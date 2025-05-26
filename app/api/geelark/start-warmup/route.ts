import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_ids, options } = body

    if (!Array.isArray(account_ids) || account_ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid account IDs' },
        { status: 400 }
      )
    }

    // Fetch accounts with their profiles
    const { data: accounts, error } = await supabaseAdmin
      .from('accounts')
      .select('*, phones(*)')
      .in('id', account_ids)
      .in('status', ['new', 'ready'])

    if (error) throw error

    const results = await Promise.allSettled(
      accounts.map(async (account) => {
        if (!account.phones?.[0]?.profile_id) {
          throw new Error(`No profile found for account ${account.id}`)
        }

        const profileId = account.phones[0].profile_id

        // Start TikTok warm-up task
        const taskId = await geelarkApi.startTikTokWarmup(profileId, account.id, options)

        // Update account status
        await supabaseAdmin
          .from('accounts')
          .update({ 
            status: 'warming_up',
            updated_at: new Date().toISOString()
          })
          .eq('id', account.id)

        await supabaseAdmin.from('logs').insert({
          level: 'info',
          component: 'api-start-warmup',
          account_id: account.id,
          message: 'TikTok warm-up started',
          meta: { 
            task_id: taskId, 
            profile_id: profileId,
            duration_minutes: options?.duration_minutes || 30,
            actions: options?.actions || ['browse', 'like', 'follow', 'comment', 'watch']
          }
        })

        return { account_id: account.id, task_id: taskId }
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled')
    const failed = results.filter(r => r.status === 'rejected')

    if (failed.length > 0) {
      await supabaseAdmin.from('logs').insert({
        level: 'warning',
        component: 'api-start-warmup',
        message: `Some warm-up tasks failed to start`,
        meta: { failed_count: failed.length, errors: failed.map(f => f.reason) }
      })
    }

    return NextResponse.json({
      success: true,
      started: successful.length,
      failed: failed.length,
      results: successful.map(r => r.value)
    })
  } catch (error) {
    console.error('Start warm-up error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-start-warmup',
      message: 'Failed to start warm-up',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to start warm-up' },
      { status: 500 }
    )
  }
}