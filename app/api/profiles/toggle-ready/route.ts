import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { profileId, ready } = await request.json()

    if (!profileId) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      )
    }

    // Get current profile status
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('accounts')
      .select('id, tiktok_username, ready_for_actions')
      .eq('id', profileId)
      .single()

    if (fetchError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Toggle the ready status
    const newReadyStatus = ready !== undefined ? ready : !profile.ready_for_actions

    const { error: updateError } = await supabaseAdmin
      .from('accounts')
      .update({
        ready_for_actions: newReadyStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId)

    if (updateError) {
      console.error('Failed to update ready status:', updateError)
      return NextResponse.json(
        { error: 'Failed to update ready status' },
        { status: 500 }
      )
    }

    // Log the change
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'profile-ready-toggle',
      message: `Profile ${profile.tiktok_username || profileId} marked as ${newReadyStatus ? 'ready' : 'not ready'} for actions`,
      meta: {
        profile_id: profileId,
        ready_for_actions: newReadyStatus,
        previous_status: profile.ready_for_actions
      }
    })

    return NextResponse.json({
      success: true,
      profileId,
      ready_for_actions: newReadyStatus
    })

  } catch (error) {
    console.error('Toggle ready status error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 