import { NextRequest, NextResponse } from 'next/server'
import { daisyApi } from '@/lib/daisy-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { rental_id, status, reason } = await request.json()

    if (!rental_id || !status) {
      return NextResponse.json(
        { error: 'Missing rental_id or status' },
        { status: 400 }
      )
    }

    if (status !== '6' && status !== '8') {
      return NextResponse.json(
        { error: 'Invalid status. Must be 6 (complete) or 8 (cancel)' },
        { status: 400 }
      )
    }

    // Set the status in DaisySMS
    await daisyApi.setStatus(rental_id, status)

    // Log the action
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'daisysms-status',
      message: `Rental status set to ${status === '6' ? 'completed' : 'cancelled'}`,
      meta: { rental_id, status, reason }
    })

    return NextResponse.json({
      success: true,
      status: status === '6' ? 'completed' : 'cancelled',
      rental_id
    })
  } catch (error) {
    console.error('DaisySMS set status error:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}