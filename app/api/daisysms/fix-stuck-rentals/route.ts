import { NextRequest, NextResponse } from 'next/server'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    // Find all waiting rentals
    const { data: rentals, error } = await supabaseAdmin
      .from('sms_rentals')
      .select('*, accounts(*)')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })

    if (error) throw error

    const results = []

    for (const rental of rentals || []) {
      const result: any = {
        rental_id: rental.rental_id,
        phone_number: rental.phone_number,
        account_id: rental.account_id,
        created_at: rental.created_at
      }

      try {
        // Check if the associated account is already active
        if (rental.accounts && (rental.accounts.status === 'active' || rental.accounts.status === 'warming_up')) {
          // Login was successful, complete the rental
          await daisyApi.setStatus(rental.rental_id, '6')
          
          await supabaseAdmin
            .from('sms_rentals')
            .update({
              status: 'completed_no_sms',
              meta: {
                ...rental.meta,
                completed_reason: 'login_successful_without_sms',
                fixed_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('rental_id', rental.rental_id)

          result.action = 'completed'
          result.reason = 'login_successful_without_sms'
          result.account_status = rental.accounts.status
        } else {
          // Check OTP status
          const otpStatus = await daisyApi.checkOTP(rental.rental_id)
          
          if (otpStatus.status === 'received' && otpStatus.code) {
            // OTP received, complete the rental
            await daisyApi.setStatus(rental.rental_id, '6')
            result.action = 'completed'
            result.reason = 'otp_received'
            result.otp_code = otpStatus.code
          } else if (otpStatus.status === 'cancelled') {
            result.action = 'already_cancelled'
          } else {
            // Check if rental is older than 20 minutes
            const rentalAge = Date.now() - new Date(rental.created_at).getTime()
            const twentyMinutes = 20 * 60 * 1000
            
            if (rentalAge > twentyMinutes) {
              result.action = 'expired'
              result.age_minutes = Math.round(rentalAge / 60000)
              result.note = 'Rental will auto-cancel and refund'
            } else {
              result.action = 'still_waiting'
              result.age_minutes = Math.round(rentalAge / 60000)
            }
          }
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error)
        result.action = 'error'
      }

      results.push(result)
    }

    // Log the operation
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'daisysms-fix-stuck',
      message: 'Checked and fixed stuck rentals',
      meta: { 
        total_checked: results.length,
        completed: results.filter(r => r.action === 'completed').length,
        errors: results.filter(r => r.action === 'error').length
      }
    })

    return NextResponse.json({
      success: true,
      checked: results.length,
      results
    })
  } catch (error) {
    console.error('Fix stuck rentals error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
} 