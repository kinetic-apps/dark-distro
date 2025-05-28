import { NextRequest, NextResponse } from 'next/server'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    console.log('Testing DaisySMS rental...')
    
    // Check parameters
    const searchParams = request.nextUrl.searchParams
    const longTermRental = searchParams.get('ltr') === 'true'
    const serviceCode = searchParams.get('service') || 'lf' // Default to TikTok
    
    // First check balance
    const balance = await daisyApi.getBalance()
    console.log('Current balance:', balance)
    
    if (balance < 1) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient balance',
        balance
      }, { status: 400 })
    }

    // Test different service codes by making direct API call
    console.log(`Testing rental with service code: ${serviceCode}`)
    
    const url = new URL(process.env.DAISYSMS_API_BASE_URL!)
    url.searchParams.append('api_key', process.env.DAISYSMS_API_KEY!)
    url.searchParams.append('action', 'getNumber')
    url.searchParams.append('service', serviceCode)
    url.searchParams.append('country', '0')
    url.searchParams.append('max_price', '2.00')
    
    if (longTermRental) {
      url.searchParams.append('ltr', '1')
      url.searchParams.append('auto_renew', '1')
    }

    const response = await fetch(url.toString())
    const text = await response.text()

    console.log('DaisySMS raw response:', text)
    
    if (!response.ok || !text.startsWith('ACCESS_NUMBER')) {
      return NextResponse.json({
        success: false,
        error: `Failed to rent number: ${text}`,
        service_code: serviceCode,
        possible_issues: [
          'Service code might be incorrect',
          'Service might not be available',
          'Price might have increased',
          'No numbers available for this service'
        ]
      }, { status: 400 })
    }

    // Parse successful response
    const [status, rentalId, phoneNumber] = text.split(':')
    
    // Save to database
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + (longTermRental ? 24 : 72))
    
    const { data } = await supabaseAdmin
      .from('sms_rentals')
      .insert({
        rental_id: rentalId,
        phone_number: phoneNumber,
        status: 'waiting',
        expires_at: expiresAt.toISOString(),
        meta: {
          long_term_rental: longTermRental,
          service_code: serviceCode,
          test_rental: true
        }
      })
      .select()
      .single()

    return NextResponse.json({
      success: true,
      rental: {
        id: data?.id,
        rental_id: rentalId,
        phone: phoneNumber,
        expires_at: expiresAt
      },
      balance_before: balance,
      long_term_rental: longTermRental,
      service_code: serviceCode,
      raw_response: text,
      test_instructions: [
        `1. Use phone number: +${phoneNumber}`,
        `2. Try to login to TikTok with this number`,
        `3. Check OTP status at: /api/daisysms/check-otp/${rentalId}`,
        `4. Monitor logs for any errors`,
        `5. If no OTP after 5 minutes, try completing: POST /api/daisysms/set-status {"rental_id": "${rentalId}", "status": "6"}`,
        `6. Or cancel for refund: POST /api/daisysms/set-status {"rental_id": "${rentalId}", "status": "8"}`
      ],
      alternative_service_codes: {
        'lf': 'TikTok (found via search)',
        'wa': 'WhatsApp (often used for TikTok)',
        'ig': 'Instagram',
        'tg': 'Telegram'
      }
    })
  } catch (error) {
    console.error('DaisySMS rental test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
} 