import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    // Test 1: Check service availability for TikTok
    const servicesUrl = new URL(process.env.DAISYSMS_API_BASE_URL!)
    servicesUrl.searchParams.append('api_key', process.env.DAISYSMS_API_KEY!)
    servicesUrl.searchParams.append('action', 'getPricesVerification')
    
    const servicesResponse = await fetch(servicesUrl.toString())
    const services = await servicesResponse.json()
    
    // Find TikTok service
    let tiktokService = null
    for (const [code, countryData] of Object.entries(services)) {
      if (typeof countryData === 'object' && countryData !== null) {
        const usaData = (countryData as any)['187'] // USA
        if (usaData && usaData.name && usaData.name.toLowerCase().includes('tiktok')) {
          tiktokService = { code, ...usaData }
          break
        }
      }
    }
    
    // Test 2: Check recent rentals
    const { data: recentRentals } = await supabaseAdmin
      .from('sms_rentals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)
    
    // Test 3: Check webhook logs
    const { data: webhookLogs } = await supabaseAdmin
      .from('logs')
      .select('*')
      .eq('component', 'daisysms-webhook')
      .order('timestamp', { ascending: false })
      .limit(5)
    
    // Test 4: Check if any rentals received OTP
    const { data: successfulRentals } = await supabaseAdmin
      .from('sms_rentals')
      .select('*')
      .not('otp', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5)
    
    // Test 5: Check balance
    const balanceUrl = new URL(process.env.DAISYSMS_API_BASE_URL!)
    balanceUrl.searchParams.append('api_key', process.env.DAISYSMS_API_KEY!)
    balanceUrl.searchParams.append('action', 'getBalance')
    
    const balanceResponse = await fetch(balanceUrl.toString())
    const balanceText = await balanceResponse.text()
    const balance = balanceText.startsWith('ACCESS_BALANCE:') 
      ? parseFloat(balanceText.split(':')[1]) 
      : null
    
    return NextResponse.json({
      success: true,
      tests: {
        tiktok_service: tiktokService || { error: 'TikTok service not found', lf_service: services.lf },
        current_balance: balance,
        recent_rentals: {
          count: recentRentals?.length || 0,
          rentals: recentRentals?.map(r => ({
            rental_id: r.rental_id,
            phone: r.phone_number,
            status: r.status,
            otp: r.otp,
            created: r.created_at,
            service: r.service
          }))
        },
        webhook_logs: {
          count: webhookLogs?.length || 0,
          logs: webhookLogs?.map(l => ({
            timestamp: l.timestamp,
            message: l.message,
            meta: l.meta
          }))
        },
        successful_otps: {
          count: successfulRentals?.length || 0,
          rentals: successfulRentals?.map(r => ({
            rental_id: r.rental_id,
            phone: r.phone_number,
            otp: r.otp,
            created: r.created_at
          }))
        }
      },
      recommendations: [
        'Ensure webhook is configured in DaisySMS profile',
        'Try manual login with rented number to test',
        'Check if TikTok requires different verification method',
        'Monitor webhook endpoint for incoming SMS'
      ]
    })
  } catch (error) {
    console.error('DaisySMS test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
} 