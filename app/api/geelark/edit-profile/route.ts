import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profile_id, avatar, nickName, bio, site } = body

    if (!profile_id) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      )
    }

    // Prepare profile update object
    const profileUpdate: any = {}
    if (avatar) profileUpdate.avatar = avatar
    if (nickName) profileUpdate.nickName = nickName
    if (bio) profileUpdate.bio = bio
    if (site) profileUpdate.site = site

    if (Object.keys(profileUpdate).length === 0) {
      return NextResponse.json(
        { error: 'At least one field to update is required' },
        { status: 400 }
      )
    }

    // Call GeeLark API to edit profile
    const result = await geelarkApi.editTikTokProfile(profile_id, profileUpdate)

    // Store task in database
    await supabaseAdmin.from('tasks').insert({
      type: 'profile_edit',
      task_type: 'profile_edit',  // Required field
      geelark_task_id: result.taskId,
      account_id: body.account_id,
      status: 'running',
      started_at: new Date().toISOString(),
      meta: {
        changes: profileUpdate
      }
    })

    // Update account metadata if username changed
    if (nickName && body.account_id) {
      await supabaseAdmin
        .from('accounts')
        .update({
          tiktok_username: nickName,
          updated_at: new Date().toISOString()
        })
        .eq('id', body.account_id)
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-edit-profile',
      message: 'TikTok profile edit initiated',
      meta: { 
        profile_id,
        task_id: result.taskId,
        changes: profileUpdate
      }
    })

    return NextResponse.json({
      success: true,
      task_id: result.taskId,
      changes: profileUpdate
    })
  } catch (error) {
    console.error('Profile edit error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-edit-profile',
      message: 'Failed to edit TikTok profile',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to edit TikTok profile' },
      { status: 500 }
    )
  }
} 