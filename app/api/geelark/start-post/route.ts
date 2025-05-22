import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  let post_id: string | undefined
  
  try {
    const body = await request.json()
    post_id = body.post_id

    if (!post_id) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      )
    }

    // Fetch post with account details
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select(`
        *,
        account:accounts!posts_account_id_fkey(
          *,
          phones(*)
        )
      `)
      .eq('id', post_id)
      .single()

    if (postError || !post) throw postError || new Error('Post not found')

    if (!post.account?.phones?.[0]?.profile_id) {
      throw new Error('No profile found for account')
    }

    const profileId = post.account.phones[0].profile_id

    // Generate signed URL for video
    const { data: signedUrlData, error: urlError } = await supabaseAdmin
      .storage
      .from('ghostpost-outbox')
      .createSignedUrl(post.asset_path, 3600) // 1 hour expiry

    if (urlError) throw urlError

    // Start post task
    const taskId = await geelarkApi.postVideo(profileId, post.account_id, {
      url: signedUrlData.signedUrl,
      caption: post.caption || '',
      hashtags: post.hashtags || []
    })

    // Update post status
    await supabaseAdmin
      .from('posts')
      .update({
        status: 'processing',
        geelark_task_id: taskId,
        updated_at: new Date().toISOString()
      })
      .eq('id', post_id)

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-start-post',
      account_id: post.account_id,
      message: 'Post task started',
      meta: { 
        post_id,
        task_id: taskId,
        profile_id: profileId,
        asset: post.asset_path
      }
    })

    return NextResponse.json({
      success: true,
      task_id: taskId
    })
  } catch (error) {
    console.error('Start post error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-start-post',
      message: 'Failed to start post',
      meta: { error: String(error), post_id }
    })

    return NextResponse.json(
      { error: 'Failed to start post' },
      { status: 500 }
    )
  }
}