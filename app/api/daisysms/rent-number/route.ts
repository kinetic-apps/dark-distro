import { NextRequest, NextResponse } from 'next/server'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    // Handle empty body or JSON parsing errors
    let body: any = {}
    try {
      const text = await request.text()
      if (text) {
        body = JSON.parse(text)
      }
    } catch (e) {
      // Empty body is fine, continue with empty object
    }
    
    const { account_id } = body

    // Rent number - let DaisySMS handle their own limits
    const rental = await daisyApi.rentNumber(account_id)

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-rent-number',
      account_id,
      message: 'Phone number rented',
      meta: { 
        rental_id: rental.id,
        phone_number: rental.phone,
        expires_at: rental.expires_at
      }
    })

    return NextResponse.json({
      success: true,
      id: rental.id,
      phone: rental.phone,
      expires_at: rental.expires_at
    })
  } catch (error) {
    console.error('Rent number error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-rent-number',
      message: 'Failed to rent number',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to rent number' },
      { status: 500 }
    )
  }
}