import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    // Fetch all accounts that are warming up
    const { data: warmingUpAccounts, error } = await supabaseAdmin
      .from('accounts')
      .select('id, warmup_progress')
      .eq('status', 'warming_up')
      .lt('warmup_progress', 100)

    if (error) throw error

    // Fetch running warmup tasks for these accounts
    const accountIds = warmingUpAccounts.map(acc => acc.id)
    
    if (accountIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No accounts currently warming up',
        updated: 0
      })
    }

    const { data: runningTasks, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('type', 'warmup')
      .eq('status', 'running')
      .in('account_id', accountIds)

    if (tasksError) throw tasksError

    // Update progress for each task
    const updates = await Promise.allSettled(
      runningTasks.map(async (task) => {
        const startTime = new Date(task.started_at || task.created_at).getTime()
        const currentTime = Date.now()
        const elapsedMinutes = (currentTime - startTime) / (1000 * 60)
        const durationMinutes = task.meta?.duration_minutes || 30
        
        // Calculate progress as percentage (0-99, never 100 until actually complete)
        const progress = Math.min(99, Math.floor((elapsedMinutes / durationMinutes) * 100))
        
        // Only update if progress has changed
        const currentAccount = warmingUpAccounts.find(acc => acc.id === task.account_id)
        if (currentAccount && currentAccount.warmup_progress !== progress) {
          await supabaseAdmin
            .from('accounts')
            .update({
              warmup_progress: progress,
              updated_at: new Date().toISOString()
            })
            .eq('id', task.account_id)
            
          // Log significant milestones
          if (progress % 25 === 0 || (progress > 90 && progress % 5 === 0)) {
            await supabaseAdmin.from('logs').insert({
              level: 'info',
              component: 'warmup-progress-updater',
              account_id: task.account_id,
              message: `Warmup progress: ${progress}%`,
              meta: { 
                task_id: task.geelark_task_id,
                elapsed_minutes: Math.floor(elapsedMinutes),
                duration_minutes: durationMinutes
              }
            })
          }
          
          return { account_id: task.account_id, progress }
        }
        
        return null
      })
    )

    const successfulUpdates = updates
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<any>).value)

    return NextResponse.json({
      success: true,
      message: `Updated warmup progress for ${successfulUpdates.length} accounts`,
      updated: successfulUpdates.length,
      details: successfulUpdates
    })
  } catch (error) {
    console.error('Warmup progress update error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'warmup-progress-updater',
      message: 'Failed to update warmup progress',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to update warmup progress' },
      { status: 500 }
    )
  }
}

// This endpoint can be called frequently (e.g., every minute) by a cron job
export async function POST(request: NextRequest) {
  // Same logic as GET, but for POST requests from cron services
  return GET(request)
} 