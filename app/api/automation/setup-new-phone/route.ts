import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface SetupOptions {
  // Profile configuration
  device_model?: string
  android_version?: number
  proxy_id?: string  // GeeLark saved proxy ID
  group_name?: string
  tags?: string[]
  remark?: string
  
  // TikTok login
  auth_method: 'tiktok' | 'daisysms'
  email?: string
  password?: string
  
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
      device_model: body.device_model || 'Pixel 6',
      android_version: body.android_version || 3, // Android 12
      proxy_id: body.proxy_id,
      group_name: body.group_name || 'automated-setup',
      tags: body.tags || ['auto-setup'],
      remark: body.remark || `Auto-setup ${new Date().toISOString()}`,
      auth_method: body.auth_method || 'tiktok',
      email: body.email,
      password: body.password,
      warmup_duration_minutes: body.warmup_duration_minutes || 30,
      warmup_action: body.warmup_action || 'browse video',
      warmup_keywords: body.warmup_keywords
    }

    // Log the setup initiation
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'automation-setup-phone',
      message: 'Starting automated phone setup',
      meta: { options, start_time: new Date().toISOString() }
    })

    // Step 1: Create Profile
    try {
      const createProfileResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/create-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          android_version: options.android_version,
          proxy_id: options.proxy_id,
          group_name: options.group_name,
          tags: options.tags,
          remark: options.remark,
          surface_brand: 'google',
          surface_model: options.device_model,
          region: 'us',
          charge_mode: 0, // Pay per minute
          language: 'default'
        })
      })

      const profileData = await createProfileResponse.json()
      
      if (!createProfileResponse.ok) {
        throw new Error(profileData.error || 'Failed to create profile')
      }

      result.account_id = profileData.account_id
      result.profile_id = profileData.profile_id
      result.profile_name = profileData.profile_name

      result.tasks.push({
        step: 'Create Profile',
        status: 'success',
        message: `Profile created: ${profileData.profile_name} (${profileData.profile_id})`
      })

      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'automation-setup-phone',
        message: 'Profile created successfully',
        meta: { 
          account_id: result.account_id,
          profile_id: result.profile_id,
          profile_name: result.profile_name
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

    // Step 2: Start the phone
    try {
      await geelarkApi.startPhones([result.profile_id!])
      
      result.tasks.push({
        step: 'Start Phone',
        status: 'success',
        message: 'Phone started successfully'
      })

      // Wait a bit for the phone to fully start
      await new Promise(resolve => setTimeout(resolve, 5000))
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
      const installResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/install-app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_ids: [result.profile_id],
          app_package: 'com.zhiliaoapp.musically',
          version: '39.1.0'
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

      // Wait for installation to complete
      await new Promise(resolve => setTimeout(resolve, 10000))
    } catch (error) {
      result.tasks.push({
        step: 'Install TikTok',
        status: 'failed',
        message: 'Failed to install TikTok',
        error: error instanceof Error ? error.message : String(error)
      })
      // Continue with setup even if installation fails
    }

    // Step 4: Login to TikTok
    let loginTaskId: string | undefined
    try {
      // Determine login credentials
      let loginEmail = options.email
      let loginPassword = options.password

      if (options.auth_method === 'tiktok' && (!loginEmail || !loginPassword)) {
        // Fetch available TikTok credentials
        const { data: credentials } = await supabaseAdmin
          .from('tiktok_credentials')
          .select('*')
          .eq('status', 'active')
          .order('last_used_at', { ascending: true, nullsFirst: true })
          .limit(1)

        if (!credentials || credentials.length === 0) {
          throw new Error('No available TikTok credentials found')
        }

        const credential = credentials[0]
        loginEmail = credential.email
        loginPassword = credential.password

        // Update last_used_at
        await supabaseAdmin
          .from('tiktok_credentials')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', credential.id)
      }

      if (!loginEmail || !loginPassword) {
        throw new Error('Email and password are required for login')
      }

      // Initiate TikTok login
      const loginResult = await geelarkApi.loginTikTok(result.profile_id!, loginEmail, loginPassword)
      loginTaskId = loginResult.taskId

      // Store login task
      await supabaseAdmin.from('tasks').insert({
        type: 'login',
        task_type: 'login',
        geelark_task_id: loginTaskId,
        account_id: result.account_id,
        status: 'running',
        started_at: new Date().toISOString(),
        meta: {
          login_method: 'email',
          email: loginEmail,
          setup_flow: true
        }
      })

      result.tasks.push({
        step: 'TikTok Login',
        status: 'success',
        message: `Login initiated with ${loginEmail}`,
        task_id: loginTaskId
      })

      // Update account with TikTok username
      await supabaseAdmin
        .from('accounts')
        .update({
          tiktok_username: loginEmail.split('@')[0], // Use email prefix as initial username
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', result.account_id)

    } catch (error) {
      result.tasks.push({
        step: 'TikTok Login',
        status: 'failed',
        message: 'Failed to login to TikTok',
        error: error instanceof Error ? error.message : String(error)
      })
      // Continue with setup even if login fails
    }

    // Step 5: Start Warmup
    let warmupTaskId: string | undefined
    try {
      // Only start warmup if login was successful
      if (loginTaskId) {
        // Wait a bit for login to complete
        await new Promise(resolve => setTimeout(resolve, 15000))

        const warmupTaskId = await geelarkApi.startTikTokWarmup(
          result.profile_id!,
          result.account_id!,
          {
            duration_minutes: options.warmup_duration_minutes,
            action: options.warmup_action,
            keywords: options.warmup_keywords
          }
        )

        // Update account status
        await supabaseAdmin
          .from('accounts')
          .update({
            status: 'warming_up',
            warmup_progress: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', result.account_id)

        result.tasks.push({
          step: 'Start Warmup',
          status: 'success',
          message: `Warmup started for ${options.warmup_duration_minutes} minutes`,
          task_id: warmupTaskId
        })
      } else {
        result.tasks.push({
          step: 'Start Warmup',
          status: 'skipped',
          message: 'Warmup skipped due to login failure'
        })
      }
    } catch (error) {
      result.tasks.push({
        step: 'Start Warmup',
        status: 'failed',
        message: 'Failed to start warmup',
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
      component: 'automation-setup-phone',
      message: `Phone setup completed ${result.success ? 'successfully' : 'with errors'}`,
      meta: {
        account_id: result.account_id,
        profile_id: result.profile_id,
        duration_ms: duration,
        failed_steps: failedSteps.map(s => s.step),
        task_ids: {
          login: loginTaskId,
          warmup: warmupTaskId
        }
      }
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Phone setup error:', error)
    
    // Log the error
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'automation-setup-phone',
      message: 'Phone setup failed',
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