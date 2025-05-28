import { NextRequest, NextResponse } from 'next/server'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')
    const rentalId = searchParams.get('rental_id')
    const accountId = searchParams.get('account_id')
    
    // Action: Get phone number for a specific account
    if (action === 'get_phone') {
      if (!accountId) {
        return NextResponse.json({ 
          success: false, 
          error: 'account_id required' 
        })
      }
      
      // Get the most recent phone number from SMS rentals for this account
      const { data: rental } = await supabaseAdmin
        .from('sms_rentals')
        .select('phone_number, rental_id, status')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (!rental || !rental.phone_number) {
        return NextResponse.json({ 
          success: false, 
          error: 'No phone number found for account' 
        })
      }
      
      // Log the request
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'geelark-daisysms-proxy',
        message: 'Phone number retrieved',
        meta: { 
          account_id: accountId,
          phone_number: rental.phone_number,
          rental_id: rental.rental_id,
          status: rental.status
        }
      })
      
      // Format phone number - remove country code '1' if present
      const formattedPhone = rental.phone_number.startsWith('1') && rental.phone_number.length === 11 
        ? rental.phone_number.substring(1) 
        : rental.phone_number
      
      return NextResponse.json({ 
        success: true, 
        phone_number: formattedPhone,
        rental_id: rental.rental_id,
        status: rental.status
      })
    }
    
    // Action: Check OTP status
    if (action === 'check_otp') {
      if (!rentalId) {
        return NextResponse.json({ 
          success: false, 
          error: 'rental_id required' 
        })
      }
      
      try {
        const otpStatus = await daisyApi.checkOTP(rentalId)
        
        return NextResponse.json({
          success: true,
          status: otpStatus.status,
          otp_code: otpStatus.code || '',
          has_otp: !!otpStatus.code
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to check OTP',
          details: error instanceof Error ? error.message : String(error)
        })
      }
    }
    
    // Action: Get both phone and OTP in one call
    if (action === 'get_credentials') {
      if (!accountId) {
        return NextResponse.json({ 
          success: false, 
          error: 'account_id required' 
        })
      }
      
      // Get account data
      const { data: account } = await supabaseAdmin
        .from('accounts')
        .select('meta')
        .eq('id', accountId)
        .single()
      
      if (!account?.meta?.phone_number) {
        return NextResponse.json({ 
          success: false, 
          error: 'No phone number found' 
        })
      }
      
      const phoneNumber = account.meta.phone_number
      const formattedPhone = phoneNumber.startsWith('1') ? phoneNumber.substring(1) : phoneNumber
      const rentalId = account.meta.rental_id
      
      // Check for OTP if we have a rental ID
      let otpCode = ''
      if (rentalId) {
        try {
          const otpStatus = await daisyApi.checkOTP(rentalId)
          otpCode = otpStatus.code || ''
        } catch (error) {
          console.error('OTP check error:', error)
        }
      }
      
      return NextResponse.json({
        success: true,
        phone_number: formattedPhone,
        otp_code: otpCode,
        rental_id: rentalId,
        has_otp: !!otpCode
      })
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid action. Use: get_phone, check_otp, or get_credentials' 
    })
    
  } catch (error) {
    console.error('DaisySMS proxy error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
} 