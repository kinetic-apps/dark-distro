import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profile_id, search_term = '' } = body

    if (!profile_id) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      )
    }

    // Get installed apps
    const installedApps = await geelarkApi.getInstalledApps(profile_id)
    
    // Search for installable apps with different search terms
    const searchTerms = search_term ? [search_term] : ['tiktok', 'TikTok', 'tik tok', '']
    const searchResults: any[] = []
    
    for (const term of searchTerms) {
      try {
        const result = await geelarkApi.getInstallableApps(profile_id, term)
        searchResults.push({
          search_term: term,
          total: result.total || 0,
          apps: result.items || []
        })
      } catch (error) {
        searchResults.push({
          search_term: term,
          error: String(error)
        })
      }
    }

    // Find all TikTok-related apps
    const allTikTokApps: any[] = []
    searchResults.forEach(result => {
      if (result.apps) {
        result.apps.forEach((app: any) => {
          if (app.appName?.toLowerCase().includes('tik') || 
              app.packageName?.includes('tiktok') ||
              app.packageName?.includes('musical') ||
              app.packageName?.includes('trill')) {
            allTikTokApps.push({
              appName: app.appName,
              packageName: app.packageName,
              versions: app.appVersionInfoList?.map((v: any) => ({
                id: v.id,
                versionName: v.versionName,
                versionCode: v.versionCode,
                installStatus: v.installStatus
              }))
            })
          }
        })
      }
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-test-apps',
      message: 'App exploration completed',
      meta: { 
        profile_id,
        installed_count: installedApps.total || 0,
        tiktok_variants_found: allTikTokApps.length
      }
    })

    return NextResponse.json({
      success: true,
      profile_id,
      installed_apps: {
        total: installedApps.total || 0,
        apps: installedApps.items || []
      },
      search_results: searchResults,
      tiktok_apps: allTikTokApps
    })
  } catch (error) {
    console.error('App test error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-test-apps',
      message: 'Failed to test apps',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to test apps' },
      { status: 500 }
    )
  }
} 