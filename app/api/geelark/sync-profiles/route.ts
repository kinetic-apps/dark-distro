import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

const API_BASE_URL = process.env.GEELARK_API_BASE_URL!
const API_KEY = process.env.GEELARK_API_KEY!
const APP_ID = process.env.GEELARK_APP_ID!

function generateUUID(): string {
  return 'yxxyxxxxyxyxxyxxyxxxyxxxyxxyxxyx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  }).toUpperCase()
}

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY || !API_BASE_URL || !APP_ID) {
      return NextResponse.json(
        { error: 'GeeLark credentials not configured' },
        { status: 400 }
      )
    }

    // Generate required authentication parameters
    const timestamp = new Date().getTime().toString()
    const traceId = generateUUID()
    const nonce = traceId.substring(0, 6)
    
    // Generate signature: SHA256(appId + traceId + ts + nonce + apiKey)
    const signString = APP_ID + traceId + timestamp + nonce + API_KEY
    const sign = createHash('sha256').update(signString).digest('hex').toUpperCase()

    // GeeLark API call to get all phone profiles
    const response = await fetch(`${API_BASE_URL}/open/v1/phone/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'appId': APP_ID,
        'traceId': traceId,
        'ts': timestamp,
        'nonce': nonce,
        'sign': sign,
      },
      body: JSON.stringify({
        page: 1,
        pageSize: 100  // Get up to 100 profiles
      }),
    })

    const responseText = await response.text()

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${responseText}` },
        { status: 400 }
      )
    }

    // Try to parse as JSON
    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      return NextResponse.json(
        { error: `Non-JSON response: ${responseText}` },
        { status: 400 }
      )
    }

    // Check for GeeLark success (code: 0 means success)
    if (data.code !== 0) {
      // Special handling for "env not found" - means no cloud phones exist in GeeLark
      if (data.code === 42001) {
        // Get all existing profiles from Supabase for logging
        const { data: existingProfiles, error: fetchError } = await supabaseAdmin
          .from('accounts')
          .select('id, tiktok_username, geelark_profile_id')

        if (fetchError) {
          throw new Error(`Failed to fetch existing profiles: ${fetchError.message}`)
        }

        const profileCount = existingProfiles?.length || 0

        if (profileCount > 0) {
          // Delete all phone records first (due to foreign key constraints)
          await supabaseAdmin
            .from('phones')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

          // Delete all account records
          const { error: accountDeleteError } = await supabaseAdmin
            .from('accounts')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

          if (accountDeleteError) {
            throw new Error(`Failed to delete accounts: ${accountDeleteError.message}`)
          }

          // Log the cleanup operation
          await supabaseAdmin.from('logs').insert({
            level: 'warning',
            component: 'api-sync-profiles',
            message: `Auto-cleanup: No cloud phones found in GeeLark, deleted all ${profileCount} profiles from database`,
            meta: { 
              geelark_error_code: data.code,
              geelark_error_message: data.msg,
              deleted_count: profileCount,
              profiles: existingProfiles?.map(p => ({
                id: p.id,
                username: p.tiktok_username,
                geelark_id: p.geelark_profile_id
              })) || [],
              trace_id: traceId
            }
          })

          return NextResponse.json({
            success: true,
            message: `No cloud phones found in GeeLark. Cleaned up ${profileCount} profiles from database.`,
            stats: {
              total_geelark: 0,
              total_existing: profileCount,
              imported: 0,
              updated: 0,
              deleted: profileCount,
              skipped: 0,
              errors: 0
            },
            trace_id: traceId,
            auto_cleanup: true
          })
        } else {
          // No profiles in database either, just return success
          return NextResponse.json({
            success: true,
            message: 'No cloud phones found in GeeLark and no profiles in database. Nothing to sync.',
            stats: {
              total_geelark: 0,
              total_existing: 0,
              imported: 0,
              updated: 0,
              deleted: 0,
              skipped: 0,
              errors: 0
            },
            trace_id: traceId
          })
        }
      } else {
        // Other GeeLark errors
        return NextResponse.json(
          { error: `GeeLark error (${data.code}): ${data.msg || 'Unknown error'}` },
          { status: 400 }
        )
      }
    }

    const geelarkProfiles = data.data?.items || []
    const geelarkProfileIds = geelarkProfiles.map((p: any) => p.id)
    
    // Debug log to see what data we're getting
    // console.log('GeeLark profiles data:', JSON.stringify(geelarkProfiles, null, 2))
    
    // Log proxy info specifically
    // geelarkProfiles.forEach((profile: any) => {
    //   console.log(`Profile ${profile.id} proxy data:`, profile.proxy)
    // })

    // Get all existing profiles from Supabase
    const { data: existingProfiles, error: fetchError } = await supabaseAdmin
      .from('accounts')
      .select('id, geelark_profile_id, tiktok_username, status')
      .not('geelark_profile_id', 'is', null)

    if (fetchError) {
      throw new Error(`Failed to fetch existing profiles: ${fetchError.message}`)
    }

    let imported = 0
    let updated = 0
    let skipped = 0
    let deleted = 0
    let errors = 0

    // Step 1: Clean up profiles that no longer exist in GeeLark
    const profilesToDelete = existingProfiles?.filter(
      profile => profile.geelark_profile_id && !geelarkProfileIds.includes(profile.geelark_profile_id)
    ) || []

    for (const profileToDelete of profilesToDelete) {
      try {
        // Delete related phone records first
        await supabaseAdmin
          .from('phones')
          .delete()
          .eq('account_id', profileToDelete.id)

        // Delete the account
        await supabaseAdmin
          .from('accounts')
          .delete()
          .eq('id', profileToDelete.id)

        deleted++
        
        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'api-sync-profiles',
          message: `Deleted profile no longer in GeeLark: ${profileToDelete.tiktok_username || 'Unnamed'}`,
          meta: { 
            deleted_profile_id: profileToDelete.id,
            geelark_profile_id: profileToDelete.geelark_profile_id,
            trace_id: traceId
          }
        })
      } catch (error) {
        console.error(`Failed to delete profile ${profileToDelete.id}:`, error)
        errors++
      }
    }

    // Step 2: Process GeeLark profiles (import new ones, update existing)
    for (const profile of geelarkProfiles) {
      try {
        const profileId = profile.id
        const serialName = profile.serialName || `Profile-${profileId}`
        
        // Check if profile already exists
        const existingAccount = existingProfiles?.find(
          p => p.geelark_profile_id === profileId
        )

        // Handle proxy data if present
        let proxyInfo = null
        if (profile.proxy) {
          // Store proxy info in meta field
          proxyInfo = {
            id: profile.proxy.id,
            scheme: profile.proxy.scheme || 'socks5',
            server: profile.proxy.server,
            port: profile.proxy.port,
            username: profile.proxy.username,
            password: profile.proxy.password
          }
        }

        if (existingAccount) {
          // Update existing profile
          const updateData: any = {
            // Only update tiktok_username if it's currently null or empty
            ...((!existingAccount.tiktok_username || existingAccount.tiktok_username.trim() === '') && { tiktok_username: serialName }),
            updated_at: new Date().toISOString(),
            meta: {
              geelark_serial_no: profile.serialNo,
              geelark_group: profile.group,
              geelark_remark: profile.remark,
              geelark_equipment_info: profile.equipmentInfo,
              last_synced_at: new Date().toISOString(),
              // Add proxy info if present
              ...(proxyInfo && { proxy: proxyInfo })
            }
          }

          // Only update status if account is not in the middle of SMS setup or other critical operations
          const criticalStatuses = [
            'creating_profile',
            'starting_phone',
            'installing_tiktok',
            'running_geelark_task',
            'renting_number',
            'pending_verification',
            'otp_received'
          ]
          
          if (!criticalStatuses.includes(existingAccount.status)) {
            updateData.status = profile.status === 2 ? 'active' : 'new'
          }

          const { error: updateError } = await supabaseAdmin
            .from('accounts')
            .update(updateData)
            .eq('id', existingAccount.id)

          if (updateError) {
            // console.error(`Failed to update account for profile ${profileId}:`, updateError)
            errors++
            continue
          }

          // Update phone status
          await supabaseAdmin
            .from('phones')
            .update({
              status: profile.status === 2 ? 'online' : 'offline',
              updated_at: new Date().toISOString()
            })
            .eq('account_id', existingAccount.id)

          updated++
          continue
        }

        // Create new account record
        const accountData: any = {
          geelark_profile_id: profileId,
          tiktok_username: serialName,  // For new accounts, we can use serialName as a placeholder
          status: 'new',  // Always start new accounts as 'new', not 'active'
          warmup_done: false,
          warmup_progress: 0,
          error_count: 0,
          meta: {
            geelark_serial_no: profile.serialNo,
            geelark_group: profile.group,
            geelark_remark: profile.remark,
            geelark_equipment_info: profile.equipmentInfo,
            imported_at: new Date().toISOString(),
            // Add proxy info if present
            ...(proxyInfo && { proxy: proxyInfo })
          }
        }

        const { data: account, error: accountError } = await supabaseAdmin
          .from('accounts')
          .insert(accountData)
          .select()
          .single()

        if (accountError) {
          // console.error(`Failed to create account for profile ${profileId}:`, accountError)
          errors++
          continue
        }

        // Create phone record
        const { error: phoneError } = await supabaseAdmin
          .from('phones')
          .insert({
            profile_id: profileId,
            account_id: account.id,
            status: profile.status === 2 ? 'online' : 'offline',
            meta: {
              imported_from_geelark: true,
              device_info: profile.equipmentInfo || {
                model: 'Unknown',
                android_version: 'Unknown'
              }
            }
          })

        if (phoneError) {
          // console.error(`Failed to create phone for profile ${profileId}:`, phoneError)
          // Delete the account if phone creation fails
          await supabaseAdmin
            .from('accounts')
            .delete()
            .eq('id', account.id)
          errors++
          continue
        }

        imported++
      } catch (error) {
        // console.error(`Error processing profile ${profile.id}:`, error)
        errors++
      }
    }

    // Log the sync operation
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-sync-profiles',
      message: `Profile sync completed: ${imported} imported, ${updated} updated, ${deleted} deleted, ${skipped} skipped, ${errors} errors`,
      meta: { 
        total_geelark_profiles: geelarkProfiles.length,
        total_existing_profiles: existingProfiles?.length || 0,
        imported,
        updated,
        deleted,
        skipped,
        errors,
        trace_id: traceId
      }
    })

    return NextResponse.json({
      success: true,
      message: `Sync completed: ${imported} imported, ${updated} updated, ${deleted} deleted`,
      stats: {
        total_geelark: geelarkProfiles.length,
        total_existing: existingProfiles?.length || 0,
        imported,
        updated,
        deleted,
        skipped,
        errors
      },
      trace_id: traceId
    })

  } catch (error) {
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-sync-profiles',
      message: 'Failed to sync profiles',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: `Sync error: ${error}` },
      { status: 500 }
    )
  }
} 