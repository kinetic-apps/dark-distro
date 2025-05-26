# Aspect Ratio Preservation in Image Generation

## Overview

This feature automatically detects and preserves the aspect ratio of input images when generating variations using OpenAI's GPT-Image-1 model. Previously, all outputs were forced to 1:1 square format, which caused text misalignment issues for non-square images.

## Implementation Details

### Changes Made

1. **Added Sharp dependency** for image dimension detection
2. **Updated API routes** (`/api/image-generator/generate` and `/api/image-generator/generate-v2`) to:
   - Detect input image dimensions using Sharp
   - Use OpenAI's 'auto' mode by default for best aspect ratio preservation
   - Support manual aspect ratio overrides
   - Return actual output dimensions in the response

3. **Enhanced the main image generation workflow**:
   - Added aspect ratio settings to the carousel generator UI
   - Integrated settings into job processing
   - Updated process-job endpoint to respect aspect ratio preferences

### Supported OpenAI Aspect Ratios

| Aspect Ratio | Size        | Use Case                       |
|--------------|-------------|--------------------------------|
| 1:1          | 1024×1024   | Square (Instagram posts)       |
| 3:2          | 1536×1024   | Horizontal/Landscape           |
| 2:3          | 1024×1536   | Vertical/Portrait              |
| auto         | Variable    | Preserves original aspect ratio|

### How It Works

1. **Input Detection**: When an image is uploaded, Sharp reads its dimensions
2. **Auto Mode**: By default, the system uses OpenAI's 'auto' mode which automatically preserves the input aspect ratio
3. **Manual Override**: You can optionally specify a specific aspect ratio
4. **Generation**: The image is generated while maintaining proper composition
5. **Output**: Text and other edits are properly positioned regardless of aspect ratio

## Main Workflow Integration

### Carousel Generator UI

The main image generator page (`/image-generator`) now includes:

- **Aspect Ratio Selector**: Choose between:
  - Auto (preserve original) - Default
  - 1:1 Square
  - 3:2 Landscape
  - 2:3 Portrait
  - 16:9 Widescreen
  - 9:16 Vertical (Stories)

- **Per-Image Prompts**: Each image in your carousel can have its own unique prompt
- **Settings Persistence**: Aspect ratio settings are stored with the job and applied during processing

### API Usage

The endpoints support custom prompts and optional aspect ratio parameters:

```javascript
const formData = new FormData()
formData.append('source_image', imageBlob)
formData.append('prompt', 'Replace text with modern sans-serif font, add blue gradient background')
formData.append('aspect_ratio', 'auto') // Optional: 'auto', '1:1', '3:2', '2:3', '16:9', '9:16'

const response = await fetch('/api/image-generator/generate-v2', {
  method: 'POST',
  body: formData
})
```

### Job Processing

When creating a job through the UI:

```javascript
const jobData = {
  prompts: ['Prompt for image 1', 'Prompt for image 2', ...],
  settings: {
    aspect_ratio: 'auto' // or specific ratio
  }
}
```

### Response Format

The API returns additional metadata:

```javascript
{
  success: true,
  imageUrl: "https://...",
  width: 1536,
  height: 1024,
  detectedDimensions: {
    width: 1920,
    height: 1080
  },
  usedSize: "auto",
  revised_prompt: "The actual prompt used by OpenAI",
  // ... other fields
}
```

## Testing

### Test Page
A test page is available at `/test-image-processing` to verify the functionality:

1. Upload any image (portrait, landscape, or square)
2. Enter a custom prompt describing the changes you want
3. Click "Generate Variation"
4. Review the output and metadata to confirm aspect ratio preservation

### Main Workflow
To test in the main workflow:

1. Go to `/image-generator`
2. Upload multiple images for your carousel
3. Set individual prompts for each image
4. Choose an aspect ratio mode (Auto recommended)
5. Generate carousels and verify the output maintains proper composition

## Migration Notes

- Existing code will continue to work without changes
- The system now uses 'auto' mode by default for better aspect ratio preservation
- Custom prompts can be specified for more control over the generation
- To force a specific aspect ratio, use the dropdown in the UI or pass the `aspect_ratio` parameter

## Best Practices

1. **Use Auto Mode**: For most use cases, 'auto' mode provides the best results
2. **Consistent Carousels**: When creating carousels, consider using the same aspect ratio for all images for consistency
3. **Platform-Specific**: Use specific ratios for platform requirements:
   - Instagram Posts: 1:1
   - Instagram Stories: 9:16
   - YouTube Thumbnails: 16:9
   - Twitter Posts: 3:2 or 16:9

## Examples

### Portrait Image with Text Replacement
- Input: 1080×1920 (Instagram story)
- Prompt: "Replace all text with bold white text on dark background"
- Mode: auto
- Result: Text properly centered, aspect ratio preserved

### Landscape Image with Style Transfer
- Input: 1920×1080 (YouTube thumbnail)
- Prompt: "Make it cyberpunk style with neon colors"
- Mode: auto
- Result: Horizontal composition maintained with style applied

### Square Image with Background Change
- Input: 1080×1080 (Instagram post)
- Prompt: "Change background to sunset beach scene"
- Mode: auto
- Result: Square format preserved with new background

## Troubleshooting

### Issue: Images still being forced to square
**Solution**: Ensure you're using the latest API endpoints and that the aspect_ratio setting is properly configured

### Issue: OpenAI API errors with certain sizes
**Solution**: The system automatically maps to the closest supported size. If issues persist, try using 'auto' mode

### Issue: Inconsistent carousel dimensions
**Solution**: Use a specific aspect ratio setting instead of 'auto' for consistent carousel slides 