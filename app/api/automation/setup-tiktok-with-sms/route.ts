import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { customAlphabet } from 'nanoid'
import { TIKTOK_AUTOMATION_PASSWORD, TIKTOK_USERNAME_PREFIX, TIKTOK_USERNAME_LENGTH } from '@/lib/constants/auth'

interface SetupOptions {
  // Profile configuration
  use_existing_profile?: boolean
  existing_profile_id?: string
  
  // New profile options (if not using existing)
  device_model?: string
  android_version?: number
  proxy_id?: string  // GeeLark proxy ID
  database_proxy_id?: string  // Database proxy ID
  proxy_config?: any  // Manual proxy configuration
  assign_proxy?: boolean  // Auto-assign proxy
  proxy_type?: string  // Proxy type preference for auto-assign
  group_name?: string
  tags?: string[]
  remark?: string
  region?: string
  
  // SMS rental configuration
  long_term_rental?: boolean  // Whether to use long-term rental for DaisySMS
  
  // RPA configuration
  task_flow_id?: string  // Custom task flow ID for phone login
  
  // Warmup configuration
  warmup_duration_minutes?: number
  warmup_action?: 'browse video' | 'search video' | 'search profile'
  warmup_keywords?: string[]
}

interface SetupResult {
  success: boolean
  account_id?: string
  profile_id?: string
  profile_name?: string
  phone_number?: string
  rental_id?: string
  warmup_task_id?: string
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
      proxy_id: body.proxy_id,
      database_proxy_id: body.database_proxy_id,
      proxy_config: body.proxy_config,
      assign_proxy: body.assign_proxy,
      proxy_type: body.proxy_type,
      group_name: body.group_name || 'tiktok-sms-setup',
      tags: body.tags || ['auto-setup', 'daisysms'],
      remark: body.remark || 'Automated TikTok setup with SMS',
      region: body.region || 'us',
      long_term_rental: body.long_term_rental || false,
      task_flow_id: body.task_flow_id,
      warmup_duration_minutes: body.warmup_duration_minutes || 30,
      warmup_action: body.warmup_action || 'browse video',
      warmup_keywords: body.warmup_keywords
    }

    // Step 1: Create or use existing profile
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

      result.tasks.push({
        step: 'Use Existing Profile',
        status: 'success',
        message: `Using existing profile: ${existingProfile.profile_name}`
      })
    } else {
      // Create new profile
      try {
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

        // Handle proxy configuration
        if (options.proxy_id) {
          // GeeLark proxy ID provided
          profileParams.proxy_id = options.proxy_id
        } else if (options.database_proxy_id) {
          // Database proxy ID provided - fetch proxy details
          const { data: dbProxy } = await supabaseAdmin
            .from('proxies')
            .select('*')
            .eq('id', options.database_proxy_id)
            .single()

          if (dbProxy) {
            profileParams.proxy_config = {
              typeId: 1, // SOCKS5
              server: dbProxy.host,
              port: dbProxy.port,
              username: dbProxy.username,
              password: dbProxy.password
            }
          }
        } else if (options.proxy_config) {
          // Manual proxy configuration provided
          profileParams.proxy_config = options.proxy_config
        } else if (options.assign_proxy) {
          // Auto-assign proxy from database
          const proxyType = options.proxy_type || 'sim'
          
          // Find available proxy
          let proxyQuery = supabaseAdmin
            .from('proxies')
            .select('*')
            .is('assigned_account_id', null)
            .limit(1)

          if (proxyType !== 'auto') {
            proxyQuery = proxyQuery.eq('type', proxyType)
          }

          const { data: availableProxies } = await proxyQuery

          if (availableProxies && availableProxies.length > 0) {
            const proxy = availableProxies[0]
            profileParams.proxy_config = {
              typeId: 1, // SOCKS5
              server: proxy.host,
              port: proxy.port,
              username: proxy.username,
              password: proxy.password
            }
            
            // Store proxy ID for later assignment
            options.database_proxy_id = proxy.id
          } else {
            // No database proxies available - try to use a GeeLark proxy as fallback
            console.log('No database proxies available, checking GeeLark proxies...')
            
            try {
              const geelarkProxiesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/list-proxies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              })
              
              if (geelarkProxiesResponse.ok) {
                const geelarkData = await geelarkProxiesResponse.json()
                if (geelarkData.proxies && geelarkData.proxies.length > 0) {
                  // Use the first available GeeLark proxy
                  profileParams.proxy_id = geelarkData.proxies[0].id
                  console.log('Using GeeLark proxy as fallback:', geelarkData.proxies[0].id)
                } else {
                  throw new Error('No proxies available in database or GeeLark')
                }
              } else {
                throw new Error(`No available ${proxyType} proxies found and GeeLark proxy check failed`)
              }
            } catch (fallbackError) {
              console.error('Fallback to GeeLark proxy failed:', fallbackError)
              throw new Error(`No available ${proxyType} proxies found`)
            }
          }
        }

        const createProfileResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/create-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileParams)
        })

        const profileData = await createProfileResponse.json()
        
        if (!createProfileResponse.ok) {
          console.error('Profile creation failed:', {
            status: createProfileResponse.status,
            statusText: createProfileResponse.statusText,
            error: profileData.error,
            profileParams: profileParams
          })
          throw new Error(profileData.error || `Failed to create profile: ${createProfileResponse.status} ${createProfileResponse.statusText}`)
        }

        result.account_id = profileData.account_id
        result.profile_id = profileData.profile_id
        result.profile_name = profileData.profile_name

        // If database proxy was used, update assignment
        if (options.database_proxy_id && result.account_id) {
          await supabaseAdmin
            .from('proxies')
            .update({ assigned_account_id: result.account_id })
            .eq('id', options.database_proxy_id)

          await supabaseAdmin
            .from('accounts')
            .update({ proxy_id: options.database_proxy_id })
            .eq('id', result.account_id)
        }

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
      await geelarkApi.startPhones([result.profile_id!])
      
      result.tasks.push({
        step: 'Start Phone',
        status: 'success',
        message: 'Phone started successfully'
      })

      // Poll for phone status until it's running (no timeout)
      console.log('Waiting for phone to be fully running...')
      const startTime = Date.now()
      let phoneReady = false
      let attempts = 0
      
      while (!phoneReady) {
        attempts++
        try {
          const statusResponse = await geelarkApi.getPhoneStatus([result.profile_id!])
          if (statusResponse.successDetails && statusResponse.successDetails.length > 0) {
            const phoneStatus = statusResponse.successDetails[0].status
            // Status 0 means "Started" according to the docs
            if (phoneStatus === 0) {
              phoneReady = true
              const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
              console.log(`Phone is now running! (took ${elapsedSeconds} seconds, ${attempts} status checks)`)
              
              // Log the startup time for monitoring
              await supabaseAdmin.from('logs').insert({
                level: 'info',
                component: 'automation-tiktok-sms',
                message: 'Phone startup completed',
                meta: { 
                  profile_id: result.profile_id,
                  startup_time_seconds: elapsedSeconds,
                  status_checks: attempts
                }
              })
              
              // Add a small delay to ensure the phone is fully stable
              console.log('Waiting 5 seconds for phone to stabilize...')
              await new Promise(resolve => setTimeout(resolve, 5000))
            } else {
              // Log every 10th attempt to avoid log spam
              if (attempts % 10 === 1) {
                const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
                console.log(`Phone status: ${phoneStatus}, waiting... (${elapsedSeconds}s elapsed)`)
              }
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          }
        } catch (statusError) {
          console.error('Error checking phone status:', statusError)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
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
              step: 'Check TikTok Installation',
              status: 'success',
              message: 'TikTok is installed and ready'
            })
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
          step: 'Check TikTok Installation',
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
        step: 'Check TikTok Installation',
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
      
      result.tasks.push({
        step: 'Create RPA Task',
        status: 'success',
        message: `RPA task created, waiting to start. Task ID: ${loginTaskId}`,
        task_id: loginTaskId
      })
      
      // Store the task ID in account metadata
      await supabaseAdmin
        .from('accounts')
        .update({
          status: 'rpa_task_created',
          meta: {
            setup_type: 'daisysms',
            login_method: 'phone_rpa',
            login_task_id: loginTaskId,
            task_flow_id: TIKTOK_FLOW_ID,
            username: username,  // Also store in meta for reference
            password_type: 'shared_automation'  // Indicate this uses the shared password
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', result.account_id)
        
      // Store the login task in tasks table
      await supabaseAdmin.from('tasks').insert({
        type: 'login',
        task_type: 'login',
        geelark_task_id: loginTaskId,
        account_id: result.account_id,
        status: 'created',
        started_at: new Date().toISOString(),
        meta: {
          profile_id: result.profile_id,
          method: 'phone_rpa',
          flow_id: TIKTOK_FLOW_ID,
          waiting_for_phone: true,
          username: username,  // Store username in task meta too
          has_password: true  // Indicate password was provided
        }
      })

      // Simulate what Geelark will see when it makes the API call
      const geelarkApiUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/daisysms-proxy?action=get_phone_and_check_otp&account_id=${result.account_id}`
      
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'automation-tiktok-sms',
        message: 'Simulating Geelark API call (what Geelark will request)',
        meta: { 
          account_id: result.account_id,
          geelark_url: geelarkApiUrl,
          geelark_variable: '${accountId}',
          actual_account_id: result.account_id,
          username: username,
          has_password: true,
          note: 'Geelark will replace ${accountId} with the actual account ID, ${username} with the generated username, and ${password} with the shared password'
        }
      })

      // Wait for RPA task to actually start (status changes from 1 to 2)
      console.log('Waiting for RPA task to start...')
      let taskStarted = false
      let waitAttempts = 0
      
      while (!taskStarted) {
        waitAttempts++
        try {
          const taskStatus = await geelarkApi.getTaskStatus(loginTaskId)
          
          // Log every 10 attempts (20 seconds)
          if (waitAttempts % 10 === 1) {
            console.log(`Task status check ${waitAttempts}: ${taskStatus.status} (${Math.floor(waitAttempts * 2 / 60)} minutes elapsed)`)
          }
          
          // Status 2 means "In progress"
          if (taskStatus.status === 'running' || taskStatus.result?.status === 2) {
            taskStarted = true
            console.log(`RPA task has started! (took ${waitAttempts * 2} seconds)`)
            
            // Log the startup time
            await supabaseAdmin.from('logs').insert({
              level: 'info',
              component: 'automation-tiktok-sms',
              message: 'RPA task started successfully',
              meta: { 
                task_id: loginTaskId,
                wait_time_seconds: waitAttempts * 2,
                attempts: waitAttempts
              }
            })
            break
          }
          
          // Check if task failed
          if (taskStatus.status === 'failed' || taskStatus.result?.status === 4) {
            throw new Error(`RPA task failed to start: ${taskStatus.result?.failDesc || 'Unknown error'}`)
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000))
        } catch (error) {
          // If it's a task failure, throw immediately
          if (error instanceof Error && error.message.includes('RPA task failed')) {
            throw error
          }
          
          console.error('Error checking task status:', error)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

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
      // Check if we can rent a new number
      const canRent = await daisyApi.canRentNewNumber()
      if (!canRent) {
        throw new Error('Maximum concurrent rentals (20) reached')
      }

      // Rent a number
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

      // Start background OTP monitoring (which will also handle warmup after login)
      monitorOTP(rentalId!, result.account_id!, result.profile_id!, options)
        .catch(error => {
          console.error('OTP monitoring error:', error)
        })

    } catch (error) {
      result.tasks.push({
        step: 'Monitor OTP',
        status: 'failed',
        message: 'Failed to start OTP monitoring',
        error: error instanceof Error ? error.message : String(error)
      })
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

// Background function to monitor OTP
async function monitorOTP(
  rentalId: string,
  accountId: string,
  profileId: string,
  options: SetupOptions
) {
  console.log(`Starting OTP monitoring for DaisySMS rental ID: ${rentalId}`)
  
  // Get the account data including task flow info
  const { data: accountData } = await supabaseAdmin
    .from('accounts')
    .select('meta')
    .eq('id', accountId)
    .single()
  
  const loginTaskId = accountData?.meta?.login_task_id
  const taskFlowId = accountData?.meta?.task_flow_id || options.task_flow_id
  const phoneNumber = accountData?.meta?.phone_number
  
  // Log initial monitoring setup
  await supabaseAdmin.from('logs').insert({
    level: 'info',
    component: 'automation-tiktok-sms-monitor',
    message: 'OTP monitoring started',
    meta: { 
      rental_id: rentalId,
      account_id: accountId,
      profile_id: profileId,
      login_task_id: loginTaskId,
      task_flow_id: taskFlowId,
      check_interval: '5 seconds',
      max_duration: '20 minutes'
    }
  })
  
  const maxAttempts = 240 // Check for 20 minutes (240 * 5 seconds)
  let attempts = 0
  let loginSuccessful = false
  let warmupStarted = false
  let lastOtpCheckResult: any = null
  let lastTaskStatus: any = null

  const checkInterval = setInterval(async () => {
    try {
      attempts++
      
      // Log every 12 attempts (1 minute)
      if (attempts % 12 === 1) {
        console.log(`OTP monitoring: ${Math.floor(attempts / 12)} minutes elapsed, rental ${rentalId}`)
      }
      
      // If we have a login task ID, check its status
      if (loginTaskId && !loginSuccessful) {
        try {
          const taskStatus = await geelarkApi.getTaskStatus(loginTaskId)
          
          // Log if task status changed
          if (JSON.stringify(taskStatus) !== JSON.stringify(lastTaskStatus)) {
            console.log(`Login task status changed for ${loginTaskId}:`, taskStatus)
            lastTaskStatus = taskStatus
            
            await supabaseAdmin.from('logs').insert({
              level: 'info',
              component: 'automation-tiktok-sms-monitor',
              message: 'Login task status changed',
              meta: { 
                task_id: loginTaskId,
                status: taskStatus.status,
                result: taskStatus.result,
                attempts: attempts
              }
            })
            
            // Update the task record
            await supabaseAdmin
              .from('tasks')
              .update({
                status: taskStatus.status,
                meta: {
                  geelark_status: taskStatus.result?.geelark_status,
                  fail_code: taskStatus.result?.failCode,
                  fail_desc: taskStatus.result?.failDesc
                },
                updated_at: new Date().toISOString()
              })
              .eq('geelark_task_id', loginTaskId)
          }
          
          // Check if login completed successfully
          if (taskStatus.status === 'completed') {
            console.log('GeeLark login task completed successfully!')
            loginSuccessful = true
            
            await supabaseAdmin.from('logs').insert({
              level: 'info',
              component: 'automation-tiktok-sms-monitor',
              message: 'RPA login task completed - waiting for OTP',
              meta: { 
                task_id: loginTaskId,
                account_id: accountId,
                profile_id: profileId
              }
            })
          } else if (taskStatus.status === 'failed') {
            console.log('GeeLark login task failed:', taskStatus.result)
            
            await supabaseAdmin.from('logs').insert({
              level: 'warning',
              component: 'automation-tiktok-sms-monitor',
              message: 'RPA login task failed',
              meta: { 
                task_id: loginTaskId,
                fail_code: taskStatus.result?.failCode,
                fail_desc: taskStatus.result?.failDesc
              }
            })
          }
        } catch (taskError) {
          console.error('Error checking login task status:', taskError)
        }
      }
      
      // First check if the account status has changed (indicating successful login)
      const { data: account } = await supabaseAdmin
        .from('accounts')
        .select('status, meta')
        .eq('id', accountId)
        .single()
      
      if (account && (account.status === 'active' || account.status === 'warming_up')) {
        // Login was successful!
        loginSuccessful = true
        
        console.log('Login successful, completing rental')
        
        // Mark the rental as completed in DaisySMS to prevent refund
        try {
          await daisyApi.setStatus(rentalId, '6') // 6 = completed
          
          await supabaseAdmin
            .from('sms_rentals')
            .update({
              status: 'completed_no_sms',
              meta: {
                completed_reason: 'login_successful_without_sms',
                completed_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('rental_id', rentalId)
          
          await supabaseAdmin.from('logs').insert({
            level: 'info',
            component: 'automation-tiktok-sms-monitor',
            message: 'TikTok login successful without SMS verification',
            meta: { 
              account_id: accountId, 
              profile_id: profileId,
              rental_id: rentalId,
              rental_completed: true
            }
          })
        } catch (completeError) {
          console.error('Failed to complete rental:', completeError)
        }
        
        // Start warmup if configured and not already started
        if (!warmupStarted && options.warmup_duration_minutes && options.warmup_duration_minutes > 0) {
          warmupStarted = true
          clearInterval(checkInterval) // Stop monitoring since login is done
          
          try {
            const warmupOptions: any = {
              duration_minutes: options.warmup_duration_minutes,
              action: options.warmup_action || 'browse video'
            }

            // Only add keywords for search actions
            if (options.warmup_action !== 'browse video' && options.warmup_keywords && options.warmup_keywords.length > 0) {
              warmupOptions.keywords = options.warmup_keywords
            }

            const warmupResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/start-warmup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                account_ids: [accountId],
                options: warmupOptions
              })
            })

            const warmupData = await warmupResponse.json()
            
            if (!warmupResponse.ok) {
              throw new Error(warmupData.error || 'Failed to start warmup')
            }

            const actionText = options.warmup_action === 'browse video' ? 'browsing videos' :
                              options.warmup_action === 'search video' ? 'searching videos' :
                              'searching profiles'

            await supabaseAdmin.from('logs').insert({
              level: 'info',
              component: 'automation-tiktok-sms-monitor',
              message: `Warmup started after successful login: ${actionText} for ${options.warmup_duration_minutes} minutes`,
              meta: { 
                account_id: accountId,
                profile_id: profileId,
                warmup_duration: options.warmup_duration_minutes,
                warmup_action: options.warmup_action || 'browse video',
                keywords: options.warmup_keywords,
                task_id: warmupData.task_ids?.[0]
              }
            })
          } catch (warmupError) {
            console.error('Failed to start warmup after login:', warmupError)
            await supabaseAdmin.from('logs').insert({
              level: 'error',
              component: 'automation-tiktok-sms-monitor',
              message: 'Failed to start warmup after successful login',
              meta: { 
                account_id: accountId,
                profile_id: profileId,
                error: warmupError instanceof Error ? warmupError.message : String(warmupError)
              }
            })
          }
        } else {
          clearInterval(checkInterval) // Stop monitoring since login is done and no warmup needed
        }
        
        return
      }
      
      // Check for OTP
      const otpStatus = await daisyApi.checkOTP(rentalId)
      
      // Log if status changed
      if (JSON.stringify(otpStatus) !== JSON.stringify(lastOtpCheckResult)) {
        console.log(`OTP status changed for rental ${rentalId}:`, otpStatus)
        lastOtpCheckResult = otpStatus
        
        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'automation-tiktok-sms-monitor',
          message: 'OTP check status changed',
          meta: { 
            rental_id: rentalId,
            status: otpStatus.status,
            code: otpStatus.code,
            attempts: attempts
          }
        })
      }
      
      if (otpStatus.status === 'received' && otpStatus.code) {
        clearInterval(checkInterval)
        
        console.log(`OTP RECEIVED! Rental ${rentalId}, Code: ${otpStatus.code}`)
        
        // Update the SMS rental record
        await supabaseAdmin
          .from('sms_rentals')
          .update({
            otp: otpStatus.code,
            status: 'received',
            updated_at: new Date().toISOString()
          })
          .eq('rental_id', rentalId)
        
        // Update account with OTP received
        await supabaseAdmin
          .from('accounts')
          .update({
            status: 'otp_received',
            meta: {
              ...account?.meta,
              otp_code: otpStatus.code,
              otp_received_at: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', accountId)
        
        // Create a new RPA task to enter the OTP
        if (taskFlowId && phoneNumber) {
          try {
            console.log('Creating RPA task to enter OTP...')
            
            const otpTask = await geelarkApi.updateRPATaskWithOTP(
              profileId,
              taskFlowId,
              phoneNumber,
              otpStatus.code
            )
            
            console.log('OTP entry RPA task created:', otpTask.taskId)
            
            // Store the OTP task
            await supabaseAdmin.from('tasks').insert({
              type: 'otp_entry',
              task_type: 'otp_entry',
              geelark_task_id: otpTask.taskId,
              account_id: accountId,
              status: 'running',
              started_at: new Date().toISOString(),
              meta: {
                profile_id: profileId,
                otp_code: otpStatus.code,
                method: 'rpa',
                flow_id: taskFlowId
              }
            })
            
            await supabaseAdmin.from('logs').insert({
              level: 'info',
              component: 'automation-tiktok-sms-monitor',
              message: 'OTP entry RPA task created',
              meta: { 
                account_id: accountId,
                profile_id: profileId,
                otp_code: otpStatus.code,
                task_id: otpTask.taskId,
                flow_id: taskFlowId
              }
            })
            
            // Monitor the OTP task for completion
            let otpTaskAttempts = 0
            const maxOtpTaskAttempts = 60 // 5 minutes
            
            const otpTaskInterval = setInterval(async () => {
              otpTaskAttempts++
              
              try {
                const otpTaskStatus = await geelarkApi.getTaskStatus(otpTask.taskId)
                
                if (otpTaskStatus.status === 'completed') {
                  clearInterval(otpTaskInterval)
                  loginSuccessful = true
                  
                  console.log('OTP entry task completed successfully!')
                  
                  // Update account status
                  await supabaseAdmin
                    .from('accounts')
                    .update({
                      status: 'active',
                      meta: {
                        ...accountData?.meta,
                        login_completed_at: new Date().toISOString(),
                        login_method: 'phone_rpa_auto'
                      },
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', accountId)
                  
                  await supabaseAdmin.from('logs').insert({
                    level: 'info',
                    component: 'automation-tiktok-sms-monitor',
                    message: 'Account creation completed via RPA',
                    meta: { 
                      account_id: accountId,
                      profile_id: profileId,
                      otp_task_id: otpTask.taskId
                    }
                  })
                  
                  // Start warmup if configured
                  if (options.warmup_duration_minutes && options.warmup_duration_minutes > 0) {
                    // ... warmup code (same as above)
                  }
                } else if (otpTaskStatus.status === 'failed' || otpTaskAttempts >= maxOtpTaskAttempts) {
                  clearInterval(otpTaskInterval)
                  
                  await supabaseAdmin.from('logs').insert({
                    level: 'error',
                    component: 'automation-tiktok-sms-monitor',
                    message: 'OTP entry task failed or timed out',
                    meta: { 
                      account_id: accountId,
                      task_id: otpTask.taskId,
                      status: otpTaskStatus.status,
                      attempts: otpTaskAttempts
                    }
                  })
                }
              } catch (error) {
                console.error('Error checking OTP task status:', error)
              }
            }, 5000) // Check every 5 seconds
            
          } catch (otpError) {
            console.error('Failed to create OTP entry task:', otpError)
            await supabaseAdmin.from('logs').insert({
              level: 'error',
              component: 'automation-tiktok-sms-monitor',
              message: 'Failed to create OTP entry RPA task',
              meta: { 
                account_id: accountId,
                error: otpError instanceof Error ? otpError.message : String(otpError)
              }
            })
          }
        }
        
        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'automation-tiktok-sms-monitor',
          message: 'OTP received successfully',
          meta: { 
            account_id: accountId, 
            profile_id: profileId,
            otp_code: otpStatus.code,
            rental_id: rentalId,
            time_to_receive: `${Math.floor(attempts * 5 / 60)} minutes`,
            rpa_auto_entry: !!taskFlowId
          }
        })
        
        // Mark rental as completed since we got the OTP
        try {
          await daisyApi.setStatus(rentalId, '6') // 6 = completed
        } catch (completeError) {
          console.error('Failed to complete rental after OTP:', completeError)
        }
        
      } else if (otpStatus.status === 'cancelled' || otpStatus.status === 'expired') {
        clearInterval(checkInterval)
        
        console.log(`OTP monitoring stopped: ${otpStatus.status} for rental ${rentalId}`)
        
        await supabaseAdmin.from('logs').insert({
          level: 'warning',
          component: 'automation-tiktok-sms-monitor',
          message: `OTP monitoring stopped: ${otpStatus.status}`,
          meta: { 
            account_id: accountId, 
            profile_id: profileId, 
            rental_id: rentalId,
            attempts: attempts,
            duration: `${Math.floor(attempts * 5 / 60)} minutes`
          }
        })
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval)
        
        console.log(`OTP monitoring timeout for rental ${rentalId} after 20 minutes`)
        
        // If we haven't received OTP or successful login after 20 minutes, 
        // the rental will auto-cancel and refund
        await supabaseAdmin.from('logs').insert({
          level: 'warning',
          component: 'automation-tiktok-sms-monitor',
          message: 'OTP monitoring timeout - rental will auto-cancel',
          meta: { 
            account_id: accountId, 
            profile_id: profileId, 
            rental_id: rentalId,
            attempts: attempts,
            login_successful: loginSuccessful,
            last_status: otpStatus.status
          }
        })
      }
      
      // Log progress every 2 minutes
      if (attempts % 24 === 0) {
        console.log(`OTP monitoring in progress: ${Math.round(attempts * 5 / 60)} minutes elapsed for rental ${rentalId}`)
        
        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'automation-tiktok-sms-monitor',
          message: 'OTP monitoring progress',
          meta: { 
            rental_id: rentalId,
            minutes_elapsed: Math.round(attempts * 5 / 60),
            status: otpStatus.status,
            account_id: accountId
          }
        })
      }
    } catch (error) {
      console.error('OTP check error:', error)
      
      // Log the error
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'automation-tiktok-sms-monitor',
        message: 'OTP check failed',
        meta: { 
          rental_id: rentalId,
          account_id: accountId,
          error: error instanceof Error ? error.message : String(error),
          attempts: attempts
        }
      })
      
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval)
      }
    }
  }, 5000) // Check every 5 seconds
} 