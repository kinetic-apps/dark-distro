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

    // Check health of new proxy
    const isHealthy = await soaxApi.checkProxyHealth({
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-rotate-proxy',
      message: 'Proxy rotated',
      meta: { 
        proxy_id: proxyId,
        proxy_type: proxy.type,
        new_ip: proxy.current_ip,
        health: isHealthy ? 'good' : 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      proxy_id: proxyId,
      new_ip: proxy.current_ip,
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