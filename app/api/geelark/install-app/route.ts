import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

const TIKTOK_PACKAGE = 'com.ss.android.ugc.trill'
const TIKTOK_VERSION = '39.1.0'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profile_ids, app_package = TIKTOK_PACKAGE, version = TIKTOK_VERSION, app_version_id } = body

    if (!Array.isArray(profile_ids) || profile_ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid profile IDs' },
        { status: 400 }
      )
    }

    // Fetch profiles with their accounts
    const { data: profiles, error } = await supabaseAdmin
      .from('phones')
      .select('*, accounts(*)')
      .in('profile_id', profile_ids)

    if (error) throw error

    const results = await Promise.allSettled(
      profiles.map(async (profile) => {
        // First, ensure the phone is started
        const startResult = await geelarkApi.startPhones([profile.profile_id])
        
        if (startResult.failAmount > 0) {
          const failDetail = startResult.failDetails?.[0]
          if (failDetail && failDetail.code !== 43020) { // 43020 might mean already running
            throw new Error(`Failed to start phone: ${failDetail.msg || 'Unknown error'}`)
          }
        }

        // Wait a moment for the phone to fully start
        await new Promise(resolve => setTimeout(resolve, 2000))

        // If app_version_id is provided, use it directly
        let appVersionId: string | null = app_version_id || null
        let installedVersion = version
        
        if (!appVersionId) {
          // Search for TikTok apps with multiple search terms
          let tiktokApp = null
          let allApps: any[] = []
          
          // Try different search terms
          const searchTerms = ['tiktok', 'TikTok', 'Tik Tok', '']
          
          for (const searchTerm of searchTerms) {
            if (tiktokApp) break
            
            try {
              const searchResult = await geelarkApi.getInstallableApps(profile.profile_id, searchTerm)
              if (searchResult.items) {
                allApps = [...allApps, ...searchResult.items]
                
                // Look for TikTok by package name or app name
                tiktokApp = searchResult.items.find((app: any) => 
                  app.packageName === app_package || 
                  app.packageName === 'com.zhiliaoapp.musically' || // TikTok international
                  app.packageName === 'com.ss.android.ugc.aweme' || // TikTok China (Douyin)
                  app.appName?.toLowerCase() === 'tiktok' ||
                  app.appName?.toLowerCase().includes('tiktok')
                )
              }
            } catch (error) {
              console.log(`Search with term "${searchTerm}" failed:`, error)
            }
          }

          if (!tiktokApp) {
            // Log all found apps for debugging
            await supabaseAdmin.from('logs').insert({
              level: 'error',
              component: 'api-install-app',
              message: 'TikTok app not found in any search',
              meta: { 
                profile_id: profile.profile_id,
                searched_package: app_package,
                found_apps: allApps.map(app => ({
                  name: app.appName,
                  package: app.packageName,
                  versions: app.appVersionInfoList?.map((v: any) => v.versionName)
                }))
              }
            })
            
            throw new Error('TikTok app not found in installable apps list')
          }

          // Find the specific version or use the latest available
          if (tiktokApp.appVersionInfoList && tiktokApp.appVersionInfoList.length > 0) {
            // Try to find the specific version
            const targetVersion = tiktokApp.appVersionInfoList.find((v: any) => 
              v.versionName === version
            )
            
            if (targetVersion) {
              appVersionId = targetVersion.id
              installedVersion = targetVersion.versionName
            } else {
              // Use the first (usually latest) version
              appVersionId = tiktokApp.appVersionInfoList[0].id
              installedVersion = tiktokApp.appVersionInfoList[0].versionName
              
              await supabaseAdmin.from('logs').insert({
                level: 'warning',
                component: 'api-install-app',
                message: `Version ${version} not found, using version ${installedVersion}`,
                meta: { 
                  profile_id: profile.profile_id,
                  requested_version: version,
                  available_versions: tiktokApp.appVersionInfoList.map((v: any) => v.versionName)
                }
              })
            }
          } else {
            throw new Error('No TikTok versions available for installation')
          }
        }

        // Install the app
        if (!appVersionId) {
          throw new Error('No app version ID found')
        }
        await geelarkApi.installApp(profile.profile_id, appVersionId)

        // Update profile metadata
        await supabaseAdmin
          .from('phones')
          .update({
            meta: {
              ...profile.meta,
              installed_apps: {
                ...(profile.meta?.installed_apps || {}),
                [app_package]: {
                  version: installedVersion,
                  version_id: appVersionId,
                  installed_at: new Date().toISOString()
                }
              }
            },
            updated_at: new Date().toISOString()
          })
          .eq('profile_id', profile.profile_id)

        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'api-install-app',
          message: `TikTok installation initiated`,
          meta: { 
            profile_id: profile.profile_id,
            account_id: profile.accounts?.[0]?.id,
            app_package,
            app_version_id: appVersionId,
            version: installedVersion
          }
        })

        return { 
          profile_id: profile.profile_id,
          app_package,
          app_version_id: appVersionId,
          version: installedVersion,
          success: true
        }
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled')
    const failed = results.filter(r => r.status === 'rejected')

    if (failed.length > 0) {
      await supabaseAdmin.from('logs').insert({
        level: 'warning',
        component: 'api-install-app',
        message: 'Some app installations failed',
        meta: { 
          failed_count: failed.length,
          errors: failed.map(f => (f as PromiseRejectedResult).reason.toString())
        }
      })
    }

    return NextResponse.json({
      success: true,
      installed: successful.length,
      failed: failed.length,
      results: successful.map(r => (r as PromiseFulfilledResult<any>).value),
      errors: failed.map(f => ({
        error: (f as PromiseRejectedResult).reason.toString()
      }))
    })
  } catch (error) {
    console.error('Install app error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-install-app',
      message: 'Failed to install app',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to install app' },
      { status: 500 }
    )
  }
} 