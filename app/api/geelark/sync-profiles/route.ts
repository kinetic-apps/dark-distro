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
      return NextResponse.json(
        { error: `GeeLark error (${data.code}): ${data.msg || 'Unknown error'}` },
        { status: 400 }
      )
    }

    const profiles = data.data?.items || []
    let imported = 0
    let skipped = 0
    let errors = 0

    // Process each profile
    for (const profile of profiles) {
      try {
        const profileId = profile.id
        const serialName = profile.serialName || `Profile-${profileId}`
        
        // Check if profile already exists
        const { data: existingAccount } = await supabaseAdmin
          .from('accounts')
          .select('id')
          .eq('geelark_profile_id', profileId)
          .single()

        if (existingAccount) {
          skipped++
          continue
        }

        // Create account record
        const { data: account, error: accountError } = await supabaseAdmin
          .from('accounts')
          .insert({
            geelark_profile_id: profileId,
            tiktok_username: serialName,
            status: profile.status === 2 ? 'active' : 'new',
            warmup_done: false,
            warmup_progress: 0,
            error_count: 0,
            meta: {
              geelark_serial_no: profile.serialNo,
              geelark_group: profile.group,
              geelark_remark: profile.remark,
              imported_at: new Date().toISOString()
            }
          })
          .select()
          .single()

        if (accountError) {
          console.error(`Failed to create account for profile ${profileId}:`, accountError)
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
              device_info: {
                model: 'Unknown',
                android_version: 'Unknown'
              }
            }
          })

        if (phoneError) {
          console.error(`Failed to create phone for profile ${profileId}:`, phoneError)
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
        console.error(`Error processing profile ${profile.id}:`, error)
        errors++
      }
    }

    // Log the sync operation
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-sync-profiles',
      message: `Profile sync completed: ${imported} imported, ${skipped} skipped, ${errors} errors`,
      meta: { 
        total_profiles: profiles.length,
        imported,
        skipped,
        errors,
        trace_id: traceId
      }
    })

    return NextResponse.json({
      success: true,
      message: `Sync completed: ${imported} profiles imported`,
      stats: {
        total: profiles.length,
        imported,
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