# TikTok SMS Setup with DaisySMS

This document describes the automated TikTok setup feature that uses DaisySMS for phone number verification.

## Overview

The TikTok SMS Setup feature provides a one-click solution to:
1. Create a new GeeLark profile or use an existing one
2. Start the phone
3. Check if TikTok is installed (GeeLark handles installation automatically)
4. Rent a DaisySMS phone number
5. Initiate TikTok login with the rented number
6. Monitor for OTP verification codes
7. (Optional) Start warmup process after successful login

## Usage

### From the Profiles Page

1. Navigate to the **Profiles** page
2. Click the **TikTok SMS Setup** button in the header
3. Configure the setup options:
   - **Use Existing Profile**: Toggle to use an existing GeeLark profile
   - **Device Model**: Select device model (Pixel 6, Pixel 7, Galaxy S23)
   - **Android Version**: Choose Android version (10-13)
   - **Group Name**: Organize profiles into groups
   - **GeeLark Proxy ID**: Optional - Enter a saved proxy ID
   - **Warmup Duration**: Select warmup duration after login
4. Click **Start Setup**

### API Endpoint

You can also trigger the setup programmatically:

```bash
POST /api/automation/setup-tiktok-with-sms
```

Request body:
```json
{
  "use_existing_profile": false,
  "existing_profile_id": "profile-id",     // Required if use_existing_profile is true
  "device_model": "Pixel 6",               // Optional, default: "Pixel 6"
  "android_version": 3,                    // Optional, default: 3 (Android 12)
  "proxy_id": "geelark-proxy-id",          // Optional
  "group_name": "tiktok-sms",              // Optional, default: "tiktok-sms-setup"
  "tags": ["auto-setup", "sms"],           // Optional
  "remark": "Custom remark",               // Optional
  "region": "us",                          // Optional, default: "us"
  "warmup_duration_minutes": 30,           // Optional, default: 30
  "warmup_action": "browse video",         // Optional
  "warmup_keywords": ["keyword1"]          // Optional, for search actions
}
```

Response:
```json
{
  "success": true,
  "account_id": "uuid",
  "profile_id": "geelark-profile-id",
  "profile_name": "Profile Name",
  "phone_number": "+1234567890",
  "rental_id": "daisysms-rental-id",
  "tasks": [
    {
      "step": "Create Profile",
      "status": "success",
      "message": "Profile created: 22 ungrouped (123456)"
    },
    {
      "step": "Start Phone",
      "status": "success",
      "message": "Phone started successfully"
    },
    {
      "step": "Check TikTok Installation",
      "status": "success",
      "message": "TikTok is installed and ready"
    },
    {
      "step": "Rent Phone Number",
      "status": "success",
      "message": "Phone number rented: +1234567890"
    },
    {
      "step": "TikTok Login",
      "status": "success",
      "message": "Login ready with phone: +1234567890. Manual intervention may be required."
    },
    {
      "step": "Monitor OTP",
      "status": "success",
      "message": "OTP monitoring started. Check SMS rentals page for verification code."
    }
  ]
}
```

## Setup Steps

### 1. Create/Select Profile
- Either creates a new GeeLark profile or uses an existing one
- New profiles default to Pixel 6 with Android 12
- Assigns proxy if specified
- Creates database records for tracking

### 2. Start Phone
- Starts the GeeLark phone
- Waits 8 seconds for phone to fully initialize

### 3. Check TikTok Installation
- Polls to check if TikTok is installed
- GeeLark handles TikTok installation automatically
- Waits up to 2 minutes for TikTok to be installed
- Continues with setup even if TikTok is not yet installed

### 4. Rent DaisySMS Number
- Checks if rental limit (20) has been reached
- Rents a US phone number for 72 hours
- Stores rental information in database

### 5. Start TikTok Login
- Opens TikTok app
- Prepares for phone number login
- Updates account status to "pending_verification"

### 6. Monitor OTP
- Starts background monitoring for OTP codes
- Checks every 5 seconds for up to 10 minutes
- Updates database when OTP is received
- Displays OTP in SMS Rentals page

## Current Limitations

1. **Manual OTP Entry**: Currently, the OTP must be entered manually in the TikTok app. The GeeLark API doesn't support automated phone number login yet.

2. **Phone Number Only**: This setup only supports phone number verification, not email/password login.

3. **US Numbers Only**: DaisySMS integration currently only supports US phone numbers.

## Monitoring

### SMS Rentals Page
- View all active phone rentals
- See OTP codes when received
- Copy phone numbers and OTP codes
- Complete or cancel rentals

### Tasks Page
- Monitor the setup progress
- View any errors that occur
- Track task completion times

### Logs
- Detailed logs for each step
- Error tracking and debugging
- OTP reception notifications

## Best Practices

1. **DaisySMS Balance**: Ensure sufficient balance before starting
2. **Proxy Assignment**: Always assign a unique proxy for better success
3. **Concurrent Rentals**: Stay under the 20 rental limit
4. **OTP Timing**: Be ready to enter OTP within 10 minutes
5. **Profile Management**: Use descriptive group names for organization

## Troubleshooting

### "Maximum concurrent rentals reached"
- Complete or cancel existing rentals in SMS page
- Wait for rentals to expire (72 hours)

### "Failed to create profile"
- Check GeeLark API credentials
- Ensure you have available phone slots
- Verify proxy ID is valid

### "Failed to rent phone number"
- Check DaisySMS balance
- Verify API credentials are correct
- Ensure rental limit not reached

### "OTP not received"
- Check SMS Rentals page for updates
- Ensure phone number was entered correctly
- Try resending OTP in TikTok app
- Check if number is blocked by TikTok

## Integration with Existing Features

- **Profiles Page**: New profiles appear immediately
- **SMS Rentals**: All rentals tracked and manageable
- **Tasks Page**: Setup progress visible as tasks
- **Logs**: All actions logged for debugging

## Future Enhancements

1. **Automated OTP Entry**: When GeeLark API supports it
2. **Multiple Region Support**: Beyond US numbers
3. **Batch Setup**: Create multiple accounts in parallel
4. **Smart Retry**: Automatic retry on failures
5. **OTP Webhook**: Real-time OTP notifications

## Security Considerations

1. **Phone Numbers**: Temporary numbers only, never reused
2. **OTP Codes**: Stored securely, auto-expire
3. **Rate Limiting**: Respect DaisySMS limits
4. **Proxy Rotation**: Each account gets unique proxy
5. **Audit Trail**: All actions logged for compliance

### "Failed to install TikTok"
- Ensure phone is fully started
- Check if TikTok app is available in GeeLark
- Try manual installation from profile detail page

### "TikTok not installed"
- GeeLark should handle TikTok installation automatically
- Wait a few minutes for GeeLark to install TikTok
- Check if the phone has internet connectivity
- Verify the profile is properly configured 