import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profile_id, task_id } = body

    // If task_id is provided, check the status of an existing screenshot
    if (task_id) {
      try {
        const result = await geelarkApi.getScreenshotResult(task_id)
        
        // Status: 0 = failed, 1 = in progress, 2 = succeeded, 3 = failed
        const statusMap: { [key: number]: string } = {
          0: 'failed',
          1: 'processing',
          2: 'completed',
          3: 'failed'
        }

        return NextResponse.json({
          success: true,
          status: statusMap[result.status] || 'unknown',
          download_url: result.downloadLink,
          task_id
        })
      } catch (error) {
        console.error('Failed to get screenshot result:', error)
        return NextResponse.json({
          success: false,
          status: 'error',
          error: 'Failed to retrieve screenshot'
        })
      }
    }

    // Otherwise, take a new screenshot
    if (!profile_id) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      )
    }

    // Check if phone is running first
    const statusResult = await geelarkApi.getPhoneStatus([profile_id])
    const phoneStatus = statusResult.successDetails?.[0]
    
    if (!phoneStatus || phoneStatus.status !== 0) { // 0 = started
      return NextResponse.json(
        { error: 'Phone must be running to take screenshot' },
        { status: 400 }
      )
    }

    // Request screenshot
    const screenshotResult = await geelarkApi.takeScreenshot(profile_id)

    // Store screenshot request in database
    await supabaseAdmin
      .from('phones')
      .update({
        meta: {
          ...(await supabaseAdmin
            .from('phones')
            .select('meta')
            .eq('profile_id', profile_id)
            .single()
            .then(res => res.data?.meta || {})),
          last_screenshot: {
            task_id: screenshotResult.taskId,
            requested_at: new Date().toISOString(),
            status: 'processing'
          }
        },
        updated_at: new Date().toISOString()
      })
      .eq('profile_id', profile_id)

    return NextResponse.json({
      success: true,
      task_id: screenshotResult.taskId,
      status: 'processing'
    })
  } catch (error) {
    console.error('Screenshot error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-screenshot',
      message: 'Failed to take screenshot',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to take screenshot' },
      { status: 500 }
    )
  }
} 