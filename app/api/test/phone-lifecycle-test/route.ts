import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { waitForPhoneReady } from '@/lib/utils/geelark-phone-status'

export async function POST(request: NextRequest) {
  try {
    const { profile_id } = await request.json()
    
    if (!profile_id) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 })
    }

    console.log(`[Phone Lifecycle Test] Testing lifecycle for profile ${profile_id}`)
    
    const testResults = {
      profile_id,
      steps: [] as Array<{
        step: string
        status: 'success' | 'error'
        message: string
        timestamp: string
        duration_ms?: number
      }>
    }

    // Step 1: Check initial phone status
    let stepStart = Date.now()
    try {
      const initialStatus = await geelarkApi.getPhoneStatus([profile_id])
      const status = initialStatus.successDetails?.[0]?.status
      const statusName = status === 0 ? 'running' : 
                        status === 1 ? 'starting' : 
                        status === 2 ? 'stopped' : 
                        status === 3 ? 'expired' : 'unknown'
      
      testResults.steps.push({
        step: 'check_initial_status',
        status: 'success',
        message: `Initial phone status: ${statusName} (${status})`,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - stepStart
      })
    } catch (error) {
      testResults.steps.push({
        step: 'check_initial_status',
        status: 'error',
        message: `Failed to check initial status: ${error}`,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - stepStart
      })
    }

    // Step 2: Start the phone
    stepStart = Date.now()
    try {
      await geelarkApi.startPhones([profile_id])
      testResults.steps.push({
        step: 'start_phone',
        status: 'success',
        message: 'Phone start command sent successfully',
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - stepStart
      })
    } catch (error) {
      testResults.steps.push({
        step: 'start_phone',
        status: 'error',
        message: `Failed to start phone: ${error}`,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - stepStart
      })
      
      return NextResponse.json({
        success: false,
        message: 'Phone start failed',
        results: testResults
      })
    }

    // Step 3: Wait for phone to be ready
    stepStart = Date.now()
    try {
      await waitForPhoneReady(profile_id, {
        maxAttempts: 60, // 2 minutes max
        logProgress: true,
        logPrefix: '[Lifecycle Test] '
      })
      
      testResults.steps.push({
        step: 'wait_for_ready',
        status: 'success',
        message: 'Phone is ready and responsive',
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - stepStart
      })
    } catch (error) {
      testResults.steps.push({
        step: 'wait_for_ready',
        status: 'error',
        message: `Phone failed to become ready: ${error}`,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - stepStart
      })
      
      // Try to stop the phone even if it didn't become ready
      try {
        await geelarkApi.stopPhones([profile_id])
      } catch (stopError) {
        console.error('Failed to stop phone after ready timeout:', stopError)
      }
      
      return NextResponse.json({
        success: false,
        message: 'Phone failed to become ready',
        results: testResults
      })
    }

    // Step 4: Simulate a task (take screenshot)
    stepStart = Date.now()
    try {
      const screenshotResult = await geelarkApi.takeScreenshot(profile_id)
      testResults.steps.push({
        step: 'simulate_task',
        status: 'success',
        message: `Screenshot task created: ${screenshotResult.taskId}`,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - stepStart
      })
    } catch (error) {
      testResults.steps.push({
        step: 'simulate_task',
        status: 'error',
        message: `Failed to create screenshot task: ${error}`,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - stepStart
      })
    }

    // Step 5: Wait a moment to simulate task execution
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Step 6: Stop the phone
    stepStart = Date.now()
    try {
      await geelarkApi.stopPhones([profile_id])
      testResults.steps.push({
        step: 'stop_phone',
        status: 'success',
        message: 'Phone stop command sent successfully',
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - stepStart
      })
    } catch (error) {
      testResults.steps.push({
        step: 'stop_phone',
        status: 'error',
        message: `Failed to stop phone: ${error}`,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - stepStart
      })
    }

    // Step 7: Verify phone is stopped
    stepStart = Date.now()
    await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds
    
    try {
      const finalStatus = await geelarkApi.getPhoneStatus([profile_id])
      const status = finalStatus.successDetails?.[0]?.status
      const statusName = status === 0 ? 'running' : 
                        status === 1 ? 'starting' : 
                        status === 2 ? 'stopped' : 
                        status === 3 ? 'expired' : 'unknown'
      
      testResults.steps.push({
        step: 'verify_stopped',
        status: status === 2 ? 'success' : 'error',
        message: `Final phone status: ${statusName} (${status})`,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - stepStart
      })
    } catch (error) {
      testResults.steps.push({
        step: 'verify_stopped',
        status: 'error',
        message: `Failed to verify final status: ${error}`,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - stepStart
      })
    }

    // Calculate overall results
    const successSteps = testResults.steps.filter(s => s.status === 'success').length
    const totalSteps = testResults.steps.length
    const overallSuccess = successSteps === totalSteps

    // Log the test results
    await supabaseAdmin.from('logs').insert({
      level: overallSuccess ? 'info' : 'warning',
      component: 'phone-lifecycle-test',
      message: `Phone lifecycle test completed: ${successSteps}/${totalSteps} steps successful`,
      meta: {
        profile_id,
        overall_success: overallSuccess,
        steps_successful: successSteps,
        total_steps: totalSteps,
        test_results: testResults
      }
    })

    return NextResponse.json({
      success: overallSuccess,
      message: `Phone lifecycle test completed: ${successSteps}/${totalSteps} steps successful`,
      results: testResults,
      summary: {
        profile_id,
        overall_success: overallSuccess,
        steps_successful: successSteps,
        total_steps: totalSteps
      }
    })

  } catch (error) {
    console.error('Phone lifecycle test error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'phone-lifecycle-test',
      message: 'Phone lifecycle test failed with error',
      meta: { 
        error: error instanceof Error ? error.message : String(error)
      }
    })

    return NextResponse.json(
      { error: 'Phone lifecycle test failed' },
      { status: 500 }
    )
  }
} 