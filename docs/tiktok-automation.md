# TikTok Automation with GeeLark

This document describes the TikTok automation features integrated with GeeLark cloud phones and DaisySMS for phone verification.

## Overview

The TikTok automation system provides the following capabilities:

1. **Install TikTok App** - Install specific version (39.1.0) on GeeLark profiles
2. **Automated Login** - Login to TikTok using phone numbers with automatic OTP verification via DaisySMS
3. **Account Warmup** - Run automated warmup activities to establish account credibility
4. **Content Posting** - Post carousels (2-35 images) and videos to TikTok
5. **Task Tracking** - Monitor all automation tasks and their status

## Features

### 1. TikTok App Installation

Install TikTok version 39.1.0 on GeeLark profiles:

```bash
POST /api/geelark/install-app
{
  "profile_ids": ["profile-id"],
  "app_package": "com.ss.android.ugc.trill",
  "version": "39.1.0"
}
```

### 2. Automated Login with OTP

Login to TikTok with automatic OTP handling:

```bash
POST /api/geelark/tiktok-login
{
  "account_id": "account-uuid",
  "profile_id": "geelark-profile-id",
  "phone_number": "+1234567890",  # Optional - uses DaisySMS if not provided
  "otp_code": "123456"            # Optional - waits for SMS if not provided
}
```

The system will:
- Use existing DaisySMS rental or rent a new number if phone_number is not provided
- Automatically check for incoming OTP codes for up to 5 minutes
- Complete the login process once OTP is received

### 3. Account Warmup

Start automated warmup activities:

```bash
POST /api/geelark/start-warmup
{
  "account_ids": ["account-uuid"],
  "options": {
    "duration_minutes": 30,
    "actions": ["browse", "like", "follow", "comment", "watch"]
  }
}
```

Warmup activities include:
- Browsing the For You page
- Liking posts
- Following accounts
- Commenting on posts
- Watching videos

### 4. Content Posting

#### Post Carousel (2-35 images)

```bash
POST /api/geelark/post-carousel
{
  "account_id": "account-uuid",
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "caption": "Check out these photos!",
  "hashtags": ["tiktok", "viral", "fyp"],
  "music": "music-id"  # Optional
}
```

#### Post Video

```bash
POST /api/geelark/post-video
{
  "account_id": "account-uuid",
  "video_url": "https://example.com/video.mp4",
  "caption": "Amazing video!",
  "hashtags": ["tiktok", "viral", "fyp"],
  "music": "music-id"  # Optional
}
```

## UI Components

### TikTok Actions Component

The `TikTokActions` component provides a user-friendly interface for all automation features:

```tsx
import { TikTokActions } from '@/components/tiktok-actions'

<TikTokActions
  accountId="account-uuid"
  profileId="geelark-profile-id"
  onActionComplete={() => {
    // Refresh data
  }}
/>
```

Features:
- Install TikTok button
- Login modal with phone/OTP input
- Warmup configuration (15min, 30min, 1hr, 2hr)
- Post creation for carousels and videos

## Database Schema

### Tasks Table

Tracks all automation tasks:

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  type TEXT CHECK (type IN ('warmup', 'login', 'post')),
  geelark_task_id TEXT,
  account_id UUID REFERENCES accounts(id),
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  meta JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Posts Table

Tracks all content posts:

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  type TEXT CHECK (type IN ('carousel', 'video')),
  status TEXT CHECK (status IN ('pending', 'posted', 'failed')),
  content JSONB,
  task_id TEXT,
  posted_at TIMESTAMPTZ,
  post_url TEXT,
  engagement JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## Integration Points

### GeeLark API

The system integrates with GeeLark's Open API v1:
- `/open/v1/phone/{profileId}/app/install` - Install apps
- `/open/v1/automation/tiktok/login` - TikTok login
- `/open/v1/automation/tiktok/warmup` - Warmup tasks
- `/open/v1/automation/tiktok/post/carousel` - Post carousels
- `/open/v1/automation/tiktok/post/video` - Post videos

### DaisySMS Integration

For phone verification:
- Automatically rents phone numbers for TikTok verification
- Monitors incoming SMS for OTP codes
- Completes verification automatically
- Manages rental lifecycle (complete/cancel)

## Best Practices

1. **App Version**: Always use TikTok version 39.1.0 for consistency
2. **Warmup Duration**: Recommend 30-60 minutes for new accounts
3. **Content Spacing**: Wait at least 30 minutes between posts
4. **Proxy Usage**: Ensure each account has a unique proxy assigned
5. **Error Handling**: Monitor task status and retry failed operations

## Troubleshooting

### Common Issues

1. **Login Fails**
   - Check if phone number is valid
   - Ensure DaisySMS has sufficient balance
   - Verify GeeLark profile is online

2. **Warmup Not Starting**
   - Confirm TikTok is installed
   - Check if account is logged in
   - Verify profile status is 'new' or 'ready'

3. **Post Creation Fails**
   - Validate image URLs are accessible
   - Check video format compatibility
   - Ensure caption doesn't exceed limits

### Monitoring

Monitor automation progress through:
- Tasks table for task status
- Logs table for detailed activity
- Profile detail page for real-time status
- GeeLark dashboard for device status

## Security Considerations

1. **API Keys**: Store GeeLark and DaisySMS credentials securely
2. **Phone Numbers**: Use temporary numbers from DaisySMS
3. **Proxies**: Assign unique proxies per account
4. **Rate Limiting**: Respect TikTok's rate limits
5. **Content**: Ensure posted content complies with TikTok guidelines 