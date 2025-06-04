import { geelarkApi } from '@/lib/geelark-api'

// GeeLark phone status codes according to documentation
export enum GeeLarkPhoneStatus {
  STARTED = 0,    // Phone is running
  STARTING = 1,   // Phone is starting
  SHUTDOWN = 2,   // Phone is shut down
  EXPIRED = 3     // Phone has expired
}

export interface PhoneStatusResult {
  isReady: boolean
  status: GeeLarkPhoneStatus | null
  error?: string
}

/**
 * Wait for a phone to reach the "Started" (ready) state
 * Based on GeeLark documentation: Status 0 means "Started"
 * 
 * @param profileId - The GeeLark profile/phone ID
 * @param options - Configuration options
 * @returns Promise that resolves when phone is ready or rejects on timeout/error
 */
export async function waitForPhoneReady(
  profileId: string,
  options: {
    maxAttempts?: number      // Maximum number of status checks (default: 60)
    pollInterval?: number     // Milliseconds between checks (default: 2000)
    stabilizationDelay?: number // Milliseconds to wait after phone is ready (default: 5000)
    logProgress?: boolean     // Whether to log progress (default: true)
    logPrefix?: string        // Prefix for log messages (default: '')
  } = {}
): Promise<void> {
  const {
    maxAttempts = 60,
    pollInterval = 2000,
    stabilizationDelay = 5000,
    logProgress = true,
    logPrefix = ''
  } = options

  const startTime = Date.now()
  let attempts = 0
  let lastStatus: GeeLarkPhoneStatus | null = null

  if (logProgress) {
    console.log(`${logPrefix}Waiting for phone ${profileId} to be ready...`)
  }

  while (attempts < maxAttempts) {
    attempts++
    
    try {
      const statusResponse = await geelarkApi.getPhoneStatus([profileId])
      
      // Check for successful response
      if (statusResponse.successDetails && statusResponse.successDetails.length > 0) {
        const phoneStatus = statusResponse.successDetails[0].status as GeeLarkPhoneStatus
        
        // Log status changes
        if (logProgress && phoneStatus !== lastStatus) {
          const statusName = getStatusName(phoneStatus)
          console.log(`${logPrefix}Phone ${profileId} status: ${statusName} (${phoneStatus})`)
          lastStatus = phoneStatus
        }
        
        // Check if phone is ready (status 0)
        if (phoneStatus === GeeLarkPhoneStatus.STARTED) {
          const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
          
          if (logProgress) {
            console.log(`${logPrefix}Phone ${profileId} is ready! (took ${elapsedSeconds} seconds, ${attempts} checks)`)
          }
          
          // Wait for stabilization
          if (stabilizationDelay > 0) {
            if (logProgress) {
              console.log(`${logPrefix}Waiting ${stabilizationDelay}ms for phone to stabilize...`)
            }
            await new Promise(resolve => setTimeout(resolve, stabilizationDelay))
          }
          
          return
        }
        
        // Check for terminal states
        if (phoneStatus === GeeLarkPhoneStatus.EXPIRED) {
          throw new Error(`Phone ${profileId} has expired`)
        }
        
        // Log progress periodically
        if (logProgress && attempts % 10 === 1 && attempts > 1) {
          const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
          console.log(`${logPrefix}Still waiting for phone ${profileId}... (${elapsedSeconds}s elapsed)`)
        }
        
      } else if (statusResponse.failDetails && statusResponse.failDetails.length > 0) {
        // Handle failure response
        const failDetail = statusResponse.failDetails[0]
        const errorMsg = `Phone status check failed: ${failDetail.msg} (code: ${failDetail.code})`
        
        if (logProgress) {
          console.error(`${logPrefix}${errorMsg}`)
        }
        
        // Code 42001 means phone doesn't exist - this is terminal
        if (failDetail.code === 42001) {
          throw new Error(errorMsg)
        }
        
        // For other errors, continue retrying
      }
      
    } catch (error) {
      // Only log API errors, not our own thrown errors
      if (error instanceof Error && !error.message.includes('Phone status check failed')) {
        if (logProgress) {
          console.error(`${logPrefix}Error checking phone status:`, error.message)
        }
      } else if (error instanceof Error) {
        // Re-throw our own errors
        throw error
      }
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }
  
  // Timeout reached
  const timeoutSeconds = (maxAttempts * pollInterval) / 1000
  throw new Error(`Phone ${profileId} did not start within ${timeoutSeconds} seconds`)
}

/**
 * Check the current status of a phone without waiting
 * 
 * @param profileId - The GeeLark profile/phone ID
 * @returns Current phone status
 */
export async function checkPhoneStatus(profileId: string): Promise<PhoneStatusResult> {
  try {
    const statusResponse = await geelarkApi.getPhoneStatus([profileId])
    
    if (statusResponse.successDetails && statusResponse.successDetails.length > 0) {
      const phoneStatus = statusResponse.successDetails[0].status as GeeLarkPhoneStatus
      return {
        isReady: phoneStatus === GeeLarkPhoneStatus.STARTED,
        status: phoneStatus
      }
    } else if (statusResponse.failDetails && statusResponse.failDetails.length > 0) {
      const failDetail = statusResponse.failDetails[0]
      return {
        isReady: false,
        status: null,
        error: `${failDetail.msg} (code: ${failDetail.code})`
      }
    }
    
    return {
      isReady: false,
      status: null,
      error: 'No status information returned'
    }
  } catch (error) {
    return {
      isReady: false,
      status: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Get human-readable name for phone status
 */
export function getStatusName(status: GeeLarkPhoneStatus): string {
  switch (status) {
    case GeeLarkPhoneStatus.STARTED:
      return 'Started'
    case GeeLarkPhoneStatus.STARTING:
      return 'Starting'
    case GeeLarkPhoneStatus.SHUTDOWN:
      return 'Shut down'
    case GeeLarkPhoneStatus.EXPIRED:
      return 'Expired'
    default:
      return `Unknown (${status})`
  }
}