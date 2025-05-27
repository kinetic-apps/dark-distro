import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    // Fetch proxies from GeeLark
    const proxiesData = await geelarkApi.listProxies(1, 100)
    
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-list-proxies',
      message: 'Fetched GeeLark proxies',
      meta: { 
        total: proxiesData.total,
        count: proxiesData.list?.length || 0
      }
    })

    return NextResponse.json({
      success: true,
      proxies: proxiesData.list || [],
      total: proxiesData.total
    })
  } catch (error) {
    console.error('List proxies error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-list-proxies',
      message: 'Failed to fetch GeeLark proxies',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch proxies' },
      { status: 500 }
    )
  }
} 