import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { soaxApi } from '@/lib/soax-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { device_info, assign_proxy, proxy_type } = body

    // Create GeeLark profile
    const profileData = await geelarkApi.createProfile(device_info)

    // Create account record
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .insert({
        geelark_profile_id: profileData.profile_id,
        status: 'new',
        warmup_done: false,
        warmup_progress: 0,
        error_count: 0
      })
      .select()
      .single()

    if (accountError) throw accountError

    // Create phone record
    await supabaseAdmin
      .from('phones')
      .insert({
        profile_id: profileData.profile_id,
        account_id: account.id,
        device_model: device_info?.model || 'Pixel 6',
        android_version: device_info?.android_version || '13',
        status: 'offline'
      })

    // Assign proxy if requested
    if (assign_proxy) {
      let proxy
      
      if (proxy_type === 'sticky') {
        // Create new sticky proxy
        const proxyCredentials = soaxApi.getStickyPoolProxy()
        
        const { data: proxyData } = await supabaseAdmin
          .from('proxies')
          .insert({
            label: `Sticky-${Date.now()}`,
            type: 'sticky',
            host: proxyCredentials.host,
            port: proxyCredentials.port,
            username: proxyCredentials.username,
            password: proxyCredentials.password,
            session_id: proxyCredentials.sessionId,
            health: 'unknown',
            assigned_account_id: account.id
          })
          .select()
          .single()
        
        proxy = proxyData
      } else {
        // Find available SIM proxy
        const { data: availableProxy } = await supabaseAdmin
          .from('proxies')
          .select('*')
          .eq('type', 'sim')
          .is('assigned_account_id', null)
          .limit(1)
          .single()
        
        if (availableProxy) {
          await supabaseAdmin
            .from('proxies')
            .update({ assigned_account_id: account.id })
            .eq('id', availableProxy.id)
          
          proxy = availableProxy
        }
      }

      if (proxy) {
        // Set proxy in GeeLark
        await geelarkApi.setProxy(profileData.profile_id, {
          host: proxy.host,
          port: proxy.port,
          username: proxy.username,
          password: proxy.password
        })

        // Update account with proxy
        await supabaseAdmin
          .from('accounts')
          .update({ proxy_id: proxy.id })
          .eq('id', account.id)
      }
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-create-profile',
      message: 'Profile created successfully',
      meta: { account_id: account.id, profile_id: profileData.profile_id }
    })

    return NextResponse.json({ 
      success: true, 
      account_id: account.id,
      profile_id: profileData.profile_id 
    })
  } catch (error) {
    console.error('Create profile error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-create-profile',
      message: 'Failed to create profile',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    )
  }
}