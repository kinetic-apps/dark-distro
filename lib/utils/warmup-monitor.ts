import { supabaseAdmin } from '@/lib/supabase/admin'
import { geelarkApi } from '@/lib/geelark-api'

/**
 * Monitor warmup task completion and automatically stop the phone when done
 * This runs in the background and doesn't block the main warmup flow
 * 
 * @param accountId - The account ID that is warming up
 * @param profileId - The GeeLark profile/phone ID to stop
 * @param taskId - The GeeLark task ID to monitor
 */
export async function monitorWarmupCompletion(
  accountId: string,
  profileId: string,
  taskId: string
): Promise<void> {
  console.log(`[Warmup Monitor] Starting monitor for warmup task - Account: ${accountId}, Profile: ${profileId}, Task: ${taskId}`)
  
  const startTime = Date.now()
  const maxWaitTime = 4 * 60 * 60 * 1000 // 4 hours max (warmup tasks can be long)
  let attempts = 0
  const maxAttempts = 720 // 4 hours / 20 seconds = 720 attempts
  
  while (attempts < maxAttempts && Date.now() - startTime < maxWaitTime) {
    attempts++
    
    try {
      // Query task status from GeeLark
      const taskStatus = await geelarkApi.queryTasks([taskId])
      
      if (!taskStatus.items || taskStatus.items.length === 0) {
        console.log(`[Warmup Monitor] Task ${taskId} not found, may have been deleted`)
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
      
      // Log status changes every 15 minutes
      if (attempts === 1 || attempts % 45 === 0) { // 45 * 20s = 15 minutes
        const minutesElapsed = Math.round((Date.now() - startTime) / 60000)
        console.log(`[Warmup Monitor] Warmup task ${taskId} status: ${statusName} (${minutesElapsed} minutes elapsed)`)
      }
      
      // Check if task is completed (success, failure, or cancelled)
      if (task.status === 3 || task.status === 4 || task.status === 7) {
        const elapsedMinutes = Math.round((Date.now() - startTime) / 60000)
        console.log(`[Warmup Monitor] Warmup task ${taskId} finished with status: ${statusName} after ${elapsedMinutes} minutes`)
        
        // Update account status based on completion type
        if (task.status === 3) {
          // Completed successfully
          await supabaseAdmin
            .from('accounts')
            .update({
              status: 'active',
              warmup_done: true,
              warmup_progress: 100,
              updated_at: new Date().toISOString()
            })
            .eq('id', accountId)
        } else {
          // Failed or cancelled
          await supabaseAdmin
            .from('accounts')
            .update({
              status: 'error',
              last_error: `Warmup ${statusName}: ${task.failDesc || 'Unknown error'}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', accountId)
        }
        
        // Stop the phone
        try {
          await geelarkApi.stopPhones([profileId])
          console.log(`[Warmup Monitor] Phone ${profileId} stopped successfully after warmup completion`)
          
          await supabaseAdmin.from('logs').insert({
            level: 'info',
            component: 'warmup-monitor',
            message: `Warmup ${statusName} and phone stopped`,
            meta: {
              account_id: accountId,
              profile_id: profileId,
              task_id: taskId,
              task_status: statusName.toLowerCase(),
              geelark_status_code: task.status,
              elapsed_minutes: elapsedMinutes,
              actual_duration_seconds: task.cost || null
            }
          })
        } catch (stopError) {
          console.error(`[Warmup Monitor] Failed to stop phone ${profileId}:`, stopError)
          
          await supabaseAdmin.from('logs').insert({
            level: 'error',
            component: 'warmup-monitor',
            message: 'Failed to stop phone after warmup completion',
            meta: {
              account_id: accountId,
              profile_id: profileId,
              task_id: taskId,
              task_status: statusName.toLowerCase(),
              error: stopError instanceof Error ? stopError.message : String(stopError)
            }
          })
        }
        
        return // Exit the monitoring loop
      }
      
      // Log progress every hour for long-running warmups
      if (attempts % 180 === 0) { // 180 * 20s = 1 hour
        const minutesElapsed = (attempts * 20) / 60
        console.log(`[Warmup Monitor] Still monitoring warmup task ${taskId} (${minutesElapsed} minutes elapsed)`)
        
        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'warmup-monitor',
          message: 'Warmup task still running',
          meta: {
            account_id: accountId,
            task_id: taskId,
            minutes_elapsed: minutesElapsed,
            geelark_status: statusName.toLowerCase()
          }
        })
      }
      
    } catch (error) {
      console.error(`[Warmup Monitor] Error checking task ${taskId}:`, error)
      
      // Don't exit on error, continue monitoring
      if (attempts % 15 === 0) { // Log errors every 5 minutes
        await supabaseAdmin.from('logs').insert({
          level: 'warning',
          component: 'warmup-monitor',
          message: 'Error during warmup monitoring',
          meta: {
            account_id: accountId,
            task_id: taskId,
            error: error instanceof Error ? error.message : String(error),
            attempts: attempts
          }
        })
      }
    }
    
    // Wait 20 seconds before next check (longer than other monitors since warmups are longer)
    await new Promise(resolve => setTimeout(resolve, 20000))
  }
  
  // Timeout reached (4 hours)
  const elapsedMinutes = Math.round((Date.now() - startTime) / 60000)
  console.error(`[Warmup Monitor] Timeout monitoring warmup task ${taskId} after ${elapsedMinutes} minutes`)
  
  await supabaseAdmin.from('logs').insert({
    level: 'error',
    component: 'warmup-monitor',
    message: 'Warmup monitoring timeout after 4 hours',
    meta: {
      account_id: accountId,
      profile_id: profileId,
      task_id: taskId,
      max_duration_minutes: 240
    }
  })
  
  // Update status to indicate timeout
  await supabaseAdmin
    .from('accounts')
    .update({
      status: 'error',
      last_error: 'Warmup monitoring timeout after 4 hours',
      updated_at: new Date().toISOString()
    })
    .eq('id', accountId)
  
  // Still try to stop the phone as a safety measure
  try {
    await geelarkApi.stopPhones([profileId])
    console.log(`[Warmup Monitor] Phone ${profileId} stopped due to timeout`)
  } catch (error) {
    console.error(`[Warmup Monitor] Failed to stop phone after timeout:`, error)
  }
} 