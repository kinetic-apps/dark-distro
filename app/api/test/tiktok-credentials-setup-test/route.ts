import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Test the setup with minimal configuration
    const testConfig = {
      device_model: body.device_model || 'Pixel 6',
      android_version: body.android_version || 3,
      group_name: body.group_name || 'test-credentials-setup',
      tags: ['test', 'credentials-setup'],
      remark: 'Test TikTok credentials setup',
      region: 'us',
      assign_proxy: true,
      proxy_type: 'sim',
      warmup_duration_minutes: body.warmup_duration_minutes || 15,
      warmup_action: body.warmup_action || 'browse video'
    }

    console.log('Testing TikTok credentials setup with config:', testConfig)

    // Call the actual setup endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/automation/setup-tiktok-with-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testConfig)
    })

    const data = await response.json()
    
    if (!response.ok) {
      return NextResponse.json(
        { 
          error: data.error || 'Setup failed',
          details: data
        },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'TikTok credentials setup test completed',
      result: data,
      test_config: testConfig
    })

  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Test failed',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
} 