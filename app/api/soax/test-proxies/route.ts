import { NextRequest, NextResponse } from 'next/server'

const PACKAGE_KEY = process.env.SOAX_PACKAGE_KEY!
const SOAX_POOL_HOST = process.env.SOAX_POOL_HOST!
const SOAX_POOL_PORT = process.env.SOAX_POOL_PORT!

export async function POST(request: NextRequest) {
  try {
    if (!PACKAGE_KEY) {
      return NextResponse.json(
        { error: 'SOAX package key not configured' },
        { status: 400 }
      )
    }

    // SOAX proxy configuration tests
    const proxyHost = SOAX_POOL_HOST || 'proxy.soax.com'
    const proxyPort = SOAX_POOL_PORT || '5000'
    
    // Test results object
    const tests = {
      package_config: {
        passed: false,
        message: 'Package configuration invalid'
      },
      proxy_config: {
        passed: false,
        message: 'Proxy configuration incomplete'
      },
      service_reachability: {
        passed: false,
        message: 'SOAX service not reachable'
      }
    }

    // Test 1: Validate package key format
    const isValidPackageKey = /^\d+$/.test(PACKAGE_KEY)
    if (isValidPackageKey) {
      tests.package_config.passed = true
      tests.package_config.message = 'Package key format is valid'
    } else {
      tests.package_config.message = 'Package key should be numeric'
    }

    // Test 2: Check proxy configuration
    if (proxyHost && proxyPort) {
      tests.proxy_config.passed = true
      tests.proxy_config.message = 'Proxy configuration available'
    } else {
      tests.proxy_config.message = 'Missing proxy host or port configuration'
    }

    // Test 3: Test service reachability
    try {
      const response = await fetch('https://soax.com/', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })
      
      if (response.ok) {
        tests.service_reachability.passed = true
        tests.service_reachability.message = 'SOAX service is reachable'
      } else {
        tests.service_reachability.message = `SOAX service returned HTTP ${response.status}`
      }
    } catch (error) {
      tests.service_reachability.message = `Service unreachable: ${error}`
    }

    // Determine overall success
    const allTestsPassed = Object.values(tests).every(test => test.passed)

    // Generate proxy authentication examples
    const sessionId = `session-${Date.now()}`
    const basicAuth = `package-${PACKAGE_KEY}-sessionid-${sessionId}:${PACKAGE_KEY}`
    const geoAuth = `package-${PACKAGE_KEY}-country-us-sessionid-${sessionId}:${PACKAGE_KEY}`

    return NextResponse.json({
      success: allTestsPassed,
      message: allTestsPassed 
        ? 'SOAX proxy configuration test completed successfully' 
        : 'SOAX proxy configuration test completed with issues',
      tests,
      proxy_details: {
        host: proxyHost,
        port: proxyPort,
        package_key: PACKAGE_KEY,
        type: 'residential'
      },
      auth_examples: {
        basic: basicAuth,
        with_geo: geoAuth,
        format: 'package-{package_id}-[country-{cc}]-sessionid-{session}:{package_key}'
      },
      usage_notes: [
        'SOAX proxies require proper network configuration to test actual connectivity',
        'Package key should match your SOAX dashboard configuration',
        'Session IDs should be unique for each connection',
        'Geographic targeting is optional but recommended for specific use cases'
      ]
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Network error: ${error}` },
      { status: 500 }
    )
  }
} 