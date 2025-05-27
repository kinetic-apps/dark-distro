import { NextRequest, NextResponse } from 'next/server'
import { soaxApi } from '@/lib/soax-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const proxyId = id
  
  try {

    // Rotate proxy
    await soaxApi.rotateProxy(proxyId)

    // Fetch updated proxy data
    const { data: proxy, error } = await supabaseAdmin
      .from('proxies')
      .select('*')
      .eq('id', proxyId)
      .single()

    if (error || !proxy) {
      return NextResponse.json(
        { error: 'Proxy not found' },
        { status: 404 }
      )
    }

    // For sticky proxies, check health to get the new IP
    let newIp = null
    if (proxy.type === 'sticky') {
      const isHealthy = await soaxApi.checkProxyHealth({
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password
      })
      
      // Fetch proxy again to get the updated IP
      const { data: updatedProxy } = await supabaseAdmin
        .from('proxies')
        .select('current_ip')
        .eq('id', proxyId)
        .single()
      
      newIp = updatedProxy?.current_ip
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-rotate-proxy',
      message: 'Proxy rotated',
      meta: { 
        proxy_id: proxyId,
        proxy_type: proxy.type,
        new_ip: newIp || 'pending',
        health: proxy.health
      }
    })

    return NextResponse.json({
      success: true,
      proxy_id: proxyId,
      new_ip: newIp,
      proxy_type: proxy.type,
      health: proxy.health
    })
  } catch (error) {
    console.error('Rotate proxy error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-rotate-proxy',
      message: 'Failed to rotate proxy',
      meta: { error: String(error), proxy_id: proxyId }
    })

    return NextResponse.json(
      { error: 'Failed to rotate proxy' },
      { status: 500 }
    )
  }
}