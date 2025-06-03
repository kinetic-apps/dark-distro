import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profile_ids } = body

    if (!Array.isArray(profile_ids) || profile_ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid profile IDs' },
        { status: 400 }
      )
    }

    if (profile_ids.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 profile IDs allowed' },
        { status: 400 }
      )
    }

    // Get phone status from GeeLark
    const statusResult = await geelarkApi.getPhoneStatus(profile_ids)

    // Map status codes to readable strings
    const statusMap: { [key: number]: string } = {
      0: 'started',
      1: 'starting',
      2: 'stopped',
      3: 'expired'
    }

    // Check if statusResult has the expected structure
    if (!statusResult || typeof statusResult !== 'object') {
      console.error('Invalid status result structure:', statusResult)
      throw new Error('Invalid response from GeeLark API')
    }

    // Process successful results
    const phoneStatuses = statusResult.successDetails?.map((detail: any) => ({
      profile_id: detail.id,
      name: detail.serialName,
      status: statusMap[detail.status] || 'unknown',
      status_code: detail.status
    })) || []

    // Add failed results with 'error' status
    const failedStatuses = statusResult.failDetails?.map((detail: any) => ({
      profile_id: detail.id,
      status: 'error',
      status_code: -1,
      error: detail.msg,
      error_code: detail.code
    })) || []

    const allStatuses = [...phoneStatuses, ...failedStatuses]

    // Update phone status in database
    await Promise.all(
      phoneStatuses.map(async (status: any) => {
        await supabaseAdmin
          .from('phones')
          .update({
            meta: {
              ...(await supabaseAdmin
                .from('phones')
                .select('meta')
                .eq('profile_id', status.profile_id)
                .single()
                .then(res => res.data?.meta || {})),
              phone_status: status.status,
              phone_status_updated_at: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('profile_id', status.profile_id)
      })
    )

    return NextResponse.json({
      success: true,
      total: statusResult.totalAmount,
      successful: statusResult.successAmount,
      failed: statusResult.failAmount,
      statuses: allStatuses
    }, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Phone status error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'api-phone-status',
      message: 'Failed to get phone status',
      meta: { error: String(error) }
    })

    return NextResponse.json(
      { error: 'Failed to get phone status' },
      { status: 500 }
    )
  }
} 