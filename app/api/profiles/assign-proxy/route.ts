import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { geelarkApi } from '@/lib/geelark-api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profileIds, proxyType = 'auto' } = body

    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json(
        { error: 'No profiles selected' },
        { status: 400 }
      )
    }

    let assigned = 0
    let errors = 0
    const results = []

    for (const profileId of profileIds) {
      try {
        // Get the profile details
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('accounts')
          .select('*, phone:phones!fk_account(*)')
          .eq('id', profileId)
          .single()

        if (profileError || !profile) {
          console.error(`Profile ${profileId} not found:`, profileError)
          errors++
          continue
        }

        // Skip if already has a proxy
        if (profile.proxy_id) {
          console.log(`Profile ${profileId} already has a proxy assigned`)
          results.push({
            profileId,
            success: false,
            message: 'Already has proxy'
          })
          continue
        }

        // Find an available proxy
        let proxyQuery = supabaseAdmin
          .from('proxies')
          .select('*')
          .is('assigned_account_id', null)
          .limit(1)

        // Filter by type if specified
        if (proxyType !== 'auto') {
          proxyQuery = proxyQuery.eq('type', proxyType)
        }

        const { data: availableProxies, error: proxyError } = await proxyQuery

        if (proxyError || !availableProxies || availableProxies.length === 0) {
          console.error(`No available proxies for profile ${profileId}`)
          errors++
          results.push({
            profileId,
            success: false,
            message: 'No available proxies'
          })
          continue
        }

        const proxy = availableProxies[0]

        // Assign proxy to profile in database
        const { error: updateError } = await supabaseAdmin
          .from('accounts')
          .update({ proxy_id: proxy.id })
          .eq('id', profileId)

        if (updateError) {
          console.error(`Failed to update profile ${profileId}:`, updateError)
          errors++
          continue
        }

        // Update proxy assignment
        await supabaseAdmin
          .from('proxies')
          .update({ assigned_account_id: profileId })
          .eq('id', proxy.id)

        // Note: GeeLark doesn't provide an API endpoint to update proxy on existing profiles
        // Proxies can only be set during profile creation in GeeLark
        // The proxy assignment is stored in our database for reference
        if (profile.geelark_profile_id) {
          await supabaseAdmin.from('logs').insert({
            level: 'info',
            component: 'api-assign-proxy',
            message: 'Proxy assigned in database. Note: GeeLark requires manual proxy update in their app.',
            meta: { 
              profile_id: profileId,
              geelark_profile_id: profile.geelark_profile_id,
              proxy_id: proxy.id
            }
          })
        }

        assigned++
        results.push({
          profileId,
          success: true,
          proxy: {
            id: proxy.id,
            label: proxy.label,
            type: proxy.type
          }
        })

      } catch (error) {
        console.error(`Error processing profile ${profileId}:`, error)
        errors++
        results.push({
          profileId,
          success: false,
          message: String(error)
        })
      }
    }

    // Log the operation
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-assign-proxy',
      message: `Proxy assignment completed: ${assigned} assigned, ${errors} errors`,
      meta: { 
        profileIds,
        assigned,
        errors,
        results
      }
    })

    return NextResponse.json({
      success: true,
      message: `Assigned proxies to ${assigned} profile(s)`,
      stats: {
        assigned,
        errors,
        total: profileIds.length
      },
      results
    })

  } catch (error) {
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-assign-proxy',
      message: 'Failed to assign proxies',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: `Assignment error: ${error}` },
      { status: 500 }
    )
  }
} 