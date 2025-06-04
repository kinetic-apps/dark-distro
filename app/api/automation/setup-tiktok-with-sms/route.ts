import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { customAlphabet } from 'nanoid'
import { TIKTOK_AUTOMATION_PASSWORD, TIKTOK_USERNAME_PREFIX, TIKTOK_USERNAME_LENGTH } from '@/lib/constants/auth'
import { ParallelBatchProcessor } from '@/lib/services/parallel-batch-processor'
import { waitForPhoneReady } from '@/lib/utils/geelark-phone-status'
import { waitForSetupCompletionAndShutdown } from '@/lib/utils/auto-stop-monitor'

// Set maximum duration to 800 seconds (13.3 minutes) for Vercel Pro plan
// This is the maximum allowed for serverless functions on Pro plan
export const maxDuration = 800

interface SetupOptions {
  // Profile configuration
  use_existing_profile?: boolean
  existing_profile_id?: string
  
  // New profile options (if not using existing)
  device_model?: string
  android_version?: number
  group_name?: string
  tags?: string[]
  remark?: string
  region?: string
  
  // SMS rental configuration
  long_term_rental?: boolean  // Whether to use long-term rental for DaisySMS
  
  // RPA configuration
  task_flow_id?: string  // Custom task flow ID for phone login
  
  // Warmup removed from SMS setup - not needed
  
  // Batch creation
  quantity?: number  // Number of phones to create (1-100)
}

interface SetupResult {
  success: boolean
  account_id?: string
  profile_id?: string
  profile_name?: string
  phone_number?: string
  rental_id?: string
  // Batch results
  batch_results?: {
    total_requested: number
    successful_setups: number
    failed_setups: number
    account_ids: string[]
    profile_ids: string[]
    details: {
      account_id?: string
      profile_id?: string
      profile_name?: string
      phone_number?: string
      rental_id?: string
      success: boolean
      error?: string
    }[]
  }
  tasks: {
    step: string
    status: 'success' | 'failed' | 'skipped'
    message: string
    task_id?: string
    error?: string
  }[]
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const result: SetupResult = {
    success: false,
    tasks: []
  }

  try {
    const body = await request.json()
    const options: SetupOptions = {
      use_existing_profile: body.use_existing_profile || false,
      existing_profile_id: body.existing_profile_id,
      device_model: body.device_model || 'Pixel 6',
      android_version: body.android_version || 3, // Android 12
      group_name: body.group_name || 'tiktok-sms-setup',
      tags: body.tags || ['auto-setup', 'daisysms'],
      remark: body.remark || 'Automated TikTok setup with SMS',
      region: body.region || 'us',
      long_term_rental: body.long_term_rental || false,
      task_flow_id: body.task_flow_id,
      quantity: Math.max(1, Math.min(100, body.quantity || 1)) // Clamp between 1-100
    }

    // Initialize setup tracking
    let accountId: string | undefined
    
    // Handle batch creation if quantity > 1
    if (options.quantity && options.quantity > 1) {
      return await handleBatchSetup(options, result, startTime)
    }
    
    // Step 1: Create or use existing profile (single setup)
    if (options.use_existing_profile && options.existing_profile_id) {
      // Use existing profile
      const { data: existingProfile } = await supabaseAdmin
        .from('phones')
        .select('*, accounts(*)')
        .eq('profile_id', options.existing_profile_id)
        .single()

      if (!existingProfile) {
        throw new Error('Existing profile not found')
      }

      result.profile_id = existingProfile.profile_id
      result.profile_name = existingProfile.profile_name
      result.account_id = existingProfile.accounts?.[0]?.id
      accountId = result.account_id

      result.tasks.push({
        step: 'Use Existing Profile',
        status: 'success',
        message: `Using existing profile: ${existingProfile.profile_name}`
      })
    } else {
      // Create new profile
      try {
        // Update status to creating_profile
        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'automation-tiktok-sms',
          message: 'Starting profile creation',
          meta: { step: 'create_profile' }
        })

        // Prepare profile creation parameters
        const profileParams: any = {
          android_version: options.android_version,
          group_name: options.group_name,
          tags: options.tags,
          remark: options.remark,
          surface_brand: options.device_model?.includes('Pixel') ? 'Google' : 'samsung',
          surface_model: options.device_model,
          region: options.region,
          charge_mode: 0, // Pay per minute
          language: 'default'
        }

        // Get available GeeLark proxies for retry logic
        let availableProxies: any[] = []
        try {
          const geelarkProxiesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/list-proxies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
          
          if (geelarkProxiesResponse.ok) {
            const geelarkData = await geelarkProxiesResponse.json()
            if (geelarkData.proxies && geelarkData.proxies.length > 0) {
              availableProxies = geelarkData.proxies
              console.log(`Found ${availableProxies.length} available GeeLark proxies`)
            } else {
              console.warn('No GeeLark proxies available')
            }
          }
        } catch (proxyError) {
          console.error('Error fetching GeeLark proxies:', proxyError)
        }

        // Try to create profile with retry logic for proxy failures
        let profileData: any = null
        let lastError: any = null
        const maxRetries = Math.min(3, availableProxies.length)
        const triedProxies = new Set<string>()
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            // Select a proxy that hasn't been tried yet
            if (availableProxies.length > 0 && attempt < availableProxies.length) {
              const untried = availableProxies.filter(p => !triedProxies.has(p.id))
              if (untried.length > 0) {
                const randomIndex = Math.floor(Math.random() * untried.length)
                const selectedProxy = untried[randomIndex]
                profileParams.proxy_id = selectedProxy.id
                triedProxies.add(selectedProxy.id)
                console.log(`Attempt ${attempt + 1}: Using GeeLark proxy ${selectedProxy.id}`)
              } else if (attempt === 0) {
                // First attempt with no untried proxies
                console.log('No proxies available, attempting without proxy')
                delete profileParams.proxy_id
              }
            } else if (attempt === 0) {
              console.log('No proxies available, attempting without proxy')
            }

            const createProfileResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/create-profile`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(profileParams)
            })

            profileData = await createProfileResponse.json()
            
            if (createProfileResponse.ok) {
              console.log('Profile created successfully')
              break // Success, exit retry loop
            }
            
            // Check if it's a proxy-related error
            const errorMessage = profileData.error || ''
            const isProxyError = errorMessage.includes('proxy') || 
                               errorMessage.includes('45003') || // Proxy banned
                               errorMessage.includes('45004') || // Proxy verification failed
                               errorMessage.includes('45001')    // Proxy does not exist
            
            if (isProxyError && attempt < maxRetries) {
              console.warn(`Proxy error on attempt ${attempt + 1}: ${errorMessage}`)
              lastError = new Error(errorMessage)
              // Continue to next attempt with different proxy
            } else {
              // Non-proxy error or final attempt, throw immediately
              throw new Error(errorMessage || `Failed to create profile: ${createProfileResponse.status}`)
            }
          } catch (error) {
            lastError = error
            if (attempt === maxRetries) {
              throw error // Final attempt failed
            }
            // For non-final attempts, only continue if it's a proxy error
            const errorMsg = error instanceof Error ? error.message : String(error)
            if (!errorMsg.includes('proxy') && !errorMsg.includes('4500')) {
              throw error // Non-proxy error, don't retry
            }
          }
        }
        
        if (!profileData || !profileData.success) {
          throw lastError || new Error('Failed to create profile after all retries')
        }

        result.account_id = profileData.account_id
        result.profile_id = profileData.profile_id
        result.profile_name = profileData.profile_name
        accountId = result.account_id

        // Update account with setup tracking
        await supabaseAdmin
          .from('accounts')
          .update({
            status: 'creating_profile',
            setup_started_at: new Date().toISOString(),
            current_setup_step: 'Create Profile',
            setup_progress: 20,
            updated_at: new Date().toISOString()
          })
          .eq('id', accountId)

        // No database proxy assignment needed - using GeeLark proxies only

        result.tasks.push({
          step: 'Create Profile',
          status: 'success',
          message: `Profile created: ${profileData.profile_name} (${profileData.profile_id})`
        })

        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'automation-tiktok-sms',
          message: 'Profile created successfully',
          meta: { 
            account_id: result.account_id,
            profile_id: result.profile_id,
            profile_name: result.profile_name,
            proxy_configured: !!profileParams.proxy_config || !!profileParams.proxy_id
          }
        })
      } catch (error) {
        result.tasks.push({
          step: 'Create Profile',
          status: 'failed',
          message: 'Failed to create profile',
          error: error instanceof Error ? error.message : String(error)
        })
        throw error
      }
    }

    // Step 2: Start the phone
    try {
      // Update status to starting_phone
      if (accountId) {
        await supabaseAdmin
          .from('accounts')
          .update({
            status: 'starting_phone',
            current_setup_step: 'Start Phone',
            setup_progress: 40,
            updated_at: new Date().toISOString()
          })
          .eq('id', accountId)
      }

      await geelarkApi.startPhones([result.profile_id!])
      
      result.tasks.push({
        step: 'Start Phone',
        status: 'success',
        message: 'Phone started successfully'
      })

      // Update phone record
      if (accountId) {
        await supabaseAdmin
          .from('phones')
          .update({
            phone_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('profile_id', result.profile_id)
      }

      // Wait for phone to be ready using standardized utility
      await waitForPhoneReady(result.profile_id!, {
        maxAttempts: 300, // 10 minutes max (300 * 2s)
        logProgress: true,
        logPrefix: '[SMS Setup] '
      })
    } catch (error) {
      result.tasks.push({
        step: 'Start Phone',
        status: 'failed',
        message: 'Failed to start phone',
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }

    // Step 3: Check if TikTok is installed (GeeLark handles installation automatically)
    try {
      // Update status to installing_tiktok
      if (accountId) {
        await supabaseAdmin
          .from('accounts')
          .update({
            status: 'installing_tiktok',
            current_setup_step: 'Install TikTok',
            setup_progress: 60,
            updated_at: new Date().toISOString()
          })
          .eq('id', accountId)
      }

      console.log('Checking if TikTok is installed...')
      
      // Poll to check if TikTok is installed
      let isInstalled = false
      let checkAttempts = 0
      const maxCheckAttempts = 60 // 60 attempts * 2 seconds = 2 minutes max
      
      while (!isInstalled && checkAttempts < maxCheckAttempts) {
        checkAttempts++
        try {
          isInstalled = await geelarkApi.isTikTokInstalled(result.profile_id!)
          
          if (isInstalled) {
            console.log('TikTok is installed!')
            result.tasks.push({
              step: 'Install TikTok',
              status: 'success',
              message: 'TikTok is installed and ready'
            })

            // Update phone record with TikTok installation time
            if (accountId) {
              await supabaseAdmin
                .from('phones')
                .update({
                  tiktok_installed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('profile_id', result.profile_id)
            }
          } else {
            // Log every 10 attempts (20 seconds)
            if (checkAttempts % 10 === 1) {
              console.log(`TikTok not yet installed, waiting... (${Math.floor(checkAttempts * 2 / 60)} minutes elapsed)`)
            }
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        } catch (checkError) {
          console.error('Error checking TikTok installation:', checkError)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
      
      if (!isInstalled) {
        // TikTok is not installed after waiting
        result.tasks.push({
          step: 'Install TikTok',
          status: 'failed',
          message: 'TikTok is not installed after waiting 2 minutes',
          error: 'GeeLark should handle TikTok installation automatically'
        })
        
        // Log this for debugging
        await supabaseAdmin.from('logs').insert({
          level: 'warning',
          component: 'automation-tiktok-sms',
          message: 'TikTok not installed after waiting',
          meta: {
            profile_id: result.profile_id,
            check_attempts: checkAttempts,
            wait_time_seconds: checkAttempts * 2
          }
        })
        
        // Don't throw error - continue anyway as GeeLark might install it later
      }
    } catch (error) {
      result.tasks.push({
        step: 'Install TikTok',
        status: 'failed',
        message: 'Failed to check TikTok installation',
        error: error instanceof Error ? error.message : String(error)
      })
      // Continue with setup even if check fails
    }

    // Use the tiktok task flow ID
    const TIKTOK_FLOW_ID = '568610393463722230'

    // Step 4: Create RPA task first (without phone number)
    let loginTaskId: string | undefined
    try {
      // Update status to running_geelark_task
      if (accountId) {
        await supabaseAdmin
          .from('accounts')
          .update({
            status: 'running_geelark_task',
            current_setup_step: 'Start TikTok Login',
            setup_progress: 80,
            updated_at: new Date().toISOString()
          })
          .eq('id', accountId)
      }

      // Generate a unique username for TikTok
      const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', TIKTOK_USERNAME_LENGTH)
      const username = `${TIKTOK_USERNAME_PREFIX}${nanoid()}` // e.g. spectre_a8k2df
      
      // Store username in account record for future reference
      await supabaseAdmin
        .from('accounts')
        .update({
          tiktok_username: username,
          updated_at: new Date().toISOString()
        })
        .eq('id', result.account_id)
      
      // Create a placeholder RPA task that will wait for phone number
      console.log('Creating RPA task for phone login...')
      
      // Pass accountId, username, and password to Geelark
      const loginTask = await geelarkApi.createCustomRPATask(
        result.profile_id!,
        TIKTOK_FLOW_ID,
        {
          accountId: result.account_id!,
          username: username,  // Pass the generated username
          password: TIKTOK_AUTOMATION_PASSWORD  // Pass the shared password
        },
        {
          name: `tiktok_phone_login_${Date.now()}`,
          remark: `Phone login for account ${result.account_id} with username ${username}`
        }
      )
      
      loginTaskId = loginTask.taskId
      console.log(`GeeLark task created successfully: ${loginTaskId}`)
      
      // CRITICAL: Store task ID in account FIRST (this is what auto-stop monitor reads)
      const accountUpdateResult = await supabaseAdmin
        .from('accounts')
        .update({
          status: 'running_geelark_task',
          geelark_task_id: loginTaskId,
          current_setup_step: 'Start TikTok Login',
          setup_progress: 85,
          meta: {
            setup_type: 'daisysms',
            login_method: 'phone_rpa',
            login_task_id: loginTaskId,
            task_flow_id: TIKTOK_FLOW_ID,
            username: username,
            password_type: 'shared_automation'
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', result.account_id)
        .select()
      
      if (accountUpdateResult.error) {
        console.error('CRITICAL: Failed to update account with task ID:', accountUpdateResult.error)
        await supabaseAdmin.from('logs').insert({
          level: 'error',
          component: 'automation-tiktok-sms',
          message: 'CRITICAL: Failed to update account with task ID - auto-stop will fail',
          meta: { 
            error: accountUpdateResult.error.message,
            account_id: result.account_id,
            geelark_task_id: loginTaskId
          }
        })
        throw new Error(`Failed to store task ID in account: ${accountUpdateResult.error.message}`)
      }
      
      console.log('Account updated with task ID successfully')
      
      // SECONDARY: Store task in tasks table (this is what tasks page reads)
      const taskInsertResult = await supabaseAdmin.from('tasks').insert({
        type: 'login',
        task_type: 'sms_login',
        geelark_task_id: loginTaskId,
        account_id: result.account_id,
        status: 'pending',
        setup_step: 'Start TikTok Login',
        progress: 85,
        started_at: new Date().toISOString(),
        meta: {
          profile_id: result.profile_id,
          method: 'phone_rpa',
          flow_id: TIKTOK_FLOW_ID,
          waiting_for_phone: true,
          username: username,
          has_password: true
        }
      }).select()

      if (taskInsertResult.error) {
        console.error('Failed to create task record (tasks page will be incomplete):', taskInsertResult.error)
        await supabaseAdmin.from('logs').insert({
          level: 'error',
          component: 'automation-tiktok-sms',
          message: 'Failed to create task record - tasks page will not show this task',
          meta: { 
            error: taskInsertResult.error.message,
            error_code: taskInsertResult.error.code,
            error_details: taskInsertResult.error.details,
            account_id: result.account_id,
            geelark_task_id: loginTaskId
          }
        })
        // Don't throw - account task ID is stored, auto-stop will work
      } else {
        console.log('Task record created successfully:', taskInsertResult.data?.[0]?.id)
      }
      
      result.tasks.push({
        step: 'Create RPA Task',
        status: 'success',
        message: `RPA task created, waiting to start. Task ID: ${loginTaskId}`,
        task_id: loginTaskId
      })

    } catch (error) {
      result.tasks.push({
        step: 'Create RPA Task',
        status: 'failed',
        message: 'Failed to create RPA task',
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }

    // Step 5: Rent DaisySMS number (after RPA task is running)
    let rentalId: string | undefined
    let phoneNumber: string | undefined
    
    try {
      // Update status to renting_number
      if (accountId) {
        await supabaseAdmin
          .from('accounts')
          .update({
            status: 'renting_number',
            current_setup_step: 'Rent Phone Number',
            setup_progress: 95,
            updated_at: new Date().toISOString()
          })
          .eq('id', accountId)
      }

      // Rent a number directly - DaisySMS will handle limit checking
      const rental = await daisyApi.rentNumber(result.account_id, options.long_term_rental)
      rentalId = rental.rental_id  // Use the DaisySMS rental ID, not the Supabase UUID
      phoneNumber = rental.phone
      result.rental_id = rentalId
      result.phone_number = phoneNumber

      result.tasks.push({
        step: 'Rent Phone Number',
        status: 'success',
        message: `Phone number rented: ${phoneNumber}${options.long_term_rental ? ' (Long-term rental)' : ''}`
      })

      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'automation-tiktok-sms',
        message: 'DaisySMS number rented',
        meta: { 
          account_id: result.account_id,
          rental_id: rentalId,
          phone_number: phoneNumber,
          long_term_rental: options.long_term_rental
        }
      })
      
      // Simulate what Geelark will receive when it calls our API
      try {
        const simulatedGeelarkResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/daisysms-proxy?action=get_phone_and_check_otp&account_id=${result.account_id}`
        )
        const simulatedData = await simulatedGeelarkResponse.json()
        
        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'automation-tiktok-sms',
          message: 'Simulated Geelark API response (what Geelark will receive)',
          meta: { 
            account_id: result.account_id,
            api_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/daisysms-proxy?action=get_phone_and_check_otp&account_id=${result.account_id}`,
            response_data: simulatedData,
            response_status: simulatedGeelarkResponse.status,
            note: 'This is what Geelark should see when it makes the API call'
          }
        })
      } catch (simError) {
        await supabaseAdmin.from('logs').insert({
          level: 'error',
          component: 'automation-tiktok-sms',
          message: 'Failed to simulate Geelark API call',
          meta: { 
            account_id: result.account_id,
            error: simError instanceof Error ? simError.message : String(simError)
          }
        })
      }
      
      // Update account with phone number
      await supabaseAdmin
        .from('accounts')
        .update({
          status: 'pending_verification',
          meta: {
            phone_number: phoneNumber,
            phone_number_formatted: phoneNumber!.startsWith('1') ? phoneNumber!.substring(1) : phoneNumber,
            rental_id: rentalId,
            setup_type: 'daisysms',
            login_method: 'phone_rpa',
            login_task_id: loginTaskId,
            task_flow_id: TIKTOK_FLOW_ID
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', result.account_id)
        
      // Update the task with phone number
      await supabaseAdmin
        .from('tasks')
        .update({
          status: 'running',
          meta: {
            profile_id: result.profile_id,
            phone_number: phoneNumber,
            method: 'phone_rpa',
            flow_id: TIKTOK_FLOW_ID,
            waiting_for_phone: false
          },
          updated_at: new Date().toISOString()
        })
        .eq('geelark_task_id', loginTaskId)
        
    } catch (error) {
      result.tasks.push({
        step: 'Rent Phone Number',
        status: 'failed',
        message: 'Failed to rent phone number',
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }

    // Step 6: Monitor for OTP
    try {
      result.tasks.push({
        step: 'Monitor OTP',
        status: 'success',
        message: 'OTP monitoring started. Check SMS rentals page for verification code.'
      })

      // RPA task handles OTP monitoring through proxy endpoints
      console.log('RPA task will monitor OTP through proxy endpoints')
      
      // Start background task to monitor completion and auto-stop phone
      if (result.profile_id && result.account_id) {
        waitForSetupCompletionAndShutdown(result.account_id, result.profile_id)
          .catch(error => {
            console.error('Auto-stop monitoring error:', error)
          })
      }

    } catch (error) {
      result.tasks.push({
        step: 'Monitor OTP',
        status: 'failed',
        message: 'Failed to start OTP monitoring',
        error: error instanceof Error ? error.message : String(error)
      })
    }

    // Mark setup as completed
    if (accountId) {
      await supabaseAdmin
        .from('accounts')
        .update({
          status: 'pending_verification',
          current_setup_step: 'Completed',
          setup_progress: 100,
          setup_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId)
    }

    // Calculate overall success
    const failedSteps = result.tasks.filter(t => t.status === 'failed')
    result.success = failedSteps.length === 0

    // Log completion
    const duration = Date.now() - startTime
    await supabaseAdmin.from('logs').insert({
      level: result.success ? 'info' : 'warning',
      component: 'automation-tiktok-sms',
      message: `TikTok SMS setup completed ${result.success ? 'successfully' : 'with errors'}`,
      meta: {
        account_id: result.account_id,
        profile_id: result.profile_id,
        phone_number: result.phone_number,
        rental_id: result.rental_id,
        duration_ms: duration,
        failed_steps: failedSteps.map(s => s.step)
      }
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('TikTok SMS setup error:', error)
    
    // Log the error
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'automation-tiktok-sms',
      message: 'TikTok SMS setup failed',
      meta: {
        error: error instanceof Error ? error.message : String(error),
        account_id: result.account_id,
        profile_id: result.profile_id,
        completed_steps: result.tasks.filter(t => t.status === 'success').map(t => t.step)
      }
    })

    return NextResponse.json(
      {
        ...result,
        error: error instanceof Error ? error.message : 'Setup failed'
      },
      { status: 500 }
    )
  }
}

// Handle batch creation of multiple phones with parallel processing
async function handleBatchSetup(
  options: SetupOptions,
  result: SetupResult,
  startTime: number
): Promise<NextResponse> {
  try {
    const quantity = options.quantity || 1
    
    result.tasks.push({
      step: 'Batch Creation',
      status: 'success',
      message: `Starting individual creation of ${quantity} phones with unique proxies...`
    })

    // Get available GeeLark proxies
    let availableProxies: any[] = []
    try {
      const geelarkProxiesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/list-proxies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (geelarkProxiesResponse.ok) {
        const geelarkData = await geelarkProxiesResponse.json()
        if (geelarkData.proxies && geelarkData.proxies.length > 0) {
          availableProxies = geelarkData.proxies
          console.log(`[BATCH] Found ${availableProxies.length} available GeeLark proxies`)
        } else {
          console.warn('[BATCH] No GeeLark proxies available')
        }
      }
    } catch (proxyError) {
      console.error('[BATCH] Error fetching GeeLark proxies:', proxyError)
    }

    // Prepare individual profile creation jobs
    const profileCreationJobs = []
    const usedProxies = new Set<string>()
    
    for (let i = 0; i < quantity; i++) {
      // Select a unique proxy for each profile
      let selectedProxy = null
      if (availableProxies.length > 0) {
        // Filter out already used proxies
        const unusedProxies = availableProxies.filter(p => !usedProxies.has(p.id))
        
        if (unusedProxies.length > 0) {
          // Randomly select from unused proxies
          const randomIndex = Math.floor(Math.random() * unusedProxies.length)
          selectedProxy = unusedProxies[randomIndex]
          usedProxies.add(selectedProxy.id)
        } else if (availableProxies.length > 0) {
          // All proxies used, start reusing randomly
          const randomIndex = Math.floor(Math.random() * availableProxies.length)
          selectedProxy = availableProxies[randomIndex]
        }
      }
      
      profileCreationJobs.push({
        index: i,
        proxy: selectedProxy,
        options: options
      })
    }

    console.log(`[BATCH] Created ${profileCreationJobs.length} jobs with ${usedProxies.size} unique proxies`)

    // Process profile creation sequentially with rate limiting
    const createdProfiles = []
    const failedProfiles = []
    const maxRetries = 3
    const baseDelay = 2000 // Start with 2 seconds delay
    
    for (let i = 0; i < profileCreationJobs.length; i++) {
      const job = profileCreationJobs[i]
      let retryCount = 0
      let success = false
      let lastError: any = null
      
      while (retryCount < maxRetries && !success) {
        try {
          const profileParams: any = {
            amount: 1, // Create one profile at a time
            android_version: options.android_version,
            group_name: options.group_name,
            tags: options.tags,
            remark: options.remark,
            surface_brand: options.device_model?.includes('Pixel') ? 'Google' : 'samsung',
            surface_model: options.device_model,
            region: options.region,
            charge_mode: 0,
            language: 'default'
          }

          // Add proxy if available
          if (job.proxy) {
            profileParams.proxy_id = job.proxy.id
            console.log(`[BATCH] Job ${job.index + 1}: Using proxy ${job.proxy.id}`)
          } else {
            console.log(`[BATCH] Job ${job.index + 1}: No proxy available`)
          }

          const createProfileResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/create-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileParams)
          })
          
          const profileData = await createProfileResponse.json()
          
          if (createProfileResponse.ok && profileData.success) {
            console.log(`[BATCH] Job ${job.index + 1}: Profile created successfully`)
            createdProfiles.push({
              success: true,
              profileData: profileData,
              jobIndex: job.index,
              proxy: job.proxy
            })
            success = true
          } else {
            // Check if it's a rate limit error
            if (profileData.error?.includes('40007') || profileData.error?.includes('too many requests')) {
              retryCount++
              if (retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount - 1) // Exponential backoff
                console.log(`[BATCH] Job ${job.index + 1}: Rate limited, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`)
                await new Promise(resolve => setTimeout(resolve, delay))
                continue
              }
            }
            
            lastError = profileData.error || 'Unknown error'
            console.error(`[BATCH] Job ${job.index + 1}: Failed - ${lastError}`)
            break
          }
        } catch (error) {
          retryCount++
          lastError = error instanceof Error ? error.message : String(error)
          
          if (retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount - 1)
            console.log(`[BATCH] Job ${job.index + 1}: Exception, retrying in ${delay}ms - ${lastError}`)
            await new Promise(resolve => setTimeout(resolve, delay))
          } else {
            console.error(`[BATCH] Job ${job.index + 1}: Exception after ${maxRetries} attempts - ${lastError}`)
          }
        }
      }
      
      if (!success) {
        failedProfiles.push({
          success: false,
          error: lastError,
          jobIndex: job.index
        })
      }
      
      // Add delay between profile creations to avoid rate limiting
      if (i < profileCreationJobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500)) // 1.5 second delay between profiles
      }
    }

    console.log(`[BATCH] Profile creation completed: ${createdProfiles.length} successful, ${failedProfiles.length} failed`)
    
    if (createdProfiles.length === 0) {
      throw new Error('Failed to create any profiles')
    }

    // Process batch results
    const batchResults = {
      total_requested: quantity,
      successful_setups: 0,
      failed_setups: 0,
      account_ids: [] as string[],
      profile_ids: [] as string[],
      details: [] as any[]
    }

    // Process each created profile
    for (const profileResult of createdProfiles) {
      const profileData = profileResult.profileData
      
      console.log(`[BATCH] Processing created profile: ${profileData.profile_id}`)
      
      // The profile was already created in our database by the create-profile endpoint
      // Just add to our results
      batchResults.account_ids.push(profileData.account_id)
      batchResults.profile_ids.push(profileData.profile_id)
      batchResults.details.push({
        account_id: profileData.account_id,
        profile_id: profileData.profile_id,
        profile_name: profileData.profile_name,
        success: true,
        proxy: profileResult.proxy ? {
          id: profileResult.proxy.id,
          label: profileResult.proxy.label || `GeeLark Proxy ${profileResult.proxy.id}`
        } : null
      })
    }

    // Add failed profiles to results
    for (const failedProfile of failedProfiles) {
      batchResults.details.push({
        success: false,
        error: failedProfile.error,
        job_index: failedProfile.jobIndex
      })
    }
      
    // Prepare jobs for parallel processing
    const jobs = batchResults.details
      .filter(detail => detail.success && detail.account_id && detail.profile_id)
      .map((detail, index) => ({
        profileId: detail.profile_id,
        accountId: detail.account_id,
        profileName: detail.profile_name,
        batchId: `batch_${startTime}_${Math.random().toString(36).substr(2, 9)}`,
        index: index,
        total: batchResults.details.filter(d => d.success).length
      }))
    
    console.log(`[BATCH] Finished creating profiles. Starting parallel setup for ${jobs.length} phones`)
    
    // Create parallel processor - no need to limit concurrent phone setups
    const processor = new ParallelBatchProcessor(options, 20) // Back to 20 concurrent - the setup process can handle many phones at once
    const parallelResults = await processor.processBatch(jobs)
    
    // Update batch results with parallel processing results
    batchResults.successful_setups = parallelResults.successful
    batchResults.failed_setups = parallelResults.failed + failedProfiles.length
    
    // Update details with setup results
    parallelResults.results.forEach((result, index) => {
      const detail = batchResults.details.find(d => d.profile_id === result.profileId)
      if (detail) {
        detail.setup_success = result.success
        detail.setup_error = result.error
        detail.rental_id = result.rentalId
        detail.phone_number = result.phoneNumber
        detail.setup_duration = result.duration
      }
    })
    
    console.log(`[BATCH] Parallel processing completed: ${parallelResults.successful} successful, ${parallelResults.failed} failed`)
    
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'automation-tiktok-sms-batch',
      message: 'Individual profile creation with parallel setup completed',
      meta: {
        batch_id: parallelResults.batchId,
        total_requested: quantity,
        profiles_created: createdProfiles.length,
        profiles_failed_creation: failedProfiles.length,
        setups_successful: parallelResults.successful,
        setups_failed: parallelResults.failed,
        unique_proxies_used: usedProxies.size,
        execution_mode: 'individual_parallel',
        max_concurrent: 5,
        duration_seconds: Math.round((Date.now() - startTime) / 1000)
      }
    })

    result.batch_results = batchResults
    result.success = batchResults.successful_setups > 0
    
    if (batchResults.successful_setups > 0) {
      result.tasks.push({
        step: 'Batch Creation',
        status: 'success',
        message: `Successfully created ${batchResults.successful_setups}/${quantity} phones. Individual setups running in background.`
      })
    }

    if (batchResults.failed_setups > 0) {
      result.tasks.push({
        step: 'Batch Creation',
        status: 'failed',
        message: `Failed to create ${batchResults.failed_setups}/${quantity} phones.`
      })
    }

    // Log batch completion
    const duration = Date.now() - startTime
    await supabaseAdmin.from('logs').insert({
      level: result.success ? 'info' : 'warning',
      component: 'automation-tiktok-sms-batch',
      message: `Batch SMS setup initiated for ${quantity} phones`,
      meta: {
        requested_quantity: quantity,
        successful_setups: batchResults.successful_setups,
        failed_setups: batchResults.failed_setups,
        duration_ms: duration,
        account_ids: batchResults.account_ids,
        profile_ids: batchResults.profile_ids
      }
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Batch SMS setup error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'automation-tiktok-sms-batch',
      message: 'Batch SMS setup failed',
      meta: {
        error: error instanceof Error ? error.message : String(error),
        requested_quantity: options.quantity
      }
    })

    return NextResponse.json(
      {
        ...result,
        error: error instanceof Error ? error.message : 'Batch setup failed'
      },
      { status: 500 }
    )
  }
}


// Helper functions for individual setup

async function waitForTikTokInstallation(profileId: string): Promise<void> {
  let attempts = 0
  const maxAttempts = 60
  
  while (attempts < maxAttempts) {
    try {
      const isInstalled = await geelarkApi.isTikTokInstalled(profileId)
      if (isInstalled) {
        return
      }
    } catch (error) {
      console.error('Error checking TikTok installation:', error)
    }
    
    attempts++
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  // Don't throw error, continue anyway
  console.warn(`TikTok not confirmed installed for ${profileId}`)
}

async function waitForTaskToStart(taskId: string, isBatchOperation: boolean = false): Promise<void> {
  let attempts = 0
  // For batch operations, wait up to 30 minutes. For single operations, 10 minutes.
  const maxAttempts = isBatchOperation ? 900 : 300  // 900 * 2s = 30 min, 300 * 2s = 10 min
  const operationType = isBatchOperation ? 'batch' : 'single'
  
  console.log(`[TASK_WAIT] Waiting for task ${taskId} to start (${operationType} operation, max wait: ${maxAttempts * 2}s)`)
  
  while (attempts < maxAttempts) {
    try {
      const taskStatus = await geelarkApi.getTaskStatus(taskId)
      
      // Log progress every 30 seconds
      if (attempts > 0 && attempts % 15 === 0) {
        const elapsedMinutes = Math.floor(attempts * 2 / 60)
        console.log(`[TASK_WAIT] Still waiting for task ${taskId} to start (${elapsedMinutes} minutes elapsed)`)
      }
      
      if (taskStatus.status === 'running' || taskStatus.result?.status === 2) {
        console.log(`[TASK_WAIT] Task ${taskId} started successfully after ${attempts * 2} seconds`)
        return
      }
      if (taskStatus.status === 'failed' || taskStatus.result?.status === 4) {
        throw new Error(`Task failed to start: ${taskStatus.result?.failDesc}`)
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('failed to start')) {
        throw error
      }
      console.error('Error checking task status:', error)
    }
    
    attempts++
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  // If batch operation, log as warning instead of error
  const timeoutMessage = `Task ${taskId} did not start within ${maxAttempts * 2} seconds (${operationType} operation)`
  
  if (isBatchOperation) {
    console.warn(`[TASK_WAIT] ${timeoutMessage}`)
    await supabaseAdmin.from('logs').insert({
      level: 'warning',
      component: 'automation-tiktok-sms-batch',
      message: 'Task start timeout in batch operation',
      meta: { 
        task_id: taskId,
        timeout_seconds: maxAttempts * 2,
        operation_type: operationType,
        note: 'This is expected in sequential batch operations where GeeLark may take longer to process'
      }
    })
  }
  
  throw new Error(timeoutMessage)
}


