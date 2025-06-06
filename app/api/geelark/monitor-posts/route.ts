import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { monitorPostCompletionAndStop } from '@/lib/utils/post-completion-monitor'

export async function POST(request: NextRequest) {
  try {
    // Get all posts that are still pending/processing and have task IDs
    const { data: activePosts, error } = await supabaseAdmin
      .from('posts')
      .select(`
        id,
        account_id,
        task_id,
        type,
        status,
        created_at,
        account:accounts!fk_account(
          geelark_profile_id
        )
      `)
      .in('status', ['pending', 'processing', 'queued'])
      .not('task_id', 'is', null)
      .not('account.geelark_profile_id', 'is', null)

    if (error) {
      console.error('Error fetching active posts:', error)
      return NextResponse.json({ error: 'Failed to fetch active posts' }, { status: 500 })
    }

    if (!activePosts || activePosts.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No active posts found to monitor',
        monitored: 0
      })
    }

    console.log(`[Monitor Posts] Found ${activePosts.length} active posts to monitor`)

    // Start monitoring for each active post
    const monitoringPromises = activePosts.map(async (post) => {
      try {
        const profileId = (post.account as any)?.geelark_profile_id
        if (!profileId) {
          console.warn(`[Monitor Posts] No profile ID for post ${post.id}`)
          return { post_id: post.id, status: 'skipped', reason: 'No profile ID' }
        }

        // Determine task type from post type
        const taskType = post.type === 'video' ? 'video' : 
                        post.type === 'carousel' ? 'carousel' : 'video'

        // Start monitoring (non-blocking)
        monitorPostCompletionAndStop(
          post.account_id, 
          profileId, 
          post.task_id, 
          taskType as 'video' | 'carousel'
        ).catch(error => {
          console.error(`[Monitor Posts] Error monitoring post ${post.id}:`, error)
        })

        console.log(`[Monitor Posts] Started monitoring for post ${post.id} (${taskType})`)
        
        return { 
          post_id: post.id, 
          status: 'monitoring_started',
          task_type: taskType,
          profile_id: profileId
        }
      } catch (error) {
        console.error(`[Monitor Posts] Error starting monitor for post ${post.id}:`, error)
        return { 
          post_id: post.id, 
          status: 'error', 
          error: error instanceof Error ? error.message : String(error)
        }
      }
    })

    const results = await Promise.all(monitoringPromises)
    const successCount = results.filter(r => r.status === 'monitoring_started').length
    const errorCount = results.filter(r => r.status === 'error').length
    const skippedCount = results.filter(r => r.status === 'skipped').length

    // Log the monitoring initiation
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'monitor-posts-api',
      message: `Started monitoring for ${successCount} active posts`,
      meta: {
        total_posts: activePosts.length,
        monitoring_started: successCount,
        errors: errorCount,
        skipped: skippedCount,
        results
      }
    })

    return NextResponse.json({
      success: true,
      message: `Started monitoring for ${successCount} posts`,
      total_posts: activePosts.length,
      monitoring_started: successCount,
      errors: errorCount,
      skipped: skippedCount,
      results
    })

  } catch (error) {
    console.error('Error in monitor posts API:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'monitor-posts-api',
      message: 'Failed to start post monitoring',
      meta: { 
        error: error instanceof Error ? error.message : String(error)
      }
    })

    return NextResponse.json(
      { error: 'Failed to start post monitoring' },
      { status: 500 }
    )
  }
}

// Also handle GET requests for manual triggers
export async function GET() {
  return POST(new NextRequest('http://localhost'))
} 