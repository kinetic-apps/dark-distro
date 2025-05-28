import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { geelarkApi } from '@/lib/geelark-api'
import { daisyApi } from '@/lib/daisy-api'

export async function GET(request: NextRequest) {
  try {
    // Find accounts that are warming up or recently warmed up
    const { data: accounts, error } = await supabaseAdmin
      .from('accounts')
      .select(`
        *,
        sms_rentals!sms_rentals_account_id_fkey(*)
      `)
      .in('status', ['warming_up', 'active'])
      .not('geelark_profile_id', 'is', null)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

    if (error) throw error

    const results = await Promise.allSettled(
      accounts.map(async (account) => {
        try {
          // Check if there's a failed warmup task with login error
          const { data: failedTasks } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .eq('account_id', account.id)
            .eq('type', 'warmup')
            .eq('status', 'failed')
            .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour

          const loginFailedTask = failedTasks?.find(task => 
            task.meta?.failCode === 20116 || // Account not logged in
            task.meta?.failDesc?.includes('not logged in')
          )

          if (loginFailedTask) {
            console.log(`Account ${account.id} detected as logged out during warmup`)

            // Check if we have an active SMS rental
            const activeRental = account.sms_rentals?.find((rental: any) => 
              rental.status === 'waiting' || rental.status === 'received'
            )

            if (activeRental) {
              // We have an active rental, attempt to re-login
              await supabaseAdmin.from('logs').insert({
                level: 'warning',
                component: 'login-monitor',
                account_id: account.id,
                message: 'Account logged out during warmup, attempting recovery',
                meta: {
                  rental_id: activeRental.rental_id,
                  phone_number: activeRental.phone_number,
                  profile_id: account.geelark_profile_id
                }
              })

              // Update account status
              await supabaseAdmin
                .from('accounts')
                .update({
                  status: 'needs_relogin',
                  meta: {
                    ...account.meta,
                    logout_detected_at: new Date().toISOString(),
                    recovery_rental_id: activeRental.rental_id
                  }
                })
                .eq('id', account.id)

              // TODO: Implement automated re-login when GeeLark supports it
              // For now, we'll flag it for manual intervention

              return {
                account_id: account.id,
                status: 'logout_detected',
                has_active_rental: true,
                rental_expires_at: activeRental.expires_at
              }
            } else {
              // No active rental, mark account as needing new setup
              await supabaseAdmin
                .from('accounts')
                .update({
                  status: 'logged_out',
                  meta: {
                    ...account.meta,
                    logout_detected_at: new Date().toISOString()
                  }
                })
                .eq('id', account.id)

              await supabaseAdmin.from('logs').insert({
                level: 'error',
                component: 'login-monitor',
                account_id: account.id,
                message: 'Account logged out and no active SMS rental available',
                meta: {
                  profile_id: account.geelark_profile_id
                }
              })

              return {
                account_id: account.id,
                status: 'logout_detected',
                has_active_rental: false
              }
            }
          }

          return {
            account_id: account.id,
            status: 'logged_in'
          }
        } catch (error) {
          console.error(`Error checking account ${account.id}:`, error)
          return {
            account_id: account.id,
            status: 'error',
            error: String(error)
          }
        }
      })
    )

    const loggedOutAccounts = results.filter(r => 
      r.status === 'fulfilled' && 
      r.value.status === 'logout_detected'
    ).length

    return NextResponse.json({
      success: true,
      checked: accounts.length,
      logged_out: loggedOutAccounts,
      results: results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean)
    })

  } catch (error) {
    console.error('Login monitoring error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'login-monitor',
      message: 'Failed to monitor login status',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to monitor login status' },
      { status: 500 }
    )
  }
} 