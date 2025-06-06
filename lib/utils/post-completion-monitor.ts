import { supabaseAdmin } from '@/lib/supabase/admin'
import { geelarkApi } from '@/lib/geelark-api'

/**
 * Monitor post task completion and automatically stop the phone when done
 * This runs in the background and doesn't block the main posting flow
 * 
 * @param accountId - The account ID that posted
 * @param profileId - The GeeLark profile/phone ID to stop
 * @param taskId - The GeeLark task ID to monitor
 * @param taskType - Type of task (video, carousel, profile_edit)
 */
export async function monitorPostCompletionAndStop(
  accountId: string,
  profileId: string,
  taskId: string,
  taskType: 'video' | 'carousel' | 'profile_edit'
): Promise<void> {
  console.log(`[Post Monitor] Starting monitor for ${taskType} post - Account: ${accountId}, Profile: ${profileId}, Task: ${taskId}`)
  
  const startTime = Date.now()
  const maxWaitTime = 60 * 60 * 1000 // 60 minutes max
  let attempts = 0
  const maxAttempts = 360 // 60 minutes / 10 seconds = 360 attempts
  
  while (attempts < maxAttempts && Date.now() - startTime < maxWaitTime) {
    attempts++
    
    try {
      // Query task status from GeeLark
      const taskStatus = await geelarkApi.queryTasks([taskId])
      
      if (!taskStatus.items || taskStatus.items.length === 0) {
        console.log(`[Post Monitor] Task ${taskId} not found, may have been deleted`)
        break
      }
      
      const task = taskStatus.items[0]
      const statusNames = {
        1: 'waiting',
        2: 'running', 
        3: 'completed',
        4: 'failed',
        7: 'cancelled'
      }
      
      const statusName = statusNames[task.status as keyof typeof statusNames] || 'unknown'
      
      // Log status changes
      if (attempts === 1 || attempts % 30 === 0) { // Log initially and every 5 minutes
        const minutesElapsed = Math.round((Date.now() - startTime) / 60000)
        console.log(`[Post Monitor] ${taskType} task ${taskId} status: ${statusName} (${minutesElapsed} minutes elapsed)`)
      }
      
      // Check if task is complete (success, failed, or cancelled)
      if ([3, 4, 7].includes(task.status)) {
        const elapsedMinutes = Math.round((Date.now() - startTime) / 60000)
        console.log(`[Post Monitor] ${taskType} task ${taskId} completed with status: ${statusName} after ${elapsedMinutes} minutes`)
        
        // Update post status in database
        if (task.status === 3) {
          // Task completed successfully
          await supabaseAdmin
            .from('posts')
            .update({
              status: 'posted',
              posted_at: new Date().toISOString(),
              tiktok_post_id: task.result?.post_id || null
            })
            .eq('task_id', taskId)
        } else {
          // Task failed or was cancelled
          await supabaseAdmin
            .from('posts')
            .update({
              status: 'failed',
              error_message: task.failDesc || `Task ${statusName.toLowerCase()}`
            })
            .eq('task_id', taskId)
        }
        
        // Stop the phone
        try {
          await geelarkApi.stopPhones([profileId])
          console.log(`[Post Monitor] Phone ${profileId} stopped successfully after ${taskType} task completion`)
          
          await supabaseAdmin.from('logs').insert({
            level: 'info',
            component: 'post-monitor',
            message: `${taskType} task completed and phone stopped`,
            meta: {
              account_id: accountId,
              profile_id: profileId,
              task_id: taskId,
              task_type: taskType,
              task_status: statusName.toLowerCase(),
              geelark_status_code: task.status,
              elapsed_minutes: elapsedMinutes,
              tiktok_post_id: task.result?.post_id || null
            }
          })
        } catch (stopError) {
          console.error(`[Post Monitor] Failed to stop phone ${profileId}:`, stopError)
          
          await supabaseAdmin.from('logs').insert({
            level: 'error',
            component: 'post-monitor',
            message: `Failed to stop phone after ${taskType} task completion`,
            meta: {
              account_id: accountId,
              profile_id: profileId,
              task_id: taskId,
              task_type: taskType,
              error: stopError instanceof Error ? stopError.message : String(stopError)
            }
          })
        }
        
        return // Exit the monitoring loop
      }
      
      // Log progress every 5 minutes for long-running tasks
      if (attempts % 30 === 0) {
        const minutesElapsed = Math.round((Date.now() - startTime) / 60000)
        
        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'post-monitor',
          message: `${taskType} task still running`,
          meta: {
            account_id: accountId,
            profile_id: profileId,
            task_id: taskId,
            task_type: taskType,
            minutes_elapsed: minutesElapsed,
            geelark_status: statusName.toLowerCase()
          }
        })
      }
      
    } catch (error) {
      console.error(`[Post Monitor] Error checking task ${taskId}:`, error)
      
      // If we can't check the task status, wait a bit longer before retrying
      await new Promise(resolve => setTimeout(resolve, 30000))
      continue
    }
    
    // Wait 10 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 10000))
  }
  
  // If we reach here, either timeout occurred or task was not found
  const elapsedMinutes = Math.round((Date.now() - startTime) / 60000)
  
  if (attempts >= maxAttempts || Date.now() - startTime >= maxWaitTime) {
    console.warn(`[Post Monitor] Timeout after ${elapsedMinutes} minutes - stopping phone ${profileId} as safety measure`)
    
    try {
      await geelarkApi.stopPhones([profileId])
      console.log(`[Post Monitor] Phone ${profileId} stopped due to timeout`)
    } catch (stopError) {
      console.error(`[Post Monitor] Failed to stop phone ${profileId} after timeout:`, stopError)
    }
    
    await supabaseAdmin.from('logs').insert({
      level: 'warning',
      component: 'post-monitor',
      message: `${taskType} task monitoring timeout - phone stopped as safety measure`,
      meta: {
        account_id: accountId,
        profile_id: profileId,
        task_id: taskId,
        task_type: taskType,
        timeout_minutes: elapsedMinutes
      }
    })
  }
} 