import { NextRequest, NextResponse } from 'next/server'

const PACKAGE_KEY = process.env.SOAX_PACKAGE_KEY!

export async function POST(request: NextRequest) {
  try {
    if (!PACKAGE_KEY) {
      return NextResponse.json(
        { error: 'SOAX package key not configured' },
        { status: 400 }
      )
    }

    // SOAX is a proxy service - test basic configuration
    const proxyHost = 'proxy.soax.com'
    const proxyPort = '5000'
    const sessionId = `test-${Date.now()}`
    
    // SOAX proxy authentication format: package-{package_id}-sessionid-{session_id}:{package_key}
    const proxyAuth = `package-${PACKAGE_KEY}-sessionid-${sessionId}:${PACKAGE_KEY}`
    
    // Test basic connectivity to SOAX's service
    try {
      // Test if we can reach SOAX's main service
      const response = await fetch('https://soax.com/', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })
      
      if (!response.ok) {
        return NextResponse.json(
          { error: `SOAX service unreachable: HTTP ${response.status}` },
          { status: 400 }
        )
      }
      
      // Basic validation of package key format (should be numeric)
      const isValidPackageKey = /^\d+$/.test(PACKAGE_KEY)
      
      if (!isValidPackageKey) {
        return NextResponse.json(
          { error: 'Invalid SOAX package key format. Package key should be numeric.' },
          { status: 400 }
        )
      }
      
      return NextResponse.json({
        success: true,
        message: 'SOAX configuration valid and service reachable',
        data: {
          service_reachable: true,
          package_key: PACKAGE_KEY,
          package_key_format: 'valid',
          proxy_endpoint: `${proxyHost}:${proxyPort}`,
          proxy_auth_format: `package-${PACKAGE_KEY}-sessionid-{session}:${PACKAGE_KEY}`,
          session_id_example: sessionId,
          note: 'This tests SOAX service availability and configuration format. Actual proxy functionality requires proper network setup.'
        }
      })
      
    } catch (fetchError) {
      return NextResponse.json(
        { 
          error: `SOAX service connectivity test failed: ${fetchError}`,
          details: {
            package_key: PACKAGE_KEY,
            proxy_endpoint: `${proxyHost}:${proxyPort}`,
            error_type: 'service_connectivity_failed'
          }
        },
        { status: 400 }
      )
    }

  } catch (error) {
    return NextResponse.json(
      { error: `Network error: ${error}` },
      { status: 500 }
    )
  }
} 