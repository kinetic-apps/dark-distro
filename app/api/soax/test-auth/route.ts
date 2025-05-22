import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.SOAX_API_BASE_URL!
const API_KEY = process.env.SOAX_API_KEY!
const PACKAGE_KEY = process.env.SOAX_PACKAGE_KEY!

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY || !API_BASE_URL || !PACKAGE_KEY) {
      return NextResponse.json(
        { error: 'SOAX credentials not configured' },
        { status: 400 }
      )
    }

    // Test authentication using package stats endpoint
    // Try different SOAX API endpoint patterns
    const response = await fetch(`${API_BASE_URL}/v1/packages/${PACKAGE_KEY}/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 401) {
      return NextResponse.json(
        { error: 'Invalid API key - authentication failed' },
        { status: 401 }
      )
    }

    if (response.status === 403) {
      return NextResponse.json(
        { error: 'API key lacks required permissions' },
        { status: 403 }
      )
    }

    const responseText = await response.text()

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${responseText}` },
        { status: 400 }
      )
    }

    // Try to parse JSON response
    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      return NextResponse.json(
        { error: `Non-JSON response: ${responseText}` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'SOAX authentication successful',
      data: {
        api_key_valid: true,
        package_key: PACKAGE_KEY,
        response_preview: responseText.substring(0, 200)
      }
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Network error: ${error}` },
      { status: 500 }
    )
  }
} 