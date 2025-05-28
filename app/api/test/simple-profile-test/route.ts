import { NextRequest, NextResponse } from 'next/server'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { action = 'rent' } = await request.json()
    
    if (action === 'rent') {
      // Rent a number with lf service code
      console.log('Renting TikTok number...')
      const rental = await daisyApi.rentNumber()
      
      // Format phone number for display
      const phoneFormats = {
        raw: rental.phone,
        with_plus: `+${rental.phone}`,
        with_country: `+1${rental.phone.substring(1)}`,
        formatted: `+1 (${rental.phone.substring(1, 4)}) ${rental.phone.substring(4, 7)}-${rental.phone.substring(7)}`,
        tiktok_format: rental.phone.substring(1) // Remove leading 1 for TikTok
      }
      
      console.log('Phone formats:', phoneFormats)
      
      // Log for debugging
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'simple-profile-test',
        message: 'TikTok number rented for testing',
        meta: {
          rental_id: rental.rental_id,
          phone_formats: phoneFormats,
          service: 'lf'
        }
      })
      
      return NextResponse.json({
        success: true,
        rental: {
          id: rental.id,
          rental_id: rental.rental_id,
          phone: rental.phone
        },
        phone_formats: phoneFormats,
        instructions: [
          '1. Try each phone format in TikTok login',
          '2. Most likely format: ' + phoneFormats.tiktok_format + ' (without country code)',
          '3. Alternative: ' + phoneFormats.with_plus,
          '4. Check OTP at: /api/daisysms/check-otp/' + rental.rental_id,
          '5. Monitor webhook: tail logs for daisysms-webhook',
          '6. Complete rental when done: POST /api/daisysms/set-status {"rental_id": "' + rental.rental_id + '", "status": "6"}'
        ],
        debug_queries: [
          `SELECT * FROM sms_rentals WHERE rental_id = '${rental.rental_id}'`,
          `SELECT * FROM logs WHERE component = 'daisysms-webhook' ORDER BY timestamp DESC LIMIT 10`
        ]
      })
    } else if (action === 'check_format') {
      // Check what format TikTok expects
      return NextResponse.json({
        success: true,
        tiktok_phone_formats: {
          usa_format: '(XXX) XXX-XXXX',
          usa_no_country: 'XXX-XXX-XXXX',
          international: '+1 XXX XXX XXXX',
          raw_10_digit: 'XXXXXXXXXX',
          notes: [
            'TikTok usually expects 10-digit US numbers without country code',
            'DaisySMS returns 11-digit numbers starting with 1',
            'Remove the leading 1 before entering in TikTok',
            'Example: 14236020676 → 4236020676'
          ]
        }
      })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Simple profile test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
} 