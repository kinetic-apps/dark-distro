import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    // Get all proxies without GeeLark IDs
    const { data: proxies, error } = await supabaseAdmin
      .from('proxies')
      .select('*')
      .is('geelark_proxy_id', null)

    if (error) throw error

    if (!proxies || proxies.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No proxies to sync',
        synced: 0 
      })
    }

    // Prepare proxy list for GeeLark
    const proxyList = proxies.map(proxy => {
      // Handle SOAX proxy password format
      let password = proxy.password
      if (password && password.includes(';;;;')) {
        // Extract the actual password part before the semicolons
        password = password.split(';;;;')[0]
      }

      return {
        scheme: 'socks5' as const,
        server: proxy.host,
        port: proxy.port,
        username: proxy.username,
        password: password
      }
    })

    // Add proxies to GeeLark in batches of 100
    let totalSynced = 0
    let totalFailed = 0
    const batchSize = 100

    for (let i = 0; i < proxyList.length; i += batchSize) {
      const batch = proxyList.slice(i, i + batchSize)
      
      try {
        const result = await geelarkApi.addProxies(batch)

        // Update proxies with GeeLark IDs
        if (result.successDetails && Array.isArray(result.successDetails)) {
          for (const successDetail of result.successDetails) {
            const proxyIndex = i + successDetail.index
            const proxy = proxies[proxyIndex]
            
            if (proxy) {
              await supabaseAdmin
                .from('proxies')
                .update({ geelark_proxy_id: successDetail.id })
                .eq('id', proxy.id)
              
              totalSynced++
            }
          }
        }

        // Log any failures
        if (result.failDetails && Array.isArray(result.failDetails)) {
          for (const failDetail of result.failDetails) {
            const proxyIndex = i + failDetail.index
            const proxy = proxies[proxyIndex]
            
            totalFailed++
            
            // Only log if it's not "proxy already exists" error
            if (failDetail.code !== 45007) {
              await supabaseAdmin.from('logs').insert({
                level: 'warning',
                component: 'api-sync-proxies',
                message: `Failed to sync proxy to GeeLark: ${failDetail.msg}`,
                meta: { 
                  proxy_id: proxy?.id,
                  proxy_host: proxy?.host,
                  proxy_port: proxy?.port,
                  error_code: failDetail.code,
                  error_msg: failDetail.msg,
                  password_format: proxy?.password?.includes(';;;;') ? 'soax_format' : 'standard'
                }
              })
            }
          }
        }
      } catch (batchError) {
        console.error(`Error processing batch starting at index ${i}:`, batchError)
        
        await supabaseAdmin.from('logs').insert({
          level: 'error',
          component: 'api-sync-proxies',
          message: `Failed to process proxy batch`,
          meta: { 
            batch_start: i,
            batch_size: batch.length,
            error: String(batchError)
          }
        })
      }
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-sync-proxies',
      message: 'Proxy sync completed',
      meta: { 
        total_proxies: proxies.length,
        synced: totalSynced,
        failed: totalFailed
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: totalFailed > 0 
        ? `Synced ${totalSynced} of ${proxies.length} proxies (${totalFailed} failed)`
        : `Successfully synced all ${totalSynced} proxies`,
      synced: totalSynced,
      failed: totalFailed,
      total: proxies.length
    })
  } catch (error) {
    console.error('Sync proxies error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-sync-proxies',
      message: 'Failed to sync proxies',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync proxies' },
      { status: 500 }
    )
  }
} 