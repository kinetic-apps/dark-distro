import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { geelarkApi } from '@/lib/geelark-api'

export async function POST(request: NextRequest) {
  try {
    const { profile_id, task_id } = await request.json()
    
    console.log('EMERGENCY STOP REQUESTED', { profile_id, task_id })
    
    const results = {
      account_updated: false,
      task_cancelled: false,
      phone_stopped: false,
      task_marked_cancelled: false,
      errors: [] as string[]
    }
    
    // Step 1: Find and update the account
    try {
      const { data: account, error } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('geelark_profile_id', profile_id)
        .single()
      
      if (account) {
        await supabaseAdmin
          .from('accounts')
          .update({
            status: 'error',
            last_error: 'Emergency stop - stuck task',
            geelark_task_id: null,
            current_setup_step: null,
            setup_progress: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', account.id)
        
        results.account_updated = true
        console.log('Account updated:', account.id)
      }
    } catch (error) {
      console.error('Failed to update account:', error)
      results.errors.push('Failed to update account')
    }
    
    // Step 2: Try to cancel the task
    if (task_id) {
      try {
        await geelarkApi.cancelTasks([task_id])
        results.task_cancelled = true
      } catch (error) {
        console.error('Failed to cancel task:', error)
        results.errors.push('Failed to cancel task via API')
      }
      
      // Also mark task as cancelled in database
      try {
        const { data: task } = await supabaseAdmin
          .from('tasks')
          .select('meta')
          .eq('geelark_task_id', task_id)
          .single()
        
        await supabaseAdmin
          .from('tasks')
          .update({
            status: 'cancelled',
            completed_at: new Date().toISOString(),
            meta: {
              ...(task?.meta || {}),
              emergency_stop: true
            }
          })
          .eq('geelark_task_id', task_id)
        
        results.task_marked_cancelled = true
      } catch (error) {
        console.error('Failed to mark task as cancelled:', error)
        results.errors.push('Failed to update task in database')
      }
    }
    
    // Step 3: Force stop the phone (try multiple times)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const stopResult = await geelarkApi.stopPhones([profile_id])
        
        if (stopResult.successAmount > 0) {
          results.phone_stopped = true
          break
        } else if (stopResult.failDetails?.[0]?.code === 43005) {
          // Phone is executing task, wait and retry
          console.log(`Attempt ${attempt}: Phone is executing task, waiting...`)
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      } catch (error) {
        console.error(`Stop attempt ${attempt} failed:`, error)
      }
    }
    
    // Step 4: Update phone status in database
    try {
      await supabaseAdmin
        .from('phones')
        .update({
          status: 'offline',
          updated_at: new Date().toISOString()
        })
        .eq('profile_id', profile_id)
    } catch (error) {
      console.error('Failed to update phone status:', error)
    }
    
    // Log the emergency stop
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'emergency-stop',
      message: 'Emergency stop executed',
      meta: {
        profile_id,
        task_id,
        results
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Emergency stop executed',
      results
    })
    
  } catch (error) {
    console.error('Emergency stop error:', error)
    return NextResponse.json(
      { error: 'Emergency stop failed', details: error },
      { status: 500 }
    )
  }
} 