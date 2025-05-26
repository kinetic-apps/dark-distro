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
      android_version,
      group_name,
      tags,
      region,
      charge_mode,
      language,
      surface_brand,
      surface_model
    } = body

    // Always get a proxy since GeeLark seems to require it
    let proxyData = null
    let proxyConfig = undefined

    // Determine proxy type - default to sim if not specified
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

      // Use the exact proxy password without modification
      // The SOAX format might be required as-is
      const proxyPassword = proxyCredentials.password

      // Configure proxy for GeeLark profile creation
      proxyConfig = {
        typeId: 3, // Try HTTPS
        server: proxyCredentials.host,
        port: proxyCredentials.port,
        username: proxyCredentials.username,
        password: proxyPassword
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

      // Use the exact proxy password without modification
      // The SOAX format might be required as-is
      const proxyPassword = availableProxy.password

      console.log('Available proxy:', {
        host: availableProxy.host,
        port: availableProxy.port,
        username: availableProxy.username,
        password: availableProxy.password,
        passwordLength: availableProxy.password.length,
        passwordChars: availableProxy.password.split('').map((c: string) => `${c} (${c.charCodeAt(0)})`).join(', ')
      })

      // Configure proxy for GeeLark
      proxyConfig = {
        typeId: 3, // Try HTTPS
        server: availableProxy.host,
        port: availableProxy.port,
        username: availableProxy.username,
        password: proxyPassword
      }
    }

    // Create GeeLark profile WITH proxy
    const profileResponse = await geelarkApi.createProfile({
      androidVersion: android_version,
      proxyConfig: proxyConfig,
      groupName: group_name,
      tagsName: tags,
      region: region,
      chargeMode: charge_mode,
      language: language,
      surfaceBrandName: surface_brand,
      surfaceModelName: surface_model
    })

    const profileData = profileResponse.details[0]

    // Create account record
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .insert({
        geelark_profile_id: profileData.id,
        status: 'new',
        warmup_done: false,
        warmup_progress: 0,
        error_count: 0,
        proxy_id: proxyData.id
      })
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
        timezone: profileData.equipmentInfo.timeZone
      })

    // Update proxy assignment
        await supabaseAdmin
      .from('proxies')
      .update({ assigned_account_id: account.id })
      .eq('id', proxyData.id)

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-create-profile',
      message: 'Profile created successfully with proxy',
      meta: { 
        account_id: account.id, 
        profile_id: profileData.id,
        profile_name: profileData.profileName,
        serial_no: profileData.envSerialNo,
        proxy_id: proxyData.id,
        proxy_type: proxyData.type,
        proxy_host: proxyData.host
      }
    })

    return NextResponse.json({ 
      success: true, 
      account_id: account.id,
      profile_id: profileData.id,
      profile_name: profileData.profileName,
      serial_no: profileData.envSerialNo,
      equipment_info: profileData.equipmentInfo,
      proxy: {
        id: proxyData.id,
        type: proxyData.type,
        label: proxyData.label
      }
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