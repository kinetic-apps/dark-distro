import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geelarkApi } from '@/lib/geelark-api'
import { nanoid } from 'nanoid'
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
      // Using GeeLark proxy ID directly
      profileParams.proxyId = proxy_id
    } else if (proxy_config) {
      // Manual proxy configuration
      profileParams.proxyConfig = proxy_config
      
      // Store proxy info for account record
      const proxyLabel = proxy_config.typeId >= 20 
        ? `${proxy_config.server}:${proxy_config.port} (HTTP)`
        : `${proxy_config.server}:${proxy_config.port} (SOCKS5)`
      
      proxyData = {
        id: null,
        label: proxyLabel,
        server: proxy_config.server,
        port: proxy_config.port
      }
    } else if (assign_proxy) {
      // Auto-assign proxy from database
      // Get allowed proxy groups
      const { data: allowedGroups } = await supabaseAdmin
        .from('proxy_group_settings')
        .select('group_name')
        .eq('allowed_for_phone_creation', true)
        .order('priority', { ascending: true })

      if (allowedGroups && allowedGroups.length > 0) {
        const groupNames = allowedGroups.map(g => g.group_name)
        
        const { data: availableProxies } = await supabaseAdmin
          .from('proxies')
          .select('*')
          .in('group_name', groupNames)
          .eq('is_active', true)
          .limit(1)

        if (availableProxies && availableProxies.length > 0) {
          const proxy = availableProxies[0]
          profileParams.proxyConfig = {
            typeId: 1, // SOCKS5
            server: proxy.server,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password
          }
          
          proxyData = {
            id: proxy.id,
            label: `${proxy.server}:${proxy.port}`,
            server: proxy.server,
            port: proxy.port
          }
        } else {
          console.log('No database proxies available in allowed groups, checking GeeLark proxies...')
          
          try {
            const geelarkProxiesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geelark/list-proxies`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            })
            
            if (geelarkProxiesResponse.ok) {
              const geelarkData = await geelarkProxiesResponse.json()
              if (geelarkData.proxies && geelarkData.proxies.length > 0) {
                profileParams.proxyId = geelarkData.proxies[0].id
                console.log('Using GeeLark proxy as fallback:', geelarkData.proxies[0].id)
              } else {
                throw new Error('No proxies available in database or GeeLark')
              }
            } else {
              throw new Error('No available proxies found in allowed groups and GeeLark proxy check failed')
            }
          } catch (fallbackError) {
            console.error('Fallback to GeeLark proxy failed:', fallbackError)
            throw new Error('No available proxies found in allowed groups')
          }
        }
      } else {
        throw new Error('No proxy groups are allowed for phone creation')
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