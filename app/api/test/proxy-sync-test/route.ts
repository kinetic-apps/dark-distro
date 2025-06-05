import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Trigger the sync
    const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/sync-proxies-from-geelark`, {
      method: 'POST'
    })
    
    const syncResult = await syncResponse.json()
    
    return NextResponse.json({
      success: true,
      message: 'Proxy sync test completed',
      sync_result: syncResult,
      next_steps: [
        '1. Check the Proxies tab to see synced proxies',
        '2. Assign group names to proxies',
        '3. Enable groups for phone creation in Group Settings',
        '4. Test phone creation with filtered proxies'
      ]
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Test failed',
        suggestion: 'Check logs for details'
      },
      { status: 500 }
    )
  }
} 