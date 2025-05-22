import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.GEELARK_API_BASE_URL!
const API_KEY = process.env.GEELARK_API_KEY!
const APP_ID = process.env.GEELARK_APP_ID!

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY || !API_BASE_URL || !APP_ID) {
      return NextResponse.json(
        { error: 'GeeLark credentials not configured' },
        { status: 400 }
      )
    }

    // GeeLark uses POST method with JSON body for all API calls
    // Use the correct GeeLark API endpoint
    const response = await fetch(`${API_BASE_URL}/api/v1/profile/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: API_KEY,
        app_id: APP_ID,
        page: 1,
        page_size: 10  // Get up to 10 profiles for testing
      }),
    })

    // Get response as text first to handle non-JSON responses
    const responseText = await response.text()

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${responseText}` },
        { status: 400 }
      )
    }

    // Try to parse as JSON
    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      return NextResponse.json(
        { error: `Non-JSON response: ${responseText}` },
        { status: 400 }
      )
    }

    // Check for GeeLark error responses
    if (data.code && data.code !== 200 && data.code !== 0) {
      return NextResponse.json(
        { error: `GeeLark error (${data.code}): ${data.msg || data.message || 'Unknown error'}` },
        { status: 400 }
      )
    }

    const profiles = data.data?.list || []

    return NextResponse.json({
      success: true,
      message: `Found ${profiles.length} profiles`,
      profiles: profiles.map((p: any) => ({
        id: p.profile_id || p.id,
        name: p.profile_name || p.name,
        status: p.status,
        device: p.device_info || 'unknown'
      })),
      total: data.data?.total || profiles.length,
      response_preview: responseText.substring(0, 200)
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Network error: ${error}` },
      { status: 500 }
    )
  }
} 