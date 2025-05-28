import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const debugLog: any[] = []
  const log = (message: string, data?: any) => {
    const entry = { timestamp: new Date().toISOString(), message, data }
    console.log(message, data || '')
    debugLog.push(entry)
  }

  try {
    const { profile_id, phone_number, manual_mode = false } = await request.json()
    
    if (!profile_id) {
      return NextResponse.json({ error: 'profile_id required' }, { status: 400 })
    }

    log('Starting TikTok login debug', { profile_id, phone_number, manual_mode })

    // Step 1: Check phone status
    log('Checking phone status...')
    const phoneStatus = await geelarkApi.getPhoneStatus([profile_id])
    log('Phone status response', phoneStatus)
    
    if (phoneStatus.successDetails?.[0]?.status !== 0) {
      log('Phone not ready, starting it...')
      await geelarkApi.startPhones([profile_id])
      
      // Wait for phone to be ready
      let attempts = 0
      while (attempts < 30) {
        attempts++
        await new Promise(resolve => setTimeout(resolve, 2000))
        const status = await geelarkApi.getPhoneStatus([profile_id])
        if (status.successDetails?.[0]?.status === 0) {
          log('Phone is now ready')
          break
        }
      }
    }

    // Step 2: Check if TikTok is installed
    log('Checking if TikTok is installed...')
    const isInstalled = await geelarkApi.isTikTokInstalled(profile_id)
    log('TikTok installed', { isInstalled })

    if (!isInstalled) {
      return NextResponse.json({ 
        error: 'TikTok not installed',
        debugLog 
      }, { status: 400 })
    }

    // Step 3: Take screenshot before starting
    log('Taking screenshot before TikTok start...')
    try {
      const screenshotTask = await geelarkApi.takeScreenshot(profile_id)
      log('Screenshot task created', { taskId: screenshotTask.taskId })
      
      // Wait a bit and get the result
      await new Promise(resolve => setTimeout(resolve, 2000))
      const screenshotResult = await geelarkApi.getScreenshotResult(screenshotTask.taskId)
      log('Screenshot result', screenshotResult)
    } catch (e) {
      log('Screenshot failed', { error: String(e) })
    }

    // Step 4: Start TikTok
    log('Starting TikTok app...')
    await geelarkApi.startApp(profile_id, 'com.zhiliaoapp.musically')
    
    // Wait for app to load
    log('Waiting 10 seconds for TikTok to load...')
    await new Promise(resolve => setTimeout(resolve, 10000))

    // Step 5: Take screenshot after TikTok starts
    log('Taking screenshot after TikTok start...')
    try {
      const screenshotTask = await geelarkApi.takeScreenshot(profile_id)
      log('Screenshot task created', { taskId: screenshotTask.taskId })
      
      // Wait a bit and get the result
      await new Promise(resolve => setTimeout(resolve, 2000))
      const screenshotResult = await geelarkApi.getScreenshotResult(screenshotTask.taskId)
      log('Screenshot result', screenshotResult)
    } catch (e) {
      log('Screenshot failed', { error: String(e) })
    }

    // Step 6: If phone number provided, try to initiate login
    let rentalId: string | undefined
    if (phone_number) {
      log('Phone number provided, checking if it needs SMS', { phone_number })
      
      // First, let's check recent rentals for this phone number
      const { data: existingRental } = await supabaseAdmin
        .from('sms_rentals')
        .select('*')
        .eq('phone_number', phone_number)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (existingRental) {
        rentalId = existingRental.rental_id
        log('Found existing rental', { 
          rental_id: rentalId,
          status: existingRental.status,
          otp: existingRental.otp
        })
      }
    }

    // Step 7: Manual mode - just provide info for manual testing
    if (manual_mode) {
      log('Manual mode - providing debug info')
      
      // Rent a number if not provided
      if (!phone_number) {
        log('Renting new number with lf service code...')
        try {
          const rental = await daisyApi.rentNumber(undefined, false)
          rentalId = rental.rental_id
          
          log('Number rented successfully', {
            rental_id: rental.rental_id,
            phone: rental.phone
          })
          
          return NextResponse.json({
            success: true,
            mode: 'manual',
            rental: {
              rental_id: rental.rental_id,
              phone: rental.phone
            },
            instructions: [
              `1. Phone is ready and TikTok is started`,
              `2. Use phone number: ${rental.phone}`,
              `3. Manually navigate to login screen and enter the phone number`,
              `4. Monitor OTP at: /api/daisysms/check-otp/${rental.rental_id}`,
              `5. Check webhook logs for any incoming SMS`,
              `6. Take screenshots to see what's happening`
            ],
            debugLog
          })
        } catch (error) {
          log('Failed to rent number', { error: String(error) })
          throw error
        }
      }
    }

    // Step 8: Check GeeLark task status if we have recent tasks
    log('Checking for recent TikTok tasks...')
    const { data: recentTasks } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('profile_id', profile_id)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (recentTasks && recentTasks.length > 0) {
      log('Found recent tasks', { 
        count: recentTasks.length,
        latest: recentTasks[0]
      })
    }

    // Step 9: Check DaisySMS logs
    log('Checking DaisySMS logs...')
    const { data: daisyLogs } = await supabaseAdmin
      .from('logs')
      .select('*')
      .eq('component', 'daisy-api')
      .gte('timestamp', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 min
      .order('timestamp', { ascending: false })
      .limit(10)
    
    if (daisyLogs && daisyLogs.length > 0) {
      log('Found DaisySMS logs', { count: daisyLogs.length })
    }

    // Step 10: Final status check
    const finalStatus = {
      phone_ready: phoneStatus.successDetails?.[0]?.status === 0,
      tiktok_installed: isInstalled,
      rental_id: rentalId,
      phone_number: phone_number,
      recent_tasks: recentTasks?.length || 0,
      daisy_logs: daisyLogs?.length || 0
    }
    
    log('Debug complete', finalStatus)

    // Save debug log
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'tiktok-login-debug',
      message: 'Debug session completed',
      meta: {
        profile_id,
        phone_number,
        manual_mode,
        final_status: finalStatus,
        debug_log: debugLog
      }
    })

    return NextResponse.json({
      success: true,
      finalStatus,
      debugLog,
      nextSteps: [
        'Check screenshots to see TikTok state',
        'Monitor SMS rentals for OTP',
        'Check webhook logs',
        'Try manual login if automated fails'
      ]
    })

  } catch (error) {
    log('Debug failed', { error: String(error) })
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      debugLog
    }, { status: 500 })
  }
} 