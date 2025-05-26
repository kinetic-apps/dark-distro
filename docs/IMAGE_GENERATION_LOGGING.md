# Image Generation Logging System

## Overview

We've implemented a comprehensive logging system for the image generation process that provides detailed, real-time updates to users about what's happening during image generation.

## Features

### 1. Detailed Log Levels
- **Info**: General process updates (blue icon)
- **Success**: Successful operations (green checkmark)
- **Warning**: Non-critical issues (yellow alert)
- **Error**: Failed operations (red X)

### 2. Log Steps
The system tracks different stages of the generation process:
- `initialization`: Job startup
- `validation`: Input validation
- `base_generation`: OpenAI image generation
- `variant_creation`: Creating image variants
- `processing`: Anti-shadowban processing
- `upload`: Uploading to storage
- `completion`: Job completion
- `cleanup`: Cleaning up old data

### 3. Real-time Updates
- Logs are displayed in real-time using Supabase subscriptions
- New logs trigger a visual indicator when the log panel is collapsed
- Auto-scroll to latest log entry

### 4. Detailed Error Information
- Network timeouts with elapsed time
- Specific OpenAI error codes (rate limits, auth errors, etc.)
- Upload failures with storage paths
- Processing errors with stack traces

### 5. Retry Logic
- **Automatic retries**: Failed OpenAI API calls are retried up to 3 times
- **Exponential backoff**: Delays between retries increase (2s, 4s, 8s)
- **Timeout handling**: 120-second timeout for OpenAI API calls
- **Smart retry logic**: Non-retryable errors (401, 400) fail immediately

### 6. Partial Completion Handling
- **New status**: `completed_partial` for jobs where some images failed
- **Clear messaging**: Users see exactly how many images succeeded/failed
- **Retry capability**: Users can retry jobs to attempt generating missing images
- **Visual indicators**: Yellow warning icon and message for partial completions

## Database Schema

```sql
CREATE TABLE image_generation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES image_generation_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL DEFAULT 'info',
  step VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Job Statuses

- `queued`: Job is waiting to be processed
- `processing`: Job is actively being processed
- `completed`: All images generated successfully
- `completed_partial`: Some images generated, but some failed
- `failed`: No images were generated successfully

## Usage

### Backend (Server-side)
```typescript
import { ImageGenerationLogger } from '@/lib/services/image-generation-logger'

// Log an info message
await ImageGenerationLogger.info(
  jobId,
  userId,
  'base_generation',
  'Starting image generation',
  { imageCount: 5 }
)

// Log an error
await ImageGenerationLogger.error(
  jobId,
  userId,
  'upload',
  'Failed to upload image',
  { error: error.message, path: storagePath }
)
```

### Frontend Display
The job details page (`/image-generator/jobs/[id]`) now includes:
- Collapsible "Detailed Logs" section
- Real-time log updates
- Color-coded log levels
- Expandable details for each log entry
- Timestamp with millisecond precision
- Partial completion warnings with retry suggestions

## Benefits

1. **Transparency**: Users can see exactly what's happening during generation
2. **Debugging**: Detailed error information helps diagnose issues
3. **Performance Monitoring**: Track response times and bottlenecks
4. **User Experience**: No more wondering if the process is stuck
5. **Resilience**: Automatic retries handle transient failures
6. **Partial Success**: Jobs can complete even if some images fail

## Future Enhancements

1. Log filtering by level or step
2. Export logs for debugging
3. Performance metrics dashboard
4. Webhook notifications for errors
5. Configurable retry policies per job
6. Batch retry for failed images only 