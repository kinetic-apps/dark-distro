import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  let profile_ids: string[] = []
  let action: string = ''
  
  try {
    const body = await request.json()
    profile_ids = body.profile_ids
    action = body.action

    if (!Array.isArray(profile_ids) || profile_ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid profile IDs' },
        { status: 400 }
      )
    }

    if (!['start', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "start" or "stop"' },
        { status: 400 }
      )
    }

    // Check if these are account IDs (UUIDs) or GeeLark profile IDs
    const isUUID = profile_ids[0].includes('-')
    let geelarkProfileIds = profile_ids

    if (isUUID) {
      // These are account IDs, we need to fetch GeeLark profile IDs
      const { data: accounts, error: fetchError } = await supabaseAdmin
        .from('accounts')
        .select('id, geelark_profile_id, tiktok_username')
        .in('id', profile_ids)
        .not('geelark_profile_id', 'is', null)

      if (fetchError) {
        throw new Error(`Failed to fetch accounts: ${fetchError.message}`)
      }

      if (!accounts || accounts.length === 0) {
        return NextResponse.json(
          { 
            error: 'No valid profiles found',
            success: false,
            results: {
              total: profile_ids.length,
              success: 0,
              failed: profile_ids.length,
              failures: profile_ids.map(id => ({
                id,
                msg: 'Profile not found or no GeeLark ID',
                code: 404
              }))
            }
          },
          { status: 400 }
        )
      }

      // Map account IDs to GeeLark profile IDs
      geelarkProfileIds = accounts.map(acc => acc.geelark_profile_id!)
      
      // Log the mapping for debugging
      console.log('Mapped account IDs to GeeLark IDs:', {
        accountIds: profile_ids,
        geelarkIds: geelarkProfileIds,
        accounts: accounts.map(a => ({ id: a.id, geelark_id: a.geelark_profile_id, name: a.tiktok_username }))
      })
    }

    // Execute the action with GeeLark profile IDs
    let result
    try {
      result = action === 'start' 
        ? await geelarkApi.startPhones(geelarkProfileIds)
        : await geelarkApi.stopPhones(geelarkProfileIds)
    } catch (error) {
      // Handle GeeLark API errors
      console.error('GeeLark API error:', error)
      
      // If it's a GeeLark error, try to parse the error details
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Log the error
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'api-phone-control',
        message: `GeeLark API error during phone ${action}`,
        meta: {
          action,
          error: errorMessage,
          account_ids: isUUID ? profile_ids : undefined,
          geelark_ids: geelarkProfileIds
        }
      })
      
      // Return a user-friendly error
      return NextResponse.json({
        success: false,
        action,
        message: `Failed to ${action} phones: ${errorMessage}`,
        results: {
          total: geelarkProfileIds.length,
          success: 0,
          failed: geelarkProfileIds.length,
          failures: geelarkProfileIds.map(id => ({
            id,
            msg: 'GeeLark API error - profile may not exist in GeeLark',
            code: 50000
          }))
        }
      }, { status: 400 })
    }

    // Update phone status in database
    if (result.successDetails && result.successDetails.length > 0) {
      await Promise.all(
        result.successDetails.map(async (detail: any) => {
          await supabaseAdmin
            .from('phones')
            .update({
              status: action === 'start' ? 'online' : 'offline',
              updated_at: new Date().toISOString()
            })
            .eq('profile_id', detail.id)
        })
      )
    }

    // Map failure details to include more context
    const enhancedFailures = result.failDetails?.map((failure: any) => {
      let enhancedMsg = failure.msg || 'Unknown error'
      
      // Add more context based on error codes
      if (failure.code === 50000) {
        enhancedMsg = 'Server error - profile may not exist in GeeLark or is corrupted'
      } else if (failure.code === 42001) {
        enhancedMsg = 'Cloud phone does not exist in GeeLark'
      } else if (failure.code === 40005) {
        enhancedMsg = 'Environment has been deleted'
      }
      
      return {
        ...failure,
        msg: enhancedMsg
      }
    }) || []

    // Determine log level based on results
    const hasFailures = result.failAmount > 0
    const allFailed = result.failAmount === result.totalAmount
    const logLevel = allFailed ? 'error' : hasFailures ? 'warning' : 'info'

    // Log the operation
    await supabaseAdmin.from('logs').insert({
      level: logLevel,
      component: 'api-phone-control',
      message: `Phone ${action} operation completed`,
      meta: {
        action,
        total: result.totalAmount,
        success: result.successAmount,
        failed: result.failAmount,
        failures: enhancedFailures,
        account_ids: isUUID ? profile_ids : undefined,
        geelark_ids: geelarkProfileIds
      }
    })

    // Return appropriate response based on results
    const response = {
      success: result.failAmount === 0,
      action,
      message: result.failAmount === 0 
        ? `Successfully ${action}ed ${result.successAmount} phone(s)`
        : result.successAmount === 0
          ? `Failed to ${action} all phones`
          : `${action}ed ${result.successAmount} phone(s), ${result.failAmount} failed`,
      results: {
        total: result.totalAmount,
        success: result.successAmount,
        failed: result.failAmount,
        failures: enhancedFailures,
        successes: result.successDetails
      }
    }

    // If all operations failed, return error status
    if (allFailed) {
      return NextResponse.json(response, { status: 400 })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Phone control error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-phone-control',
      message: 'Failed to control phones',
      meta: { 
        error: String(error),
        profile_ids: profile_ids,
        action: action
      }
    })

    return NextResponse.json(
      { 
        error: 'Failed to control phones',
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 