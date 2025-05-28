import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'

export async function GET(request: NextRequest) {
  try {
    const flows = await geelarkApi.getTaskFlows()
    
    // Filter for TikTok-related flows
    const tiktokFlows = flows.items.filter(flow => 
      flow.title.toLowerCase().includes('tiktok') ||
      flow.desc.toLowerCase().includes('tiktok') ||
      flow.title.toLowerCase().includes('phone') ||
      flow.params.includes('phoneNumber')
    )
    
    return NextResponse.json({
      total: flows.total,
      flows: flows.items,
      tiktok_flows: tiktokFlows
    })
  } catch (error) {
    console.error('Failed to get task flows:', error)
    return NextResponse.json(
      { error: 'Failed to get task flows' },
      { status: 500 }
    )
  }
} 