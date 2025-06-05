import { supabaseAdmin } from '@/lib/supabase/admin'
import { geelarkApi } from '@/lib/geelark-api'
import { daisyApi } from '@/lib/daisy-api'
import { processInParallel, retryWithBackoff } from '@/lib/utils/concurrency-limiter'
import { customAlphabet } from 'nanoid'
import { TIKTOK_AUTOMATION_PASSWORD, TIKTOK_USERNAME_PREFIX, TIKTOK_USERNAME_LENGTH } from '@/lib/constants/auth'
import { waitForPhoneReady } from '@/lib/utils/geelark-phone-status'
import { waitForSetupCompletionAndShutdown } from '@/lib/utils/auto-stop-monitor'

interface PhoneSetupJob {
  profileId: string
  accountId: string
  profileName: string
  batchId: string
  index: number
  total: number
}

interface PhoneSetupResult {
  profileId: string
  accountId: string
  success: boolean
  error?: string
  rentalId?: string
  phoneNumber?: string
  loginTaskId?: string
  duration?: number
}

export class ParallelBatchProcessor {
  private maxConcurrent: number
  private batchId: string
  private options: any

  constructor(options: any, maxConcurrent: number = 5) {
    this.options = options
    this.maxConcurrent = maxConcurrent
    this.batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async processBatch(jobs: PhoneSetupJob[]): Promise<{
    batchId: string
    totalRequested: number
    successful: number
    failed: number
    results: PhoneSetupResult[]
  }> {
    // Removed: console.log(`[PARALLEL] Starting batch ${this.batchId} with ${jobs.length} phones, max concurrent: ${this.maxConcurrent}`)
    
    // Mark all jobs as part of this batch
    await this.markBatchJobs(jobs)
    
    // Process jobs in parallel with concurrency limit
    const results = await processInParallel(
      jobs,
      async (job) => this.processPhone(job),
      this.maxConcurrent
    )
    
    // Aggregate results
    const processedResults: PhoneSetupResult[] = results.map((r, index) => {
      if (r.error) {
        return {
          profileId: jobs[index].profileId,
          accountId: jobs[index].accountId,
          success: false,
          error: r.error.message
        }
      }
      return r.result!
    })
    
    const successful = processedResults.filter(r => r.success).length
    const failed = processedResults.filter(r => !r.success).length
    
    // Log batch completion
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'parallel-batch-processor',
      message: 'Batch processing completed',
      meta: {
        batch_id: this.batchId,
        total_requested: jobs.length,
        successful,
        failed,
        duration_seconds: Math.round((Date.now() - parseInt(this.batchId.split('_')[1])) / 1000)
      }
    })
    
    return {
      batchId: this.batchId,
      totalRequested: jobs.length,
      successful,
      failed,
      results: processedResults
    }
  }

  private async markBatchJobs(jobs: PhoneSetupJob[]): Promise<void> {
    // Update all accounts with batch metadata
    const updatePromises = jobs.map((job, index) => 
      supabaseAdmin
        .from('accounts')
        .update({
          meta: {
            batch_id: this.batchId,
            batch_index: index + 1,
            batch_total: jobs.length,
            batch_status: 'queued',
            batch_queued_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', job.accountId)
    )
    
    await Promise.all(updatePromises)
  }

  private async processPhone(job: PhoneSetupJob): Promise<PhoneSetupResult> {
    const startTime = Date.now()
    const { profileId, accountId, profileName, index, total } = job
    
    // Removed: console.log(`[PARALLEL] Starting phone ${index + 1}/${total} (${profileId})`)
    
    try {
      // Update status to processing
      await this.updateBatchStatus(accountId, 'processing')
      
      // Step 1: Start the phone
      await this.startPhone(profileId, accountId)
      
      // Step 2: Wait for phone to be ready
      await waitForPhoneReady(profileId, {
        logProgress: true,
        logPrefix: '[PARALLEL] '
      })
      
      // Step 3: Ensure TikTok is installed
      await this.ensureTikTokInstalled(profileId, accountId)
      
      // Step 4: Create RPA task for login
      const { loginTaskId, username } = await this.createLoginTask(profileId, accountId)
      
      // Step 5: Wait for task to start
      await this.waitForTaskToStart(loginTaskId)
      
      // Step 6: Rent SMS number (with retry)
      const { rentalId, phoneNumber } = await this.rentPhoneNumber(accountId)
      
      // Step 7: Update account with phone number
      await this.updateAccountWithPhone(accountId, phoneNumber, rentalId, loginTaskId, username)
      
      // Step 8: RPA task handles OTP monitoring through proxy endpoints
      // Removed: console.log(`[PARALLEL] RPA task will monitor OTP for account ${accountId} through proxy endpoints`)
      
      // Start background auto-stop monitoring
      this.startAutoStopMonitoring(accountId, profileId)
      
      const duration = Math.round((Date.now() - startTime) / 1000)
      
      // Removed: console.log(`[PARALLEL] Phone ${index + 1}/${total} setup completed in ${duration}s`)
      
      await this.updateBatchStatus(accountId, 'completed')
      
      return {
        profileId,
        accountId,
        success: true,
        rentalId,
        phoneNumber,
        loginTaskId,
        duration
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      // Keep this error log as it's important
      console.error(`[PARALLEL] Phone ${index + 1}/${total} failed: ${errorMessage}`)
      
      await this.updateBatchStatus(accountId, 'failed', errorMessage)
      
      return {
        profileId,
        accountId,
        success: false,
        error: errorMessage,
        duration: Math.round((Date.now() - startTime) / 1000)
      }
    }
  }

  private async updateBatchStatus(accountId: string, status: string, error?: string): Promise<void> {
    const updates: any = {
      batch_status: status,
      batch_updated_at: new Date().toISOString()
    }
    
    if (error) {
      updates.batch_error = error
    }
    
    await supabaseAdmin
      .from('accounts')
      .update({
        meta: updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)
  }

  private async startPhone(profileId: string, accountId: string): Promise<void> {
    // Removed: console.log(`[PARALLEL] Starting phone ${profileId}`)
    
    await supabaseAdmin
      .from('accounts')
      .update({
        status: 'starting_phone',
        current_setup_step: 'Start Phone',
        setup_progress: 20,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)
    
    await geelarkApi.startPhones([profileId])
    
    await supabaseAdmin
      .from('phones')
      .update({
        phone_started_at: new Date().toISOString(),
        status: 'starting',
        updated_at: new Date().toISOString()
      })
      .eq('profile_id', profileId)
  }


  private async ensureTikTokInstalled(profileId: string, accountId: string): Promise<void> {
    // Removed: console.log(`[PARALLEL] Checking TikTok installation for ${profileId}`)
    
    await supabaseAdmin
      .from('accounts')
      .update({
        status: 'installing_tiktok',
        current_setup_step: 'Install TikTok',
        setup_progress: 40,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)
    
    // Check if installed (but don't wait too long)
    const maxAttempts = 30
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const isInstalled = await geelarkApi.isTikTokInstalled(profileId)
        if (isInstalled) {
          // Removed: console.log(`[PARALLEL] TikTok confirmed installed on ${profileId}`)
          return
        }
      } catch (error) {
        // Removed: console.error(`Error checking TikTok installation: ${error}`)
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    // Removed: console.warn(`[PARALLEL] TikTok installation not confirmed for ${profileId}, continuing anyway`)
  }

  private async createLoginTask(profileId: string, accountId: string): Promise<{ loginTaskId: string, username: string }> {
    // Removed: console.log(`[PARALLEL] Creating RPA login task for ${profileId}`)
    
    const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', TIKTOK_USERNAME_LENGTH)
    const username = `${TIKTOK_USERNAME_PREFIX}${nanoid()}`
    
    await supabaseAdmin
      .from('accounts')
      .update({
        tiktok_username: username,
        status: 'running_geelark_task',
        current_setup_step: 'Start TikTok Login',
        setup_progress: 60,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)
    
    const TIKTOK_FLOW_ID = '568610393463722230'
    const loginTask = await geelarkApi.createCustomRPATask(
      profileId,
      TIKTOK_FLOW_ID,
      {
        accountId: accountId,
        username: username,
        password: TIKTOK_AUTOMATION_PASSWORD
      },
      {
        name: `tiktok_phone_login_${Date.now()}`,
        remark: `Parallel batch login for account ${accountId}`
      }
    )
    
    // Store task in database
    await supabaseAdmin.from('tasks').insert({
      type: 'login',
      task_type: 'sms_login',
      geelark_task_id: loginTask.taskId,
      account_id: accountId,
      status: 'pending',
      setup_step: 'Start TikTok Login',
      progress: 60,
      started_at: new Date().toISOString(),
      meta: {
        profile_id: profileId,
        method: 'phone_rpa',
        flow_id: TIKTOK_FLOW_ID,
        username: username,
        batch_id: this.batchId
      }
    })
    
    return { loginTaskId: loginTask.taskId, username }
  }

  private async waitForTaskToStart(taskId: string): Promise<void> {
    // Removed: console.log(`[PARALLEL] Waiting for task ${taskId} to start`)
    
    const maxAttempts = 150 // 5 minutes for parallel operations
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const taskStatus = await geelarkApi.getTaskStatus(taskId)
        if (taskStatus.status === 'running' || taskStatus.result?.status === 2) {
          // Removed: console.log(`[PARALLEL] Task ${taskId} started`)
          return
        }
        if (taskStatus.status === 'failed' || taskStatus.result?.status === 4) {
          throw new Error(`Task failed to start: ${taskStatus.result?.failDesc}`)
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('failed to start')) {
          throw error
        }
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    throw new Error(`Task ${taskId} did not start within ${maxAttempts * 2} seconds`)
  }

  private async rentPhoneNumber(accountId: string): Promise<{ rentalId: string, phoneNumber: string }> {
    // Removed: console.log(`[PARALLEL] Renting phone number for account ${accountId}`)
    
    // Retry logic for DaisySMS API errors (they will tell us if we hit limits)
    return retryWithBackoff(async () => {
      const rental = await daisyApi.rentNumber(accountId, this.options.long_term_rental)
      
      // Removed: console.log(`[PARALLEL] Rented number ${rental.phone} for account ${accountId}`)
      
      return {
        rentalId: rental.rental_id,
        phoneNumber: rental.phone
      }
    }, 5, 2000, 30000) // 5 retries, starting at 2s, max 30s delay
  }

  private async updateAccountWithPhone(
    accountId: string,
    phoneNumber: string,
    rentalId: string,
    loginTaskId: string,
    username: string
  ): Promise<void> {
    await supabaseAdmin
      .from('accounts')
      .update({
        status: 'pending_verification',
        current_setup_step: 'Waiting for OTP',
        setup_progress: 80,
        meta: {
          phone_number: phoneNumber,
          phone_number_formatted: phoneNumber.startsWith('1') ? phoneNumber.substring(1) : phoneNumber,
          rental_id: rentalId,
          setup_type: 'daisysms',
          login_method: 'phone_rpa',
          login_task_id: loginTaskId,
          username: username,
          batch_id: this.batchId,
          batch_parallel: true
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)
  }
  
  private startAutoStopMonitoring(accountId: string, profileId: string): void {
    // Start background monitoring without blocking
    waitForSetupCompletionAndShutdown(accountId, profileId)
      .catch(error => {
        // Keep this error log as it's important
        console.error(`[PARALLEL] Auto-stop monitoring error for ${accountId}:`, error)
      })
  }
}