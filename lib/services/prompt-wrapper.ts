/**
 * Prompt wrapper service for image generation
 * Automatically formats user text input as replacement text for images
 */

export interface PromptWrapperOptions {
  preserveStyle?: boolean
  fontStyle?: 'modern' | 'bold' | 'elegant' | 'casual'
  maintainLayout?: boolean
}

/**
 * Wraps user text input with a standardized prompt for text replacement
 * @param userText - The text that should replace existing text in the image
 * @param options - Optional styling and formatting preferences
 * @returns Formatted prompt for OpenAI image editing
 */
export function wrapTextReplacementPrompt(
  userText: string, 
  options: PromptWrapperOptions = {}
): string {
  const {
    preserveStyle = true,
    fontStyle = 'modern',
    maintainLayout = true
  } = options

  // Escape any special characters in the user text to ensure they're treated literally
  const escapedText = userText
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/"/g, '\\"')    // Escape quotes

  // Create an extremely specific prompt that leaves no room for interpretation
  let prompt = `INSTRUCTION: Replace ONLY the text characters in this image with exactly: "${escapedText}". `
  
  // Ultra-specific preservation requirements
  prompt += `ABSOLUTE REQUIREMENTS - DO NOT CHANGE ANY OF THE FOLLOWING: `
  prompt += `1. Font family - use the EXACT same font as the original text. `
  prompt += `2. Font size - maintain the EXACT same size in pixels/points. `
  prompt += `3. Font weight - preserve the EXACT same weight (thin/regular/bold/etc). `
  prompt += `4. Font style - keep the EXACT same style (italic/normal/oblique). `
  prompt += `5. Letter spacing (tracking) - maintain the EXACT same spacing between letters. `
  prompt += `6. Line height (leading) - preserve the EXACT same spacing between lines. `
  prompt += `7. Text color - use the EXACT same color values (RGB/HEX) as the original. `
  prompt += `8. Text shadows - preserve ALL shadow properties: color, blur, offset X, offset Y, spread. `
  prompt += `9. Text outlines/strokes - maintain the EXACT same stroke width, color, and style. `
  prompt += `10. Text effects - preserve ALL effects: gradients, glows, bevels, emboss, textures. `
  prompt += `11. Text position - keep the EXACT same X,Y coordinates and alignment. `
  prompt += `12. Text rotation/transformation - maintain any rotation, skew, or perspective. `
  prompt += `13. Opacity/transparency - preserve the EXACT same opacity levels. `
  prompt += `14. Blend modes - maintain any blend modes applied to the text. `
  
  // Emphasize what should NOT happen
  prompt += `CRITICAL WARNINGS: `
  prompt += `- Do NOT apply any new styling or "improvements" to the text. `
  prompt += `- Do NOT change the font to something "similar" - use the EXACT same font. `
  prompt += `- Do NOT adjust positioning to "look better" - keep EXACT same position. `
  prompt += `- Do NOT add or remove any effects - preserve ALL original effects exactly. `
  prompt += `- Do NOT change colors even slightly - use EXACT same color values. `
  
  // Final emphasis
  prompt += `SUMMARY: This is a pure character replacement task. Imagine you are selecting each character in a text editor and typing new characters while keeping all formatting intact. The result should be indistinguishable from the original except for the actual letters/numbers/symbols being different. Every single visual property must remain EXACTLY the same.`

  return prompt
}

/**
 * Legacy prompt wrapper for backward compatibility
 * @deprecated Use wrapTextReplacementPrompt instead
 */
export function wrapPrompt(userInput: string): string {
  return wrapTextReplacementPrompt(userInput)
}

/**
 * Checks if a prompt appears to be raw text (vs already formatted)
 * @param prompt - The prompt to analyze
 * @returns true if it appears to be raw replacement text
 */
export function isRawTextInput(prompt: string): boolean {
  // Check if prompt contains instruction keywords
  const instructionKeywords = [
    'replace', 'change', 'modify', 'edit', 'update', 'transform',
    'make', 'create', 'generate', 'add', 'remove', 'with'
  ]
  
  const lowerPrompt = prompt.toLowerCase()
  const hasInstructions = instructionKeywords.some(keyword => 
    lowerPrompt.includes(keyword)
  )
  
  // If it's short and has no instruction keywords, likely raw text
  return prompt.length < 100 && !hasInstructions
}

/**
 * Smart prompt wrapper that always wraps input for consistent text replacement
 * @param userInput - User's input text to replace in the image
 * @param options - Formatting options
 * @returns Properly formatted prompt
 */
export function smartWrapPrompt(
  userInput: string, 
  options: PromptWrapperOptions = {}
): string {
  // Always wrap the input to ensure consistent text replacement behavior
  // This ensures special characters like ":", ";", etc. are handled properly
  return wrapTextReplacementPrompt(userInput, options)
} 