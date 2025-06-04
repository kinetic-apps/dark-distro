import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'

export async function POST(request: NextRequest) {
  try {
    // Fetch all proxies from GeeLark
    const proxiesData = await geelarkApi.listProxies(1, 100)
    
    // If there are more pages, fetch them all
    const allProxies = [...proxiesData.list]
    let currentPage = 1
    
    while (allProxies.length < proxiesData.total && currentPage < 10) {
      currentPage++
      const nextPage = await geelarkApi.listProxies(currentPage, 100)
      allProxies.push(...nextPage.list)
    }
    
    return NextResponse.json({
      success: true,
      proxies: allProxies,
      total: proxiesData.total
    })
  } catch (error) {
    console.error('List proxies error:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list proxies' },
      { status: 500 }
    )
  }
}