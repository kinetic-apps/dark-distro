import { NextRequest, NextResponse } from 'next/server'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rentalId } = await params
  
  try {

    // Get the rental from database
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from('sms_rentals')
      .select('*, accounts(*)')
      .eq('rental_id', rentalId)
      .single()

    if (rentalError || !rental) {
      return NextResponse.json(
        { error: 'Rental not found' },
        { status: 404 }
      )
    }

    // Check if the associated account is already active (login successful)
    if (rental.accounts && (rental.accounts.status === 'active' || rental.accounts.status === 'warming_up')) {
      // Login was successful, complete the rental if not already done
      if (rental.status === 'waiting') {
        try {
          await daisyApi.setStatus(rentalId, '6') // Complete the rental
          
          await supabaseAdmin
            .from('sms_rentals')
            .update({
              status: 'completed_no_sms',
              meta: {
                ...rental.meta,
                completed_reason: 'login_successful_without_sms',
                completed_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('rental_id', rentalId)

      return NextResponse.json({
            status: 'completed_no_sms',
            message: 'Login was successful without SMS verification',
            rental_completed: true
          })
        } catch (completeError) {
          console.error('Failed to complete rental:', completeError)
        }
      }
    }

    // Check OTP status from DaisySMS
    const otpStatus = await daisyApi.checkOTP(rentalId)

    // If OTP received and rental is still waiting, complete it
    if (otpStatus.status === 'received' && otpStatus.code && rental.status === 'waiting') {
      try {
        await daisyApi.setStatus(rentalId, '6') // Complete the rental
      } catch (completeError) {
        console.error('Failed to complete rental after OTP:', completeError)
      }
    }

    return NextResponse.json({
      ...otpStatus,
      rental_status: rental.status,
      account_status: rental.accounts?.status
    })
  } catch (error) {
    console.error('Check OTP error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-check-otp',
      message: 'Failed to check OTP',
      meta: { error: String(error), rental_id: rentalId }
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check OTP' },
      { status: 500 }
    )
  }
}