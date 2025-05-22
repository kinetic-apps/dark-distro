import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.DAISYSMS_API_BASE_URL!
const API_KEY = process.env.DAISYSMS_API_KEY!

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY || !API_BASE_URL) {
      return NextResponse.json(
        { error: 'DaisySMS credentials not configured' },
        { status: 400 }
      )
    }

    const url = new URL(API_BASE_URL)
    url.searchParams.append('api_key', API_KEY)
    url.searchParams.append('action', 'getBalance')

    const response = await fetch(url.toString())
    const text = await response.text()

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${text}` },
        { status: 400 }
      )
    }

    if (text.startsWith('BAD_KEY')) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }

    if (text.startsWith('ACCESS_BALANCE')) {
      const balance = text.split(':')[1]
      return NextResponse.json({
        success: true,
        balance: parseFloat(balance),
        message: `Current balance: ${balance} credits`
      })
    }

    return NextResponse.json(
      { error: `Unexpected response: ${text}` },
      { status: 400 }
    )

  } catch (error) {
    return NextResponse.json(
      { error: `Network error: ${error}` },
      { status: 500 }
    )
  }
} 