import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { soaxApi } from '@/lib/soax-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  let accounts: any[] = []
  let profilesCreated = false
  let profileData: any = null
  let requestBody: any = null
  
  try {
    requestBody = await request.json()
    const body = requestBody
    const { 
      amount = 1,  // Support batch creation, default to 1
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
      amount,
      android_version, 
      proxy_id, 
      has_proxy_config: !!proxy_config,
      group_name 
    })

    // Prepare profile parameters FIRST
    const profileParams: any = {
      amount: amount,  // Pass amount to GeeLark API
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

    // Create GeeLark profile(s) FIRST
    console.log('Creating GeeLark profile(s) with params:', JSON.stringify(profileParams, null, 2))
    
    let profileResponse
    try {
      profileResponse = await geelarkApi.createProfile(profileParams)
      profilesCreated = true
    } catch (geelarkError) {
      console.error('GeeLark API error:', geelarkError)
      throw new Error(`GeeLark API error: ${geelarkError instanceof Error ? geelarkError.message : String(geelarkError)}`)
    }

    if (!profileResponse || !profileResponse.details || profileResponse.details.length === 0) {
      console.error('Invalid profile response:', profileResponse)
      throw new Error('Invalid response from GeeLark API - no profile details returned')
    }

    profileData = profileResponse

    // Handle batch creation response
    const createdProfiles = []
    const createdAccounts = []
    
    // Process each created profile
    for (const profile of profileData.details) {
      if (profile.code === 0) { // Success
        // Create account record with the GeeLark profile ID
        const { data: accountData, error: accountError } = await supabaseAdmin
          .from('accounts')
          .insert({
            geelark_profile_id: profile.id,
            meta: {
              created_via: 'api',
              device_model: surface_model,
              android_version: android_version,
              group_name: group_name,
              remark: remark,
              profile_name: profile.profileName,
              serial_no: profile.envSerialNo
            }
          })
          .select()
          .single()

        if (accountError) {
          console.error('Account creation error for profile:', profile.id, accountError)
          continue
        }
        
        accounts.push(accountData)
        createdAccounts.push(accountData)
        console.log('Account created:', accountData.id)

        // Create phone record with equipment info
        const phoneData = {
          profile_id: profile.id,
          account_id: accountData.id,
          device_model: profile.equipmentInfo?.deviceModel || surface_model || 'Unknown',
          android_version: profile.equipmentInfo?.osVersion || `Android ${android_version || '13'}`,
          status: 'offline',
          meta: {
            profile_name: profile.profileName || profile.envSerialNo || 'Unknown',
            serial_no: profile.envSerialNo,
            imei: profile.equipmentInfo?.imei,
            phone_number: profile.equipmentInfo?.phoneNumber,
            country: profile.equipmentInfo?.countryName,
            timezone: profile.equipmentInfo?.timeZone,
            proxy_info: proxyData,
            remark: remark,
            equipment_info: profile.equipmentInfo
          }
        }

        console.log('Creating phone record:', phoneData)

        const { error: phoneError } = await supabaseAdmin
          .from('phones')
          .insert(phoneData)

        if (phoneError) {
          console.error('Failed to create phone record:', phoneError)
        }

        // Update proxy assignment if we have a database proxy
        if (proxyData && proxyData.id && amount === 1) {
          // Only assign proxy to single profile creation
          await supabaseAdmin
            .from('proxies')
            .update({ assigned_account_id: accountData.id })
            .eq('id', proxyData.id)
        }

        createdProfiles.push({
          id: profile.id,
          profileName: profile.profileName,
          envSerialNo: profile.envSerialNo,
          equipmentInfo: profile.equipmentInfo,
          accountId: accountData.id
        })
      }
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-create-profile',
      message: amount > 1 ? 'Batch profiles created successfully' : 'Profile created successfully',
      meta: { 
        amount_requested: amount,
        amount_created: createdProfiles.length,
        account_ids: createdAccounts.map(a => a.id),
        profile_ids: createdProfiles.map(p => p.id),
        proxy_type: proxyData?.type || 'none',
        proxy_source: proxy_id ? 'geelark' : proxy_config ? 'manual/dynamic' : 'auto',
        remark: remark
      }
    })

    // Return appropriate response based on single or batch creation
    if (amount === 1 && createdProfiles.length > 0) {
      // Single profile creation response (backward compatible)
      const profile = createdProfiles[0]
      const account = createdAccounts[0]
      
      return NextResponse.json({ 
        success: true, 
        account_id: account.id,
        profile_id: profile.id,
        profile_name: profile.profileName,
        serial_no: profile.envSerialNo,
        equipment_info: profile.equipmentInfo,
        proxy: proxyData ? {
          id: proxyData.id,
          type: proxyData.type,
          label: proxyData.label
        } : null
      })
    } else {
      // Batch creation response
      return NextResponse.json({
        success: profileData.successAmount > 0,
        total_amount: profileData.totalAmount,
        success_amount: profileData.successAmount,
        fail_amount: profileData.failAmount,
        details: profileData.details,
        created_accounts: createdAccounts.map(a => ({
          account_id: a.id,
          profile_id: a.geelark_profile_id
        }))
      })
    }
  } catch (error) {
    console.error('Create profile error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    // Clean up resources if they were created
    if (profilesCreated && profileData?.details) {
      console.log('Cleaning up GeeLark profiles due to error')
      for (const profile of profileData.details) {
        if (profile.code === 0 && profile.id) {
          try {
            await geelarkApi.deleteProfile(profile.id)
          } catch (deleteError) {
            console.error('Failed to clean up GeeLark profile:', profile.id, deleteError)
          }
        }
      }
    }
    
    if (accounts.length > 0) {
      console.log('Cleaning up accounts:', accounts.map(a => a.id))
      await supabaseAdmin
        .from('accounts')
        .delete()
        .in('id', accounts.map(a => a.id))
    }
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-create-profile',
      message: 'Failed to create profile(s)',
      meta: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        account_ids: accounts.map(a => a.id),
        amount_requested: requestBody?.amount || 1
      }
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create profile(s)' },
      { status: 500 }
    )
  }
}