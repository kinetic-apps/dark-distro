# Carousel Variant System Documentation

## Overview

The carousel variant system has been redesigned to properly organize and track image generation outputs for automated TikTok carousel posting. This system creates a hierarchical folder structure and provides APIs for Geelark integration.

## Key Features

- **High Volume Support**: Generate up to 500 carousel variants per job
- **Efficient Processing**: Optimized for large-scale generation with progress tracking
- **Smart UI**: Pagination and navigation controls for managing large variant sets
- **Performance Monitoring**: Detailed logging and progress updates for long-running jobs

## Storage Structure

```
generated-carousels/
└── {userId}/generated/
    └── job-{timestamp}-{jobId}/
        ├── variant-{variantId}/
        │   ├── 001-{jobId}-{variantId}.jpg
        │   ├── 002-{jobId}-{variantId}.jpg
        │   └── 003-{jobId}-{variantId}.jpg
        └── variant-{variantId}/
            ├── 001-{jobId}-{variantId}.jpg
            ├── 002-{jobId}-{variantId}.jpg
            └── 003-{jobId}-{variantId}.jpg
```

### File Naming Convention
- Format: `{order}-{jobId}-{variantId}.{ext}`
- Example: `001-job123-var456.jpg`
- Benefits:
  - Sequential ordering (001, 002, 003)
  - Traceable to source job and variant
  - Unique identifiers prevent collisions
  - Easy programmatic parsing

## Performance Considerations

### Large Job Handling (50+ variants)
- **Progress Updates**: More frequent updates for better visibility
- **Time Estimates**: ~30 seconds per image × number of images × variants
- **UI Optimizations**: 
  - Pagination for grid view (10 variants per page)
  - Number input navigation for 20+ variants
  - Warning messages for jobs over 50 variants

### Example Time Estimates
- 10 variants × 5 images = 50 images (~25 minutes)
- 100 variants × 5 images = 500 images (~4 hours)
- 500 variants × 5 images = 2,500 images (~21 hours)

## UI Enhancements

### Image Generator Page
- **Variant Input**: Number input with quick select dropdown
- **Range**: 1-500 variants supported
- **Warnings**: Visual alerts for large jobs
- **Time Estimates**: Dynamic calculation based on variant count

### Job Details Page
- **Grid View**: Paginated display for large variant sets
- **Carousel View**: 
  - Dropdown for ≤20 variants
  - Number input with prev/next navigation for >20 variants
- **Performance**: Optimized rendering for thousands of images

## Database Schema

### New Tables

#### `carousel_variants`
Tracks each variant generated from a job:
- `id`: UUID primary key
- `job_id`: Reference to image_generation_jobs
- `variant_index`: Variant number within the job
- `variant_id`: Unique identifier for this variant
- `folder_path`: Storage folder path
- `slide_count`: Number of slides in this variant
- `status`: 'ready' | 'assigned' | 'posted' | 'archived'
- `assigned_profile_id`: GeeLark profile ID if assigned
- `assigned_at`: When variant was assigned
- `posted_at`: When variant was posted
- `metadata`: JSONB for additional data

#### `variant_slides`
Tracks individual slides within each variant:
- `id`: UUID primary key
- `variant_id`: Reference to carousel_variants
- `slide_order`: Sequential order (1, 2, 3...)
- `filename`: File name in storage
- `storage_path`: Full storage path
- `image_url`: Public URL
- `width`, `height`: Image dimensions
- `caption`: Slide-specific caption
- `alt_text`: Accessibility text

#### `variant_assignments`
Tracks which profiles have been assigned variants:
- `id`: UUID primary key
- `variant_id`: Reference to carousel_variants
- `profile_id`: GeeLark profile ID
- `account_id`: Reference to accounts table
- `status`: 'pending' | 'posting' | 'posted' | 'failed'
- `posted_at`: When successfully posted
- `error_message`: Error details if failed

## API Endpoints

### Get Carousel Variant for Profile
```
GET /api/geelark/get-carousel-variant/{profileId}
```

Returns the next available variant for a profile:
```json
{
  "success": true,
  "variant": {
    "id": "variant-uuid",
    "variant_id": "unique-variant-id",
    "folder_path": "user/generated/job-123/variant-456",
    "slide_count": 3,
    "slides": [
      {
        "order": 1,
        "filename": "001-job123-var456.jpg",
        "url": "https://...",
        "width": 1024,
        "height": 1536,
        "caption": "Slide 1",
        "alt_text": "Description"
      }
    ],
    "metadata": {}
  }
}
```

### Mark Variant as Posted
```
POST /api/geelark/mark-variant-posted
```

Request body:
```json
{
  "profileId": "geelark-profile-id",
  "variantId": "variant-uuid",
  "postId": "tiktok-post-id" // optional
}
```

## UI Components

### Assets Page (`/assets`)
- Displays jobs with expandable variant lists
- Shows variant status (ready, assigned, posted)
- Allows preview of all slides in a variant
- Supports assigning variants to profiles
- Enables downloading all slides
- Provides filtering by status and date

### Profiles Page (`/profiles`)
- Added carousel assignment button for active profiles
- Opens modal to select available variants
- Shows variant preview with thumbnails
- Confirms assignment and updates status

### Variant Assignment Modal
- Lists available (unassigned) variants
- Shows job name and template information
- Displays slide thumbnails (up to 4)
- Allows selection and assignment
- Updates database on confirmation

## Workflow

1. **Image Generation**
   - Job creates base images from OpenAI
   - Applies anti-shadowban processing for each variant
   - Saves images in organized folder structure
   - Creates database records for tracking

2. **Asset Management**
   - View all generated variants in Assets page
   - Filter by status, date, or job
   - Preview slides and download if needed
   - Assign variants to profiles

3. **Profile Assignment**
   - Select active profile in Profiles page
   - Click carousel icon to open assignment modal
   - Choose from available variants
   - Confirm assignment

4. **Geelark Integration**
   - Profile calls `/api/geelark/get-carousel-variant/{profileId}`
   - Receives variant with all slide URLs
   - Posts carousel to TikTok
   - Calls `/api/geelark/mark-variant-posted` on success

## Benefits

1. **Organization**: Clear folder structure for easy management
2. **Tracking**: Complete audit trail from generation to posting
3. **Automation**: Seamless integration with Geelark profiles
4. **Scalability**: Handles multiple variants and profiles efficiently
5. **Flexibility**: Supports various carousel sizes and formats
6. **Analytics**: Track which variants perform best

## Future Enhancements

1. **Auto-assignment**: Rules-based variant assignment
2. **Posting Queue**: Schedule variants for optimal times
3. **Performance Tracking**: Monitor engagement metrics
4. **A/B Testing**: Compare variant performance
5. **Bulk Operations**: Assign multiple variants at once
6. **Preview Mode**: Test carousel appearance before posting 