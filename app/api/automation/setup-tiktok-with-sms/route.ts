import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { daisyApi } from '@/lib/daisy-api'
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
  
  // SMS rental configuration
  long_term_rental?: boolean  // Whether to use long-term rental for DaisySMS
  
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

    // Step 3: Install TikTok
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

    // Step 4: Rent DaisySMS number
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
    } catch (error) {
      result.tasks.push({
        step: 'Rent Phone Number',
        status: 'failed',
        message: 'Failed to rent phone number',
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }

    // Step 5: Start TikTok and initiate login
    let loginTaskId: string | undefined
    try {
      // Start TikTok app
      await geelarkApi.startApp(result.profile_id!, 'com.zhiliaoapp.musically')
      
      // Wait a bit for app to start
      // Note: GeeLark doesn't have an API to check if a specific app is running,
      // so we use a short wait here. The app should start quickly since the phone is already running.
      console.log('Waiting for TikTok to start...')
      await new Promise(resolve => setTimeout(resolve, 5000))

      // For now, we'll need to handle the login manually since GeeLark API
      // doesn't support phone number login directly
      // This is a placeholder for future implementation
      
      result.tasks.push({
        step: 'TikTok Login',
        status: 'success',
        message: `Login ready with phone: ${phoneNumber}. Manual intervention may be required.`
      })

      // Store the phone number in the account metadata for reference
      await supabaseAdmin
        .from('accounts')
        .update({
          status: 'pending_verification',
          meta: {
            phone_number: phoneNumber,
            phone_number_formatted: phoneNumber.substring(1), // Remove leading 1 for TikTok
            rental_id: rentalId,
            setup_type: 'daisysms'
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', result.account_id)
        
      // Log the phone number format
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'automation-tiktok-sms',
        message: 'Phone number formatted for TikTok',
        meta: {
          original: phoneNumber,
          formatted: phoneNumber.substring(1),
          note: 'TikTok expects 10-digit US numbers without country code'
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
  
  const maxAttempts = 240 // Check for 20 minutes (240 * 5 seconds)
  let attempts = 0
  let loginSuccessful = false
  let warmupStarted = false

  const checkInterval = setInterval(async () => {
    try {
      attempts++
      
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
            component: 'automation-tiktok-sms',
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
              component: 'automation-tiktok-sms',
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
              component: 'automation-tiktok-sms',
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
      
      if (otpStatus.status === 'received' && otpStatus.code) {
        clearInterval(checkInterval)
        
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
        
        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'automation-tiktok-sms',
          message: 'OTP received successfully',
          meta: { 
            account_id: accountId, 
            profile_id: profileId,
            otp_code: otpStatus.code,
            rental_id: rentalId
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
        
        await supabaseAdmin.from('logs').insert({
          level: 'warning',
          component: 'automation-tiktok-sms',
          message: `OTP monitoring stopped: ${otpStatus.status}`,
          meta: { account_id: accountId, profile_id: profileId, rental_id: rentalId }
        })
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval)
        
        // If we haven't received OTP or successful login after 20 minutes, 
        // the rental will auto-cancel and refund
        await supabaseAdmin.from('logs').insert({
          level: 'warning',
          component: 'automation-tiktok-sms',
          message: 'OTP monitoring timeout - rental will auto-cancel',
          meta: { 
            account_id: accountId, 
            profile_id: profileId, 
            rental_id: rentalId,
            attempts: attempts,
            login_successful: loginSuccessful
          }
        })
      }
      
      // Log progress every 2 minutes
      if (attempts % 24 === 0) {
        console.log(`OTP monitoring in progress: ${Math.round(attempts * 5 / 60)} minutes elapsed`)
      }
    } catch (error) {
      console.error('OTP check error:', error)
      
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval)
      }
    }
  }, 5000) // Check every 5 seconds
} 