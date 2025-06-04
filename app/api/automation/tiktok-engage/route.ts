import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { monitorEngagementCompletion } from '@/lib/utils/engagement-monitor'

// Set maximum duration to 1800 seconds (30 minutes) for engagement tasks
export const maxDuration = 1800

interface EngagementOptions {
  profile_ids: string[]
  target_usernames: string[]
  posts_per_user?: number
  like_only?: boolean
}

interface EngagementResult {
  success: boolean
  results: {
    profile_id: string
    profile_name?: string
    task_id?: string
    status: 'success' | 'failed'
    message: string
    error?: string
  }[]
  summary: {
    total_profiles: number
    successful_tasks: number
    failed_tasks: number
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const result: EngagementResult = {
    success: false,
    results: [],
    summary: {
      total_profiles: 0,
      successful_tasks: 0,
      failed_tasks: 0
    }
  }

  try {
    const body = await request.json()
    const options: EngagementOptions = {
      profile_ids: body.profile_ids || [],
      target_usernames: body.target_usernames || [],
      posts_per_user: body.posts_per_user || 3,
      like_only: body.like_only || false
    }

    // Validate inputs
    if (!options.profile_ids || options.profile_ids.length === 0) {
      throw new Error('No profiles selected')
    }
    
    if (!options.target_usernames || options.target_usernames.length === 0) {
      throw new Error('No target usernames provided')
    }

    result.summary.total_profiles = options.profile_ids.length

    // Log the engagement request
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'automation-tiktok-engage',
      message: 'TikTok engagement automation started',
      meta: {
        profile_count: options.profile_ids.length,
        target_count: options.target_usernames.length,
        posts_per_user: options.posts_per_user,
        like_only: options.like_only
      }
    })

    // Get the TikTok engagement task flow ID
    // You'll need to upload the RPA JSON to GeeLark and get this ID
    const TIKTOK_ENGAGE_FLOW_ID = process.env.TIKTOK_ENGAGE_FLOW_ID || 'YOUR_FLOW_ID_HERE'

    // Process each profile in parallel
    const profilePromises = options.profile_ids.map(async (profileId) => {
      try {
        // Get profile details
        const { data: phone } = await supabaseAdmin
          .from('phones')
          .select('*, accounts(*)')
          .eq('profile_id', profileId)
          .single()

        if (!phone) {
          return {
            profile_id: profileId,
            status: 'failed' as const,
            message: 'Profile not found',
            error: 'Profile does not exist in database'
          }
        }

        const accountId = phone.accounts?.[0]?.id

        // Check if phone is already running
        let phoneRunning = false
        try {
          const phoneStatusResponse = await geelarkApi.getPhoneStatus([profileId])
          const phoneDetail = phoneStatusResponse.successDetails?.find((d: any) => d.id === profileId)
          phoneRunning = phoneDetail && phoneDetail.status === 0 // 0 = started/running
        } catch (error) {
          console.log(`Phone ${profileId} not running, will start it`)
        }

        // Start phone if not running
        if (!phoneRunning) {
          try {
            await geelarkApi.startPhones([profileId])
            
            // Wait for phone to actually start
            let phoneStarted = false
            const startTime = Date.now()
            
            while (!phoneStarted && (Date.now() - startTime) < 300000) { // 5 minute timeout
              await new Promise(resolve => setTimeout(resolve, 5000)) // Check every 5 seconds
              
              try {
                const statusResponse = await geelarkApi.getPhoneStatus([profileId])
                const phoneDetail = statusResponse.successDetails?.find((d: any) => d.id === profileId)
                phoneStarted = phoneDetail && phoneDetail.status === 0 // 0 = started/running
              } catch (error) {
                // Phone not ready yet, continue waiting
              }
            }
            
            if (!phoneStarted) {
              throw new Error('Phone failed to start')
            }
          } catch (error) {
            return {
              profile_id: profileId,
              profile_name: phone.profile_name,
              status: 'failed' as const,
              message: 'Failed to start phone',
              error: error instanceof Error ? error.message : String(error)
            }
          }
        }

        // Get a random comment from the pool if comments are enabled
        let selectedComment = ''
        if (!options.like_only) {
          const { data: randomComment } = await supabaseAdmin
            .rpc('get_random_comment')
          
          if (!randomComment) {
            throw new Error('No comments available in the pool')
          }
          selectedComment = randomComment
        }

        // Create RPA task for engagement
        const taskParams = {
          usernames: options.target_usernames,
          comment: selectedComment,
          postsPerUser: String(options.posts_per_user),
          likeOnly: String(options.like_only)
        }

        const engagementTask = await geelarkApi.createCustomRPATask(
          profileId,
          TIKTOK_ENGAGE_FLOW_ID,
          taskParams,
          {
            name: `tiktok_engage_${Date.now()}`,
            remark: `Engage with ${options.target_usernames.length} users, ${options.posts_per_user} posts each`
          }
        )

        const taskId = engagementTask.taskId

        // Update account with task info
        if (accountId) {
          await supabaseAdmin
            .from('accounts')
            .update({
              status: 'running_engagement',
              geelark_task_id: taskId,
              meta: {
                engagement_task_id: taskId,
                target_usernames: options.target_usernames,
                engagement_type: options.like_only ? 'like_only' : 'like_and_comment'
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', accountId)
        }

        // Store task in tasks table
        await supabaseAdmin.from('tasks').insert({
          type: 'engagement',
          task_type: 'tiktok_engage',
          geelark_task_id: taskId,
          account_id: accountId,
          status: 'running',
          started_at: new Date().toISOString(),
          meta: {
            profile_id: profileId,
            target_usernames: options.target_usernames,
            posts_per_user: options.posts_per_user,
            like_only: options.like_only,
            comment: selectedComment
          }
        })

        // Start background monitoring for auto-stop
        if (accountId) {
          monitorEngagementCompletion(accountId, profileId, taskId)
            .catch(error => {
              console.error('Engagement monitoring error:', error)
            })
        }

        return {
          profile_id: profileId,
          profile_name: phone.profile_name,
          task_id: taskId,
          status: 'success' as const,
          message: `Engagement task started successfully`
        }

      } catch (error) {
        console.error(`Error processing profile ${profileId}:`, error)
        return {
          profile_id: profileId,
          status: 'failed' as const,
          message: 'Failed to create engagement task',
          error: error instanceof Error ? error.message : String(error)
        }
      }
    })

    // Wait for all profiles to be processed
    const profileResults = await Promise.all(profilePromises)
    result.results = profileResults

    // Calculate summary
    result.summary.successful_tasks = profileResults.filter(r => r.status === 'success').length
    result.summary.failed_tasks = profileResults.filter(r => r.status === 'failed').length
    
    result.success = result.summary.successful_tasks > 0

    // Log completion
    const duration = Date.now() - startTime
    await supabaseAdmin.from('logs').insert({
      level: result.success ? 'info' : 'error',
      component: 'automation-tiktok-engage',
      message: `TikTok engagement automation completed`,
      meta: {
        duration_ms: duration,
        total_profiles: result.summary.total_profiles,
        successful: result.summary.successful_tasks,
        failed: result.summary.failed_tasks,
        target_usernames: options.target_usernames
      }
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('TikTok engagement error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'automation-tiktok-engage',
      message: 'TikTok engagement automation failed',
      meta: {
        error: error instanceof Error ? error.message : String(error)
      }
    })

    return NextResponse.json(
      {
        ...result,
        error: error instanceof Error ? error.message : 'Engagement automation failed'
      },
      { status: 500 }
    )
  }
} 