import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    // Get all profiles with GeeLark IDs
    const { data: profiles } = await supabaseAdmin
      .from('accounts')
      .select('id, geelark_profile_id')
      .not('geelark_profile_id', 'is', null)

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No profiles to sync',
        synced: 0 
      })
    }

    // Process in batches of 100 (GeeLark API limit)
    const batchSize = 100
    let totalSynced = 0
    let totalErrors = 0

    for (let i = 0; i < profiles.length; i += batchSize) {
      const batch = profiles.slice(i, i + batchSize)
      const profileIds = batch.map(p => p.geelark_profile_id!)

      try {
        // Get phone statuses from GeeLark
        const statusResult = await geelarkApi.getPhoneStatus(profileIds)

        // Map status codes to readable strings
        const statusMap: { [key: number]: string } = {
          0: 'started',
          1: 'starting',
          2: 'stopped',
          3: 'expired'
        }

        // Process successful results
        const phoneStatuses = statusResult.successDetails?.map((detail: any) => ({
          profile_id: detail.id,
          name: detail.serialName,
          status: statusMap[detail.status] || 'unknown',
          status_code: detail.status
        })) || []

        // Only update phones that were explicitly returned by GeeLark with a status
        // Don't assume phones are stopped just because they weren't in the response
        
        // Update phone status in database
        await Promise.all([
          // Update phones that were returned by GeeLark
          ...phoneStatuses.map(async (status: any) => {
            // First check if phone record exists
            const { data: existingPhone } = await supabaseAdmin
              .from('phones')
              .select('profile_id, meta')
              .eq('profile_id', status.profile_id)
              .single()

            if (existingPhone) {
              // Update existing record
              await supabaseAdmin
                .from('phones')
                .update({
                  meta: {
                    ...(existingPhone.meta || {}),
                    phone_status: status.status,
                    phone_status_updated_at: new Date().toISOString()
                  },
                  updated_at: new Date().toISOString()
                })
                .eq('profile_id', status.profile_id)
            } else {
              // Create new phone record if it doesn't exist
              const account = batch.find(p => p.geelark_profile_id === status.profile_id)
              if (account) {
                await supabaseAdmin
                  .from('phones')
                  .insert({
                    profile_id: status.profile_id,
                    account_id: account.id,
                    status: 'unknown', // Default status column value
                    meta: {
                      phone_status: status.status,
                      phone_status_updated_at: new Date().toISOString()
                    }
                  })
              }
            }
          })
        ])

        totalSynced += phoneStatuses.length
        totalErrors += statusResult.failDetails?.length || 0

      } catch (error) {
        console.error(`Failed to sync batch starting at index ${i}:`, error)
        totalErrors += batch.length
      }
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-sync-phone-status',
      message: 'Phone status sync completed',
      meta: { 
        total_profiles: profiles.length,
        total_synced: totalSynced,
        total_errors: totalErrors
      }
    })

    return NextResponse.json({
      success: true,
      total_profiles: profiles.length,
      synced: totalSynced,
      errors: totalErrors
    })

  } catch (error) {
    console.error('Phone status sync error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-sync-phone-status',
      message: 'Failed to sync phone status',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to sync phone status' },
      { status: 500 }
    )
  }
}