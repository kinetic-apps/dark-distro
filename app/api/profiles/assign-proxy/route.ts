import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { geelarkApi } from '@/lib/geelark-api'

export async function POST(request: NextRequest) {
  try {
    const { profileIds, selectedGroups } = await request.json()

    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json(
        { error: 'No profiles provided' },
        { status: 400 }
      )
    }

    if (!selectedGroups || !Array.isArray(selectedGroups) || selectedGroups.length === 0) {
      return NextResponse.json(
        { error: 'No proxy groups selected' },
        { status: 400 }
      )
    }

    // Get available proxies from selected groups
    const { data: availableProxies, error: proxiesError } = await supabaseAdmin
      .from('proxies')
      .select('*')
      .in('group_name', selectedGroups)
      .eq('is_active', true)

    if (proxiesError) {
      throw new Error(`Failed to fetch proxies: ${proxiesError.message}`)
    }

    if (!availableProxies || availableProxies.length === 0) {
      return NextResponse.json(
        { error: 'No active proxies found in selected groups' },
        { status: 400 }
      )
    }

    // Get profile details
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('accounts')
      .select('id, geelark_profile_id, tiktok_username, status')
      .in('id', profileIds)

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`)
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json(
        { error: 'No profiles found' },
        { status: 400 }
      )
    }

    const results = []
    const errors = []

    // Process each profile
    for (const profile of profiles) {
      try {
        // Check if profile is active (has running tasks or is online)
        const { data: activeTasks } = await supabaseAdmin
          .from('tasks')
          .select('id')
          .eq('account_id', profile.id)
          .in('status', ['pending', 'running'])
          .limit(1)

        if (activeTasks && activeTasks.length > 0) {
          errors.push({
            profileId: profile.id,
            profileName: profile.tiktok_username || 'Unnamed Profile',
            error: 'Profile has active tasks - cannot change proxy'
          })
          continue
        }

        // Randomly select a proxy from available proxies
        const randomProxy = availableProxies[Math.floor(Math.random() * availableProxies.length)]

        // Update proxy in GeeLark if profile has GeeLark ID
        if (profile.geelark_profile_id) {
          try {
            await geelarkApi.updatePhoneProxy(profile.geelark_profile_id, {
              typeId: randomProxy.scheme === 'socks5' ? 1 : 
                       randomProxy.scheme === 'http' ? 2 : 3,
              server: randomProxy.server,
              port: randomProxy.port,
              username: randomProxy.username || '',
              password: randomProxy.password || ''
            })
          } catch (geelarkError) {
            console.error('GeeLark proxy update failed:', geelarkError)
            errors.push({
              profileId: profile.id,
              profileName: profile.tiktok_username || 'Unnamed Profile',
              error: `GeeLark update failed: ${geelarkError instanceof Error ? geelarkError.message : 'Unknown error'}`
            })
            continue
          }
        }

        // Update proxy in local database
        const { error: updateError } = await supabaseAdmin
          .from('accounts')
          .update({ 
            proxy_id: randomProxy.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id)

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`)
        }

        results.push({
          profileId: profile.id,
          profileName: profile.tiktok_username || 'Unnamed Profile',
          assignedProxy: {
            id: randomProxy.id,
            group: randomProxy.group_name,
            server: randomProxy.server,
            port: randomProxy.port,
            scheme: randomProxy.scheme
          },
          status: 'success'
        })

      } catch (error) {
        console.error(`Error processing profile ${profile.id}:`, error)
        errors.push({
          profileId: profile.id,
          profileName: profile.tiktok_username || 'Unnamed Profile',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Log the bulk assignment operation
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'bulk-proxy-assignment',
      message: `Bulk proxy assignment completed: ${results.length} successful, ${errors.length} failed`,
      meta: {
        total_profiles: profileIds.length,
        successful_assignments: results.length,
        failed_assignments: errors.length,
        selected_groups: selectedGroups,
        available_proxies_count: availableProxies.length
      }
    })

    return NextResponse.json({
      success: true,
      summary: {
        total: profileIds.length,
        successful: results.length,
        failed: errors.length,
        selectedGroups,
        availableProxiesCount: availableProxies.length
      },
      results,
      errors
    })

  } catch (error) {
    console.error('Bulk proxy assignment error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to assign proxies',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 