import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

const API_BASE_URL = process.env.GEELARK_API_BASE_URL!
const API_KEY = process.env.GEELARK_API_KEY!
const APP_ID = process.env.GEELARK_APP_ID!

function generateUUID(): string {
  return 'yxxyxxxxyxyxxyxxyxxxyxxxyxxyxxyx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  }).toUpperCase()
}

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY || !API_BASE_URL || !APP_ID) {
      return NextResponse.json(
        { error: 'GeeLark credentials not configured' },
        { status: 400 }
      )
    }

    // Generate required authentication parameters
    const timestamp = new Date().getTime().toString()
    const traceId = generateUUID()
    const nonce = traceId.substring(0, 6)
    
    // Generate signature: SHA256(appId + traceId + ts + nonce + apiKey)
    const signString = APP_ID + traceId + timestamp + nonce + API_KEY
    const sign = createHash('sha256').update(signString).digest('hex').toUpperCase()

    // GeeLark API call to get phone profiles
    const response = await fetch(`${API_BASE_URL}/open/v1/phone/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'appId': APP_ID,
        'traceId': traceId,
        'ts': timestamp,
        'nonce': nonce,
        'sign': sign,
      },
      body: JSON.stringify({
        page: 1,
        pageSize: 10  // Get up to 10 profiles for testing
      }),
    })

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

    // Check for GeeLark success (code: 0 means success)
    if (data.code !== 0) {
      return NextResponse.json(
        { error: `GeeLark error (${data.code}): ${data.msg || 'Unknown error'}` },
        { status: 400 }
      )
    }

    const profiles = data.data?.list || []

    return NextResponse.json({
      success: true,
      message: `Found ${profiles.length} cloud phone profiles`,
      profiles: profiles.map((p: any) => ({
        id: p.phoneId || p.id,
        name: p.phoneName || p.name || 'Unnamed Phone',
        status: p.status || 'unknown',
        device: p.deviceInfo || p.device || 'Android',
        created: p.createTime || 'unknown'
      })),
      total: data.data?.total || profiles.length,
      trace_id: traceId,
      response_preview: responseText.substring(0, 300)
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Network error: ${error}` },
      { status: 500 }
    )
  }
} 