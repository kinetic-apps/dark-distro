# Smart Text Replacement - Prompt Wrapper Update

## Overview

The image generation feature has been updated to automatically assume that user text input is simply the text to be replaced in the image, rather than requiring users to write complex prompts.

## What Changed

### Before
- Users had to write full prompts like: `"Replace any text in this image with bold, modern sans-serif text"`
- Required understanding of prompt engineering
- Inconsistent results due to varying prompt quality

### After
- Users simply enter the replacement text: `"New Product Launch"`
- System automatically wraps input with proper instructions
- Consistent, professional results every time

## Implementation Details

### New Service: `lib/services/prompt-wrapper.ts`

#### Key Functions

1. **`smartWrapPrompt(userInput, options?)`**
   - Automatically detects if input is raw text or already a formatted prompt
   - Only wraps raw text, leaves complex prompts unchanged
   - Main function used throughout the application

2. **`wrapTextReplacementPrompt(userText, options?)`**
   - Core wrapper function that formats text replacement prompts
   - Supports styling options (modern, bold, elegant, casual)
   - Maintains layout and design preservation

3. **`isRawTextInput(prompt)`**
   - Detects if input appears to be simple text vs. complex instructions
   - Checks for instruction keywords and prompt length

#### Options Available

```typescript
interface PromptWrapperOptions {
  preserveStyle?: boolean      // Maintain original styling (default: true)
  fontStyle?: 'modern' | 'bold' | 'elegant' | 'casual'  // Font style (default: 'modern')
  maintainLayout?: boolean     // Keep original positioning (default: true)
}
```

### Updated API Endpoints

All image generation endpoints now use the smart prompt wrapper:

- `app/api/image-generator/generate/route.ts`
- `app/api/image-generator/generate-v2/route.ts`
- `app/api/image-generator/process-job/route.ts`

### Updated Frontend Components

1. **Test Page (`app/test-image-processing/page.tsx`)**
   - Changed from "Prompt" to "Text to Replace"
   - Updated placeholder text and instructions
   - Renamed to "Smart Text Replacement"

2. **Main Generator (`app/image-generator/page.tsx`)**
   - Updated labels and placeholders
   - Changed default text from complex prompt to simple text
   - Updated help text and tips

### Example Transformations

#### Input: `"New Product Launch"`
**Generated Prompt:**
```
Replace any existing text in this image with: "New Product Launch". Maintain the original text styling, positioning, and visual hierarchy. Use clean, modern sans-serif typography. Keep the same text placement, size relationships, and overall composition. Ensure the new text fits naturally within the existing design elements. Ensure high quality, readable text that matches the image's aesthetic and maintains professional appearance.
```

#### Input: `"50% OFF SALE"` (with bold style)
**Generated Prompt:**
```
Replace any existing text in this image with: "50% OFF SALE". Maintain the original text styling, positioning, and visual hierarchy. Use bold, impactful typography. Keep the same text placement, size relationships, and overall composition. Ensure the new text fits naturally within the existing design elements. Ensure high quality, readable text that matches the image's aesthetic and maintains professional appearance.
```

## Testing

### Test Endpoint: `/api/test/prompt-wrapper`
- Tests different wrapper functions
- Shows raw text detection
- Demonstrates various styling options

### Test Page: `/test-prompt-wrapper`
- Interactive testing interface
- Real-time prompt generation
- Examples and documentation

## Benefits

1. **Simplified User Experience**
   - No need to understand prompt engineering
   - Just enter the text you want
   - Consistent results every time

2. **Better Results**
   - Professionally crafted prompts
   - Maintains design integrity
   - Preserves original styling and layout

3. **Backward Compatibility**
   - Smart detection preserves complex prompts
   - Existing workflows continue to work
   - Gradual migration path

4. **Flexibility**
   - Multiple styling options
   - Configurable behavior
   - Easy to extend

## Usage Examples

### Simple Text Replacement
```typescript
// User enters: "Your Brand Name"
// System generates: "Replace any existing text in this image with: 'Your Brand Name'..."
```

### Complex Prompt (Unchanged)
```typescript
// User enters: "Replace the text with blue gradient background and white text"
// System detects complexity and leaves unchanged
```

### Styled Replacement
```typescript
// With options
const prompt = wrapTextReplacementPrompt("SALE 50% OFF", { 
  fontStyle: 'bold',
  preserveStyle: false 
})
```

## Migration Notes

- All existing functionality remains intact
- No breaking changes to API
- Frontend updates improve UX but don't break existing flows
- Test endpoints available for validation

## Future Enhancements

1. **Style Detection**: Automatically detect and match existing text styles
2. **Multi-language Support**: Handle different languages and character sets
3. **Advanced Layout**: More sophisticated layout preservation
4. **Custom Templates**: User-defined prompt templates
5. **A/B Testing**: Compare different prompt strategies 