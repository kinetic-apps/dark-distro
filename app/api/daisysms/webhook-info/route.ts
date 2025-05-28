import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const currentWebhookUrl = `${protocol}://${host}/api/daisysms/webhook`
  const productionWebhookUrl = 'https://spectre-studio.app/api/daisysms/webhook'
  
  return NextResponse.json({
    production_webhook_url: productionWebhookUrl,
    current_webhook_url: currentWebhookUrl,
    is_local: host.includes('localhost'),
    instructions: [
      '1. Go to your DaisySMS profile page at https://daisysms.com',
      '2. Find the webhook URL field',
      '3. For PRODUCTION use: ' + productionWebhookUrl,
      '4. Save your profile',
      '5. DaisySMS will send SMS notifications to this endpoint'
    ],
    local_testing_options: [
      {
        method: 'ngrok',
        steps: [
          '1. Install ngrok: brew install ngrok',
          '2. Run: ngrok http 3000',
          '3. Use the ngrok URL in DaisySMS: https://YOUR-ID.ngrok.io/api/daisysms/webhook',
          '4. This allows local testing with real webhooks'
        ]
      },
      {
        method: 'production_webhook',
        steps: [
          '1. Use production URL in DaisySMS: ' + productionWebhookUrl,
          '2. Webhooks will write to production database',
          '3. Your local app can still read the OTPs from the database',
          '4. This is simpler but mixes local/prod data'
        ]
      }
    ],
    test_webhook: {
      method: 'POST',
      url: currentWebhookUrl,
      sample_payload: {
        activationId: 123,
        messageId: 999,
        service: 'lf',
        text: 'Your TikTok code is 123456',
        code: '123456',
        country: 0,
        receivedAt: '2025-05-28 12:00:00'
      }
    },
    test_command: `curl -X POST ${currentWebhookUrl} -H "Content-Type: application/json" -d '{"activationId":123,"messageId":999,"service":"lf","text":"Your TikTok code is 123456","code":"123456","country":0,"receivedAt":"2025-05-28 12:00:00"}'`,
    notes: [
      'Webhook is CRITICAL for OTP delivery - without it, you will NOT receive codes!',
      'DaisySMS will retry webhook up to 8 times if it fails',
      'Make sure your webhook returns 200 status to prevent retries',
      'Check logs with: SELECT * FROM logs WHERE component = \'daisysms-webhook\' ORDER BY timestamp DESC'
    ]
  })
} 