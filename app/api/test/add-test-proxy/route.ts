import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    // Add a test proxy to the database
    const { data: proxy, error } = await supabaseAdmin
      .from('proxies')
      .insert({
        label: 'Test SIM Proxy',
        type: 'sim',
        host: 'test.proxy.com',
        port: 8080,
        username: 'testuser',
        password: 'testpass',
        health: 'unknown'
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      proxy: proxy
    })
  } catch (error) {
    console.error('Add test proxy error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to add test proxy',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
} 