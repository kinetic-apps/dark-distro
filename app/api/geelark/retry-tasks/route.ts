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

    // Retry tasks via GeeLark API
    const result = await geelarkApi.retryTasks(task_ids)

    // Update task statuses in database
    if (result.successAmount > 0) {
      // First get current tasks to update retry count
      const { data: tasks } = await supabaseAdmin
        .from('tasks')
        .select('geelark_task_id, meta')
        .in('geelark_task_id', task_ids)

      // Update each task with incremented retry count
      await Promise.all(
        tasks?.map(async (task) => {
          const currentRetryCount = task.meta?.retry_count || 0
          await supabaseAdmin
            .from('tasks')
            .update({
              status: 'running',
              started_at: new Date().toISOString(),
              completed_at: null,
              meta: {
                ...task.meta,
                retry_count: currentRetryCount + 1
              }
            })
            .eq('geelark_task_id', task.geelark_task_id)
        }) || []
      )
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-retry-tasks',
      message: 'Tasks retried',
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
      retried: result.successAmount,
      failed: result.failAmount,
      failDetails: result.failDetails
    })
  } catch (error) {
    console.error('Retry tasks error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-retry-tasks',
      message: 'Failed to retry tasks',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to retry tasks' },
      { status: 500 }
    )
  }
} 