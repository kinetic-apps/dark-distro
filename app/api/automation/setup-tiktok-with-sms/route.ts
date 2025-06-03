import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { customAlphabet } from 'nanoid'
import { TIKTOK_AUTOMATION_PASSWORD, TIKTOK_USERNAME_PREFIX, TIKTOK_USERNAME_LENGTH } from '@/lib/constants/auth'

// Set maximum duration to 30 minutes (1800 seconds) for this endpoint
// This prevents timeouts during batch operations
export const maxDuration = 1800

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
  warmup_task_id?: string
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
      warmup_keywords: body.warmup_keywords,
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

        // Handle proxy configuration
        if (options.proxy_id) {
          // GeeLark proxy ID provided
          profileParams.proxy_id = options.proxy_id
        } else if (options.assign_proxy && options.proxy_type === 'auto') {
          // Auto-assign a random GeeLark proxy for SPECTRE SMS setup
          console.log('Auto-assigning GeeLark proxy for SPECTRE SMS setup...')
          
          try {
            const geelarkProxiesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/list-proxies`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            })
            
            if (geelarkProxiesResponse.ok) {
              const geelarkData = await geelarkProxiesResponse.json()
              if (geelarkData.proxies && geelarkData.proxies.length > 0) {
                // Randomly select a proxy from available ones
                const randomIndex = Math.floor(Math.random() * geelarkData.proxies.length)
                const selectedProxy = geelarkData.proxies[randomIndex]
                profileParams.proxy_id = selectedProxy.id
                console.log('Randomly selected GeeLark proxy:', selectedProxy.id)
              } else {
                console.log('No GeeLark proxies available, continuing without proxy')
              }
            } else {
              console.log('Failed to fetch GeeLark proxies, continuing without proxy')
            }
          } catch (proxyError) {
            console.error('Error fetching GeeLark proxies:', proxyError)
            console.log('Continuing without proxy due to error')
          }
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
          status: 'running_geelark_task',
          geelark_task_id: loginTaskId,
          current_setup_step: 'Start TikTok Login',
          setup_progress: 85,
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
          task_type: 'sms_login',
          geelark_task_id: loginTaskId,
          account_id: result.account_id,
          status: 'created',
          setup_step: 'Start TikTok Login',
          progress: 85,
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

        // Update phone record with login task status
        if (accountId) {
          await supabaseAdmin
            .from('phones')
            .update({
              login_task_status: 'created',
              updated_at: new Date().toISOString()
            })
            .eq('profile_id', result.profile_id)
        }

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
            
            // Update phone record with running status
            if (accountId) {
              await supabaseAdmin
                .from('phones')
                .update({
                  login_task_status: 'running',
                  updated_at: new Date().toISOString()
                })
                .eq('profile_id', result.profile_id)

              // Update task record
              await supabaseAdmin
                .from('tasks')
                .update({
                  status: 'running',
                  progress: 90,
                  updated_at: new Date().toISOString()
                })
                .eq('geelark_task_id', loginTaskId)
            }
            
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

      // Start background OTP monitoring with auto-stop (which will also handle warmup after login)
      monitorOTPWithAutoStop(rentalId!, result.account_id!, result.profile_id!, options)
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

// Handle batch creation of multiple phones
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
      message: `Starting batch creation of ${quantity} phones...`
    })

    // Use GeeLark's batch creation API
    const profileParams: any = {
      amount: quantity, // Number of phones to create
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

    // Handle proxy configuration for batch
    if (options.assign_proxy && options.proxy_type === 'auto') {
      // Get available GeeLark proxies for distribution
      try {
        // Add timeout for proxy listing in batch
        const batchProxyController = new AbortController()
        const batchProxyTimeout = setTimeout(() => batchProxyController.abort(), 30000) // 30 second timeout
        
        const geelarkProxiesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/list-proxies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: batchProxyController.signal
        })
        
        clearTimeout(batchProxyTimeout)
        
        if (geelarkProxiesResponse.ok) {
          const geelarkData = await geelarkProxiesResponse.json()
          if (geelarkData.proxies && geelarkData.proxies.length > 0) {
            // Use the first available proxy for all phones (could be enhanced to distribute)
            profileParams.proxy_id = geelarkData.proxies[0].id
          }
        }
      } catch (proxyError) {
        console.error('Error fetching GeeLark proxies for batch:', proxyError)
      }
    }

    // Create batch profiles with extended timeout
    const batchController = new AbortController()
    const batchTimeout = setTimeout(() => batchController.abort(), 600000) // 10 minute timeout for batch creation
    
    const createProfileResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/create-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileParams),
      signal: batchController.signal
    })
    
    clearTimeout(batchTimeout)

    const profileData = await createProfileResponse.json()
    
    if (!createProfileResponse.ok) {
      throw new Error(profileData.error || `Failed to create batch profiles: ${createProfileResponse.status}`)
    }

    // Process batch results
    const batchResults = {
      total_requested: quantity,
      successful_setups: profileData.success_amount || 0,
      failed_setups: profileData.fail_amount || 0,
      account_ids: [] as string[],
      profile_ids: [] as string[],
      details: [] as any[]
    }

    // Process each created profile
    if (profileData.details && Array.isArray(profileData.details)) {
      console.log(`Processing ${profileData.details.length} profiles...`)
      
      for (let i = 0; i < profileData.details.length; i++) {
        const profile = profileData.details[i]
        console.log(`[BATCH] Processing profile ${i + 1}/${profileData.details.length}: ${profile.id}, code: ${profile.code}`)
        
        if (profile.code === 0) { // Success
          console.log(`[BATCH] Processing profile ${profile.id}`)
          
          // Check if account already exists
          const { data: existingAccount } = await supabaseAdmin
            .from('accounts')
            .select('*')
            .eq('geelark_profile_id', profile.id)
            .single()
          
          let accountResult: any
          
          if (existingAccount) {
            console.log(`[BATCH] Account already exists for profile ${profile.id}, updating for SMS setup`)
            
            // Update existing account for SMS setup
            const updateResult = await supabaseAdmin
              .from('accounts')
              .update({
                status: 'creating_profile',
                setup_started_at: new Date().toISOString(),
                current_setup_step: 'Create Profile',
                setup_progress: 20,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingAccount.id)
              .select()
            
            accountResult = {
              data: updateResult.data?.[0] || existingAccount,
              error: updateResult.error
            }
          } else {
            console.log(`[BATCH] Creating new account for profile ${profile.id}`)
            
            // Create new account
            const accountInsert = await supabaseAdmin.from('accounts').insert({
              geelark_profile_id: profile.id,
              tiktok_username: null,
              status: 'creating_profile',
              setup_started_at: new Date().toISOString(),
              current_setup_step: 'Create Profile',
              setup_progress: 20,
              warmup_progress: 0,
              error_count: 0
            }).select()
            
            accountResult = {
              data: accountInsert.data?.[0] || null,
              error: accountInsert.error
            }
          }

          console.log(`[BATCH] Account creation result:`, { 
            hasData: !!accountResult.data, 
            hasError: !!accountResult.error,
            profile: profile.id,
            error: accountResult.error // Add the actual error details
          })

          if (accountResult.error) {
            console.error(`[BATCH] Account creation error for profile ${profile.id}:`, accountResult.error)
            
            await supabaseAdmin.from('logs').insert({
              level: 'error',
              component: 'automation-tiktok-sms-batch',
              message: 'Failed to create account record',
              meta: {
                profile_id: profile.id,
                profile_name: profile.profileName,
                error: accountResult.error,
                error_code: accountResult.error.code,
                error_message: accountResult.error.message,
                error_details: accountResult.error.details
              }
            })
            
            // Still record the failure in batch results
            batchResults.details.push({
              profile_id: profile.id,
              profile_name: profile.profileName,
              success: false,
              error: `Account creation failed: ${accountResult.error.message}`
            })
            
            // Continue to next profile instead of skipping entirely
            continue
          }

          if (accountResult.data) {
            console.log(`[BATCH] Account created: ${accountResult.data.id} for profile ${profile.id}`)
            
            batchResults.account_ids.push(accountResult.data.id)
            batchResults.profile_ids.push(profile.id)
            batchResults.details.push({
              account_id: accountResult.data.id,
              profile_id: profile.id,
              profile_name: profile.profileName,  // Fixed property name
              success: true
            })

            // Check if phone record already exists (profile_id is primary key)
            const { data: existingPhone } = await supabaseAdmin
              .from('phones')
              .select('profile_id, account_id')
              .eq('profile_id', profile.id)
              .single()
              
            let phoneResult: any
            
            if (existingPhone) {
              console.log(`[BATCH] Phone record already exists for ${profile.id}, updating account_id`)
              // Update existing phone record with the new account_id
              phoneResult = await supabaseAdmin
                .from('phones')
                .update({
                  account_id: accountResult.data.id,
                  updated_at: new Date().toISOString()
                })
                .eq('profile_id', profile.id)
                .select()
            } else {
              // Store new phone record
              phoneResult = await supabaseAdmin.from('phones').insert({
                profile_id: profile.id,
                account_id: accountResult.data.id,
                device_model: options.device_model || 'Pixel 6',
                android_version: profile.equipmentInfo?.osVersion || `Android ${options.android_version || 12}`,
                status: 'offline',
                meta: {
                  profile_name: profile.profileName,
                  serial_no: profile.envSerialNo,
                  equipment_info: profile.equipmentInfo,
                  batch_index: i + 1,
                  total_batch: profileData.details.length
                }
              }).select()
            }
            
            if (phoneResult.error) {
              console.error(`[BATCH] Failed to create/update phone record for ${profile.id}:`, phoneResult.error)
              await supabaseAdmin.from('logs').insert({
                level: 'error',
                component: 'automation-tiktok-sms-batch',
                message: 'Failed to create/update phone record',
                meta: {
                  profile_id: profile.id,
                  account_id: accountResult.data.id,
                  error: phoneResult.error,
                  error_code: phoneResult.error.code,
                  error_message: phoneResult.error.message,
                  error_details: phoneResult.error.details,
                  was_update: !!existingPhone
                }
              })
            } else {
              console.log(`[BATCH] Phone record ${existingPhone ? 'updated' : 'created'} for ${profile.id}`)
            }
            
            // Don't start individual setup here - we'll do it sequentially after all profiles are created
          }
        } else {
          batchResults.details.push({
            profile_id: profile.id,
            success: false,
            error: profile.msg || 'Creation failed'
          })
        }
      }
      
      // Now run all setups sequentially
      console.log(`[BATCH] Finished creating profiles. Starting sequential setup for ${batchResults.profile_ids.length} phones`)
      
      // First, mark all phones as queued with their position
      for (let i = 0; i < batchResults.profile_ids.length; i++) {
        const accountId = batchResults.account_ids[i]
        await supabaseAdmin
          .from('accounts')
          .update({
            meta: {
              queue_position: i + 1,
              queue_total: batchResults.profile_ids.length,
              queued_at: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', accountId)
      }
      
      // Process each phone sequentially - wait for complete setup AND shutdown before moving to next
      for (let i = 0; i < batchResults.profile_ids.length; i++) {
        const profileId = batchResults.profile_ids[i]
        const accountId = batchResults.account_ids[i]
        const detail = batchResults.details.find(d => d.profile_id === profileId && d.success)
        
        if (!detail) continue
        
        console.log(`[SEQUENTIAL] Starting phone ${i + 1}/${batchResults.profile_ids.length}: ${profileId}`)
        
        // Clear queue metadata when starting
        await supabaseAdmin
          .from('accounts')
          .update({
            meta: {},
            updated_at: new Date().toISOString()
          })
          .eq('id', accountId)
        
        try {
          // Start the individual setup
          await startIndividualSetup(profileId, accountId, options, true)
          
          console.log(`[SEQUENTIAL] Phone ${i + 1} setup initiated, waiting for completion...`)
          
          // Wait for the setup to complete (OTP monitoring will auto-stop the phone)
          await waitForSetupCompletionAndShutdown(accountId, profileId)
          
          console.log(`[SEQUENTIAL] Phone ${i + 1} fully completed and shut down`)
          
          await supabaseAdmin.from('logs').insert({
            level: 'info',
            component: 'automation-tiktok-sms-batch',
            message: `Sequential phone ${i + 1}/${batchResults.profile_ids.length} completed`,
            meta: {
              batch_index: i + 1,
              profile_id: profileId,
              account_id: accountId,
              mode: 'truly_sequential'
            }
          })
          
          // Add delay before next phone
          if (i < batchResults.profile_ids.length - 1) {
            console.log(`[SEQUENTIAL] Waiting 10 seconds before starting next phone...`)
            await new Promise(resolve => setTimeout(resolve, 10000))
          }
          
        } catch (error) {
          console.error(`[SEQUENTIAL] Phone ${i + 1} failed:`, error)
          
          // Check if it's a timeout error vs a real failure
          const isTimeout = error instanceof Error && error.message.includes('did not start within')
          const logLevel = isTimeout ? 'warning' : 'error'
          
          await supabaseAdmin.from('logs').insert({
            level: logLevel,
            component: 'automation-tiktok-sms-batch',
            message: `Sequential phone ${i + 1}/${batchResults.profile_ids.length} ${isTimeout ? 'timed out' : 'failed'}`,
            meta: {
              batch_index: i + 1,
              profile_id: profileId,
              account_id: accountId,
              error: error instanceof Error ? error.message : String(error),
              mode: 'truly_sequential',
              is_timeout: isTimeout,
              note: isTimeout ? 'GeeLark task took longer than expected to start. This can happen in batch operations.' : undefined
            }
          })
          
          // Update account status to error
          await supabaseAdmin
            .from('accounts')
            .update({
              status: 'error',
              last_error: error instanceof Error ? error.message : String(error),
              error_count: 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', accountId)
          
          // Continue with next phone even if this one failed
        }
      }
      
      console.log(`[SEQUENTIAL] All ${batchResults.profile_ids.length} phones processed`)
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'automation-tiktok-sms-batch',
        message: 'All sequential phone setups completed',
        meta: {
          total_setups: batchResults.profile_ids.length,
          profile_ids: batchResults.profile_ids,
          execution_mode: 'truly_sequential'
        }
      })
    }

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

// Start individual setup for a single phone (called from batch)
async function startIndividualSetup(
  profileId: string,
  accountId: string,
  options: SetupOptions,
  isBatchOperation: boolean = false
) {
  try {
    console.log(`Starting individual setup for profile ${profileId}, account ${accountId}`)
    
    // Verify the account and phone records exist
    const { data: accountCheck } = await supabaseAdmin
      .from('accounts')
      .select('id, status, geelark_profile_id')
      .eq('id', accountId)
      .single()
      
    const { data: phoneCheck } = await supabaseAdmin
      .from('phones')
      .select('profile_id, status, account_id')
      .eq('profile_id', profileId)
      .single()
      
    console.log(`[INDIVIDUAL] Record check - Account: ${accountCheck?.id}, Phone: ${phoneCheck?.profile_id}`)
    
    if (!accountCheck || !phoneCheck) {
      throw new Error(`Missing records - Account: ${!!accountCheck}, Phone: ${!!phoneCheck}`)
    }
    
    // Log the start of individual setup
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'automation-tiktok-sms-individual',
      message: 'Starting individual phone setup',
      meta: {
        profile_id: profileId,
        account_id: accountId,
        has_account_record: !!accountCheck,
        has_phone_record: !!phoneCheck,
        options: {
          device_model: options.device_model,
          android_version: options.android_version,
          group_name: options.group_name,
          long_term_rental: options.long_term_rental
        }
      }
    })
    
    // Start the phone
    console.log(`[INDIVIDUAL] Starting phone ${profileId}...`)
    try {
      const startResult = await geelarkApi.startPhones([profileId])
      console.log(`[INDIVIDUAL] Phone ${profileId} start result:`, JSON.stringify(startResult, null, 2))
      
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'automation-tiktok-sms-individual',
        message: 'Phone start command sent',
        meta: {
          profile_id: profileId,
          account_id: accountId,
          start_result: startResult
        }
      })
    } catch (startError) {
      console.error(`[INDIVIDUAL] Failed to start phone ${profileId}:`, startError)
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'automation-tiktok-sms-individual',
        message: 'Failed to start phone',
        meta: {
          profile_id: profileId,
          account_id: accountId,
          error: startError instanceof Error ? startError.message : String(startError)
        }
      })
      throw startError
    }
    
    // Update status
    await supabaseAdmin
      .from('accounts')
      .update({
        status: 'starting_phone',
        current_setup_step: 'Start Phone',
        setup_progress: 40,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)

    // Update phone record
    await supabaseAdmin
      .from('phones')
      .update({
        phone_started_at: new Date().toISOString(),
        status: 'starting',
        updated_at: new Date().toISOString()
      })
      .eq('profile_id', profileId)

    // Wait for phone to be ready
    console.log(`[INDIVIDUAL] Waiting for phone ${profileId} to be ready...`)
    try {
      await waitForPhoneReady(profileId)
      console.log(`[INDIVIDUAL] Phone ${profileId} is ready!`)
      
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'automation-tiktok-sms-individual',
        message: 'Phone is ready',
        meta: {
          profile_id: profileId,
          account_id: accountId
        }
      })
    } catch (readyError) {
      console.error(`[INDIVIDUAL] Phone ${profileId} failed to become ready:`, readyError)
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'automation-tiktok-sms-individual',
        message: 'Phone failed to become ready',
        meta: {
          profile_id: profileId,
          account_id: accountId,
          error: readyError instanceof Error ? readyError.message : String(readyError)
        }
      })
      throw readyError
    }
    
    // Update status to installing TikTok
    await supabaseAdmin
      .from('accounts')
      .update({
        status: 'installing_tiktok',
        current_setup_step: 'Install TikTok',
        setup_progress: 60,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)

    // Wait for TikTok installation (simplified)
    await waitForTikTokInstallation(profileId)

    // Create RPA task for login
    const TIKTOK_FLOW_ID = '568610393463722230'
    const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', TIKTOK_USERNAME_LENGTH)
    const username = `${TIKTOK_USERNAME_PREFIX}${nanoid()}`
    
    await supabaseAdmin
      .from('accounts')
      .update({
        tiktok_username: username,
        status: 'running_geelark_task',
        current_setup_step: 'Start TikTok Login',
        setup_progress: 80,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)

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
        remark: `Phone login for account ${accountId} with username ${username}`
      }
    )

    // Wait for task to start
    await waitForTaskToStart(loginTask.taskId, isBatchOperation)

    // Rent SMS number - let DaisySMS handle limit checking
    try {
      const rental = await daisyApi.rentNumber(accountId, options.long_term_rental)
      
      await supabaseAdmin
        .from('accounts')
        .update({
          status: 'pending_verification',
          current_setup_step: 'Completed',
          setup_progress: 100,
          setup_completed_at: new Date().toISOString(),
          meta: {
            phone_number: rental.phone,
            rental_id: rental.rental_id,
            setup_type: 'daisysms',
            login_method: 'phone_rpa',
            login_task_id: loginTask.taskId,
            task_flow_id: TIKTOK_FLOW_ID,
            auto_stop: true // Mark for auto-stop
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId)

      // Start OTP monitoring with auto-stop
      monitorOTPWithAutoStop(rental.rental_id, accountId, profileId, options)
        .catch(error => {
          console.error('OTP monitoring error:', error)
        })
    } catch (rentalError) {
      console.error(`Failed to rent number for ${accountId}:`, rentalError)
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'automation-tiktok-sms-individual',
        message: 'Failed to rent DaisySMS number',
        meta: {
          account_id: accountId,
          profile_id: profileId,
          error: rentalError instanceof Error ? rentalError.message : String(rentalError)
        }
      })
      throw rentalError
    }

  } catch (error) {
    console.error(`[INDIVIDUAL] Setup failed for ${profileId}:`, error)
    
    // Check if it's a timeout error
    const isTimeout = error instanceof Error && error.message.includes('did not start within')
    
    // Log the full error details
    await supabaseAdmin.from('logs').insert({
      level: isTimeout ? 'warning' : 'error',
      component: 'automation-tiktok-sms-individual',
      message: isTimeout ? 'Individual setup timed out waiting for task' : 'Individual setup failed with exception',
      meta: {
        profile_id: profileId,
        account_id: accountId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error_type: error?.constructor?.name,
        is_timeout: isTimeout,
        is_batch_operation: isBatchOperation,
        note: isTimeout ? 'Task took longer than expected to start. This is common in batch operations.' : undefined
      }
    })
    
    await supabaseAdmin
      .from('accounts')
      .update({
        status: 'error',
        last_error: error instanceof Error ? error.message : String(error),
        error_count: 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)
      
    // Re-throw the error so it's caught by the batch handler
    throw error
  }
}

// Helper functions for individual setup
async function waitForPhoneReady(profileId: string): Promise<void> {
  let attempts = 0
  const maxAttempts = 60
  let lastStatus: any = null
  
  console.log(`Waiting for phone ${profileId} to be ready...`)
  
  while (attempts < maxAttempts) {
    try {
      const statusResponse = await geelarkApi.getPhoneStatus([profileId])
      
      if (statusResponse.successDetails && statusResponse.successDetails.length > 0) {
        const phoneStatus = statusResponse.successDetails[0].status
        
        // Log status changes
        if (phoneStatus !== lastStatus) {
          console.log(`Phone ${profileId} status changed to: ${phoneStatus}`)
          lastStatus = phoneStatus
        }
        
        // Status 0 means "Started" according to the docs
        if (phoneStatus === 0) {
          console.log(`Phone ${profileId} is ready!`)
          await new Promise(resolve => setTimeout(resolve, 5000)) // Stabilization delay
          return
        }
      } else if (statusResponse.failDetails && statusResponse.failDetails.length > 0) {
        const failDetail = statusResponse.failDetails[0]
        console.error(`Phone status check failed for ${profileId}:`, failDetail)
        throw new Error(`Phone status check failed: ${failDetail.msg}`)
      }
    } catch (error) {
      console.error('Error checking phone status:', error)
      // Don't throw here, continue trying
    }
    
    attempts++
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  throw new Error(`Phone ${profileId} did not start within ${maxAttempts * 2} seconds`)
}

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

// Wait for setup completion and phone shutdown
async function waitForSetupCompletionAndShutdown(
  accountId: string,
  profileId: string
): Promise<void> {
  console.log(`[WAIT] Monitoring setup completion for account ${accountId}, profile ${profileId}`)
  
  const maxWaitTime = 30 * 60 * 1000 // 30 minutes max wait
  const startTime = Date.now()
  let phoneShutDown = false
  
  while (Date.now() - startTime < maxWaitTime && !phoneShutDown) {
    try {
      // Check account status
      const { data: account } = await supabaseAdmin
        .from('accounts')
        .select('status, setup_completed_at')
        .eq('id', accountId)
        .single()
      
      // Check phone status
      const phoneStatusResponse = await geelarkApi.getPhoneStatus([profileId])
      const phoneStatus = phoneStatusResponse.successDetails?.[0]?.status
      
      // Phone status: 0=running, 1=starting, 2=shut down
      if (phoneStatus === 2) {
        console.log(`[WAIT] Phone ${profileId} is shut down`)
        phoneShutDown = true
        
        // Update phone record
        await supabaseAdmin
          .from('phones')
          .update({
            status: 'offline',
            updated_at: new Date().toISOString()
          })
          .eq('profile_id', profileId)
        
        return
      }
      
      // Log progress every minute
      const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000)
      if (elapsedMinutes > 0 && (Date.now() - startTime) % 60000 < 10000) {
        console.log(`[WAIT] Still waiting for ${profileId} to complete and shut down (${elapsedMinutes} minutes elapsed)`)
        console.log(`[WAIT] Account status: ${account?.status}, Phone status: ${phoneStatus}`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000)) // Check every 10 seconds
      
    } catch (error) {
      console.error(`[WAIT] Error checking status for ${profileId}:`, error)
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
  }
  
  // If we reach here, timeout occurred
  const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000)
  console.warn(`[WAIT] Timeout waiting for ${profileId} to complete and shut down after ${elapsedMinutes} minutes`)
  
  // Try to stop the phone anyway
  try {
    await geelarkApi.stopPhones([profileId])
    console.log(`[WAIT] Force stopped phone ${profileId} after timeout`)
  } catch (error) {
    console.error(`[WAIT] Failed to force stop phone ${profileId}:`, error)
  }
}

// Enhanced OTP monitoring with auto-stop functionality
async function monitorOTPWithAutoStop(
  rentalId: string,
  accountId: string,
  profileId: string,
  options: SetupOptions
) {
  try {
    // First run the regular OTP monitoring
    await monitorOTP(rentalId, accountId, profileId, options)
    
    // After OTP monitoring completes, wait for all GeeLark tasks to finish before stopping phone
    console.log(`OTP monitoring completed, now waiting for GeeLark tasks to finish before auto-stopping phone ${profileId}`)
    
    await waitForAllTasksToComplete(accountId, profileId)
    
  } catch (error) {
    console.error('Enhanced OTP monitoring failed:', error)
  }
}

async function waitForAllTasksToComplete(
  accountId: string,
  profileId: string
) {
  try {
    console.log(`Waiting for all GeeLark tasks to complete for account ${accountId}`)
    
    const maxWaitTime = 10 * 60 * 1000 // 10 minutes max wait
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      // Get all active tasks for this account
      const { data: activeTasks } = await supabaseAdmin
        .from('tasks')
        .select('geelark_task_id, type, status')
        .eq('account_id', accountId)
        .in('status', ['running', 'pending', 'waiting'])
      
      if (!activeTasks || activeTasks.length === 0) {
        console.log(`No active tasks found for account ${accountId}, proceeding to stop phone`)
        break
      }
      
      // Get GeeLark task IDs
      const geelarkTaskIds = activeTasks
        .filter(task => task.geelark_task_id)
        .map(task => task.geelark_task_id!)
      
      if (geelarkTaskIds.length === 0) {
        console.log(`No GeeLark task IDs found, proceeding to stop phone`)
        break
      }
      
      console.log(`Checking status of ${geelarkTaskIds.length} GeeLark tasks:`, geelarkTaskIds)
      
      try {
        // Query GeeLark task statuses
        const taskStatuses = await geelarkApi.queryTasks(geelarkTaskIds)
        
        if (!taskStatuses || !taskStatuses.items) {
          console.log('No task status data returned, waiting...')
          await new Promise(resolve => setTimeout(resolve, 10000))
          continue
        }
        
        let allCompleted = true
        let hasRunningTasks = false
        
        for (const task of taskStatuses.items) {
          console.log(`Task ${task.id}: status=${task.status}, type=${task.taskType}`)
          
          // Update our database with the current status
          await supabaseAdmin
            .from('tasks')
            .update({
              status: task.status === 3 ? 'completed' : 
                      task.status === 4 ? 'failed' :
                      task.status === 7 ? 'cancelled' :
                      task.status === 2 ? 'running' : 'pending',
              updated_at: new Date().toISOString(),
              ...(task.status === 3 && { completed_at: new Date().toISOString() }),
              ...(task.failCode && { 
                meta: { 
                  fail_code: task.failCode, 
                  fail_desc: task.failDesc 
                } 
              })
            })
            .eq('geelark_task_id', task.id)
          
          // Check if task is still running (status 1=waiting, 2=in progress)
          if (task.status === 1 || task.status === 2) {
            allCompleted = false
            hasRunningTasks = true
          } else if (task.status !== 3 && task.status !== 4 && task.status !== 7) {
            // Unknown status, assume still running
            allCompleted = false
          }
        }
        
        if (allCompleted) {
          console.log(`All GeeLark tasks completed for account ${accountId}`)
          break
        } else {
          const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000)
          console.log(`Tasks still running for account ${accountId}, waiting... (${elapsedMinutes} minutes elapsed)`)
          await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds before checking again
        }
        
      } catch (taskError) {
        console.error('Error checking GeeLark task status:', taskError)
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
    }
    
    // Now stop the phone
    const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000)
    console.log(`Auto-stopping phone ${profileId} after ${elapsedMinutes} minutes (all tasks completed or timeout reached)`)
    
    try {
      await geelarkApi.stopPhones([profileId])
      
      await supabaseAdmin
        .from('accounts')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId)
      
      await supabaseAdmin
        .from('phones')
        .update({
          status: 'offline',
          updated_at: new Date().toISOString()
        })
        .eq('profile_id', profileId)
      
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'automation-auto-stop',
        message: 'Phone automatically stopped after all tasks completed',
        meta: { 
          account_id: accountId,
          profile_id: profileId,
          reason: 'all_tasks_completed',
          wait_time_minutes: elapsedMinutes
        }
      })
      
    } catch (error) {
      console.error(`Failed to auto-stop phone ${profileId}:`, error)
      
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'automation-auto-stop',
        message: 'Failed to auto-stop phone',
        meta: { 
          account_id: accountId,
          profile_id: profileId,
          error: error instanceof Error ? error.message : String(error)
        }
      })
    }
    
  } catch (error) {
    console.error(`Error waiting for tasks to complete for account ${accountId}:`, error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'automation-auto-stop',
      message: 'Error waiting for tasks to complete',
      meta: { 
        account_id: accountId,
        profile_id: profileId,
        error: error instanceof Error ? error.message : String(error)
      }
    })
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

            // Add timeout for warmup start
            const warmupController = new AbortController()
            const warmupTimeout = setTimeout(() => warmupController.abort(), 60000) // 1 minute timeout
            
            const warmupResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/start-warmup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                account_ids: [accountId],
                options: warmupOptions
              }),
              signal: warmupController.signal
            })
            
            clearTimeout(warmupTimeout)

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