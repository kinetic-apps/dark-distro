import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_id, images, caption, hashtags, music } = body

    if (!account_id || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'Account ID and images are required' },
        { status: 400 }
      )
    }

    // Validate image count (TikTok allows 2-35 images)
    if (images.length < 2 || images.length > 35) {
      return NextResponse.json(
        { error: 'TikTok carousels require between 2 and 35 images' },
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

    // Post carousel
    const taskId = await geelarkApi.postTikTokCarousel(profileId, account_id, {
      images,
      caption: caption || '',
      hashtags: hashtags || [],
      music
    })

    // Create post record
    await supabaseAdmin.from('posts').insert({
      account_id,
      type: 'carousel',
      status: 'pending',
      content: {
        images,
        caption,
        hashtags,
        music,
        images_count: images.length
      },
      task_id: taskId,
      created_at: new Date().toISOString()
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-post-carousel',
      account_id,
      message: 'TikTok carousel post initiated',
      meta: {
        task_id: taskId,
        profile_id: profileId,
        images_count: images.length,
        has_music: !!music
      }
    })

    return NextResponse.json({
      success: true,
      task_id: taskId,
      message: 'Carousel post initiated',
      details: {
        images_count: images.length,
        has_caption: !!caption,
        hashtags_count: hashtags?.length || 0,
        has_music: !!music
      }
    })
  } catch (error) {
    console.error('Post carousel error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-post-carousel',
      message: 'Failed to post carousel',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to post carousel' },
      { status: 500 }
    )
  }
} 