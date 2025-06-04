import { NextRequest, NextResponse } from 'next/server'

// Test endpoint to verify TikTok engagement automation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Test with a single profile and username
    const testPayload = {
      profile_ids: body.profile_ids || ['test-profile-id'],
      target_usernames: body.target_usernames || ['cristiano', 'leomessi'],
      comments: body.comments || [
        "Great content! 🔥",
        "Love this! ❤️",
        "Amazing! 👏"
      ],
      posts_per_user: body.posts_per_user || 2,
      like_only: body.like_only || false
    }

    // Call the engagement API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/automation/tiktok-engage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    })

    const result = await response.json()

    return NextResponse.json({
      test_payload: testPayload,
      engagement_result: result,
      success: response.ok
    })

  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Test failed' },
      { status: 500 }
    )
  }
} 