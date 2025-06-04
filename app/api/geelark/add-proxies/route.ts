import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'

export async function POST(request: NextRequest) {
  try {
    const { proxies } = await request.json()

    if (!proxies || !Array.isArray(proxies) || proxies.length === 0) {
      return NextResponse.json(
        { error: 'No proxies provided' },
        { status: 400 }
      )
    }

    // Add proxies to GeeLark
    const result = await geelarkApi.addProxies(proxies)

    return NextResponse.json({
      success: true,
      totalCount: result.totalAmount,
      successCount: result.successAmount,
      failedCount: result.failAmount,
      failedDetails: result.failDetails,
      successDetails: result.successDetails,
      message: result.failAmount > 0 
        ? `Imported ${result.successAmount} of ${result.totalAmount} proxies (${result.failAmount} failed)`
        : `Successfully imported all ${result.successAmount} proxies`
    })
  } catch (error) {
    console.error('Add proxies error:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add proxies' },
      { status: 500 }
    )
  }
}