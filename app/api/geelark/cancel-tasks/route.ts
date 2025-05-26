import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { task_ids } = body

    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      return NextResponse.json(
        { error: 'Task IDs array is required' },
        { status: 400 }
      )
    }

    // Cancel tasks via GeeLark API
    const result = await geelarkApi.cancelTasks(task_ids)

    // Update task statuses in database
    if (result.successAmount > 0) {
      await supabaseAdmin
        .from('tasks')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .in('geelark_task_id', task_ids)
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-cancel-tasks',
      message: 'Tasks cancelled',
      meta: { 
        total: result.totalAmount,
        success: result.successAmount,
        failed: result.failAmount,
        task_ids
      }
    })

    return NextResponse.json({
      success: true,
      total: result.totalAmount,
      cancelled: result.successAmount,
      failed: result.failAmount,
      failDetails: result.failDetails
    })
  } catch (error) {
    console.error('Cancel tasks error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-cancel-tasks',
      message: 'Failed to cancel tasks',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to cancel tasks' },
      { status: 500 }
    )
  }
} 