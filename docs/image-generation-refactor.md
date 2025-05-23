# Image Generation System Refactor

## Overview

The image generation system has been completely refactored to use a job-based workflow inspired by the successful implementation in the @dhilan (Carousel Craft) project. This provides better tracking, organization, and scalability.

## Key Improvements

### 1. **Job-Based Processing**
- Each generation request creates a job that can be tracked
- Real-time progress updates using Supabase subscriptions
- Jobs can be viewed, managed, and deleted

### 2. **Proper OpenAI Integration**
- Uses the `/v1/images/edits` endpoint correctly
- No unnecessary image preprocessing (resizing, masks)
- Supports multiple aspect ratios (1:1, 4:5, 9:16)
- Direct image upload without modifications

### 3. **Template System**
- Automatically saves source images as templates
- Templates can be reused for future generations
- Favorite templates for quick access

### 4. **Better Organization**
- Images stored in user-specific folders
- Proper metadata tracking in database
- Carousel grouping for easy management

## Database Schema

### Tables Created:
1. **image_generation_templates** - Stores reusable templates
2. **image_generation_jobs** - Tracks generation jobs
3. **generated_carousel_images** - Stores generated images with metadata

## Usage

### Creating a New Job:
1. Navigate to `/image-generator`
2. Upload source images
3. Configure settings (prompt, variants, style options)
4. Create job and track progress

### Viewing Jobs:
- `/image-generator/jobs` - List all jobs
- `/image-generator/jobs/[id]` - View job details and results

### Using Templates:
- `/image-generator/templates` - Browse saved templates
- Click "Use Template" to start with pre-configured settings

## API Changes

### Old API:
- `/api/image-generator/generate` - Complex processing with masks and resizing

### New API:
- `/api/image-generator/generate-v2` - Simplified, direct OpenAI integration

## Key Differences from Old System

| Old System | New System |
|------------|------------|
| Direct processing | Job-based workflow |
| No progress tracking | Real-time progress updates |
| Complex image preprocessing | Direct image upload |
| No history | Full job history |
| Manual organization | Automatic template creation |
| Single aspect ratio | Multiple aspect ratios |

## Environment Variables

Ensure you have:
```
OPENAI_API_KEY=your_api_key_here
```

## Migration Steps

To run the new system:

1. Run the migration to create new tables:
   ```bash
   npx supabase db push
   ```

2. Ensure the `generated-carousels` storage bucket exists

3. Update any existing code that references the old `/api/image-generator/generate` endpoint

## Future Enhancements

- Batch job processing
- Job scheduling
- Advanced template management
- Export to various formats
- Integration with social media APIs 