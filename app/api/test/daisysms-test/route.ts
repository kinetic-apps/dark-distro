import { NextRequest, NextResponse } from 'next/server'
import { daisyApi } from '@/lib/daisy-api'

export async function GET(request: NextRequest) {
  try {
    // Test 1: Check balance
    const balance = await daisyApi.getBalance()
    
    // Test 2: Get service prices (optional - for debugging)
    let prices = null
    try {
      const pricesResponse = await fetch(
        `https://daisysms.com/stubs/handler_api.php?api_key=${process.env.DAISYSMS_API_KEY}&action=getPrices`
      )
      const pricesText = await pricesResponse.text()
      prices = pricesText.substring(0, 200) + '...' // Just show a preview
    } catch (e) {
      prices = 'Failed to fetch prices'
    }

    return NextResponse.json({
      success: true,
      balance: balance,
      prices_preview: prices,
      api_configured: !!process.env.DAISYSMS_API_KEY
    })
  } catch (error) {
    console.error('DaisySMS test error:', error)
    return NextResponse.json(
      { 
        error: 'DaisySMS test failed',
        details: error instanceof Error ? error.message : String(error),
        api_configured: !!process.env.DAISYSMS_API_KEY
      },
      { status: 500 }
    )
  }
} 