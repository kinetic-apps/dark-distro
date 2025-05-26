import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_id, profile_id, phone_number, otp_code } = body

    if (!account_id || !profile_id) {
      return NextResponse.json(
        { error: 'Account ID and Profile ID are required' },
        { status: 400 }
      )
    }

    // If no phone number provided, check if account has an SMS rental
    let phoneToUse = phone_number
    let rentalId: string | null = null

    if (!phoneToUse && !otp_code) {
      // Check for existing SMS rental
      const { data: rental } = await supabaseAdmin
        .from('sms_rentals')
        .select('*')
        .eq('account_id', account_id)
        .eq('status', 'waiting')
        .single()

      if (rental) {
        phoneToUse = rental.phone_number
        rentalId = rental.rental_id
      } else {
        // Rent a new number
        const rentalInfo = await daisyApi.rentNumber(account_id)
        phoneToUse = rentalInfo.phone
        
        // Get the rental ID from database
        const { data: newRental } = await supabaseAdmin
          .from('sms_rentals')
          .select('rental_id')
          .eq('id', rentalInfo.id)
          .single()
          
        rentalId = newRental?.rental_id || null
      }
    }

    // Initiate TikTok login
    const taskData = await geelarkApi.loginTikTok(profile_id, phoneToUse, otp_code)

    // Store login attempt
    await supabaseAdmin.from('tasks').insert({
      type: 'login',
      geelark_task_id: taskData.task_id,
      account_id,
      status: 'running',
      started_at: new Date().toISOString(),
      meta: {
        phone_number: phoneToUse,
        rental_id: rentalId,
        has_otp: !!otp_code
      }
    })

    // If OTP was not provided, we need to wait for it
    if (!otp_code && rentalId) {
      // Start checking for OTP in background
      checkForOTP(rentalId, account_id, profile_id, taskData.task_id)
    }

    return NextResponse.json({
      success: true,
      task_id: taskData.task_id,
      phone_number: phoneToUse,
      rental_id: rentalId,
      status: otp_code ? 'logging_in' : 'waiting_for_otp'
    })
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