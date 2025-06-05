import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    // Get existing proxies to preserve group assignments
    const { data: existingProxies } = await supabaseAdmin
      .from('proxies')
      .select('geelark_id, group_name, tags, is_active')
    
    // Create a map for quick lookup
    const existingProxyMap = new Map(
      existingProxies?.map(p => [p.geelark_id, p]) || []
    )

    // Fetch all proxies from GeeLark
    let allGeelarkProxies: any[] = []
    let currentPage = 1
    const pageSize = 100
    
    // Fetch all pages
    while (true) {
      const response = await geelarkApi.listProxies(currentPage, pageSize)
      allGeelarkProxies.push(...response.list)
      
      if (allGeelarkProxies.length >= response.total || currentPage >= 10) {
        break
      }
      currentPage++
    }

    // Prepare upsert data
    const upsertData = allGeelarkProxies.map(proxy => {
      const existing = existingProxyMap.get(proxy.id)
      
      return {
        geelark_id: proxy.id,
        scheme: proxy.scheme,
        server: proxy.server,
        port: proxy.port,
        username: proxy.username || null,
        password: proxy.password || null,
        // Preserve existing metadata if available
        group_name: existing?.group_name || null,
        tags: existing?.tags || [],
        is_active: existing?.is_active ?? true,
        synced_at: new Date().toISOString()
      }
    })

    // Upsert proxies in batches
    const batchSize = 100
    let totalUpserted = 0
    let errors = 0

    for (let i = 0; i < upsertData.length; i += batchSize) {
      const batch = upsertData.slice(i, i + batchSize)
      
      const { error } = await supabaseAdmin
        .from('proxies')
        .upsert(batch, {
          onConflict: 'geelark_id',
          ignoreDuplicates: false
        })
      
      if (error) {
        console.error('Batch upsert error:', error)
        errors += batch.length
      } else {
        totalUpserted += batch.length
      }
    }

    // Mark proxies that no longer exist in GeeLark as inactive
    const geelarkIds = allGeelarkProxies.map(p => p.id)
    const { error: deactivateError } = await supabaseAdmin
      .from('proxies')
      .update({ is_active: false })
      .not('geelark_id', 'in', `(${geelarkIds.join(',')})`)

    if (deactivateError) {
      console.error('Error deactivating old proxies:', deactivateError)
    }

    // Log the sync operation
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-proxy-sync',
      message: 'GeeLark proxy sync completed',
      meta: {
        total_from_geelark: allGeelarkProxies.length,
        total_upserted: totalUpserted,
        errors: errors,
        timestamp: new Date().toISOString()
      }
    })

    return NextResponse.json({
      success: true,
      message: `Synced ${totalUpserted} proxies from GeeLark`,
      stats: {
        total_from_geelark: allGeelarkProxies.length,
        total_upserted: totalUpserted,
        errors: errors
      }
    })

  } catch (error) {
    console.error('GeeLark proxy sync error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'geelark-proxy-sync',
      message: 'Failed to sync proxies from GeeLark',
      meta: { 
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync proxies' },
      { status: 500 }
    )
  }
} 