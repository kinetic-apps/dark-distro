# Automated Phone Setup

This document describes the automated phone setup feature that orchestrates the complete setup of a new GeeLark phone from start to finish.

## Overview

The automated phone setup feature provides a one-click solution to:
1. Create a new GeeLark profile with Pixel 6 + Android 12 configuration
2. Start the phone
3. Install TikTok v39.1.0
4. Login to TikTok using available credentials
5. Start a warmup process

All tasks are executed synchronously and tracked in the tasks page.

## Usage

### From the Profiles Page

1. Navigate to the **Profiles** page
2. Click the **Setup Phone** button in the header
3. Configure the setup options:
   - **Group Name**: Organize profiles into groups (default: "automated-setup")
   - **GeeLark Proxy ID**: Optional - Enter a saved proxy ID or leave empty for auto-assignment
   - **TikTok Login Method**: Choose between using available credentials or custom email/password
   - **Warmup Duration**: Select how long the warmup should run (15min, 30min, 1hr, 2hr)
4. Click **Start Setup**

### API Endpoint

You can also trigger the setup programmatically:

```bash
POST /api/automation/setup-new-phone
```

Request body:
```json
{
  "device_model": "Pixel 6",           // Optional, default: "Pixel 6"
  "android_version": 3,                // Optional, default: 3 (Android 12)
  "proxy_id": "geelark-proxy-id",      // Optional, GeeLark saved proxy ID
  "group_name": "campaign-1",          // Optional, default: "automated-setup"
  "tags": ["auto-setup", "campaign"],  // Optional, default: ["auto-setup"]
  "remark": "Custom remark",           // Optional
  "auth_method": "tiktok",             // "tiktok" or "custom"
  "email": "user@example.com",         // Required if auth_method is "custom"
  "password": "password123",           // Required if auth_method is "custom"
  "warmup_duration_minutes": 30,       // Optional, default: 30
  "warmup_action": "browse video",     // Optional: "browse video", "search video", "search profile"
  "warmup_keywords": ["keyword1"]      // Optional, for search actions
}
```

Response:
```json
{
  "success": true,
  "account_id": "uuid",
  "profile_id": "geelark-profile-id",
  "profile_name": "Profile Name",
  "tasks": [
    {
      "step": "Create Profile",
      "status": "success",
      "message": "Profile created: 22 ungrouped (123456)",
      "task_id": null
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
      "message": "Login initiated with user@example.com",
      "task_id": "task-123"
    },
    {
      "step": "Start Warmup",
      "status": "success",
      "message": "Warmup started for 30 minutes",
      "task_id": "task-456"
    }
  ]
}
```

## Setup Steps

### 1. Create Profile
- Creates a new GeeLark profile with specified configuration
- Default: Pixel 6 with Android 12
- Assigns proxy if specified
- Creates database records for tracking

### 2. Start Phone
- Starts the GeeLark phone
- Waits 5 seconds for phone to fully initialize

### 3. Install TikTok
- Installs TikTok v39.1.0 (com.zhiliaoapp.musically)
- Waits 10 seconds for installation to complete
- Updates phone metadata with installed apps

### 4. TikTok Login
- Uses available TikTok credentials from database if auth_method is "tiktok"
- Or uses provided email/password if auth_method is "custom"
- Creates a login task that can be tracked
- Updates account status to "active"

### 5. Start Warmup
- Initiates warmup process for specified duration
- Default action is "browse video" for 30 minutes
- Updates account status to "warming_up"
- Creates a warmup task that can be tracked

## Error Handling

The setup process is designed to be resilient:
- Each step is executed independently
- Failures in non-critical steps (like TikTok installation) don't stop the entire process
- All errors are logged and returned in the response
- Tasks are tracked in the database for monitoring

## Task Tracking

All tasks created during setup are:
- Stored in the `tasks` table
- Visible on the Tasks page
- Can be monitored for completion/failure
- Include metadata about the setup flow

## Best Practices

1. **Proxy Assignment**: Always assign a proxy for better success rates
2. **Credentials**: Ensure TikTok credentials are available in the database
3. **Monitoring**: Check the Tasks page to monitor progress
4. **Error Recovery**: If a step fails, you can manually complete it from the profile detail page
5. **Batch Setup**: Run multiple setups with different proxy IDs for scaling

## Troubleshooting

### "No available TikTok credentials found"
- Add TikTok credentials to the `tiktok_credentials` table
- Or use custom email/password in the setup

### "Failed to create profile"
- Check GeeLark API credentials
- Ensure you have available phone slots
- Verify proxy ID is valid

### "Failed to install TikTok"
- Ensure phone is fully started
- Check if TikTok app is available in GeeLark
- Try manual installation from profile detail page

### "Login failed"
- Verify credentials are correct
- Check if account requires additional verification
- Monitor the task in Tasks page for specific error

## Integration with Existing Features

The automated setup integrates seamlessly with:
- **Tasks Page**: All tasks appear in the tasks list
- **Profile Detail**: Navigate to the new profile after setup
- **Logs**: All actions are logged for debugging
- **Notifications**: Real-time updates during setup process 