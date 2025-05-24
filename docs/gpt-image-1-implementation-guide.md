# GPT-Image-1 Implementation Guide

## Overview

GPT-Image-1 is OpenAI's latest multimodal image generation model (released April 2025), built on the GPT-4o foundation. This guide explains the correct implementation approach based on our investigation of working vs. non-working implementations.

## Key Learnings

### ❌ Common Mistakes That Cause Failures

1. **Using a fully transparent mask**
   ```javascript
   // DON'T DO THIS - Returns original image unchanged
   const maskBuffer = await sharp({
     create: {
       width: 1024,
       height: 1024,
       channels: 4,
       background: { r: 0, g: 0, b: 0, alpha: 0 } // FULLY TRANSPARENT!
     }
   })
   ```

2. **Unnecessary image preprocessing**
   - Don't resize images to square format
   - Don't create masks unless editing specific regions
   - Don't add unnecessary modifications

### ✅ Correct Implementation

```javascript
// CORRECT APPROACH - No mask for variations
const form = new FormData();
form.append("model", "gpt-image-1");
form.append("prompt", enhancedPrompt);
form.append("n", "1"); // Number of variations
form.append("size", "1024x1536"); // 9:16 for TikTok/Reels
form.append("image", imageBlob, "source.png");
// NO MASK PARAMETER!

const response = await fetch("https://api.openai.com/v1/images/edits", {
  method: "POST",
  headers: { 
    "Authorization": `Bearer ${OPENAI_API_KEY}`
  },
  body: form
});
```

## Model Capabilities

### Supported Features
- **Resolutions**: Up to 4096×4096 pixels
- **Aspect Ratios**: 
  - 1024×1024 (1:1 square)
  - 1024×1280 (4:5 portrait)
  - 1024×1536 (9:16 vertical - TikTok/Reels)
  - 1280×1024 (5:4 landscape)
  - 1536×1024 (16:9 horizontal)
- **Response Format**: Base64 JSON only (no URL format)
- **Model**: `gpt-image-1` (not DALL-E)

### API Endpoints
- `/v1/images/generations` - Create new images from text
- `/v1/images/edits` - Edit/create variations of existing images

## Best Practices

### 1. Prompt Engineering
```javascript
const enhancedPrompt = `
Create a variation of this image for social media.
- Maintain the original style and composition
- Format as vertical 9:16 aspect ratio
- Ensure important content fits the vertical format
- ${additionalInstructions}
`;
```

### 2. Error Handling
```javascript
// Add proper timeout handling
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000);

try {
  const response = await fetch(url, {
    signal: controller.signal,
    // ... other options
  });
  clearTimeout(timeoutId);
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('Request timed out');
  }
}
```

### 3. Response Processing
```javascript
// Handle both base64 and URL responses
if (data.data?.[0]?.b64_json) {
  // Convert base64 to blob
  const base64 = data.data[0].b64_json;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  imageBlob = new Blob([bytes], { type: 'image/png' });
}
```

## When to Use Masks

Masks should ONLY be used when you want to edit specific regions:

```javascript
// Only use masks for targeted edits
// Transparent areas = areas to be regenerated
// Opaque areas = areas to keep unchanged
```

For variations and style transfers, **DO NOT use masks**.

## Migration from DALL-E

If migrating from DALL-E 3:
1. Change model from `dall-e-3` to `gpt-image-1`
2. Use `/v1/images/edits` endpoint for variations
3. Remove `style` and `quality` parameters (not supported)
4. Expect base64 responses only

## Troubleshooting

### Issue: API returns original image unchanged
**Solution**: Remove the mask parameter entirely

### Issue: Requests timeout or hang
**Solution**: 
- Don't use transparent masks
- Increase timeout to 60 seconds
- Check API key permissions

### Issue: 403 Forbidden errors
**Solution**: Ensure your OpenAI account has access to GPT-Image-1

## Example: Complete Working Implementation

```javascript
async function generateImageVariation(sourceImageBlob, prompt, settings) {
  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', prompt);
  form.append('n', '1');
  form.append('size', settings.aspect_ratio === '9:16' ? '1024x1536' : '1024x1024');
  form.append('image', sourceImageBlob, 'source.png');

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: form
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0];
}
```

## Resources

- [OpenAI Images API Documentation](https://platform.openai.com/docs/api-reference/images)
- [GPT-4o Multimodal Capabilities](https://openai.com/blog/gpt-4o)
- Community discussions on implementation patterns 