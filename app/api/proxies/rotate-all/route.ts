import { NextRequest, NextResponse } from 'next/server'
import { soaxApi } from '@/lib/soax-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

// This endpoint is called by the nightly cron job
export async function POST(request: NextRequest) {
  try {
    // Fetch all dedicated SIM proxies
    const { data: dedicatedProxies, error } = await supabaseAdmin
      .from('proxies')
      .select('*')
      .eq('type', 'sim')
      .not('assigned_account_id', 'is', null)

    if (error) throw error

    const results = await Promise.allSettled(
      dedicatedProxies.map(async (proxy) => {
        try {
          // For SIM proxies, we can't rotate via API
          // Just check health and update status
          const isHealthy = await soaxApi.checkProxyHealth({
            host: proxy.host,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password
          })

          await supabaseAdmin
            .from('proxies')
            .update({
              health: isHealthy ? 'good' : 'unknown',
              last_rotated: new Date().toISOString()
            })
            .eq('id', proxy.id)

          return { proxy_id: proxy.id, status: 'checked', healthy: isHealthy }
        } catch (error) {
          return { proxy_id: proxy.id, status: 'error', error: String(error) }
        }
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'nightly-proxy-rotation',
      message: 'Nightly proxy rotation completed',
      meta: { 
        total: dedicatedProxies.length,
        successful,
        failed,
        timestamp: new Date().toISOString()
      }
    })

    return NextResponse.json({
      success: true,
      total: dedicatedProxies.length,
      successful,
      failed
    })
  } catch (error) {
    console.error('Nightly rotation error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'nightly-proxy-rotation',
      message: 'Failed to run nightly proxy rotation',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to rotate proxies' },
      { status: 500 }
    )
  }
}