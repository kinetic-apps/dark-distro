import { supabaseAdmin } from '@/lib/supabase/admin'
import { geelarkApi } from '@/lib/geelark-api'

interface BulkPostTask {
  account_id: string
  profile_id: string
  task_id: string
  serial_no: string
}

/**
 * Monitor bulk post tasks and stop phones after completion
 * This runs separately from the individual post monitors since we skip those in bulk mode
 */
export async function monitorBulkPostCompletion(tasks: BulkPostTask[]) {
  console.log(`[Bulk Post Monitor] Starting monitoring for ${tasks.length} tasks`)
  
  const startTime = Date.now()
  const maxDuration = 60 * 60 * 1000 // 60 minutes max
  const checkInterval = 10000 // Check every 10 seconds
  
  const pendingTasks = new Map(tasks.map(t => [t.task_id, t]))
  const completedTasks = new Set<string>()
  
  const checkTasks = async () => {
    if (pendingTasks.size === 0) {
      console.log('[Bulk Post Monitor] All tasks completed')
      return
    }
    
    if (Date.now() - startTime > maxDuration) {
      console.log('[Bulk Post Monitor] Max duration reached, stopping remaining phones')
      // Stop all remaining phones
      for (const task of pendingTasks.values()) {
        try {
          await geelarkApi.stopPhones([task.profile_id])
          await supabaseAdmin.from('logs').insert({
            level: 'warning',
            component: 'bulk-post-monitor',
            account_id: task.account_id,
            message: 'Phone stopped due to timeout',
            meta: { 
              task_id: task.task_id,
              serial_no: task.serial_no,
              duration_minutes: Math.floor((Date.now() - startTime) / 60000)
            }
          })
        } catch (error) {
          console.error(`[Bulk Post Monitor] Failed to stop phone ${task.profile_id}:`, error)
        }
      }
      return
    }
    
    try {
      // Query all pending tasks
      const taskIds = Array.from(pendingTasks.keys())
      const response = await geelarkApi.queryTasks(taskIds)
      
      if (response.items && Array.isArray(response.items)) {
        for (const item of response.items) {
          const task = pendingTasks.get(item.id)
          if (!task) continue
          
          // Check if task is completed (status 3) or failed (status 4)
          if (item.status === 3 || item.status === 4) {
            console.log(`[Bulk Post Monitor] Task ${item.id} completed with status ${item.status} (Serial #${task.serial_no})`)
            
            // Update post status
            const postStatus = item.status === 3 ? 'posted' : 'failed'
            await supabaseAdmin
              .from('posts')
              .update({ 
                status: postStatus,
                posted_at: item.status === 3 ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
              })
              .eq('task_id', item.id)
            
            // Stop the phone
            try {
              await geelarkApi.stopPhones([task.profile_id])
              console.log(`[Bulk Post Monitor] Stopped phone ${task.profile_id} (Serial #${task.serial_no})`)
              
              await supabaseAdmin.from('logs').insert({
                level: 'info',
                component: 'bulk-post-monitor',
                account_id: task.account_id,
                message: `Bulk post completed and phone stopped`,
                meta: { 
                  task_id: item.id,
                  serial_no: task.serial_no,
                  status: postStatus,
                  duration_minutes: Math.floor((Date.now() - startTime) / 60000)
                }
              })
            } catch (stopError) {
              console.error(`[Bulk Post Monitor] Failed to stop phone ${task.profile_id}:`, stopError)
            }
            
            // Remove from pending and add to completed
            pendingTasks.delete(item.id)
            completedTasks.add(item.id)
          }
        }
      }
    } catch (error) {
      console.error('[Bulk Post Monitor] Error checking tasks:', error)
    }
    
    // Schedule next check if there are still pending tasks
    if (pendingTasks.size > 0) {
      setTimeout(checkTasks, checkInterval)
    } else {
      console.log(`[Bulk Post Monitor] All tasks completed. Total: ${completedTasks.size}`)
      
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'bulk-post-monitor',
        message: 'Bulk post monitoring completed',
        meta: { 
          total_tasks: tasks.length,
          completed_tasks: completedTasks.size,
          duration_minutes: Math.floor((Date.now() - startTime) / 60000)
        }
      })
    }
  }
  
  // Start monitoring
  setTimeout(checkTasks, checkInterval)
} 