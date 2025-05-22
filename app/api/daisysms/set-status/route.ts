import { NextRequest, NextResponse } from 'next/server'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  let rental_id: string | undefined
  
  try {
    const body = await request.json()
    rental_id = body.rental_id
    const { status } = body

    if (!rental_id || !['6', '8'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid rental ID or status' },
        { status: 400 }
      )
    }

    // Set status in DaisySMS
    await daisyApi.setStatus(rental_id, status as '6' | '8')

    const statusText = status === '6' ? 'completed' : 'cancelled'

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-set-status',
      message: `Rental ${statusText}`,
      meta: { rental_id, status }
    })

    return NextResponse.json({
      success: true,
      status: statusText
    })
  } catch (error) {
    console.error('Set status error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-set-status',
      message: 'Failed to set rental status',
      meta: { error: String(error), rental_id }
    })

    return NextResponse.json(
      { error: 'Failed to set status' },
      { status: 500 }
    )
  }
}