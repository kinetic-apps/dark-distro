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

    const url = `${API_BASE_URL}/packages/${PACKAGE_KEY}/stats`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${data.error || 'Authentication failed'}` },
        { status: 400 }
      )
    }

    if (!data.success) {
      return NextResponse.json(
        { error: `SOAX error: ${data.error}` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      data: data.data
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Network error: ${error}` },
      { status: 500 }
    )
  }
} 