import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  let body: any = {}
  let account_id: string | undefined
  
  try {
    body = await request.json()
    const { account_id: aid, video_url, caption, hashtags, music } = body
    account_id = aid

    // Log the incoming request
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-post-video',
      account_id,
      message: 'Video post request received',
      meta: { 
        account_id,
        video_url,
        has_caption: !!caption,
        has_hashtags: !!hashtags,
        has_music: !!music
      }
    })

    if (!account_id || !video_url) {
      const errorMsg = 'Account ID and video URL are required'
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'api-post-video',
        account_id,
        message: errorMsg,
        meta: { 
          validation_error: true,
          account_id,
          video_url
        }
      })
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 }
      )
    }

    // Validate video URL format
    try {
      const url = new URL(video_url)
      console.log('[Video Post] Video URL validated:', url.hostname, url.pathname)
    } catch (urlError) {
      const errorMsg = 'Invalid video URL format'
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'api-post-video',
        account_id,
        message: errorMsg,
        meta: { 
          validation_error: true,
          video_url,
          error: String(urlError)
        }
      })
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 }
      )
    }

    // Fetch account with profile
    const { data: account, error } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('id', account_id)
      .single()

    if (error || !account) {
      const errorMsg = `Account not found: ${account_id}`
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'api-post-video',
        account_id,
        message: errorMsg,
        meta: { 
          db_error: error,
          account_id
        }
      })
      return NextResponse.json(
        { error: errorMsg },
        { status: 404 }
      )
    }

    // Get phone record separately to avoid join issues
    const { data: phones } = await supabaseAdmin
      .from('phones')
      .select('*')
      .eq('account_id', account_id)

    // Use geelark_profile_id from account or phone record
    const profileId = account.geelark_profile_id || phones?.[0]?.profile_id

    if (!profileId) {
      const errorMsg = 'No profile ID found for this account'
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'api-post-video',
        account_id,
        message: errorMsg,
        meta: { 
          account,
          phone: phones?.[0]
        }
      })
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 }
      )
    }

    // Check if TikTok is installed
    console.log('[Video Post] Checking TikTok installation for profile:', profileId)
    const isTikTokInstalled = await geelarkApi.isTikTokInstalled(profileId)
    if (!isTikTokInstalled) {
      const errorMsg = 'TikTok is not installed on this profile'
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'api-post-video',
        account_id,
        message: errorMsg,
        meta: { 
          profile_id: profileId,
          checked_tiktok: true
        }
      })
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 }
      )
    }

    // Post video
    console.log('[Video Post] Starting video post for account:', account_id)
    console.log('[Video Post] Video URL:', video_url)
    
    const taskId = await geelarkApi.postTikTokVideo(profileId, account_id, {
      video_url,
      caption: caption || '',
      hashtags: hashtags || [],
      music
    })

    // Create post record
    const { error: postError } = await supabaseAdmin.from('posts').insert({
      account_id,
      type: 'video',
      status: 'pending',
      asset_path: video_url,
      caption: caption || '',
      hashtags: hashtags || [],
      content: {
        video_url,
        caption,
        hashtags,
        music
      },
      task_id: taskId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    if (postError) {
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'api-post-video',
        account_id,
        message: 'Failed to create post record',
        meta: { 
          error: postError,
          task_id: taskId
        }
      })
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-post-video',
      account_id,
      message: 'TikTok video post initiated',
      meta: {
        task_id: taskId,
        profile_id: profileId,
        has_music: !!music
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
    
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-post-video',
      account_id,
      message: `Failed to post video: ${errorMessage}`,
      meta: { 
        error: errorMessage,
        stack: errorStack,
        request_body: body
      }
    })

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
} 