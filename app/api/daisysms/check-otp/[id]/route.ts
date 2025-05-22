import { NextRequest, NextResponse } from 'next/server'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rentalId = id
  
  try {

    // Get rental from database
    const { data: rental, error } = await supabaseAdmin
      .from('sms_rentals')
      .select('*')
      .eq('id', rentalId)
      .single()

    if (error || !rental) {
      return NextResponse.json(
        { error: 'Rental not found' },
        { status: 404 }
      )
    }

    if (!rental.rental_id) {
      return NextResponse.json(
        { error: 'Invalid rental' },
        { status: 400 }
      )
    }

    // Check if already received or expired
    if (rental.status === 'received' || rental.status === 'expired') {
      return NextResponse.json({
        status: rental.status,
        code: rental.otp_code
      })
    }

    // Check OTP status
    const otpStatus = await daisyApi.checkOTP(rental.rental_id)

    return NextResponse.json({
      status: otpStatus.status,
      code: otpStatus.code
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
      { error: 'Failed to check OTP' },
      { status: 500 }
    )
  }
}