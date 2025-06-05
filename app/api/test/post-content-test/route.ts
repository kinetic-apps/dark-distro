import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { profileId, accountId, type, content } = await request.json()

    if (!profileId || !accountId) {
      return NextResponse.json(
        { error: 'Profile ID and Account ID are required' },
        { status: 400 }
      )
    }

    console.log(`[Test] Starting ${type} post test for profile:`, profileId)

    let taskId: string

    if (type === 'video' && content.video_url) {
      console.log('[Test] Posting video:', content.video_url)
      
      taskId = await geelarkApi.postTikTokVideo(profileId, accountId, {
        video_url: content.video_url,
        caption: content.caption || 'Test video post',
        hashtags: content.hashtags || ['test'],
        music: content.music
      })
      
    } else if (type === 'carousel' && content.images?.length > 0) {
      console.log('[Test] Posting carousel with', content.images.length, 'images')
      
      taskId = await geelarkApi.postTikTokCarousel(profileId, accountId, {
        images: content.images,
        caption: content.caption || 'Test carousel post',
        hashtags: content.hashtags || ['test'],
        music: content.music
      })
      
    } else {
      return NextResponse.json(
        { error: 'Invalid content type or missing content' },
        { status: 400 }
      )
    }

    console.log('[Test] Task created:', taskId)

    // Check task status after a delay
    setTimeout(async () => {
      try {
        const status = await geelarkApi.getTaskStatus(taskId)
        console.log('[Test] Task status after 5s:', status)
        
        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'test-post-content',
          message: 'Task status check',
          meta: { taskId, status }
        })
      } catch (error) {
        console.error('[Test] Failed to check task status:', error)
      }
    }, 5000)

    return NextResponse.json({
      success: true,
      taskId,
      type,
      message: `${type} post task created successfully`
    })

  } catch (error) {
    console.error('[Test] Post content test error:', error)
    return NextResponse.json(
      { 
        error: 'Post content test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 