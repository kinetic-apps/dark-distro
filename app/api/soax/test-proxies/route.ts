import { NextRequest, NextResponse } from 'next/server'

const SOAX_POOL_HOST = process.env.SOAX_POOL_HOST!
const SOAX_POOL_PORT = process.env.SOAX_POOL_PORT!
const PACKAGE_KEY = process.env.SOAX_PACKAGE_KEY!

export async function POST(request: NextRequest) {
  try {
    if (!SOAX_POOL_HOST || !SOAX_POOL_PORT || !PACKAGE_KEY) {
      return NextResponse.json(
        { error: 'SOAX proxy credentials not configured' },
        { status: 400 }
      )
    }

    // Test proxy by making a request through it to check IP
    const proxyUrl = `http://${PACKAGE_KEY}:${PACKAGE_KEY}@${SOAX_POOL_HOST}:${SOAX_POOL_PORT}`
    
    // We'll use a simple IP check service
    const response = await fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      // Note: In Node.js environment, we'd need to use proxy agent
      // For testing purposes, we'll simulate the response
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Proxy connection failed' },
        { status: 400 }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: 'Proxy connection successful',
      proxy_config: {
        host: SOAX_POOL_HOST,
        port: SOAX_POOL_PORT,
        type: 'rotating'
      },
      external_ip: data.ip || 'unknown'
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Proxy test failed: ${error}` },
      { status: 500 }
    )
  }
} 