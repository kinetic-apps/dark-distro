# TikTok Engagement Automation

This feature allows you to automate TikTok engagement (likes and comments) across multiple accounts simultaneously.

## Overview

The TikTok engagement automation enables you to:
- Search for specific TikTok usernames
- Like and comment on their recent posts
- Run the automation across multiple phone profiles in parallel
- Customize comments and engagement behavior

## Time Limits

- **Maximum Runtime**: 30 minutes per engagement session
- **No other restrictions** - the automation runs until completion or the 30-minute limit

## Setup

### 1. Upload RPA Task Flow to GeeLark

1. Upload one of the RPA JSON files to GeeLark:
   - `tiktok-search-like-comment-RPA.json` - Basic version
   - `tiktok-search-like-comment-RPA-v2.json` - Enhanced version with better error handling

2. Get the task flow ID from GeeLark after upload

3. Set the environment variable:
   ```bash
   TIKTOK_ENGAGE_FLOW_ID=569508002772551189
   ```
   
   Note: The current flow ID is `569508002772551189` (titled "ENGAGE" in GeeLark)

### RPA JSON Configuration

The RPA JSON files are configured to receive parameters from the API:

- **startParamMap**: Defines the parameters with empty default values
  - `usernames` (textarea): Empty array, populated by API with target usernames
  - `comment` (string): Empty string, populated by API with a random comment from the pool
  - `postsPerUser` (string): Default "3", can be overridden by API
  - `likeOnly` (string): Default "false", controls whether to only like without commenting

The parameters are dynamically populated when creating tasks via the API endpoint. The comment is automatically selected from the database pool for each phone to ensure variety.

### 2. Prepare Your Phones

Ensure all phones you want to use:
- Have TikTok installed
- Are logged into TikTok accounts
- Are tagged appropriately in your system

## API Usage

### Endpoint
```
POST /api/automation/tiktok-engage
```

### Request Body
```json
{
  "profile_ids": ["profile1", "profile2", "profile3"],
  "target_usernames": ["cristiano", "leomessi", "neymarjr"],
  "posts_per_user": 3,
  "like_only": false
}
```

### Parameters

- **profile_ids** (required): Array of GeeLark profile IDs to use
- **target_usernames** (required): Array of TikTok usernames to engage with (without @ symbol)
- **posts_per_user** (optional): Number of posts to engage with per user. Default: 3
- **like_only** (optional): If true, only likes posts without commenting. Default: false

### Comments System

Comments are now automatically selected from a pre-configured pool in the database:
- Each phone gets a unique, random comment from the pool
- Comments are categorized (positive, casual, emoji, supportive, etc.)
- Prevents all phones from posting identical comments
- Manage comments at `/settings/comments`

### Response
```json
{
  "success": true,
  "results": [
    {
      "profile_id": "profile1",
      "profile_name": "Phone 1",
      "task_id": "task123",
      "status": "success",
      "message": "Engagement task started successfully"
    }
  ],
  "summary": {
    "total_profiles": 3,
    "successful_tasks": 3,
    "failed_tasks": 0
  }
}
```

## Features

### Parallel Execution
- All selected phones will engage with the target users simultaneously
- Each phone operates independently

### Auto-Start Phones
- If a phone is not running, it will be automatically started
- The task is created immediately after starting the phone
- No artificial waits or complex timing logic

### Random Comment Selection
- Each phone gets a unique comment from the database pool
- Comments are randomly selected to appear more natural
- Over 100 pre-configured comments in various categories
- Usage tracking to monitor comment distribution

### Error Handling
- If a target username is not found, the task moves to the next username
- Failed tasks are logged and reported in the response

### Auto-Stop After Completion
- Phones are automatically stopped after the engagement task completes
- Monitors task status every 10 seconds for up to 30 minutes
- Updates account records and logs progress every 5 minutes
- If task runs longer than 30 minutes, it will timeout and stop the phone

## Integration with Frontend

To integrate with your profiles page:

1. Add a multi-select feature to your profiles table
2. Add an "Engage" button that opens a modal
3. In the modal, collect:
   - Target usernames (textarea, one per line)
   - Comments (pre-filled, editable)
   - Posts per user (number input)
   - Like only mode (checkbox)
4. Send the request to the API endpoint

Example frontend code:
```javascript
const handleEngage = async (selectedProfiles, config) => {
  const response = await fetch('/api/automation/tiktok-engage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile_ids: selectedProfiles,
      target_usernames: config.usernames.split('\n').filter(u => u.trim()),
      comments: config.comments,
      posts_per_user: config.postsPerUser,
      like_only: config.likeOnly
    })
  })
  
  const result = await response.json()
  // Handle result
}
```

## Monitoring

Tasks can be monitored through:
- The tasks page in your web app
- Database logs in the `tasks` table
- Account status updates in the `accounts` table
- System logs in the `logs` table

## Best Practices

1. **Reasonable Limits**: Don't engage with too many posts per user in a single session
2. **Varied Comments**: Use a diverse set of comments to appear more natural
3. **Target Selection**: Choose relevant targets for your account niche
4. **Timing**: Space out engagement sessions appropriately

## Troubleshooting

### Phone Won't Start
- Check if the profile exists in the database
- Verify GeeLark API credentials
- Check phone status in GeeLark dashboard

### Task Creation Fails
- Ensure the RPA flow ID is correctly set
- Verify TikTok is installed on the phone
- Check if the account is logged in

### Engagement Not Working
- Verify the RPA JSON is correctly formatted
- Check if target usernames exist
- Review task logs for specific errors

## Testing

Use the test endpoint to verify functionality:
```bash
curl -X POST http://localhost:3000/api/test/tiktok-engage-test \
  -H "Content-Type: application/json" \
  -d '{
    "profile_ids": ["your-profile-id"],
    "target_usernames": ["testuser1", "testuser2"]
  }'
``` 