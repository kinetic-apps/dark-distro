import { supabaseAdmin } from '@/lib/supabase/admin'
import { geelarkApi } from '@/lib/geelark-api'

/**
 * Monitor setup completion and automatically stop the phone when all tasks are done
 * This runs in the background and doesn't block the main setup flow
 * 
 * @param accountId - The account ID to monitor
 * @param profileId - The GeeLark profile/phone ID to stop
 */
export async function waitForSetupCompletionAndShutdown(
  accountId: string,
  profileId: string
): Promise<void> {
  console.log(`[AUTO-STOP] Starting monitor for account ${accountId}, profile ${profileId}`)
  
  const startTime = Date.now()
  const maxWaitTime = 30 * 60 * 1000 // 30 minutes max
  let allTasksCompleted = false
  
  while (Date.now() - startTime < maxWaitTime && !allTasksCompleted) {
    try {
      // Method 1: Get task IDs from account record (primary method)
      const { data: account } = await supabaseAdmin
        .from('accounts')
        .select('geelark_task_id, meta, status, current_setup_step')
        .eq('id', accountId)
        .single()
      
      if (!account) {
        console.error(`[AUTO-STOP] Account ${accountId} not found`)
        return
      }
      
      // Check if account is in an active setup phase - if so, don't stop the phone yet
      const activeSetupStates = ['creating_profile', 'starting_phone', 'installing_tiktok', 'running_geelark_task', 'renting_number', 'pending_verification']
      if (activeSetupStates.includes(account.status)) {
        console.log(`[AUTO-STOP] Account ${accountId} is in active setup (${account.status}), continuing to monitor...`)
        
        // If we're in setup but no task IDs are found, wait longer before giving up
        const setupPhaseWaitTime = 5 * 60 * 1000 // 5 minutes for setup phase
        if (Date.now() - startTime < setupPhaseWaitTime) {
          await new Promise(resolve => setTimeout(resolve, 30000))
          continue
        }
      }
      
      // Collect task IDs using multiple methods
      const taskIds: string[] = []
      
      // Method 1: From account.geelark_task_id
      if (account.geelark_task_id) {
        taskIds.push(account.geelark_task_id)
      }
      
      // Method 2: From account.meta.login_task_id
      if (account.meta?.login_task_id) {
        taskIds.push(account.meta.login_task_id)
      }
      
      // Method 3: From tasks table for this account (fallback)
      if (taskIds.length === 0) {
        console.log('[AUTO-STOP] No task IDs in account record, checking tasks table...')
        const { data: activeTasks } = await supabaseAdmin
        .from('tasks')
        .select('geelark_task_id')
        .eq('account_id', accountId)
          .in('status', ['pending', 'running'])
        .not('geelark_task_id', 'is', null)
      
        if (activeTasks && activeTasks.length > 0) {
          activeTasks.forEach(task => {
          if (task.geelark_task_id && !taskIds.includes(task.geelark_task_id)) {
            taskIds.push(task.geelark_task_id)
          }
        })
          console.log(`[AUTO-STOP] Found ${activeTasks.length} task IDs from tasks table`)
        }
      }
      
      // If still no task IDs found and account is no longer in setup, assume no active tasks
      if (taskIds.length === 0) {
        if (!activeSetupStates.includes(account.status)) {
          console.log(`[AUTO-STOP] No task IDs found and account status is ${account.status} - assuming no active tasks`)
        allTasksCompleted = true
        } else {
          console.log(`[AUTO-STOP] No task IDs found but account is still in setup (${account.status}) - waiting...`)
          await new Promise(resolve => setTimeout(resolve, 30000))
          continue
      }
      } else {
        console.log(`[AUTO-STOP] Monitoring ${taskIds.length} GeeLark tasks: ${taskIds.join(', ')}`)
      
        // Query GeeLark for task status - this is the ONLY source of truth for task completion
        const taskStatuses = await geelarkApi.queryTasks(taskIds)
        
        if (!taskStatuses || !taskStatuses.items || taskStatuses.items.length === 0) {
          console.log('[AUTO-STOP] No task status data returned from GeeLark, waiting...')
          await new Promise(resolve => setTimeout(resolve, 30000))
          continue
        }
        
        let hasRunningTasks = false
        
        for (const task of taskStatuses.items) {
          const statusName = task.status === 1 ? 'Waiting' :
                           task.status === 2 ? 'In progress' :
                           task.status === 3 ? 'Completed' :
                           task.status === 4 ? 'Failed' :
                           task.status === 7 ? 'Cancelled' : `Unknown(${task.status})`
          
          console.log(`[AUTO-STOP] Task ${task.id}: status=${task.status} (${statusName})`)
          
          // Check if task is still running (status 1=waiting, 2=in progress)
          if (task.status === 1 || task.status === 2) {
            hasRunningTasks = true
          }
        }
        
        if (!hasRunningTasks) {
          console.log(`[AUTO-STOP] All GeeLark tasks completed for account ${accountId}`)
          allTasksCompleted = true
        } else {
          const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000)
          console.log(`[AUTO-STOP] Tasks still running for account ${accountId}, waiting... (${elapsedMinutes} minutes elapsed)`)
        }
      }
      
      // Also check phone status to see if it's already stopped
      const phoneStatusResponse = await geelarkApi.getPhoneStatus([profileId])
      const phoneStatus = phoneStatusResponse.successDetails?.[0]?.status
      
      // Phone status: 0=running, 1=starting, 2=shut down, 3=expired
      if (phoneStatus === 2 || phoneStatus === 3) {
        console.log(`[AUTO-STOP] Phone ${profileId} is already shut down (status: ${phoneStatus})`)
        return
      }
      
      await new Promise(resolve => setTimeout(resolve, 30000)) // Check every 30 seconds
      
    } catch (error) {
      console.error(`[AUTO-STOP] Error checking status:`, error)
      await new Promise(resolve => setTimeout(resolve, 30000))
    }
  }
  
  // If we reach here and all tasks are completed, stop the phone
  if (allTasksCompleted) {
    const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000)
    console.log(`[AUTO-STOP] All tasks completed, stopping phone ${profileId} after ${elapsedMinutes} minutes`)
    
    try {
      await geelarkApi.stopPhones([profileId])
      console.log(`[AUTO-STOP] Successfully stopped phone ${profileId}`)
        
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'auto-stop-monitor',
        message: 'Phone stopped after all tasks completed',
        meta: { 
          account_id: accountId,
          profile_id: profileId,
          wait_time_minutes: elapsedMinutes
        }
      })
    } catch (error) {
      console.error(`[AUTO-STOP] Failed to stop phone ${profileId}:`, error)
      
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'auto-stop-monitor',
        message: 'Failed to stop phone after task completion',
        meta: { 
          account_id: accountId,
          profile_id: profileId,
          error: error instanceof Error ? error.message : String(error)
        }
      })
    }
  } else {
    // Timeout occurred
    const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000)
    console.warn(`[AUTO-STOP] Timeout after ${elapsedMinutes} minutes - NOT stopping phone ${profileId} (may still have active tasks)`)
    
    await supabaseAdmin.from('logs').insert({
      level: 'warning',
      component: 'auto-stop-monitor',
      message: 'Auto-stop timeout - phone left running as a safety measure',
      meta: { 
        account_id: accountId,
        profile_id: profileId,
        timeout_minutes: elapsedMinutes
      }
    })
  }
}