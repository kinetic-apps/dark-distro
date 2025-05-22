import { NextRequest, NextResponse } from 'next/server'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_id } = body

    // Check current rental count
    const canRent = await daisyApi.canRentNewNumber()
    if (!canRent) {
      return NextResponse.json(
        { error: 'Maximum concurrent rentals (20) reached' },
        { status: 429 }
      )
    }

    // Rent number
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