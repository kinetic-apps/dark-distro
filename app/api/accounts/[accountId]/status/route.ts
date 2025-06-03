import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }

    // Fetch account data with enhanced status information
    const { data: accountData, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select(`
        id,
        status,
        current_setup_step,
        setup_progress,
        setup_started_at,
        setup_completed_at,
        geelark_task_id,
        tiktok_username,
        tasks!fk_account(
          id,
          type,
          task_type,
          status,
          setup_step,
          progress,
          started_at,
          completed_at,
          created_at,
          meta
        )
      `)
      .eq('id', accountId)
      .single()

    if (accountError) {
      console.error('Error fetching account data:', accountError)
      return NextResponse.json(
        { error: 'Failed to fetch account data' },
        { status: 500 }
      )
    }

    if (!accountData) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    // Get current activity details
    let currentActivity = null
    let detailedStatus = accountData.status

    // Check for active tasks
    const activeTasks = accountData.tasks?.filter((t: any) => t.status === 'running') || []
    
    if (activeTasks.length > 0) {
      const activeTask = activeTasks[0]
      
      // Determine detailed activity based on task type and setup step
      if (activeTask.task_type === 'sms_login' || activeTask.type === 'login') {
        if (accountData.current_setup_step) {
          currentActivity = accountData.current_setup_step
        } else {
          currentActivity = 'TikTok Login in Progress'
        }
      } else if (activeTask.type === 'warmup') {
        currentActivity = `Warming Up (${activeTask.progress || 0}%)`
      } else if (activeTask.type === 'post') {
        currentActivity = 'Posting Content'
      } else {
        currentActivity = `Running ${activeTask.type} Task`
      }
    } else if (accountData.current_setup_step && accountData.status !== 'active') {
      // Setup in progress but no active tasks
      currentActivity = accountData.current_setup_step
    } else {
      // Check status for other activities
      switch (accountData.status) {
        case 'creating_profile':
          currentActivity = 'Creating Profile...'
          break
        case 'starting_phone':
          currentActivity = 'Starting Phone...'
          break
        case 'installing_tiktok':
          currentActivity = 'Installing TikTok...'
          break
        case 'renting_number':
          currentActivity = 'Renting Phone Number...'
          break
        case 'running_geelark_task':
          currentActivity = 'Running Login Task...'
          break
        case 'pending_verification':
          currentActivity = 'Awaiting SMS Verification'
          break
        case 'warming_up':
          currentActivity = 'Warming Up Account'
          break
        case 'active':
          // Don't set current activity for active accounts - let phone status show through
          currentActivity = null
          break
        case 'paused':
          currentActivity = 'Phone Stopped'
          break
        case 'banned':
          currentActivity = 'Account Banned'
          break
        case 'error':
          currentActivity = 'Error State'
          break
        default:
          currentActivity = 'Unknown Status'
      }
    }

    // Check if GeeLark task is running
    if (accountData.geelark_task_id) {
      try {
        // We could check GeeLark task status here if needed
        // For now, just note that there's an active GeeLark task
        if (accountData.status === 'running_geelark_task') {
          currentActivity = 'Running GeeLark Automation'
        }
      } catch (geelarkError) {
        console.error('Error checking GeeLark task:', geelarkError)
      }
    }

    const response = {
      ...accountData,
      ...(currentActivity && { current_activity: currentActivity }),
      active_tasks: activeTasks.length,
      is_setup_in_progress: accountData.status?.includes('creating') ||
                           accountData.status?.includes('starting') ||
                           accountData.status?.includes('installing') ||
                           accountData.status?.includes('renting') ||
                           accountData.status?.includes('running'),
      setup_phase: accountData.setup_started_at && !accountData.setup_completed_at
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Account status API error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 