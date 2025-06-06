import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    // Fetch all running tasks AND recently completed tasks (within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const { data: tasksToCheck, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .or(`status.eq.running,and(status.in.(completed,failed,cancelled),completed_at.gte.${oneHourAgo})`)

    if (error) throw error

    const results = await Promise.allSettled(
      tasksToCheck.map(async (task) => {
        if (!task.geelark_task_id) return

        try {
          const taskStatus = await geelarkApi.getTaskStatus(task.geelark_task_id)
          
          // Always update the geelark_status in meta
          const updatedMeta = {
            ...task.meta,
            geelark_status: taskStatus.result?.geelark_status || (taskStatus.status === 'completed' ? 3 : 
                           taskStatus.status === 'failed' ? 4 : 
                           taskStatus.status === 'cancelled' ? 7 : 
                           taskStatus.status === 'running' ? 2 : 1),
            result: taskStatus.result
          }

          // Update task status
          if (taskStatus.status !== task.status || task.meta?.geelark_status !== updatedMeta.geelark_status) {
            await supabaseAdmin
              .from('tasks')
              .update({
                status: taskStatus.status === 'completed' ? 'completed' : 
                       taskStatus.status === 'failed' ? 'failed' :
                       taskStatus.status === 'cancelled' ? 'cancelled' :
                       taskStatus.status === 'running' ? 'running' : 'pending',
                completed_at: taskStatus.status !== 'running' && taskStatus.status !== 'pending' ? new Date().toISOString() : task.completed_at,
                message: taskStatus.result?.message || null,
                meta: updatedMeta,
                updated_at: new Date().toISOString()
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

            // Handle login completion
            if (task.type === 'login' && taskStatus.status === 'completed') {
              // Get the current account status
              const { data: account } = await supabaseAdmin
                .from('accounts')
                .select('status')
                .eq('id', task.account_id)
                .single()

              // Only update if account is still in pending_verification status
              if (account?.status === 'pending_verification') {
                await supabaseAdmin
                  .from('accounts')
                  .update({
                    status: 'active',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', task.account_id)

                await supabaseAdmin.from('logs').insert({
                  level: 'info',
                  component: 'task-poller',
                  account_id: task.account_id,
                  message: 'Login completed successfully - account activated',
                  meta: { 
                    task_id: task.geelark_task_id,
                    previous_status: 'pending_verification'
                  }
                })
              }
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

              // Handle login task failures
              if (task.type === 'login') {
                // Get the current account status
                const { data: account } = await supabaseAdmin
                  .from('accounts')
                  .select('status')
                  .eq('id', task.account_id)
                  .single()

                // Only update if account is still in pending_verification status
                if (account?.status === 'pending_verification') {
                  await supabaseAdmin
                    .from('accounts')
                    .update({
                      status: 'error',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', task.account_id)
                }
              }

              await supabaseAdmin.from('logs').insert({
                level: 'error',
                component: 'task-poller',
                account_id: task.account_id,
                message: `${task.type} task failed`,
                meta: { 
                  task_id: task.geelark_task_id,
                  error: taskStatus.result?.error,
                  fail_code: taskStatus.result?.failCode,
                  fail_desc: taskStatus.result?.failDesc
                }
              })

              // Increment error count on account
              await supabaseAdmin.rpc('increment', {
                table_name: 'accounts',
                row_id: task.account_id,
                column_name: 'error_count'
              })
            }

            return { task_id: task.id, status: taskStatus.status }
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
      checked: tasksToCheck.length,
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

    console.log('[API] Task status sync request received for task IDs:', task_ids)

    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      console.log('[API] No task IDs provided, returning early')
      return NextResponse.json(
        { error: 'Invalid task IDs' },
        { status: 400 }
      )
    }

    // Query task status from GeeLark
    console.log(`[API] Querying GeeLark for ${task_ids.length} tasks...`)
    const taskStatus = await geelarkApi.queryTasks(task_ids)
    
    console.log('[API] GeeLark response:', JSON.stringify(taskStatus, null, 2))

    // Update local task records
    const updatePromises = taskStatus.items?.map(async (task: any) => {
      const status = task.status === 3 ? 'completed' : 
                    task.status === 4 ? 'failed' : 
                    task.status === 7 ? 'cancelled' :
                    task.status === 2 ? 'running' : 'pending'

      console.log(`[API] Updating task ${task.id}: GeeLark status ${task.status} -> ${status}`)

      // Store complete GeeLark response in meta
      const updatedMeta = {
        geelark_status: task.status,
        geelark_task_type: task.taskType,
        plan_name: task.planName,
        serial_name: task.serialName,
        env_id: task.envId,
        schedule_at: task.scheduleAt,
        fail_code: task.failCode,
        fail_desc: task.failDesc,
        cost: task.cost,
        cost_seconds: task.cost,
        last_sync: new Date().toISOString()
      }

      const { data, error } = await supabaseAdmin
        .from('tasks')
        .update({
          status,
          completed_at: status === 'completed' || status === 'failed' || status === 'cancelled' ? new Date().toISOString() : null,
          error_message: task.failDesc || null,
          meta: updatedMeta,
          updated_at: new Date().toISOString()
        })
        .eq('geelark_task_id', task.id)
        .select()

      if (error) {
        console.error(`[API] Failed to update task ${task.id}:`, error)
      } else {
        console.log(`[API] Successfully updated task ${task.id}`)
        
        // Handle specific task completions
        if (status === 'completed' && data && data[0]) {
          const taskData = data[0]
          
          // Handle warmup completion
          if (taskData.type === 'warmup') {
            await supabaseAdmin
              .from('accounts')
              .update({
                warmup_done: true,
                warmup_progress: 100,
                status: 'active'
              })
              .eq('id', taskData.account_id)
          }
          
          // Handle login completion
          if (taskData.type === 'login' || taskData.type === 'sms_login') {
            await supabaseAdmin
              .from('accounts')
              .update({
                status: 'active',
                updated_at: new Date().toISOString()
              })
              .eq('id', taskData.account_id)
          }
          
          // Handle post completion
          if (taskData.type === 'post') {
            await supabaseAdmin
              .from('posts')
              .update({
                status: 'posted',
                posted_at: new Date().toISOString()
              })
              .eq('geelark_task_id', task.id)
          }
        }
        
        // Handle failures
        if (status === 'failed' && data && data[0]) {
          const taskData = data[0]
          
          if (taskData.type === 'post') {
            await supabaseAdmin
              .from('posts')
              .update({
                status: 'failed',
                error: task.failDesc || 'Unknown error'
              })
              .eq('geelark_task_id', task.id)
          }
          
          // Increment error count on account
          await supabaseAdmin.rpc('increment', {
            table_name: 'accounts',
            row_id: taskData.account_id,
            column_name: 'error_count'
          })
        }
      }

      return { task_id: task.id, status, error }
    }) || []

    const results = await Promise.all(updatePromises)
    const updatedCount = results.filter(r => !r.error).length

    console.log(`[API] Updated ${updatedCount}/${taskStatus.items?.length || 0} tasks`)

    return NextResponse.json({
      success: true,
      tasks: taskStatus.items || [],
      updated: updatedCount
    })
  } catch (error) {
    console.error('[API] Task status error:', error)
    
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