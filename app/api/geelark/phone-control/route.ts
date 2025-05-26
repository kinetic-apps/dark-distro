import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profile_ids, action } = body

    if (!Array.isArray(profile_ids) || profile_ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid profile IDs' },
        { status: 400 }
      )
    }

    if (!['start', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "start" or "stop"' },
        { status: 400 }
      )
    }

    // Execute the action
    const result = action === 'start' 
      ? await geelarkApi.startPhones(profile_ids)
      : await geelarkApi.stopPhones(profile_ids)

    // Update phone status in database
    if (result.successDetails && result.successDetails.length > 0) {
      await Promise.all(
        result.successDetails.map(async (detail: any) => {
          await supabaseAdmin
            .from('phones')
            .update({
              status: action === 'start' ? 'online' : 'offline',
              updated_at: new Date().toISOString()
            })
            .eq('profile_id', detail.id)
        })
      )
    }

    // Log the operation
    await supabaseAdmin.from('logs').insert({
      level: result.failAmount > 0 ? 'warning' : 'info',
      component: 'api-phone-control',
      message: `Phone ${action} operation completed`,
      meta: {
        action,
        total: result.totalAmount,
        success: result.successAmount,
        failed: result.failAmount,
        failures: result.failDetails
      }
    })

    return NextResponse.json({
      success: true,
      action,
      results: {
        total: result.totalAmount,
        success: result.successAmount,
        failed: result.failAmount,
        failures: result.failDetails,
        successes: result.successDetails
      }
    })
  } catch (error) {
    console.error('Phone control error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-phone-control',
      message: 'Failed to control phones',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to control phones' },
      { status: 500 }
    )
  }
} 