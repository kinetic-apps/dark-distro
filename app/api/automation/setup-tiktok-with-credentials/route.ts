import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

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
  
  // Credential options
  credential_id?: string  // Specific TikTok credential to use
  
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
  credential_email?: string
  credential_id?: string
  login_task_id?: string
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
      group_name: body.group_name || 'tiktok-credentials-setup',
      tags: body.tags || ['auto-setup', 'credentials'],
      remark: body.remark || 'Automated TikTok setup with credentials',
      region: body.region || 'us',
      credential_id: body.credential_id,
      warmup_duration_minutes: body.warmup_duration_minutes || 30,
      warmup_action: body.warmup_action || 'browse video',
      warmup_keywords: body.warmup_keywords
    }

    // Step 1: Get TikTok credentials
    let credential: any
    try {
      if (options.credential_id) {
        // Use specific credential
        const { data } = await supabaseAdmin
          .from('tiktok_credentials')
          .select('*')
          .eq('id', options.credential_id)
          .eq('status', 'active')
          .single()
        
        if (!data) {
          throw new Error('Specified credential not found or inactive')
        }
        credential = data
      } else {
        // Get next available credential
        const { data: credentials } = await supabaseAdmin
          .from('tiktok_credentials')
          .select('*')
          .eq('status', 'active')
          .order('last_used_at', { ascending: true, nullsFirst: true })
          .limit(1)
        
        if (!credentials || credentials.length === 0) {
          throw new Error('No available TikTok credentials found')
        }
        credential = credentials[0]
      }

      result.credential_email = credential.email
      result.credential_id = credential.id

      // Update last_used_at
      await supabaseAdmin
        .from('tiktok_credentials')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', credential.id)

      result.tasks.push({
        step: 'Get Credentials',
        status: 'success',
        message: `Using TikTok credentials: ${credential.email}`
      })

      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'automation-tiktok-credentials',
        message: 'TikTok credentials obtained',
        meta: { 
          credential_id: credential.id,
          email: credential.email,
          creator_name: credential.creator_name
        }
      })
    } catch (error) {
      result.tasks.push({
        step: 'Get Credentials',
        status: 'failed',
        message: 'Failed to get TikTok credentials',
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }

    // Step 2: Create or use existing profile
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

        // Handle proxy configuration (same logic as SMS setup)
        if (options.proxy_id) {
          profileParams.proxy_id = options.proxy_id
        } else if (options.database_proxy_id) {
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
          profileParams.proxy_config = options.proxy_config
        } else if (options.assign_proxy) {
          const proxyType = options.proxy_type || 'sim'
          
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
            
            options.database_proxy_id = proxy.id
          } else {
            console.log('No database proxies available, checking GeeLark proxies...')
            
            try {
              const geelarkProxiesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/list-proxies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              })
              
              if (geelarkProxiesResponse.ok) {
                const geelarkData = await geelarkProxiesResponse.json()
                if (geelarkData.proxies && geelarkData.proxies.length > 0) {
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

        // Store credential info in account metadata
        await supabaseAdmin
          .from('accounts')
          .update({
            meta: {
              tiktok_credential_id: credential.id,
              tiktok_email: credential.email,
              setup_type: 'credentials'
            }
          })
          .eq('id', result.account_id)

        result.tasks.push({
          step: 'Create Profile',
          status: 'success',
          message: `Profile created: ${profileData.profile_name} (${profileData.profile_id})`
        })

        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'automation-tiktok-credentials',
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

    // Step 3: Start the phone
    try {
      await geelarkApi.startPhones([result.profile_id!])
      
      result.tasks.push({
        step: 'Start Phone',
        status: 'success',
        message: 'Phone started successfully'
      })

      // Poll for phone status until it's running
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
            if (phoneStatus === 0) { // 0 means "Started"
              phoneReady = true
              const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
              console.log(`Phone is now running! (took ${elapsedSeconds} seconds, ${attempts} status checks)`)
              
              await supabaseAdmin.from('logs').insert({
                level: 'info',
                component: 'automation-tiktok-credentials',
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

    // Step 4: Install TikTok
    try {
      // Check if TikTok is already installed
      const isInstalled = await geelarkApi.isTikTokInstalled(result.profile_id!)
      
      if (isInstalled) {
        result.tasks.push({
          step: 'Install TikTok',
          status: 'success',
          message: 'TikTok is already installed'
        })
      } else {
        const installResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/install-app`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_ids: [result.profile_id],
            app_package: 'com.zhiliaoapp.musically',
            version: '39.1.0',
            app_version_id: '1901590921383706626' // Specific version ID for v39.1.0
          })
        })

        const installData = await installResponse.json()
        
        if (!installResponse.ok) {
          throw new Error(installData.error || 'Failed to install TikTok')
        }

        result.tasks.push({
          step: 'Install TikTok',
          status: 'success',
          message: 'TikTok v39.1.0 installed successfully'
        })

        // Poll to check if TikTok is actually installed
        console.log('Waiting for TikTok installation to complete...')
        let installComplete = false
        let installAttempts = 0
        const maxInstallAttempts = 30 // 30 attempts * 2 seconds = 60 seconds max
        
        while (!installComplete && installAttempts < maxInstallAttempts) {
          installAttempts++
          try {
            const isInstalled = await geelarkApi.isTikTokInstalled(result.profile_id!)
            if (isInstalled) {
              installComplete = true
              console.log('TikTok installation confirmed')
            } else {
              console.log('TikTok not yet installed, waiting...')
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          } catch (checkError) {
            console.error('Error checking TikTok installation:', checkError)
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
        
        if (!installComplete) {
          console.warn('Could not confirm TikTok installation, proceeding anyway...')
        }
      }
    } catch (error) {
      result.tasks.push({
        step: 'Install TikTok',
        status: 'failed',
        message: 'Failed to install TikTok',
        error: error instanceof Error ? error.message : String(error)
      })
      // Continue with setup even if installation fails
    }

    // Step 5: Start TikTok and login with email/password
    let loginTaskId: string | undefined
    try {
      // Start TikTok app
      await geelarkApi.startApp(result.profile_id!, 'com.zhiliaoapp.musically')
      
      // Wait a bit for app to start
      console.log('Waiting for TikTok to start...')
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Login with email/password
      console.log('=== INITIATING EMAIL/PASSWORD LOGIN ===')
      console.log(`Email: ${credential.email}`)
      
      const loginResponse = await geelarkApi.loginTikTok(
        result.profile_id!,
        credential.email,
        credential.password
      )
      
      loginTaskId = loginResponse.taskId
      result.login_task_id = loginTaskId
      console.log(`Login task created! Task ID: ${loginTaskId}`)
      
      result.tasks.push({
        step: 'TikTok Login',
        status: 'success',
        message: `Login initiated with email: ${credential.email}, task ID: ${loginTaskId}`
      })
      
      // Store the task info
      await supabaseAdmin.from('tasks').insert({
        type: 'login',
        task_type: 'login',
        geelark_task_id: loginTaskId,
        account_id: result.account_id,
        status: 'running',
        started_at: new Date().toISOString(),
        meta: {
          login_method: 'email',
          email: credential.email,
          credential_id: credential.id,
          setup_flow: 'credentials'
        }
      })

      // Update account status
      await supabaseAdmin
        .from('accounts')
        .update({
          status: 'logging_in',
          meta: {
            tiktok_credential_id: credential.id,
            tiktok_email: credential.email,
            setup_type: 'credentials',
            login_method: 'email',
            login_task_id: loginTaskId
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', result.account_id)
        
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'automation-tiktok-credentials',
        message: 'TikTok email login initiated',
        meta: {
          account_id: result.account_id,
          profile_id: result.profile_id,
          email: credential.email,
          login_task_id: loginTaskId
        }
      })

    } catch (error) {
      result.tasks.push({
        step: 'TikTok Login',
        status: 'failed',
        message: 'Failed to initiate TikTok login',
        error: error instanceof Error ? error.message : String(error)
      })
      // Continue with setup
    }

    // Step 6: Monitor login status and start warmup
    try {
      result.tasks.push({
        step: 'Monitor Login',
        status: 'success',
        message: 'Login monitoring started. Checking task status...'
      })

      // Start background monitoring (which will also handle warmup after login)
      monitorLogin(loginTaskId!, result.account_id!, result.profile_id!, options)
        .catch(error => {
          console.error('Login monitoring error:', error)
        })

    } catch (error) {
      result.tasks.push({
        step: 'Monitor Login',
        status: 'failed',
        message: 'Failed to start login monitoring',
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
      component: 'automation-tiktok-credentials',
      message: `TikTok credentials setup completed ${result.success ? 'successfully' : 'with errors'}`,
      meta: {
        account_id: result.account_id,
        profile_id: result.profile_id,
        credential_email: result.credential_email,
        credential_id: result.credential_id,
        login_task_id: result.login_task_id,
        duration_ms: duration,
        failed_steps: failedSteps.map(s => s.step)
      }
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('TikTok credentials setup error:', error)
    
    // Log the error
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'automation-tiktok-credentials',
      message: 'TikTok credentials setup failed',
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

// Background function to monitor login status
async function monitorLogin(
  loginTaskId: string,
  accountId: string,
  profileId: string,
  options: SetupOptions
) {
  console.log(`Starting login monitoring for task ID: ${loginTaskId}`)
  
  // Log initial monitoring setup
  await supabaseAdmin.from('logs').insert({
    level: 'info',
    component: 'automation-tiktok-credentials-monitor',
    message: 'Login monitoring started',
    meta: { 
      login_task_id: loginTaskId,
      account_id: accountId,
      profile_id: profileId,
      check_interval: '5 seconds',
      max_duration: '10 minutes'
    }
  })
  
  const maxAttempts = 120 // Check for 10 minutes (120 * 5 seconds)
  let attempts = 0
  let loginSuccessful = false
  let warmupStarted = false
  let lastTaskStatus: any = null

  const checkInterval = setInterval(async () => {
    try {
      attempts++
      
      // Log every 12 attempts (1 minute)
      if (attempts % 12 === 1) {
        console.log(`Login monitoring: ${Math.floor(attempts / 12)} minutes elapsed, task ${loginTaskId}`)
      }
      
      // Check login task status
      try {
        const taskStatus = await geelarkApi.getTaskStatus(loginTaskId)
        
        // Log if task status changed
        if (JSON.stringify(taskStatus) !== JSON.stringify(lastTaskStatus)) {
          console.log(`Login task status changed for ${loginTaskId}:`, taskStatus)
          lastTaskStatus = taskStatus
          
          await supabaseAdmin.from('logs').insert({
            level: 'info',
            component: 'automation-tiktok-credentials-monitor',
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
          
          // Update account status to active
          await supabaseAdmin
            .from('accounts')
            .update({
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('id', accountId)
          
          await supabaseAdmin.from('logs').insert({
            level: 'info',
            component: 'automation-tiktok-credentials-monitor',
            message: 'TikTok login completed successfully',
            meta: { 
              task_id: loginTaskId,
              account_id: accountId,
              profile_id: profileId,
              attempts: attempts,
              duration_minutes: Math.floor(attempts / 12)
            }
          })
          
          // Start warmup if configured
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
                component: 'automation-tiktok-credentials-monitor',
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
                component: 'automation-tiktok-credentials-monitor',
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
        } else if (taskStatus.status === 'failed') {
          console.log('GeeLark login task failed:', taskStatus.result)
          clearInterval(checkInterval)
          
          // Update account status
          await supabaseAdmin
            .from('accounts')
            .update({
              status: 'login_failed',
              meta: {
                fail_code: taskStatus.result?.failCode,
                fail_desc: taskStatus.result?.failDesc
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', accountId)
          
          await supabaseAdmin.from('logs').insert({
            level: 'error',
            component: 'automation-tiktok-credentials-monitor',
            message: 'TikTok login failed',
            meta: { 
              task_id: loginTaskId,
              account_id: accountId,
              profile_id: profileId,
              fail_code: taskStatus.result?.failCode,
              fail_desc: taskStatus.result?.failDesc,
              attempts: attempts
            }
          })
          
          return
        }
      } catch (taskError) {
        console.error('Error checking login task status:', taskError)
      }
      
      // Check if we've exceeded max attempts
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval)
        console.log('Login monitoring timeout reached')
        
        await supabaseAdmin.from('logs').insert({
          level: 'warning',
          component: 'automation-tiktok-credentials-monitor',
          message: 'Login monitoring timeout - task may still be running',
          meta: { 
            task_id: loginTaskId,
            account_id: accountId,
            profile_id: profileId,
            attempts: attempts,
            duration_minutes: 10
          }
        })
      }
    } catch (error) {
      console.error('Error in login monitoring:', error)
      
      // Log error but continue monitoring
      if (attempts % 12 === 1) { // Log errors every minute
        await supabaseAdmin.from('logs').insert({
          level: 'error',
          component: 'automation-tiktok-credentials-monitor',
          message: 'Error during login monitoring',
          meta: { 
            task_id: loginTaskId,
            account_id: accountId,
            error: error instanceof Error ? error.message : String(error),
            attempts: attempts
          }
        })
      }
    }
  }, 5000) // Check every 5 seconds
} 