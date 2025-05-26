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

  // Create a very specific prompt that emphasizes exact style preservation
  let prompt = `Replace ALL text in this image with exactly: "${escapedText}". `
  
  // Strong emphasis on preserving original styling
  prompt += `CRITICAL: You must preserve EXACTLY the same font family, font size, font weight, font style (italic/normal), letter spacing, line height, text color, text effects (shadows, outlines, gradients), and any other visual text properties from the original image. `
  
  // Positioning and layout
  prompt += `Keep the exact same text positioning, alignment, and layout as the original. `
  
  // Additional preservation instructions
  prompt += `Do not change any aspect of the text appearance except for the actual words/characters. The new text should look like it was originally designed with the same exact styling as the text being replaced. `
  
  // Background and design elements
  prompt += `Maintain all background elements, graphics, and design components unchanged. Only replace the text content itself.`

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