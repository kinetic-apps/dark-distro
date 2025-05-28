# TikTok SMS Setup Guide

## Overview

The TikTok SMS setup feature automates most of the account creation process. While GeeLark docs don't mention phone login support, we attempt it anyway - it might work!

## Update: Phone Login Attempts

⚠️ **We now attempt phone login via the GeeLark API**
- Even though docs only mention email/password, we try phone numbers
- The system will attempt multiple formats (with/without country code)
- If it works, great! If not, manual login is still required

## Setup Process

### Automated Steps ✅
1. Create/select GeeLark profile
2. Start the phone
3. Install TikTok (v39.1.0)
4. Start TikTok app
5. Rent DaisySMS number
6. **Attempt phone login via API** (new!)
7. Monitor for OTP (background)

### Manual Steps (if API login fails) ❌
1. Navigate to TikTok login screen on the phone
2. Select "Use phone or email"
3. Enter the phone number **WITHOUT country code**
   - Example: If DaisySMS gives you `13476711222`, enter `3476711222`
4. Request verification code
5. Wait for OTP to appear in SMS rentals page

## Prerequisites

### 1. Configure DaisySMS Webhook
**This is CRITICAL for receiving OTPs!**

1. Go to https://daisysms.com and log in
2. Navigate to your profile settings
3. Set webhook URL to: `https://spectre-studio.app/api/daisysms/webhook`
4. Save your profile

### 2. Verify DaisySMS Balance
- Ensure you have sufficient balance
- Each rental costs approximately $0.50-$1.00

### 3. GeeLark Phone Requirements
- Phone must be running
- TikTok must be installed
- Proxy should be configured (if required)

## Testing the Setup

### 1. Test Phone Login Formats
```bash
curl -X POST http://localhost:3000/api/test/tiktok-phone-login-test \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "YOUR_PROFILE_ID",
    "phone_number": "13476711222"
  }'
```

This will test multiple phone number formats to see what works.

### 2. Debug TikTok Login Flow
```bash
curl -X POST http://localhost:3000/api/test/tiktok-login-debug \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "YOUR_PROFILE_ID",
    "action": "all"
  }'
```

### 3. Monitor Logs
Check these log components:
- `automation-tiktok-sms` - Main setup process
- `automation-tiktok-sms-monitor` - OTP monitoring (now checks login task status!)
- `daisysms-webhook` - Incoming SMS webhooks
- `daisy-api` - DaisySMS API calls

## What's New

### Phone Login Attempts
The system now tries to login with phone numbers in these formats:
1. Full number with country code (e.g., `13476711222`)
2. Without country code (e.g., `3476711222`)
3. With + prefix (e.g., `+13476711222`)
4. With dummy password (in case it's required)

### Enhanced Monitoring
- Monitors GeeLark login task status
- Tracks if phone login succeeds or fails
- Automatically falls back to manual process if needed

## Troubleshooting

### Not Receiving OTPs?

1. **Check Login Task Status**
   - Look for login task logs in the monitoring component
   - Check if the task completed or failed
   - Failed tasks mean manual login is required

2. **Check Webhook Configuration**
   - Verify webhook URL is set in DaisySMS profile
   - Test webhook with sample payload
   - Check webhook logs for incoming messages

3. **Verify Phone Number Format**
   - System tries multiple formats automatically
   - For manual entry: use 10-digit US numbers WITHOUT country code

4. **Check Rental Status**
   - Ensure rental is active in SMS rentals page
   - Verify rental hasn't expired (15-minute timeout)

### Common Issues

1. **"Login task failed"**
   - Phone login might not be supported
   - Fall back to manual login process
   - Consider using email/password instead

2. **"No OTP received after 20 minutes"**
   - Check if login task succeeded
   - Manual login step may be required
   - TikTok might have blocked the number

3. **"Webhook not receiving messages"**
   - Webhook URL not configured in DaisySMS
   - Local development without ngrok
   - Firewall blocking webhooks

## Alternative: Email/Password Login

For guaranteed automated login, use email/password credentials:

1. Add TikTok credentials to the system
2. Set authentication method to "tiktok" in settings
3. The system will use email/password login automatically

## Development Notes

### Testing Phone Login
Use the dedicated test endpoint to check if phone login works:
```bash
/api/test/tiktok-phone-login-test
```

### Local Testing with Webhooks

Option 1: Use ngrok
```bash
ngrok http 3000
# Use the ngrok URL in DaisySMS settings
```

Option 2: Use production webhook
- Set production URL in DaisySMS
- Webhooks write to production database
- Local app reads from production database

### API Endpoints

- `/api/automation/setup-tiktok-with-sms` - Main setup endpoint (now attempts phone login!)
- `/api/test/tiktok-phone-login-test` - Test phone login formats
- `/api/daisysms/webhook` - Webhook receiver
- `/api/daisysms/check-otp/[id]` - Check OTP status
- `/api/test/tiktok-login-debug` - Debug helper

### Database Tables

- `sms_rentals` - SMS rental records
- `accounts` - Account status and metadata
- `logs` - Detailed operation logs
- `tasks` - GeeLark task tracking (now includes login tasks!)

## Future Improvements

1. **Smart Format Detection**: Automatically determine best phone format
2. **OCR Integration**: Read OTP from screenshots
3. **Multiple Phone Support**: Parallel account creation
4. **Auto-retry Logic**: Handle common failures automatically 