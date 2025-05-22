import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.SOAX_API_BASE_URL!
const API_KEY = process.env.SOAX_API_KEY!
const SOAX_POOL_HOST = process.env.SOAX_POOL_HOST!
const SOAX_POOL_PORT = process.env.SOAX_POOL_PORT!
const PACKAGE_KEY = process.env.SOAX_PACKAGE_KEY!

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY || !API_BASE_URL || !PACKAGE_KEY) {
      return NextResponse.json(
        { error: 'SOAX credentials not configured' },
        { status: 400 }
      )
    }

    // Test 1: Check if we can access package/account info (proxy pool status)
    let apiTestPassed = false
    let packageInfo = null

    try {
      const response = await fetch(`${API_BASE_URL}/packages/${PACKAGE_KEY}/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        packageInfo = await response.json()
        apiTestPassed = true
      }
    } catch (error) {
      // API test failed, but continue with proxy test
    }

    // Test 2: Check proxy configuration (if available)
    let proxyConfigValid = false
    let proxyDetails = null

    if (SOAX_POOL_HOST && SOAX_POOL_PORT) {
      proxyConfigValid = true
      proxyDetails = {
        host: SOAX_POOL_HOST,
        port: SOAX_POOL_PORT,
        username: PACKAGE_KEY, // SOAX typically uses package key as username
        type: 'residential'
      }
    }

    // Test 3: Try to validate proxy credentials format
    const credentialsValid = !!(PACKAGE_KEY && PACKAGE_KEY.length > 10)

    return NextResponse.json({
      success: true,
      message: 'SOAX proxy test completed',
      tests: {
        api_access: {
          passed: apiTestPassed,
          message: apiTestPassed ? 'API accessible' : 'API test failed'
        },
        proxy_config: {
          passed: proxyConfigValid,
          message: proxyConfigValid ? 'Proxy configuration available' : 'Proxy configuration missing'
        },
        credentials: {
          passed: credentialsValid,
          message: credentialsValid ? 'Credentials format valid' : 'Invalid credentials format'
        }
      },
      proxy_details: proxyDetails,
      package_info: packageInfo
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Proxy test failed: ${error}` },
      { status: 500 }
    )
  }
} 