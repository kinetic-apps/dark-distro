import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { waitForPhoneReady } from '@/lib/utils/geelark-phone-status'
import { monitorBulkPostCompletion } from '@/lib/utils/bulk-post-monitor'

interface BulkPostRequest {
  account_ids: string[]
  asset_type: 'video' | 'carousel'
  video_url?: string
  images?: string[]
  caption?: string
  hashtags?: string[]
  music?: string
}

interface PostResult {
  account_id: string
  success: boolean
  task_id?: string
  error?: string
  started_at?: string
  phone_ready_at?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkPostRequest = await request.json()
    const { account_ids, asset_type, video_url, images, caption, hashtags, music } = body

    // Validate request
    if (!account_ids || !Array.isArray(account_ids) || account_ids.length === 0) {
      return NextResponse.json(
        { error: 'Account IDs array is required' },
        { status: 400 }
      )
    }

    if (!asset_type || !['video', 'carousel'].includes(asset_type)) {
      return NextResponse.json(
        { error: 'Valid asset type is required (video or carousel)' },
        { status: 400 }
      )
    }

    if (asset_type === 'video' && !video_url) {
      return NextResponse.json(
        { error: 'Video URL is required for video posts' },
        { status: 400 }
      )
    }

    if (asset_type === 'carousel' && (!images || !Array.isArray(images) || images.length === 0)) {
      return NextResponse.json(
        { error: 'Images array is required for carousel posts' },
        { status: 400 }
      )
    }

    // Log bulk post request
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-bulk-post',
      message: 'Bulk post request received',
      meta: {
        account_count: account_ids.length,
        asset_type,
        has_caption: !!caption,
        has_hashtags: !!hashtags,
        has_music: !!music
      }
    })

    // Fetch all accounts with their phone details and serial numbers
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .in('id', account_ids)

    if (accountsError || !accounts) {
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: 500 }
      )
    }

    // Get phone records for serial numbers
    const { data: phones } = await supabaseAdmin
      .from('phones')
      .select('*')
      .in('account_id', account_ids)

    // Create a map of account_id to phone data
    const phoneMap = new Map(phones?.map(p => [p.account_id, p]) || [])

    // Sort accounts by serial number (ascending)
    const sortedAccounts = accounts.sort((a, b) => {
      const serialA = parseInt(a.meta?.geelark_serial_no || '999999')
      const serialB = parseInt(b.meta?.geelark_serial_no || '999999')
      return serialA - serialB
    })

    console.log('[Bulk Post] Processing accounts in serial number order:', 
      sortedAccounts.map(a => ({
        id: a.id,
        serial: a.meta?.geelark_serial_no,
        username: a.tiktok_username
      }))
    )

    const results: PostResult[] = []
    const startedPhones = new Set<string>()
    const monitoringTasks: Array<{ account_id: string; profile_id: string; task_id: string; serial_no: string }> = []

    // Process accounts in cascading manner
    for (let i = 0; i < sortedAccounts.length; i++) {
      const account = sortedAccounts[i]
      const profileId = account.geelark_profile_id
      const serialNo = account.meta?.geelark_serial_no || 'unknown'
      
      const result: PostResult = {
        account_id: account.id,
        success: false
      }

      try {
        console.log(`[Bulk Post] Processing account ${i + 1}/${sortedAccounts.length} - Serial #${serialNo}`)
        
        // Start the phone
        console.log(`[Bulk Post] Starting phone for account ${account.id} (Serial #${serialNo})`)
        result.started_at = new Date().toISOString()
        
        await geelarkApi.startPhones([profileId])
        startedPhones.add(profileId)
        
        // Wait for phone to be ready
        await waitForPhoneReady(profileId, {
          maxAttempts: 300, // 10 minutes max
          logProgress: true,
          logPrefix: `[Bulk Post #${serialNo}] `
        })
        
        result.phone_ready_at = new Date().toISOString()
        console.log(`[Bulk Post] Phone ready for account ${account.id} (Serial #${serialNo})`)

        // Now create the post task (without waiting for completion)
        let taskId: string
        
        if (asset_type === 'video') {
          // Create video post task
          taskId = await geelarkApi.postTikTokVideo(profileId, account.id, {
            video_url: video_url!,
            caption: caption || '',
            hashtags: hashtags || [],
            music
          }, { skipPhoneStart: true })
        } else {
          // Create carousel post task
          taskId = await geelarkApi.postTikTokCarousel(profileId, account.id, {
            images: images!,
            caption: caption || '',
            hashtags: hashtags || [],
            music
          }, { skipPhoneStart: true })
        }

        // Create post record
        await supabaseAdmin.from('posts').insert({
          account_id: account.id,
          type: asset_type,
          status: 'pending',
          asset_path: asset_type === 'video' ? video_url : images![0],
          caption: caption || '',
          hashtags: hashtags || [],
          content: asset_type === 'video' 
            ? { video_url, caption, hashtags, music }
            : { images, caption, hashtags, music, images_count: images!.length },
          task_id: taskId,
          meta: {
            bulk_post: true,
            serial_no: serialNo,
            batch_position: i + 1,
            batch_total: sortedAccounts.length
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

        result.success = true
        result.task_id = taskId

        // Add to monitoring list
        monitoringTasks.push({
          account_id: account.id,
          profile_id: profileId,
          task_id: taskId,
          serial_no: serialNo
        })

        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'api-bulk-post',
          message: `Bulk post task created for account ${i + 1}/${sortedAccounts.length}`,
          meta: {
            account_id: account.id,
            serial_no: serialNo,
            task_id: taskId,
            position: i + 1,
            total: sortedAccounts.length,
            phone_start_duration_ms: new Date(result.phone_ready_at!).getTime() - new Date(result.started_at!).getTime()
          }
        })

      } catch (error) {
        console.error(`[Bulk Post] Error processing account ${account.id}:`, error)
        result.error = error instanceof Error ? error.message : String(error)
        
        // If phone was started but task failed, stop it
        if (startedPhones.has(profileId)) {
          try {
            await geelarkApi.stopPhones([profileId])
            startedPhones.delete(profileId)
          } catch (stopError) {
            console.error(`[Bulk Post] Failed to stop phone after error:`, stopError)
          }
        }

        await supabaseAdmin.from('logs').insert({
          level: 'error',
          component: 'api-bulk-post',
          account_id: account.id,
          message: `Bulk post failed for account ${i + 1}/${sortedAccounts.length}`,
          meta: {
            serial_no: serialNo,
            error: result.error,
            position: i + 1,
            total: sortedAccounts.length
          }
        })
        
        // Continue to next account instead of stopping
        console.log(`[Bulk Post] Continuing to next account after error`)
      }

      results.push(result)
      
      // Add a small delay between accounts to avoid overwhelming the system
      if (i < sortedAccounts.length - 1) {
        console.log(`[Bulk Post] Waiting 2 seconds before processing next account...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // Start monitoring all successful tasks
    if (monitoringTasks.length > 0) {
      console.log(`[Bulk Post] Starting monitor for ${monitoringTasks.length} tasks`)
      monitorBulkPostCompletion(monitoringTasks).catch(error => {
        console.error('[Bulk Post] Error starting bulk monitor:', error)
      })
    }

    // Summary
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-bulk-post',
      message: 'Bulk post completed',
      meta: {
        total: results.length,
        success: successCount,
        failed: failCount,
        asset_type,
        results: results.map(r => ({
          account_id: r.account_id,
          success: r.success,
          error: r.error
        }))
      }
    })

    return NextResponse.json({
      success: true,
      message: `Bulk post completed: ${successCount} succeeded, ${failCount} failed`,
      total: results.length,
      success_count: successCount,
      fail_count: failCount,
      results
    })

  } catch (error) {
    console.error('Bulk post error:', error)
    
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-bulk-post',
      message: `Bulk post failed: ${errorMessage}`,
      meta: { 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      }
    })

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
} 