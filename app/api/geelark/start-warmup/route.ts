import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_ids, profile_ids, options } = body

    // Support both account_ids (for backward compatibility) and profile_ids
    const ids = profile_ids || account_ids

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid profile IDs' },
        { status: 400 }
      )
    }

    // Fetch accounts with their geelark_profile_id
    const { data: profiles, error } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .in('id', ids)
      .not('geelark_profile_id', 'is', null)

    if (error) throw error

    if (!profiles || profiles.length === 0) {
      return NextResponse.json(
        { error: 'No valid profiles found with GeeLark profile IDs' },
        { status: 404 }
      )
    }

    const results = await Promise.allSettled(
      profiles.map(async (profile) => {
        if (!profile.geelark_profile_id) {
          throw new Error(`No GeeLark profile ID found for profile ${profile.id}`)
        }

        // Start TikTok warm-up task
        const taskId = await geelarkApi.startTikTokWarmup(
          profile.geelark_profile_id, 
          profile.id, 
          options
        )

        // Update account status
        await supabaseAdmin
          .from('accounts')
          .update({ 
            status: 'warming_up',
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id)

        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'api-start-warmup',
          message: 'TikTok warm-up started',
          meta: { 
            task_id: taskId, 
            profile_id: profile.id,
            geelark_profile_id: profile.geelark_profile_id,
            duration_minutes: options?.duration_minutes || 30,
            action: options?.action || 'browse video'
          }
        })

        return { profile_id: profile.id, task_id: taskId }
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled')
    const failed = results.filter(r => r.status === 'rejected')

    if (failed.length > 0) {
      await supabaseAdmin.from('logs').insert({
        level: 'warning',
        component: 'api-start-warmup',
        message: `Some warm-up tasks failed to start`,
        meta: { 
          failed_count: failed.length, 
          errors: failed.map(f => {
            const reason = (f as PromiseRejectedResult).reason
            return {
              message: reason?.message || String(reason),
              stack: reason?.stack
            }
          })
        }
      })
    }

    return NextResponse.json({
      success: true,
      started: successful.length,
      failed: failed.length,
      results: successful.map(r => (r as PromiseFulfilledResult<any>).value),
      message: `Started warmup for ${successful.length} profile(s)`
    })
  } catch (error) {
    console.error('Start warm-up error:', error)
    
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    }
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-start-warmup',
      message: 'Failed to start warm-up',
      meta: { error: errorDetails }
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start warm-up' },
      { status: 500 }
    )
  }
}