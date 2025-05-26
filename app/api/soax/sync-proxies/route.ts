import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { soaxApi } from '@/lib/soax-api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type = 'all' } = body // 'all', 'sticky', 'rotating', 'sim'

    let imported = 0
    let skipped = 0
    let errors = 0
    const results = []

    // Import sticky proxies
    if (type === 'all' || type === 'sticky') {
      try {
        // Generate a few sticky proxy sessions
        for (let i = 1; i <= 5; i++) {
          const sessionId = soaxApi.generateStickySession()
          const proxyCredentials = soaxApi.getStickyPoolProxy(sessionId)
          
          const { data: existingProxy } = await supabaseAdmin
            .from('proxies')
            .select('id')
            .eq('host', proxyCredentials.host)
            .eq('port', proxyCredentials.port)
            .eq('session_id', sessionId)
            .single()

          if (existingProxy) {
            skipped++
            continue
          }

          const { data: proxy, error } = await supabaseAdmin
            .from('proxies')
            .insert({
              label: `Sticky-${sessionId}`,
              type: 'sticky',
              host: proxyCredentials.host,
              port: proxyCredentials.port,
              username: proxyCredentials.username,
              password: proxyCredentials.password,
              session_id: sessionId,
              health: 'unknown',
              meta: {
                package_key: process.env.SOAX_PACKAGE_KEY,
                created_from: 'sync',
                created_at: new Date().toISOString()
              }
            })
            .select()
            .single()

          if (error) {
            console.error(`Failed to create sticky proxy:`, error)
            errors++
          } else {
            imported++
            results.push(proxy)
          }
        }
      } catch (error) {
        console.error('Error importing sticky proxies:', error)
        errors++
      }
    }

    // Import rotating proxy
    if (type === 'all' || type === 'rotating') {
      try {
        const proxyCredentials = soaxApi.getRotatingPoolProxy()
        
        const { data: existingProxy } = await supabaseAdmin
          .from('proxies')
          .select('id')
          .eq('host', proxyCredentials.host)
          .eq('port', proxyCredentials.port)
          .eq('type', 'rotating')
          .single()

        if (!existingProxy) {
          const { data: proxy, error } = await supabaseAdmin
            .from('proxies')
            .insert({
              label: 'Rotating-Pool',
              type: 'rotating',
              host: proxyCredentials.host,
              port: proxyCredentials.port,
              username: proxyCredentials.username,
              password: proxyCredentials.password,
              health: 'unknown',
              meta: {
                package_key: process.env.SOAX_PACKAGE_KEY,
                created_from: 'sync',
                created_at: new Date().toISOString()
              }
            })
            .select()
            .single()

          if (error) {
            console.error(`Failed to create rotating proxy:`, error)
            errors++
          } else {
            imported++
            results.push(proxy)
          }
        } else {
          skipped++
        }
      } catch (error) {
        console.error('Error importing rotating proxy:', error)
        errors++
      }
    }

    // Import SIM proxies
    if (type === 'all' || type === 'sim') {
      try {
        // SIM proxies use specific ports - let's import a few common ones
        const simPorts = [5000, 5001, 5002, 5003, 5004] // You can adjust these based on your SOAX package
        
        for (const port of simPorts) {
          const proxyCredentials = soaxApi.getDedicatedSIMProxy(port)
          
          const { data: existingProxy } = await supabaseAdmin
            .from('proxies')
            .select('id')
            .eq('host', proxyCredentials.host)
            .eq('port', proxyCredentials.port)
            .single()

          if (existingProxy) {
            skipped++
            continue
          }

          const { data: proxy, error } = await supabaseAdmin
            .from('proxies')
            .insert({
              label: `SIM-${port}`,
              type: 'sim',
              host: proxyCredentials.host,
              port: proxyCredentials.port,
              username: proxyCredentials.username,
              password: proxyCredentials.password,
              soax_port: port,
              health: 'unknown',
              meta: {
                sim_credentials: true,
                created_from: 'sync',
                created_at: new Date().toISOString()
              }
            })
            .select()
            .single()

          if (error) {
            console.error(`Failed to create SIM proxy on port ${port}:`, error)
            errors++
          } else {
            imported++
            results.push(proxy)
          }
        }
      } catch (error) {
        console.error('Error importing SIM proxies:', error)
        errors++
      }
    }

    // Check health of newly imported proxies
    for (const proxy of results) {
      try {
        const isHealthy = await soaxApi.checkProxyHealth({
          host: proxy.host,
          port: proxy.port,
          username: proxy.username,
          password: proxy.password
        })

        if (isHealthy) {
          await supabaseAdmin
            .from('proxies')
            .update({ health: 'good' })
            .eq('id', proxy.id)
        }
      } catch (error) {
        console.error(`Health check failed for proxy ${proxy.id}:`, error)
      }
    }

    // Log the sync operation
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-sync-proxies',
      message: `SOAX proxy sync completed: ${imported} imported, ${skipped} skipped, ${errors} errors`,
      meta: { 
        type,
        imported,
        skipped,
        errors,
        results: results.map(p => ({ id: p.id, label: p.label, type: p.type }))
      }
    })

    return NextResponse.json({
      success: true,
      message: `Sync completed: ${imported} proxies imported`,
      stats: {
        imported,
        skipped,
        errors
      },
      proxies: results
    })

  } catch (error) {
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-sync-proxies',
      message: 'Failed to sync SOAX proxies',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: `Sync error: ${error}` },
      { status: 500 }
    )
  }
} 