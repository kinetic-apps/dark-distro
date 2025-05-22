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

    const url = `${API_BASE_URL}/api/v1/profiles`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'X-App-ID': APP_ID,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${data.message || 'Profile listing failed'}` },
        { status: 400 }
      )
    }

    if (data.code !== 0) {
      return NextResponse.json(
        { error: `GeeLark error: ${data.msg}` },
        { status: 400 }
      )
    }

    const profiles = data.data || []

    return NextResponse.json({
      success: true,
      message: `Found ${profiles.length} profiles`,
      profiles: profiles.map((p: any) => ({
        id: p.profile_id,
        status: p.status,
        device: p.device_info
      }))
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Network error: ${error}` },
      { status: 500 }
    )
  }
} 