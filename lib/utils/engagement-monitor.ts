import { supabaseAdmin } from '@/lib/supabase/admin'
import { geelarkApi } from '@/lib/geelark-api'

/**
 * Monitor engagement task completion and auto-stop phone
 * This runs in the background after the engagement task is created
 */
export async function monitorEngagementCompletion(
  accountId: string,
  profileId: string,
  taskId: string
): Promise<void> {
  console.log(`[Engagement Monitor] Starting monitoring for task ${taskId}`)
  
  const maxAttempts = 180 // 180 * 10s = 30 minutes max (matching API route maxDuration)
  let attempts = 0
  
  while (attempts < maxAttempts) {
    attempts++
    
    try {
      // Query GeeLark for task status - this is the ONLY source of truth for task completion
      const taskStatuses = await geelarkApi.queryTasks([taskId])
      
      if (!taskStatuses || !taskStatuses.items || taskStatuses.items.length === 0) {
        console.log('[Engagement Monitor] No task status data returned from GeeLark, waiting...')
        await new Promise(resolve => setTimeout(resolve, 10000))
        continue
      }
      
      const task = taskStatuses.items[0]
      const statusName = task.status === 1 ? 'Waiting' :
                       task.status === 2 ? 'In progress' :
                       task.status === 3 ? 'Completed' :
                       task.status === 4 ? 'Failed' :
                       task.status === 7 ? 'Cancelled' : `Unknown(${task.status})`
      
      console.log(`[Engagement Monitor] Task ${task.id}: status=${task.status} (${statusName})`)
      
      // Check if task is completed (status 3=completed, 4=failed, 7=cancelled)
      if (task.status === 3 || task.status === 4 || task.status === 7) {
        console.log(`[Engagement Monitor] Task ${taskId} ${statusName}`)
        
        // Update account status
        await supabaseAdmin
          .from('accounts')
          .update({
            status: task.status === 3 ? 'active' : 'error',
            geelark_task_id: null,
            meta: {
              last_engagement_status: statusName.toLowerCase(),
              last_engagement_at: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', accountId)
        
        // Update task record
        await supabaseAdmin
          .from('tasks')
          .update({
            status: task.status === 3 ? 'completed' : 'failed',
            completed_at: new Date().toISOString(),
            meta: {
              final_status: statusName.toLowerCase(),
              geelark_status_code: task.status
            }
          })
          .eq('geelark_task_id', taskId)
        
        // Stop the phone
        try {
          await geelarkApi.stopPhones([profileId])
          console.log(`[Engagement Monitor] Phone ${profileId} stopped successfully`)
          
          await supabaseAdmin.from('logs').insert({
            level: 'info',
            component: 'engagement-monitor',
            message: 'Engagement completed and phone stopped',
            meta: {
              account_id: accountId,
              profile_id: profileId,
              task_id: taskId,
              task_status: statusName.toLowerCase(),
              geelark_status_code: task.status
            }
          })
        } catch (stopError) {
          console.error(`[Engagement Monitor] Failed to stop phone ${profileId}:`, stopError)
          
          await supabaseAdmin.from('logs').insert({
            level: 'error',
            component: 'engagement-monitor',
            message: 'Failed to stop phone after engagement',
            meta: {
              account_id: accountId,
              profile_id: profileId,
              error: stopError instanceof Error ? stopError.message : String(stopError)
            }
          })
        }
        
        return // Exit the monitoring loop
      }
      
      // Log progress every 5 minutes
      if (attempts % 30 === 0) {
        const minutesElapsed = (attempts * 10) / 60
        console.log(`[Engagement Monitor] Still monitoring task ${taskId} (${minutesElapsed} minutes elapsed)`)
        
        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'engagement-monitor',
          message: 'Engagement task still running',
          meta: {
            account_id: accountId,
            task_id: taskId,
            minutes_elapsed: minutesElapsed,
            geelark_status: statusName.toLowerCase()
          }
        })
      }
      
    } catch (error) {
      console.error(`[Engagement Monitor] Error checking task ${taskId}:`, error)
      
      // Don't exit on error, continue monitoring
      if (attempts % 10 === 0) {
        await supabaseAdmin.from('logs').insert({
          level: 'warning',
          component: 'engagement-monitor',
          message: 'Error during engagement monitoring',
          meta: {
            account_id: accountId,
            task_id: taskId,
            error: error instanceof Error ? error.message : String(error),
            attempts: attempts
          }
        })
      }
    }
    
    // Wait 10 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 10000))
  }
  
  // Timeout reached (30 minutes)
  console.error(`[Engagement Monitor] Timeout monitoring task ${taskId} after 30 minutes`)
  
  await supabaseAdmin.from('logs').insert({
    level: 'error',
    component: 'engagement-monitor',
    message: 'Engagement monitoring timeout after 30 minutes',
    meta: {
      account_id: accountId,
      profile_id: profileId,
      task_id: taskId,
      max_duration_minutes: 30
    }
  })
  
  // Update status to indicate timeout
  await supabaseAdmin
    .from('accounts')
    .update({
      status: 'error',
      geelark_task_id: null,
      meta: {
        last_engagement_status: 'timeout',
        last_engagement_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', accountId)
  
  // Still try to stop the phone
  try {
    await geelarkApi.stopPhones([profileId])
  } catch (error) {
    console.error(`[Engagement Monitor] Failed to stop phone after timeout:`, error)
  }
} 