import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get warmup statistics for the account
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('warmup_statistics')
      .select('*')
      .eq('account_id', id)
      .single()

    if (statsError) {
      console.error('Error fetching warmup statistics:', statsError)
      return NextResponse.json({ error: 'Failed to fetch warmup statistics' }, { status: 500 })
    }

    // Get detailed warmup task history
    const { data: warmupTasks, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('account_id', id)
      .eq('type', 'warmup')
      .order('created_at', { ascending: false })

    if (tasksError) {
      console.error('Error fetching warmup tasks:', tasksError)
      return NextResponse.json({ error: 'Failed to fetch warmup tasks' }, { status: 500 })
    }

    // Process warmup tasks to extract configuration and calculate durations
    const processedTasks = warmupTasks.map(task => {
      // Extract configuration from meta (new format) or provide defaults (old format)
      const config = task.meta?.warmup_config || {
        planned_duration: task.meta?.duration_minutes || 30,
        strategy: task.meta?.action || 'browse video',
        search_terms: task.meta?.keywords || [],
        created_at: task.created_at
      }

      // Calculate actual duration
      let actualDurationMinutes = 0
      if (task.status === 'completed' || task.status === 'failed') {
        if (task.meta?.cost_seconds) {
          // Use GeeLark's cost_seconds (most accurate)
          actualDurationMinutes = Math.round(task.meta.cost_seconds / 60)
        } else if (task.started_at && task.completed_at) {
          // Fallback to time difference
          const startTime = new Date(task.started_at).getTime()
          const endTime = new Date(task.completed_at).getTime()
          actualDurationMinutes = Math.round((endTime - startTime) / (1000 * 60))
        }
      }

      // Calculate current progress for running tasks
      let currentProgress = 0
      if (task.status === 'running' && task.started_at) {
        const startTime = new Date(task.started_at).getTime()
        const currentTime = Date.now()
        const elapsedMinutes = (currentTime - startTime) / (1000 * 60)
        const plannedDuration = config.planned_duration || 30
        currentProgress = Math.min(99, Math.floor((elapsedMinutes / plannedDuration) * 100))
      }

      return {
        id: task.id,
        geelark_task_id: task.geelark_task_id,
        status: task.status,
        created_at: task.created_at,
        started_at: task.started_at,
        completed_at: task.completed_at,
        config: {
          planned_duration: config.planned_duration,
          strategy: config.strategy,
          search_terms: config.search_terms || [],
          niche: config.search_terms?.join(', ') || null
        },
        duration: {
          planned_minutes: config.planned_duration,
          actual_minutes: actualDurationMinutes,
          current_progress: currentProgress
        },
        result: {
          success: task.status === 'completed',
          error_message: task.meta?.fail_desc || task.error_message || null,
          error_code: task.meta?.fail_code || null
        }
      }
    })

    // Calculate success rate
    const completedTasks = processedTasks.filter(t => t.status === 'completed')
    const failedTasks = processedTasks.filter(t => t.status === 'failed')
    const totalFinishedTasks = completedTasks.length + failedTasks.length
    const successRate = totalFinishedTasks > 0 ? Math.round((completedTasks.length / totalFinishedTasks) * 100) : 0

    // Calculate average duration
    const completedDurations = completedTasks
      .map(t => t.duration.actual_minutes)
      .filter(d => d > 0)
    const averageDuration = completedDurations.length > 0 
      ? Math.round(completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length)
      : 0

    const response = {
      statistics: {
        total_sessions: stats?.total_warmup_sessions || 0,
        completed_sessions: stats?.completed_warmup_sessions || 0,
        failed_sessions: stats?.failed_warmup_sessions || 0,
        total_duration_minutes: stats?.total_warmup_duration_minutes || 0,
        total_duration_hours: Math.round((stats?.total_warmup_duration_minutes || 0) / 60 * 10) / 10,
        success_rate: successRate,
        average_duration_minutes: averageDuration,
        first_warmup_at: stats?.first_warmup_at,
        last_warmup_at: stats?.last_warmup_at,
        currently_warming_up: processedTasks.some(t => t.status === 'running')
      },
      tasks: processedTasks
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Warmup history API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 