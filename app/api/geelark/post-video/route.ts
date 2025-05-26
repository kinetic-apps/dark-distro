import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_id, video_url, caption, hashtags, music } = body

    if (!account_id || !video_url) {
      return NextResponse.json(
        { error: 'Account ID and video URL are required' },
        { status: 400 }
      )
    }

    // Fetch account with profile
    const { data: account, error } = await supabaseAdmin
      .from('accounts')
      .select('*, phones(*)')
      .eq('id', account_id)
      .single()

    if (error || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    if (!account.phones?.[0]?.profile_id) {
      return NextResponse.json(
        { error: 'No profile associated with this account' },
        { status: 400 }
      )
    }

    const profileId = account.phones[0].profile_id

    // Post video
    const taskId = await geelarkApi.postTikTokVideo(profileId, account_id, {
      video_url,
      caption: caption || '',
      hashtags: hashtags || [],
      music
    })

    // Create post record
    await supabaseAdmin.from('posts').insert({
      account_id,
      type: 'video',
      status: 'pending',
      content: {
        video_url,
        caption,
        hashtags,
        music
      },
      task_id: taskId,
      created_at: new Date().toISOString()
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-post-video',
      account_id,
      message: 'TikTok video post initiated',
      meta: {
        task_id: taskId,
        profile_id: profileId,
        has_music: !!music,
        hashtags_count: hashtags?.length || 0
      }
    })

    return NextResponse.json({
      success: true,
      task_id: taskId,
      message: 'Video post initiated',
      details: {
        has_caption: !!caption,
        hashtags_count: hashtags?.length || 0,
        has_music: !!music
      }
    })
  } catch (error) {
    console.error('Post video error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-post-video',
      message: 'Failed to post video',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to post video' },
      { status: 500 }
    )
  }
} 