import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('DaisySMS webhook received:', JSON.stringify(body, null, 2))
    
    // Log the webhook data
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'daisysms-webhook',
      message: 'Webhook received',
      meta: body
    })
    
    // Extract data from webhook
    const { activationId, messageId, service, text, code, country, receivedAt } = body
    
    if (activationId && code) {
      // Update the rental with the received OTP
      const { data: rental } = await supabaseAdmin
        .from('sms_rentals')
        .select('*')
        .eq('rental_id', String(activationId))
        .single()
      
      if (rental) {
        await supabaseAdmin
          .from('sms_rentals')
          .update({
            otp: code,
            status: 'received',
            meta: {
              ...rental.meta,
              webhook_received: true,
              message_text: text,
              received_at: receivedAt
            },
            updated_at: new Date().toISOString()
          })
          .eq('rental_id', String(activationId))
        
        console.log(`OTP updated for rental ${activationId}: ${code}`)
        
        // If there's an associated account, update it too
        if (rental.account_id) {
          await supabaseAdmin
            .from('accounts')
            .update({
              status: 'otp_received',
              meta: {
                otp_code: code,
                otp_received_at: receivedAt
              }
            })
            .eq('id', rental.account_id)
        }
      }
    }
    
    // Return success to DaisySMS
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('DaisySMS webhook error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'daisysms-webhook',
      message: 'Webhook processing failed',
      meta: { error: String(error) }
    })
    
    // Still return 200 to prevent retries
    return NextResponse.json({ success: false, error: String(error) }, { status: 200 })
  }
} 