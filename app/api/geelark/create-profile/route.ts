import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { soaxApi } from '@/lib/soax-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      device_info, 
      assign_proxy, 
      proxy_type,
      proxy_id,        // GeeLark proxy ID
      proxy_config,    // Manual/Dynamic proxy configuration
      android_version,
      group_name,
      tags,
      region,
      charge_mode,
      language,
      surface_brand,
      surface_model,
      remark
    } = body

    // Prepare GeeLark profile creation parameters
    const profileParams: any = {
      androidVersion: android_version,
      groupName: group_name,
      tagsName: tags,
      region: region,
      chargeMode: charge_mode,
      language: language,
      surfaceBrandName: surface_brand,
      surfaceModelName: surface_model,
      remark: remark
    }

    // Handle proxy configuration
    let proxyData = null

    if (proxy_id) {
      // Using GeeLark proxy by ID
      profileParams.proxyId = proxy_id
      
      // We don't have the proxy details in our database for GeeLark proxies
      // Create a placeholder record
      proxyData = {
        id: null,
        type: 'geelark',
        label: `GeeLark Proxy ${proxy_id}`,
        geelark_proxy_id: proxy_id
      }
    } else if (proxy_config) {
      // Using manual or dynamic proxy configuration
      profileParams.proxyConfig = proxy_config
      
      // Create a record in our database for tracking
      const proxyLabel = proxy_config.typeId >= 20 
        ? `Dynamic-${['IPIDEA', 'IPHTML', 'kookeey', 'Lumatuo'][proxy_config.typeId - 20]}`
        : `Manual-${proxy_config.server}:${proxy_config.port}`
      
      proxyData = {
        id: null,
        type: proxy_config.typeId >= 20 ? 'dynamic' : 'manual',
        label: proxyLabel,
        meta: proxy_config
      }
    } else if (assign_proxy) {
      // Auto-assign proxy from local database
      const useProxyType = proxy_type || 'sim'

      if (useProxyType === 'sticky') {
        // Create new sticky proxy
        const proxyCredentials = soaxApi.getStickyPoolProxy()
        
        const { data: newProxy } = await supabaseAdmin
          .from('proxies')
          .insert({
            label: `Sticky-${Date.now()}`,
            type: 'sticky',
            host: proxyCredentials.host,
            port: proxyCredentials.port,
            username: proxyCredentials.username,
            password: proxyCredentials.password,
            session_id: proxyCredentials.sessionId,
            health: 'unknown'
          })
          .select()
          .single()
        
        proxyData = newProxy

        // Configure proxy for GeeLark profile creation
        profileParams.proxyConfig = {
          typeId: 1, // SOCKS5
          server: proxyCredentials.host,
          port: proxyCredentials.port,
          username: proxyCredentials.username,
          password: proxyCredentials.password
        }
      } else {
        // Find available SIM proxy
        const { data: availableProxy } = await supabaseAdmin
          .from('proxies')
          .select('*')
          .eq('type', 'sim')
          .is('assigned_account_id', null)
          .limit(1)
          .single()
        
        if (!availableProxy) {
          throw new Error('No available SIM proxies. Please add more proxies or use sticky proxy type.')
        }

        proxyData = availableProxy

        // Configure proxy for GeeLark
        profileParams.proxyConfig = {
          typeId: 1, // SOCKS5
          server: availableProxy.host,
          port: availableProxy.port,
          username: availableProxy.username,
          password: availableProxy.password
        }
      }
    }

    // Create GeeLark profile
    const profileResponse = await geelarkApi.createProfile(profileParams)

    const profileData = profileResponse.details[0]

    // Create account record
    const accountData: any = {
      geelark_profile_id: profileData.id,
      status: 'new',
      warmup_done: false,
      warmup_progress: 0,
      error_count: 0
    }

    // Only add proxy_id if we have a database proxy record
    if (proxyData && proxyData.id) {
      accountData.proxy_id = proxyData.id
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .insert(accountData)
      .select()
      .single()

    if (accountError) throw accountError

    // Create phone record with equipment info
    await supabaseAdmin
      .from('phones')
      .insert({
        profile_id: profileData.id,
        account_id: account.id,
        device_model: profileData.equipmentInfo.deviceModel || surface_model || 'Unknown',
        android_version: profileData.equipmentInfo.osVersion || `Android ${android_version || '13'}`,
        status: 'offline',
        imei: profileData.equipmentInfo.imei,
        phone_number: profileData.equipmentInfo.phoneNumber,
        country: profileData.equipmentInfo.countryName,
        timezone: profileData.equipmentInfo.timeZone,
        meta: {
          proxy_info: proxyData,
          remark: remark
        }
      })

    // Update proxy assignment if we have a database proxy
    if (proxyData && proxyData.id) {
      await supabaseAdmin
        .from('proxies')
        .update({ assigned_account_id: account.id })
        .eq('id', proxyData.id)
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-create-profile',
      message: 'Profile created successfully',
      meta: { 
        account_id: account.id, 
        profile_id: profileData.id,
        profile_name: profileData.profileName,
        serial_no: profileData.envSerialNo,
        proxy_type: proxyData?.type || 'none',
        proxy_source: proxy_id ? 'geelark' : proxy_config ? 'manual/dynamic' : 'auto',
        remark: remark
      }
    })

    return NextResponse.json({ 
      success: true, 
      account_id: account.id,
      profile_id: profileData.id,
      profile_name: profileData.profileName,
      serial_no: profileData.envSerialNo,
      equipment_info: profileData.equipmentInfo,
      proxy: proxyData ? {
        id: proxyData.id,
        type: proxyData.type,
        label: proxyData.label
      } : null
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
      { error: error instanceof Error ? error.message : 'Failed to create profile' },
      { status: 500 }
    )
  }
}