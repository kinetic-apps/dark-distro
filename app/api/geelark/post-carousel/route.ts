import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  let body: any = {}
  let account_id: string | undefined
  
  try {
    body = await request.json()
    const { account_id: aid, images, caption, hashtags, music } = body
    account_id = aid

    // Log the incoming request
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-post-carousel',
      account_id,
      message: 'Carousel post request received',
      meta: { 
        account_id,
        images_count: images?.length,
        has_caption: !!caption,
        has_hashtags: !!hashtags,
        has_music: !!music
      }
    })

    if (!account_id || !images || !Array.isArray(images) || images.length === 0) {
      const errorMsg = 'Account ID and images are required'
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'api-post-carousel',
        account_id,
        message: errorMsg,
        meta: { 
          validation_error: true,
          account_id,
          images: images,
          images_is_array: Array.isArray(images),
          images_length: images?.length
        }
      })
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 }
      )
    }

    // Validate image count (TikTok allows 2-35 images)
    if (images.length < 2 || images.length > 35) {
      const errorMsg = `TikTok carousels require between 2 and 35 images (got ${images.length})`
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'api-post-carousel',
        account_id,
        message: errorMsg,
        meta: { 
          validation_error: true,
          images_count: images.length
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
        component: 'api-post-carousel',
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
        component: 'api-post-carousel',
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
    const isTikTokInstalled = await geelarkApi.isTikTokInstalled(profileId)
    if (!isTikTokInstalled) {
      const errorMsg = 'TikTok is not installed on this profile'
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'api-post-carousel',
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

    // Post carousel
    const taskId = await geelarkApi.postTikTokCarousel(profileId, account_id, {
      images,
      caption: caption || '',
      hashtags: hashtags || [],
      music
    })

    // Create post record
    const { error: postError } = await supabaseAdmin.from('posts').insert({
      account_id,
      type: 'carousel',
      status: 'pending',
      asset_path: images[0], // Use first image as asset_path
      caption: caption || '',
      hashtags: hashtags || [],
      content: {
        images,
        caption,
        hashtags,
        music,
        images_count: images.length
      },
      task_id: taskId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    if (postError) {
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'api-post-carousel',
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
    
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-post-carousel',
      account_id,
      message: `Failed to post carousel: ${errorMessage}`,
      meta: { 
        error: errorMessage,
        stack: errorStack,
        request_body: body
      }
    })

    return NextResponse.json(
      { error: `Failed to post carousel: ${errorMessage}` },
      { status: 500 }
    )
  }
} 