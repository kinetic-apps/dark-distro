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
        // Get phone list from GeeLark
        const phoneList = await geelarkApi.getPhoneList(profileIds)

        if (phoneList.data?.items) {
          for (const phone of phoneList.data.items) {
            const account = batch.find(p => p.geelark_profile_id === phone.id)
            if (!account) continue

            // Extract tags and remark
            const tags = phone.tags?.map((t: any) => t.name) || []
            const remark = phone.remark || null

            // Update local phones table
            await supabaseAdmin
              .from('phones')
              .update({
                tags,
                remark,
                updated_at: new Date().toISOString()
              })
              .eq('account_id', account.id)

            totalSynced++
          }
        }
      } catch (error) {
        console.error(`Failed to sync batch starting at index ${i}:`, error)
        totalErrors += batch.length
      }
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-sync-phone-metadata',
      message: 'Phone metadata sync completed',
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
    console.error('Phone metadata sync error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-sync-phone-metadata',
      message: 'Failed to sync phone metadata',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to sync phone metadata' },
      { status: 500 }
    )
  }
} 