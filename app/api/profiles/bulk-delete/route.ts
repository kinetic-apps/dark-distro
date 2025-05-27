import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { geelarkApi } from '@/lib/geelark-api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profileIds, deleteFromGeelark = false } = body

    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid profile IDs' },
        { status: 400 }
      )
    }

    // Fetch profiles to get GeeLark profile IDs
    const { data: profiles, error: fetchError } = await supabaseAdmin
      .from('accounts')
      .select('id, geelark_profile_id, tiktok_username')
      .in('id', profileIds)

    if (fetchError) {
      throw new Error(`Failed to fetch profiles: ${fetchError.message}`)
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json(
        { error: 'No profiles found' },
        { status: 404 }
      )
    }

    let deletedFromSupabase = 0
    let deletedFromGeelark = 0
    let errors: string[] = []

    // Step 1: Delete from GeeLark if requested
    if (deleteFromGeelark) {
      for (const profile of profiles) {
        if (profile.geelark_profile_id) {
          try {
            await geelarkApi.deleteProfile(profile.geelark_profile_id)
            deletedFromGeelark++
            
            await supabaseAdmin.from('logs').insert({
              level: 'info',
              component: 'api-bulk-delete',
              message: `Deleted profile from GeeLark: ${profile.tiktok_username || 'Unnamed'}`,
              meta: { 
                profile_id: profile.id,
                geelark_profile_id: profile.geelark_profile_id
              }
            })
          } catch (error) {
            const errorMsg = `Failed to delete ${profile.tiktok_username || 'Unnamed'} from GeeLark: ${error}`
            errors.push(errorMsg)
            console.error(errorMsg)
          }
        }
      }
    }

    // Step 2: Delete from Supabase
    for (const profile of profiles) {
      try {
        // Delete related phone records first
        await supabaseAdmin
          .from('phones')
          .delete()
          .eq('account_id', profile.id)

        // Delete the account
        await supabaseAdmin
          .from('accounts')
          .delete()
          .eq('id', profile.id)

        deletedFromSupabase++
        
        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'api-bulk-delete',
          message: `Deleted profile from Supabase: ${profile.tiktok_username || 'Unnamed'}`,
          meta: { 
            profile_id: profile.id,
            geelark_profile_id: profile.geelark_profile_id
          }
        })
      } catch (error) {
        const errorMsg = `Failed to delete ${profile.tiktok_username || 'Unnamed'} from Supabase: ${error}`
        errors.push(errorMsg)
        console.error(errorMsg)
      }
    }

    // Log the bulk delete operation
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-bulk-delete',
      message: `Bulk delete completed: ${deletedFromSupabase} deleted from Supabase, ${deletedFromGeelark} deleted from GeeLark`,
      meta: { 
        requested_count: profileIds.length,
        deleted_from_supabase: deletedFromSupabase,
        deleted_from_geelark: deletedFromGeelark,
        error_count: errors.length,
        errors: errors.slice(0, 5) // Log first 5 errors
      }
    })

    const message = deleteFromGeelark 
      ? `Deleted ${deletedFromSupabase} profiles from database and ${deletedFromGeelark} from GeeLark`
      : `Deleted ${deletedFromSupabase} profiles from database`

    return NextResponse.json({
      success: true,
      message,
      stats: {
        requested: profileIds.length,
        deleted_from_supabase: deletedFromSupabase,
        deleted_from_geelark: deletedFromGeelark,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-bulk-delete',
      message: 'Failed to bulk delete profiles',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: `Bulk delete error: ${error}` },
      { status: 500 }
    )
  }
} 