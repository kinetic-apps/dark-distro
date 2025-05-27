import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profile_id, email, password, account_id } = body

    if (!profile_id || !email || !password) {
      return NextResponse.json(
        { error: 'Profile ID, email, and password are required' },
        { status: 400 }
      )
    }

    console.log('=== TikTok Login Debug ===')
    console.log('Profile ID:', profile_id)
    console.log('Email:', email)
    console.log('Password:', '***' + password.slice(-3))

    // Log the exact parameters being sent
    await supabaseAdmin.from('logs').insert({
      level: 'debug',
      component: 'tiktok-login-debug',
      message: 'TikTok login parameters',
      meta: {
        profile_id,
        email,
        password_length: password.length,
        timestamp: new Date().toISOString()
      }
    })

    let result = null
    let error = null

    try {
      // Call the GeeLark API
      result = await geelarkApi.loginTikTok(profile_id, email, password)
      
      // Store login attempt in database
      try {
        const { data: taskData, error: taskError } = await supabaseAdmin.from('tasks').insert({
          task_type: 'login',
          type: 'login',
          geelark_task_id: result.taskId,
          account_id: null,
          status: 'running',
          started_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          meta: {
            login_method: 'email',
            email: email,
            debug: true,
            profile_id: profile_id,
            debug_account_id: account_id || 'debug-account'
          }
        }).select()

        if (taskError) {
          console.error('Task insertion error:', taskError)
          await supabaseAdmin.from('logs').insert({
            level: 'error',
            component: 'tiktok-login-debug',
            message: 'Failed to insert task record',
            meta: { error: taskError, task_id: result.taskId }
          })
        } else {
          console.log('Task inserted successfully:', taskData)
          await supabaseAdmin.from('logs').insert({
            level: 'info',
            component: 'tiktok-login-debug',
            message: 'Task record created',
            meta: { task_id: result.taskId, db_task_id: taskData?.[0]?.id }
          })
        }
      } catch (insertError) {
        console.error('Task insertion exception:', insertError)
        await supabaseAdmin.from('logs').insert({
          level: 'error',
          component: 'tiktok-login-debug',
          message: 'Exception during task insertion',
          meta: { error: String(insertError), task_id: result.taskId }
        })
      }
      
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'tiktok-login-debug',
        message: 'TikTok login successful',
        meta: {
          profile_id,
          email,
          task_id: result.taskId,
          result
        }
      })
    } catch (err) {
      error = {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        name: err instanceof Error ? err.name : undefined
      }
      
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'tiktok-login-debug',
        message: 'TikTok login failed',
        meta: {
          profile_id,
          email,
          error
        }
      })
    }

    return NextResponse.json({
      success: !error,
      result,
      error,
      debug: {
        profile_id,
        email,
        password_length: password.length,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Debug failed',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
} 