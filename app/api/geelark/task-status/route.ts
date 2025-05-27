import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    // Fetch all running tasks
    const { data: runningTasks, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('status', 'running')

    if (error) throw error

    const results = await Promise.allSettled(
      runningTasks.map(async (task) => {
        if (!task.geelark_task_id) return

        try {
          const taskStatus = await geelarkApi.getTaskStatus(task.geelark_task_id)

          // Update task status
          if (taskStatus.status !== 'running') {
            await supabaseAdmin
              .from('tasks')
              .update({
                status: taskStatus.status === 'completed' ? 'completed' : 'failed',
                ended_at: new Date().toISOString(),
                message: taskStatus.result?.message || null,
                meta: { ...task.meta, result: taskStatus.result }
              })
              .eq('id', task.id)

            // Handle warmup completion
            if (task.type === 'warmup' && taskStatus.status === 'completed') {
              await supabaseAdmin
                .from('accounts')
                .update({
                  warmup_done: true,
                  warmup_progress: 100,
                  status: 'active'
                })
                .eq('id', task.account_id)

              await supabaseAdmin.from('logs').insert({
                level: 'info',
                component: 'task-poller',
                account_id: task.account_id,
                message: 'Warm-up completed',
                meta: { task_id: task.geelark_task_id }
              })
            }

            // Handle post completion
            if (task.type === 'post' && taskStatus.status === 'completed') {
              const tiktokPostId = taskStatus.result?.post_id || null

              await supabaseAdmin
                .from('posts')
                .update({
                  status: 'posted',
                  tiktok_post_id: tiktokPostId,
                  posted_at: new Date().toISOString()
                })
                .eq('geelark_task_id', task.geelark_task_id)

              await supabaseAdmin.from('logs').insert({
                level: 'info',
                component: 'task-poller',
                account_id: task.account_id,
                message: 'Post published successfully',
                meta: { 
                  task_id: task.geelark_task_id,
                  tiktok_post_id: tiktokPostId
                }
              })
            }

            // Handle failures
            if (taskStatus.status === 'failed') {
              if (task.type === 'post') {
                await supabaseAdmin
                  .from('posts')
                  .update({
                    status: 'failed',
                    error: taskStatus.result?.error || 'Unknown error'
                  })
                  .eq('geelark_task_id', task.geelark_task_id)
              }

              await supabaseAdmin.from('logs').insert({
                level: 'error',
                component: 'task-poller',
                account_id: task.account_id,
                message: `${task.type} task failed`,
                meta: { 
                  task_id: task.geelark_task_id,
                  error: taskStatus.result?.error
                }
              })

              // Increment error count on account
              await supabaseAdmin.rpc('increment', {
                table_name: 'accounts',
                row_id: task.account_id,
                column_name: 'error_count'
              })
            }
          } else if (task.type === 'warmup' && taskStatus.status === 'running') {
            // Calculate time-based progress for running warmup tasks
            const startTime = new Date(task.started_at || task.created_at).getTime()
            const currentTime = Date.now()
            const elapsedMinutes = (currentTime - startTime) / (1000 * 60)
            const durationMinutes = task.meta?.duration_minutes || 30
            
            // Calculate progress as percentage (0-99, never 100 until actually complete)
            const progress = Math.min(99, Math.floor((elapsedMinutes / durationMinutes) * 100))
            
            // Update warmup progress
            await supabaseAdmin
              .from('accounts')
              .update({
                warmup_progress: progress,
                updated_at: new Date().toISOString()
              })
              .eq('id', task.account_id)
              
            // Log progress update
            if (progress % 10 === 0) { // Log every 10% increment
              await supabaseAdmin.from('logs').insert({
                level: 'info',
                component: 'task-poller',
                account_id: task.account_id,
                message: `Warmup progress: ${progress}%`,
                meta: { 
                  task_id: task.geelark_task_id,
                  elapsed_minutes: Math.floor(elapsedMinutes),
                  duration_minutes: durationMinutes
                }
              })
            }
          }

          return { task_id: task.id, status: taskStatus.status }
        } catch (error) {
          // Log the error but don't fail the entire batch
          console.error(`Failed to check status for task ${task.geelark_task_id}:`, error)
          return { task_id: task.id, status: 'error', error: String(error) }
        }
      })
    )

    const updated = results.filter(r => r.status === 'fulfilled').length

    return NextResponse.json({
      success: true,
      checked: runningTasks.length,
      updated
    })
  } catch (error) {
    console.error('Task status check error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'task-poller',
      message: 'Failed to check task statuses',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to check task statuses' },
      { status: 500 }
    )
  }
}

// This endpoint can be called by a cron job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { task_ids } = body

    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid task IDs' },
        { status: 400 }
      )
    }

    // Query task status from GeeLark
    const taskStatus = await geelarkApi.queryTasks(task_ids)

    // Update local task records
    const updatePromises = taskStatus.items?.map(async (task: any) => {
      const status = task.status === 3 ? 'completed' : 
                    task.status === 4 ? 'failed' : 
                    task.status === 7 ? 'cancelled' :
                    task.status === 2 ? 'running' : 'pending'

      await supabaseAdmin
        .from('tasks')
        .update({
          status,
          completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
          error_message: task.failDesc || null,
          meta: {
            geelark_status: task.status,
            fail_code: task.failCode,
            fail_desc: task.failDesc,
            cost_seconds: task.cost
          },
          updated_at: new Date().toISOString()
        })
        .eq('geelark_task_id', task.id)
    }) || []

    await Promise.all(updatePromises)

    return NextResponse.json({
      success: true,
      tasks: taskStatus.items || []
    })
  } catch (error) {
    console.error('Task status error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-task-status',
      message: 'Failed to get task status',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to get task status' },
      { status: 500 }
    )
  }
}