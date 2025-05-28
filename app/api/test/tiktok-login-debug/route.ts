import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const logs: any[] = []
  const log = (message: string, data?: any) => {
    console.log(`[TikTok Login Debug] ${message}`, data || '')
    logs.push({ timestamp: new Date().toISOString(), message, data })
  }

  try {
    const body = await request.json()
    const { profile_id, phone_number, action = 'check' } = body

    if (!profile_id) {
      return NextResponse.json({ error: 'Profile ID required' }, { status: 400 })
    }

    log('Starting TikTok login debug', { profile_id, phone_number, action })

    // Action 1: Check current rentals
    if (action === 'check' || action === 'all') {
      log('Checking current SMS rentals...')
      
      const { data: rentals } = await supabaseAdmin
        .from('sms_rentals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
      
      log('Recent rentals:', rentals)

      // Check active rentals via DaisySMS API
      try {
        const balance = await daisyApi.getBalance()
        log('DaisySMS balance:', balance)
      } catch (e) {
        log('Failed to get balance:', e)
      }
    }

    // Action 2: Test phone number login (manual process)
    if (action === 'test_login' || action === 'all') {
      if (!phone_number) {
        return NextResponse.json({ 
          error: 'Phone number required for test_login action',
          logs 
        }, { status: 400 })
      }

      log('Testing TikTok login with phone number...')
      
      // According to GeeLark docs, they only support email/password login via API
      // Phone number login must be done manually
      log('IMPORTANT: GeeLark API does NOT support phone number login')
      log('The tiktokLogin endpoint only accepts email/password')
      log('Phone number login must be done manually through the app')
      
      // What we CAN do:
      // 1. Start the phone
      // 2. Start TikTok app
      // 3. Rent a number from DaisySMS
      // 4. Monitor for OTP
      // 5. User must manually enter phone number in TikTok
      
      log('Current implementation flow:')
      log('1. Phone is started ✓')
      log('2. TikTok app is started ✓')
      log('3. DaisySMS number is rented ✓')
      log('4. OTP monitoring is active ✓')
      log('5. User must MANUALLY enter phone number in TikTok ❌')
      log('6. When TikTok sends OTP, DaisySMS will receive it')
      log('7. We update the database with the OTP')
      
      // Check if there's an active rental for this profile
      const { data: account } = await supabaseAdmin
        .from('accounts')
        .select('*, phones(*)')
        .eq('phones.profile_id', profile_id)
        .single()
      
      if (account) {
        log('Account found:', { 
          id: account.id, 
          status: account.status,
          meta: account.meta 
        })
        
        // Check for active rental
        const { data: activeRental } = await supabaseAdmin
          .from('sms_rentals')
          .select('*')
          .eq('account_id', account.id)
          .eq('status', 'active')
          .single()
        
        if (activeRental) {
          log('Active rental found:', {
            rental_id: activeRental.rental_id,
            phone: activeRental.phone,
            created_at: activeRental.created_at,
            otp: activeRental.otp
          })
          
          // Check OTP status
          try {
            const otpStatus = await daisyApi.checkOTP(activeRental.rental_id)
            log('OTP check result:', otpStatus)
          } catch (e) {
            log('Failed to check OTP:', e)
          }
        } else {
          log('No active rental found for this account')
        }
      }
    }

    // Action 3: Test webhook
    if (action === 'test_webhook' || action === 'all') {
      log('Checking webhook configuration...')
      
      // Get webhook info from DaisySMS
      try {
        const webhookResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/daisysms/webhook-info`)
        const webhookData = await webhookResponse.json()
        log('Webhook info:', webhookData)
      } catch (e) {
        log('Failed to get webhook info:', e)
      }
      
      // Check recent webhook logs
      const { data: webhookLogs } = await supabaseAdmin
        .from('logs')
        .select('*')
        .eq('component', 'daisysms-webhook')
        .order('created_at', { ascending: false })
        .limit(5)
      
      log('Recent webhook logs:', webhookLogs)
    }

    // Action 4: Manual login initiation
    if (action === 'manual_login') {
      log('Manual login process:')
      log('1. Ensure phone is running and TikTok is open')
      log('2. Navigate to login screen in TikTok')
      log('3. Select "Use phone or email"')
      log('4. Enter the rented phone number WITHOUT country code')
      log('5. TikTok will send OTP to the number')
      log('6. Check SMS rentals page for the OTP')
      
      // Get the formatted phone number
      if (phone_number) {
        const formatted = phone_number.startsWith('1') ? phone_number.substring(1) : phone_number
        log('Formatted phone number for TikTok:', formatted)
        log('Enter this in TikTok:', formatted)
      }
    }

    // Action 5: Check GeeLark task status
    if (action === 'check_tasks' || action === 'all') {
      log('Checking GeeLark tasks...')
      
      const { data: tasks } = await supabaseAdmin
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
      
      log('Recent tasks:', tasks)
      
      // Check task status in GeeLark
      for (const task of tasks || []) {
        if (task.geelark_task_id) {
          try {
            const status = await geelarkApi.getTaskStatus(task.geelark_task_id)
            log(`Task ${task.geelark_task_id} status:`, status)
          } catch (e) {
            log(`Failed to get status for task ${task.geelark_task_id}:`, e)
          }
        }
      }
    }

    // Log to database for tracking
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'tiktok-login-debug',
      message: 'Debug session completed',
      meta: { 
        profile_id,
        action,
        logs_count: logs.length
      }
    })

    return NextResponse.json({
      success: true,
      profile_id,
      action,
      logs,
      recommendations: [
        'GeeLark API does NOT support phone number login - only email/password',
        'Phone login must be done manually in the TikTok app',
        'Make sure to enter phone number WITHOUT country code (e.g., 3476711222 not 13476711222)',
        'Monitor the SMS rentals page for incoming OTP',
        'Check webhook logs to ensure DaisySMS is sending webhooks',
        'Consider implementing email/password login instead for full automation'
      ]
    })

  } catch (error) {
    log('Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      logs
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'TikTok Login Debug Endpoint',
    usage: {
      method: 'POST',
      body: {
        profile_id: 'required - GeeLark profile ID',
        phone_number: 'optional - phone number for testing',
        action: 'check | test_login | test_webhook | manual_login | check_tasks | all'
      },
      actions: {
        check: 'Check current SMS rentals and balance',
        test_login: 'Test the login flow and check for issues',
        test_webhook: 'Check webhook configuration and recent logs',
        manual_login: 'Get instructions for manual login process',
        check_tasks: 'Check GeeLark task status',
        all: 'Run all checks'
      }
    }
  })
} 