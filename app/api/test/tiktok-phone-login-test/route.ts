import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { profile_id, phone_number } = await request.json()
    
    if (!profile_id || !phone_number) {
      return NextResponse.json(
        { error: 'profile_id and phone_number are required' },
        { status: 400 }
      )
    }
    
    console.log('Testing phone login with GeeLark API...')
    console.log(`Profile: ${profile_id}`)
    console.log(`Phone: ${phone_number}`)
    
    const results: any[] = []
    
    // Test 1: Try with full phone number
    console.log('\n=== TEST 1: Full phone number ===')
    try {
      const password1 = 'phone_test_' + Date.now()
      console.log(`Using placeholder password: ${password1}`)
      const response1 = await geelarkApi.loginTikTok(profile_id, phone_number, password1)
      console.log('SUCCESS! Task created:', response1)
      results.push({
        test: 'full_phone_number',
        input: phone_number,
        password: password1,
        success: true,
        task_id: response1.taskId,
        response: response1
      })
      
      // Wait a bit and check task status
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const status = await geelarkApi.getTaskStatus(response1.taskId)
        results[results.length - 1].task_status = status
        console.log('Task status:', status)
      } catch (e) {
        console.log('Could not get task status:', e)
      }
    } catch (error) {
      console.log('FAILED:', error)
      results.push({
        test: 'full_phone_number',
        input: phone_number,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    
    // Test 2: Try without country code
    const phoneWithoutCode = phone_number.startsWith('1') ? phone_number.substring(1) : phone_number
    console.log('\n=== TEST 2: Phone without country code ===')
    try {
      const password2 = 'phone_test_' + Date.now()
      console.log(`Using placeholder password: ${password2}`)
      const response2 = await geelarkApi.loginTikTok(profile_id, phoneWithoutCode, password2)
      console.log('SUCCESS! Task created:', response2)
      results.push({
        test: 'phone_without_code',
        input: phoneWithoutCode,
        password: password2,
        success: true,
        task_id: response2.taskId,
        response: response2
      })
      
      // Wait a bit and check task status
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const status = await geelarkApi.getTaskStatus(response2.taskId)
        results[results.length - 1].task_status = status
        console.log('Task status:', status)
      } catch (e) {
        console.log('Could not get task status:', e)
      }
    } catch (error) {
      console.log('FAILED:', error)
      results.push({
        test: 'phone_without_code',
        input: phoneWithoutCode,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    
    // Test 3: Try with + prefix
    const phoneWithPlus = '+' + phone_number
    console.log('\n=== TEST 3: Phone with + prefix ===')
    try {
      const password3 = 'phone_test_' + Date.now()
      console.log(`Using placeholder password: ${password3}`)
      const response3 = await geelarkApi.loginTikTok(profile_id, phoneWithPlus, password3)
      console.log('SUCCESS! Task created:', response3)
      results.push({
        test: 'phone_with_plus',
        input: phoneWithPlus,
        password: password3,
        success: true,
        task_id: response3.taskId,
        response: response3
      })
      
      // Wait a bit and check task status
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const status = await geelarkApi.getTaskStatus(response3.taskId)
        results[results.length - 1].task_status = status
        console.log('Task status:', status)
      } catch (e) {
        console.log('Could not get task status:', e)
      }
    } catch (error) {
      console.log('FAILED:', error)
      results.push({
        test: 'phone_with_plus',
        input: phoneWithPlus,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    
    // Test 4: Try with international format without +
    const phoneInternational = '1' + phoneWithoutCode
    console.log('\n=== TEST 4: International format (no +) ===')
    try {
      const password4 = 'phone_test_' + Date.now()
      console.log(`Using placeholder password: ${password4}`)
      const response4 = await geelarkApi.loginTikTok(profile_id, phoneInternational, password4)
      console.log('SUCCESS! Task created:', response4)
      results.push({
        test: 'international_no_plus',
        input: phoneInternational,
        password: password4,
        success: true,
        task_id: response4.taskId,
        response: response4
      })
      
      // Wait a bit and check task status
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const status = await geelarkApi.getTaskStatus(response4.taskId)
        results[results.length - 1].task_status = status
        console.log('Task status:', status)
      } catch (e) {
        console.log('Could not get task status:', e)
      }
    } catch (error) {
      console.log('FAILED:', error)
      results.push({
        test: 'international_no_plus',
        input: phoneInternational,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    
    // Log results
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'tiktok-phone-login-test',
      message: 'Phone login tests completed',
      meta: {
        profile_id,
        phone_number,
        results,
        summary: {
          total_tests: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      }
    })
    
    // Analyze results
    const analysis = {
      phone_login_supported: results.some(r => r.success),
      working_formats: results.filter(r => r.success).map(r => r.test),
      recommendations: [] as string[]
    }
    
    if (results.some(r => r.success)) {
      analysis.recommendations.push('Phone login appears to be supported!')
      const successfulTest = results.find(r => r.success)
      if (successfulTest) {
        analysis.recommendations.push(`Use format: ${successfulTest.input}`)
        if (successfulTest.task_status) {
          analysis.recommendations.push(`Task status: ${successfulTest.task_status.status}`)
        }
      }
    } else {
      analysis.recommendations.push('Phone login does not appear to be supported')
      analysis.recommendations.push('All formats failed - manual login required')
      analysis.recommendations.push('Consider using email/password login instead')
    }
    
    return NextResponse.json({
      success: true,
      profile_id,
      phone_number,
      results,
      analysis
    })
    
  } catch (error) {
    console.error('Phone login test error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Test failed'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'TikTok Phone Login Test Endpoint',
    usage: {
      method: 'POST',
      body: {
        profile_id: 'required - GeeLark profile ID',
        phone_number: 'required - phone number to test (e.g., 13476711222)'
      },
      tests: [
        'Full phone number (e.g., 13476711222)',
        'Without country code (e.g., 3476711222)',
        'With + prefix (e.g., +13476711222)',
        'International format (no +)'
      ]
    }
  })
} 