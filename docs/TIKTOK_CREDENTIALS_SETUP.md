# TikTok Credentials Setup

This document describes the automated TikTok setup feature that uses email/password authentication from the TikTok credentials database.

## Overview

The TikTok Credentials Setup feature provides a one-click solution to:
1. Get available TikTok credentials from the database
2. Create a new GeeLark profile or use an existing one
3. Start the phone
4. Install TikTok v39.1.0
5. Login with email/password automatically
6. Monitor login status
7. (Optional) Start warmup process after successful login

## Prerequisites

### 1. TikTok Credentials
You must have active TikTok credentials in the database. Add them via:
- **UI**: Navigate to TikTok Credentials page and add manually or import from Excel
- **Database**: Insert directly into `tiktok_credentials` table with status='active'

### 2. Proxies (Recommended)
While optional, proxies are highly recommended for TikTok accounts:
- **SIM/Mobile proxies**: Best for TikTok (lowest ban risk)
- **Sticky proxies**: Good for consistency
- **Rotating proxies**: Not recommended for TikTok

## Usage

### From the Profiles Page

1. Navigate to the **Profiles** page
2. Click the **TikTok Credentials Setup** button in the header
3. Configure the setup options:
   - **Use Existing Profile**: Toggle to use an existing GeeLark profile
   - **Device Model**: Select device model (Pixel 6, Pixel 7, Galaxy S23)
   - **Android Version**: Choose Android version (10-13)
   - **Group Name**: Organize profiles into groups
   - **Proxy Configuration**: Choose proxy source (Auto, Database, GeeLark, Manual)
   - **Warmup Duration**: Select warmup duration after login (0-120 minutes)
   - **Warmup Action**: Choose warmup behavior (browse/search videos/profiles)
4. Click **Start Setup**

### API Endpoint

You can also trigger the setup programmatically:

```bash
POST /api/automation/setup-tiktok-with-credentials
```

Request body:
```json
{
  "use_existing_profile": false,
  "existing_profile_id": "profile-id",     // Required if use_existing_profile is true
  "device_model": "Pixel 6",               // Optional, default: "Pixel 6"
  "android_version": 3,                    // Optional, default: 3 (Android 12)
  "group_name": "tiktok-credentials",      // Optional
  "tags": ["auto-setup", "credentials"],   // Optional
  "remark": "Custom remark",               // Optional
  "region": "us",                          // Optional, default: "us"
  
  // Proxy options (choose one)
  "assign_proxy": true,                    // Auto-assign from database
  "proxy_type": "sim",                     // Proxy type preference for auto-assign
  "database_proxy_id": "uuid",             // Use specific database proxy
  "proxy_id": "geelark-proxy-id",          // Use GeeLark proxy
  "proxy_config": {                        // Manual proxy config
    "typeId": 1,
    "server": "proxy.host",
    "port": 1080,
    "username": "user",
    "password": "pass"
  },
  
  // Credential options
  "credential_id": "uuid",                 // Optional, use specific credential
  
  // Warmup options
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
  "credential_email": "user@example.com",
  "credential_id": "credential-uuid",
  "login_task_id": "geelark-task-id",
  "tasks": [
    {
      "step": "Get Credentials",
      "status": "success",
      "message": "Using TikTok credentials: user@example.com"
    },
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
      "step": "Install TikTok",
      "status": "success",
      "message": "TikTok v39.1.0 installed successfully"
    },
    {
      "step": "TikTok Login",
      "status": "success",
      "message": "Login initiated with email: user@example.com, task ID: 123456"
    },
    {
      "step": "Monitor Login",
      "status": "success",
      "message": "Login monitoring started. Checking task status..."
    }
  ]
}
```

## Setup Steps

### 1. Get TikTok Credentials
- Fetches the next available active credential (least recently used)
- Or uses a specific credential if `credential_id` is provided
- Updates `last_used_at` timestamp to track usage

### 2. Create/Select Profile
- Either creates a new GeeLark profile or uses an existing one
- New profiles default to Pixel 6 with Android 12
- Assigns proxy based on configuration
- Creates database records for tracking

### 3. Start Phone
- Starts the GeeLark phone
- Waits for phone to be fully running (status = 0)
- Adds 5-second stabilization delay

### 4. Install TikTok
- Checks if TikTok is already installed
- Installs TikTok v39.1.0 (com.zhiliaoapp.musically) if needed
- Polls installation status for up to 60 seconds

### 5. Login with Email/Password
- Starts TikTok app
- Initiates login using GeeLark's `tiktokLogin` API
- Creates a login task that can be monitored
- Updates account status to "logging_in"

### 6. Monitor Login Status
- Background process monitors the login task
- Checks task status every 5 seconds for up to 10 minutes
- Updates account status based on results:
  - `active`: Login successful
  - `login_failed`: Login failed with error details
- Starts warmup if configured and login successful

## Monitoring

### Tasks Page
- View all automation tasks including login tasks
- Monitor task progress and status
- See failure reasons if login fails

### Logs
- Detailed logs for each step with component `automation-tiktok-credentials`
- Monitor logs with component `automation-tiktok-credentials-monitor`
- Login task status updates and errors

### Account Status
The account status reflects the current state:
- `new`: Profile created, not yet logged in
- `logging_in`: Login in progress
- `active`: Successfully logged in
- `login_failed`: Login failed (check meta for details)
- `warming_up`: Login successful, warmup in progress

## Credential Management

### Adding Credentials
1. Navigate to TikTok Credentials page
2. Click "Add Credential" or import from Excel
3. Ensure credentials have status='active'

### Credential Rotation
- System automatically uses least recently used credential
- `last_used_at` timestamp tracks usage
- Credentials remain available for reuse

### Credential Status
- `active`: Available for use
- `inactive`: Temporarily disabled
- `suspended`: Account issues, do not use

## Best Practices

1. **Proxy Assignment**: Always use unique proxies per account
2. **Credential Quality**: Test credentials manually before bulk import
3. **Warmup Duration**: Use at least 30 minutes warmup for new accounts
4. **Monitoring**: Check logs and task status for any issues
5. **Rate Limiting**: Don't create too many accounts too quickly

## Troubleshooting

### "No available TikTok credentials found"
- Check TikTok Credentials page for active credentials
- Ensure credentials have status='active'
- Add new credentials if needed

### "Failed to create profile"
- Check GeeLark API credentials
- Ensure you have available phone slots
- Verify proxy configuration

### "Login task failed"
Common failure codes:
- `20130`: Account password is wrong
- `20136`: Account blocked
- `20144`: Incorrect account or password
- `20264`: Account temporarily restricted

Solutions:
- Verify credential is correct
- Check if account needs captcha/verification
- Try different credential
- Use different proxy

### "Login monitoring timeout"
- Login task may still be running
- Check Tasks page for current status
- Manual intervention may be required

## Comparison with SMS Setup

| Feature | Credentials Setup | SMS Setup |
|---------|------------------|-----------|
| Authentication | Email/Password | Phone/OTP |
| Automation | Fully automated | Requires manual OTP entry |
| Speed | Faster (no OTP wait) | Slower (wait for SMS) |
| Cost | Free (own credentials) | ~$0.50-1.00 per number |
| Success Rate | High (if credentials valid) | Depends on SMS delivery |
| Account Quality | Depends on credential age | Fresh accounts |

## Integration with Existing Features

- **Profiles Page**: New profiles appear immediately
- **Tasks Page**: Login tasks tracked and visible
- **Logs**: All actions logged for debugging
- **Warmup**: Automatic warmup after successful login

## Security Considerations

1. **Credential Storage**: Passwords stored securely in database
2. **Access Control**: Only authorized users can trigger setup
3. **Rate Limiting**: Respect GeeLark and TikTok limits
4. **Proxy Isolation**: Each account gets unique proxy
5. **Audit Trail**: All actions logged for compliance

## Future Enhancements

1. **Batch Setup**: Create multiple accounts in parallel
2. **Credential Validation**: Pre-check credentials before use
3. **Smart Retry**: Automatic retry with different credentials
4. **Profile Templates**: Save and reuse setup configurations
5. **Advanced Warmup**: Custom warmup scripts and behaviors 