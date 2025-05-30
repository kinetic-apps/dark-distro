import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_id, profile_id, login_method = 'auto', email, password, phone_number, otp_code } = body

    if (!account_id || !profile_id) {
      return NextResponse.json(
        { error: 'Account ID and Profile ID are required' },
        { status: 400 }
      )
    }

    // Check authentication method setting if login_method is 'auto'
    let effectiveLoginMethod = login_method
    let autoEmail = email
    let autoPassword = password

    if (login_method === 'auto') {
      // Get the authentication method from settings
      const { data: settingData } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'geelark_auth_method')
        .single()

      const authMethod = settingData?.value?.replace(/"/g, '') || 'daisysms'

      if (authMethod === 'tiktok') {
        // Fetch available TikTok credentials
        const { data: credentials } = await supabaseAdmin
          .from('tiktok_credentials')
          .select('*')
          .eq('status', 'active')
          .order('last_used_at', { ascending: true, nullsFirst: true })
          .limit(1)

        if (!credentials || credentials.length === 0) {
          return NextResponse.json(
            { error: 'No available TikTok credentials found' },
            { status: 404 }
          )
        }

        const credential = credentials[0]
        autoEmail = credential.email
        autoPassword = credential.password
        effectiveLoginMethod = 'email'

        // Update last_used_at
        await supabaseAdmin
          .from('tiktok_credentials')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', credential.id)

        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'api-tiktok-login',
          message: 'Using TikTok credentials from database',
          meta: { account_id, credential_id: credential.id, email: credential.email }
        })
      } else {
        // Use DaisySMS phone method (not implemented in this example)
        return NextResponse.json(
          { error: 'DaisySMS phone authentication is not implemented yet' },
          { status: 501 }
        )
      }
    }

    // Handle email/password login
    if (effectiveLoginMethod === 'email') {
      const loginEmail = autoEmail || email
      const loginPassword = autoPassword || password

      if (!loginEmail || !loginPassword) {
        return NextResponse.json(
          { error: 'Email and password are required for email login' },
          { status: 400 }
        )
      }

      // Initiate TikTok login with email/password
      const taskData = await geelarkApi.loginTikTok(profile_id, loginEmail, loginPassword)

      // Store login attempt
      await supabaseAdmin.from('tasks').insert({
        type: 'login',
        task_type: 'login',  // Required field
        geelark_task_id: taskData.taskId,
        account_id,
        status: 'running',
        started_at: new Date().toISOString(),
        meta: {
          login_method: 'email',
          email: loginEmail
        }
      })

      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'api-tiktok-login',
        message: 'TikTok email login initiated',
        meta: { account_id, profile_id, email: loginEmail }
      })

      return NextResponse.json({
        success: true,
        task_id: taskData.taskId,
        login_method: 'email',
        status: 'logging_in'
      })
    }

    // Handle phone/OTP login (legacy - keeping for compatibility)
    // Note: According to docs, this would require a separate implementation
    // The current API only supports email/password login
    if (login_method === 'phone') {
      return NextResponse.json(
        { error: 'Phone/OTP login is not currently supported by the API. Please use email/password login.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Invalid login method' },
      { status: 400 }
    )
  } catch (error) {
    console.error('TikTok login error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-tiktok-login',
      message: 'Failed to initiate TikTok login',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to initiate TikTok login' },
      { status: 500 }
    )
  }
}

// Background function to check for OTP
async function checkForOTP(
  rentalId: string,
  accountId: string,
  profileId: string,
  taskId: string
) {
  const maxAttempts = 60 // Check for 5 minutes (60 * 5 seconds)
  let attempts = 0

  const checkInterval = setInterval(async () => {
    try {
      attempts++
      
      const otpStatus = await daisyApi.checkOTP(rentalId)
      
      if (otpStatus.status === 'received' && otpStatus.code) {
        clearInterval(checkInterval)
        
        // Complete the login with OTP
        await geelarkApi.loginTikTok(profileId, '', otpStatus.code)
        
        // Update task status
        await supabaseAdmin
          .from('tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            meta: {
              otp_received: true,
              otp_code: otpStatus.code
            }
          })
          .eq('geelark_task_id', taskId)
        
        // Mark SMS rental as completed
        await daisyApi.setStatus(rentalId, '6')
        
        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'api-tiktok-login',
          message: 'TikTok login completed with OTP',
          meta: { account_id: accountId, profile_id: profileId }
        })
      } else if (otpStatus.status === 'cancelled' || otpStatus.status === 'expired') {
        clearInterval(checkInterval)
        
        await supabaseAdmin
          .from('tasks')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            meta: { error: `OTP ${otpStatus.status}` }
          })
          .eq('geelark_task_id', taskId)
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval)
        
        await supabaseAdmin
          .from('tasks')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            meta: { error: 'OTP timeout' }
          })
          .eq('geelark_task_id', taskId)
        
        // Cancel the SMS rental
        await daisyApi.setStatus(rentalId, '8')
      }
    } catch (error) {
      console.error('OTP check error:', error)
      
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval)
      }
    }
  }, 5000) // Check every 5 seconds
} 