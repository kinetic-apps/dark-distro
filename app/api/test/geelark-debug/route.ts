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

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const config = {
      API_BASE_URL: API_BASE_URL || 'NOT SET',
      API_KEY: API_KEY ? '***' + API_KEY.slice(-4) : 'NOT SET',
      APP_ID: APP_ID || 'NOT SET',
    }

    console.log('GeeLark Debug - Environment Config:', config)

    if (!API_KEY || !API_BASE_URL || !APP_ID) {
      return NextResponse.json({
        error: 'GeeLark credentials not configured',
        environment: config,
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    // Test the exact same API call as sync-profiles
    let testResult = null
    let testError = null
    
    try {
      // Generate required authentication parameters (same as sync-profiles)
      const timestamp = new Date().getTime().toString()
      const traceId = generateUUID()
      const nonce = traceId.substring(0, 6)
      
      // Generate signature: SHA256(appId + traceId + ts + nonce + apiKey)
      const signString = APP_ID + traceId + timestamp + nonce + API_KEY
      const sign = createHash('sha256').update(signString).digest('hex').toUpperCase()

      console.log('Debug - Auth params:', {
        timestamp,
        traceId,
        nonce,
        signString: `${APP_ID} + ${traceId} + ${timestamp} + ${nonce} + ***`,
        sign
      })

      // GeeLark API call to get all phone profiles (same as sync-profiles)
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
          pageSize: 10  // Small number for testing
        }),
      })

      const responseText = await response.text()
      console.log('GeeLark API Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText
      })

      if (!response.ok) {
        testError = {
          type: 'HTTP_ERROR',
          status: response.status,
          statusText: response.statusText,
          body: responseText
        }
      } else {
        try {
          const data = JSON.parse(responseText)
          if (data.code !== 0) {
            testError = {
              type: 'GEELARK_ERROR',
              code: data.code,
              message: data.msg,
              data: data
            }
          } else {
            testResult = {
              success: true,
              profileCount: data.data?.items?.length || 0,
              profiles: data.data?.items || [],
              fullResponse: data,
              // Specifically extract proxy info
              proxyInfo: data.data?.items?.map((item: any) => ({
                profileId: item.id,
                profileName: item.serialName,
                hasProxy: !!item.proxy,
                proxy: item.proxy || null
              }))
            }
          }
        } catch (parseError) {
          testError = {
            type: 'PARSE_ERROR',
            message: 'Failed to parse JSON response',
            body: responseText,
            parseError: parseError instanceof Error ? parseError.message : String(parseError)
          }
        }
      }
    } catch (error) {
      testError = {
        type: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      }
    }

    return NextResponse.json({
      environment: config,
      testResult,
      testError,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Debug failed',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 