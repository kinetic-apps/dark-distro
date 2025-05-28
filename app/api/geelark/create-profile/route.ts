import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { soaxApi } from '@/lib/soax-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  let account: any = null
  let profileCreated = false
  let profileData: any = null
  
  try {
    const body = await request.json()
    const { 
      android_version,
      proxy_id,
      database_proxy_id,  // Add support for database proxy ID
      proxy_config,
      proxy_type,
      assign_proxy,
      group_name,
      tags,
      remark,
      surface_brand,
      surface_model,
      region,
      charge_mode,
      language
    } = body

    console.log('Create profile request:', { 
      android_version, 
      proxy_id, 
      has_proxy_config: !!proxy_config,
      group_name 
    })

    // Prepare profile parameters FIRST
    const profileParams: any = {
      androidVersion: android_version,
      groupName: group_name,
      tagsName: tags,
      remark,
      region,
      chargeMode: charge_mode,
      language,
      surfaceBrandName: surface_brand,
      surfaceModelName: surface_model
    }

    let proxyData: any = null

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
    } else if (database_proxy_id) {
      // Using database proxy by ID
      const { data: dbProxy } = await supabaseAdmin
        .from('proxies')
        .select('*')
        .eq('id', database_proxy_id)
        .single()

      if (dbProxy) {
        profileParams.proxyConfig = {
          typeId: 1, // SOCKS5
          server: dbProxy.host,
          port: dbProxy.port,
          username: dbProxy.username,
          password: dbProxy.password
        }
        proxyData = dbProxy
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
        // Find available proxy based on type preference
        let proxyQuery = supabaseAdmin
          .from('proxies')
          .select('*')
          .is('assigned_account_id', null)
          .limit(1)

        if (useProxyType !== 'auto') {
          proxyQuery = proxyQuery.eq('type', useProxyType)
        }

        const { data: availableProxy } = await proxyQuery.single()
        
        if (!availableProxy) {
          throw new Error(`No available ${useProxyType} proxies. Please add more proxies or use a different type.`)
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

    // Create GeeLark profile FIRST
    console.log('Creating GeeLark profile with params:', JSON.stringify(profileParams, null, 2))
    
    let profileResponse
    try {
      profileResponse = await geelarkApi.createProfile(profileParams)
      profileCreated = true
    } catch (geelarkError) {
      console.error('GeeLark API error:', geelarkError)
      throw new Error(`GeeLark API error: ${geelarkError instanceof Error ? geelarkError.message : String(geelarkError)}`)
    }

    if (!profileResponse || !profileResponse.details || profileResponse.details.length === 0) {
      console.error('Invalid profile response:', profileResponse)
      throw new Error('Invalid response from GeeLark API - no profile details returned')
    }

    profileData = profileResponse.details[0]
    
    if (!profileData || !profileData.id) {
      console.error('Invalid profile data:', profileData)
      throw new Error('Invalid profile data - missing profile ID')
    }

    // NOW create account record with the GeeLark profile ID
    const { data: accountData, error: accountError } = await supabaseAdmin
      .from('accounts')
      .insert({
        geelark_profile_id: profileData.id,
        meta: {
          created_via: 'api',
          device_model: surface_model,
          android_version: android_version,
          group_name: group_name,
          remark: remark,
          profile_name: profileData.profileName,
          serial_no: profileData.envSerialNo
        }
      })
      .select()
      .single()

    if (accountError) {
      console.error('Account creation error:', accountError)
      // Clean up the GeeLark profile since account creation failed
      if (profileCreated && profileData.id) {
        try {
          await geelarkApi.deleteProfile(profileData.id)
        } catch (deleteError) {
          console.error('Failed to clean up GeeLark profile:', deleteError)
        }
      }
      throw new Error(`Failed to create account: ${accountError.message}`)
    }
    
    account = accountData
    console.log('Account created:', account.id)

    // Create phone record with equipment info
    const phoneData = {
        profile_id: profileData.id,
        account_id: account.id,
      device_model: profileData.equipmentInfo?.deviceModel || surface_model || 'Unknown',
      android_version: profileData.equipmentInfo?.osVersion || `Android ${android_version || '13'}`,
        status: 'offline',
        meta: {
        profile_name: profileData.profileName || profileData.envSerialNo || 'Unknown',
        serial_no: profileData.envSerialNo,
        imei: profileData.equipmentInfo?.imei,
        phone_number: profileData.equipmentInfo?.phoneNumber,
        country: profileData.equipmentInfo?.countryName,
        timezone: profileData.equipmentInfo?.timeZone,
          proxy_info: proxyData,
        remark: remark,
        equipment_info: profileData.equipmentInfo
        }
    }

    console.log('Creating phone record:', phoneData)

    const { error: phoneError } = await supabaseAdmin
      .from('phones')
      .insert(phoneData)

    if (phoneError) {
      console.error('Failed to create phone record:', phoneError)
      throw phoneError
    }

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
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    // Clean up resources if they were created
    if (profileCreated && profileData?.id) {
      console.log('Cleaning up GeeLark profile:', profileData.id)
      try {
        await geelarkApi.deleteProfile(profileData.id)
      } catch (deleteError) {
        console.error('Failed to clean up GeeLark profile:', deleteError)
      }
    }
    
    if (account?.id) {
      console.log('Cleaning up account:', account.id)
      await supabaseAdmin
        .from('accounts')
        .delete()
        .eq('id', account.id)
    }
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-create-profile',
      message: 'Failed to create profile',
      meta: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        account_id: account?.id,
        profile_id: profileData?.id
      }
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create profile' },
      { status: 500 }
    )
  }
}