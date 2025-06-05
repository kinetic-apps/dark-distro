import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { profileIds, action } = await request.json()

    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json(
        { error: 'Profile IDs are required' },
        { status: 400 }
      )
    }

    // Get current profiles
    const { data: profiles, error: fetchError } = await supabaseAdmin
      .from('accounts')
      .select('id, tiktok_username, status, geelark_task_id, current_setup_step, warmup_done, warmup_progress')
      .in('id', profileIds)

    if (fetchError) {
      console.error('Failed to fetch profiles:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch profiles' },
        { status: 500 }
      )
    }

    const results = {
      updated: 0,
      errors: [] as string[]
    }

    // Process each profile
    for (const profile of profiles || []) {
      try {
        let newStatus = 'active' // Default to active
        let updates: any = {
          status: newStatus,
          current_setup_step: null,
          setup_progress: null,
          geelark_task_id: null, // Clear any stuck task IDs
          last_error: null, // Clear any error messages
          updated_at: new Date().toISOString()
        }

        // If action is specified, use it
        if (action === 'reset-to-new') {
          updates.status = 'new'
          updates.warmup_done = false
          updates.warmup_progress = 0
        } else if (action === 'mark-active') {
          updates.status = 'active'
        } else {
          // Auto-detect based on current status
          if (profile.status === 'pending_verification' || profile.status === 'error') {
            // These were likely stuck during setup, mark as active
            updates.status = 'active'
          } else if (profile.status === 'running_geelark_task' || profile.status === 'renting_number') {
            // Clear setup-related statuses
            updates.status = 'active'
          } else if (profile.status === 'new' && (profile.warmup_done || profile.warmup_progress > 0)) {
            // If profile has done warmup, it should be active
            updates.status = 'active'
          }
        }

        const { error: updateError } = await supabaseAdmin
          .from('accounts')
          .update(updates)
          .eq('id', profile.id)

        if (updateError) {
          console.error(`Failed to update profile ${profile.id}:`, updateError)
          results.errors.push(`${profile.tiktok_username || profile.id}: ${updateError.message}`)
        } else {
          results.updated++
          
          // Log the fix
          await supabaseAdmin.from('logs').insert({
            level: 'info',
            component: 'fix-stuck-status',
            message: `Fixed stuck status for ${profile.tiktok_username || profile.id}`,
            meta: {
              profile_id: profile.id,
              old_status: profile.status,
              new_status: updates.status,
              old_setup_step: profile.current_setup_step
            }
          })
        }
      } catch (error) {
        console.error(`Error processing profile ${profile.id}:`, error)
        results.errors.push(`${profile.tiktok_username || profile.id}: ${error}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${results.updated} profile(s)`,
      updated: results.updated,
      errors: results.errors
    })

  } catch (error) {
    console.error('Fix stuck status error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check stuck profiles
export async function GET(request: NextRequest) {
  try {
    // Find profiles with potentially stuck statuses
    const { data: stuckProfiles, error } = await supabaseAdmin
      .from('accounts')
      .select('id, tiktok_username, status, current_setup_step, geelark_task_id, last_error, updated_at')
      .or(`status.in.(pending_verification,error,running_geelark_task,renting_number,starting_phone,installing_tiktok),last_error.ilike.%timeout%`)
      .order('updated_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch stuck profiles:', error)
      return NextResponse.json(
        { error: 'Failed to fetch stuck profiles' },
        { status: 500 }
      )
    }

    // Filter to only show profiles that haven't been updated in the last 30 minutes
    // OR have a timeout error message
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    const likelyStuck = stuckProfiles?.filter(profile => 
      new Date(profile.updated_at) < thirtyMinutesAgo || 
      (profile.last_error && profile.last_error.includes('timeout'))
    ) || []

    return NextResponse.json({
      total: stuckProfiles?.length || 0,
      likely_stuck: likelyStuck.length,
      profiles: likelyStuck.map(p => ({
        id: p.id,
        username: p.tiktok_username,
        status: p.status,
        setup_step: p.current_setup_step,
        has_task_id: !!p.geelark_task_id,
        last_error: p.last_error,
        last_updated: p.updated_at
      }))
    })

  } catch (error) {
    console.error('Get stuck profiles error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 