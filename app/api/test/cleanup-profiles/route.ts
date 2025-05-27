import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { confirm } = body

    // Safety check - require explicit confirmation
    if (confirm !== 'DELETE_ALL_PROFILES') {
      return NextResponse.json(
        { error: 'Confirmation required. Send { "confirm": "DELETE_ALL_PROFILES" }' },
        { status: 400 }
      )
    }

    // Get all profiles first for logging
    const { data: profiles, error: fetchError } = await supabaseAdmin
      .from('accounts')
      .select('id, tiktok_username, geelark_profile_id')

    if (fetchError) {
      throw new Error(`Failed to fetch profiles: ${fetchError.message}`)
    }

    const profileCount = profiles?.length || 0

    // Delete all phone records first (due to foreign key constraints)
    const { error: phoneDeleteError } = await supabaseAdmin
      .from('phones')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (phoneDeleteError) {
      console.error('Error deleting phones:', phoneDeleteError)
    }

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
      component: 'api-cleanup-profiles',
      message: `Manual cleanup: deleted all ${profileCount} profiles from database`,
      meta: { 
        deleted_count: profileCount,
        profiles: profiles?.map(p => ({
          id: p.id,
          username: p.tiktok_username,
          geelark_id: p.geelark_profile_id
        })) || []
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully deleted all ${profileCount} profiles from database`,
      deleted_count: profileCount,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-cleanup-profiles',
      message: 'Failed to cleanup profiles',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: `Cleanup error: ${error}` },
      { status: 500 }
    )
  }
} 