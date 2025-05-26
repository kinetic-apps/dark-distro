import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    // Test 1: Get profile list
    const profiles = await geelarkApi.getProfileList()
    
    // Test 2: Get installable apps for the first profile if available
    let installableApps = null
    if (profiles && profiles.length > 0) {
      installableApps = await geelarkApi.getInstallableApps(profiles[0].envId, 'tiktok')
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-test-auth',
      message: 'GeeLark API test successful',
      meta: { 
        profile_count: profiles?.length || 0,
        installable_apps_count: installableApps?.total || 0
      }
    })

    return NextResponse.json({
      success: true,
      profiles: profiles || [],
      installable_apps: installableApps || null,
      message: 'GeeLark API connection successful'
    })
  } catch (error) {
    console.error('GeeLark API test error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-test-auth',
      message: 'GeeLark API test failed',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { 
        error: 'GeeLark API test failed',
        details: String(error)
      },
      { status: 500 }
    )
  }
} 