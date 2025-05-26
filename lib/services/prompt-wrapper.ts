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

  // Base instruction for text replacement
  let prompt = `Replace any existing text in this image with: "${userText}"`

  // Add style preservation instructions
  if (preserveStyle) {
    prompt += `. Maintain the original text styling, positioning, and visual hierarchy`
  }

  // Add font style preferences
  const fontStyleMap = {
    modern: 'Use clean, modern sans-serif typography',
    bold: 'Use bold, impactful typography',
    elegant: 'Use elegant, refined typography',
    casual: 'Use casual, friendly typography'
  }
  
  prompt += `. ${fontStyleMap[fontStyle]}`

  // Add layout preservation
  if (maintainLayout) {
    prompt += `. Keep the same text placement, size relationships, and overall composition. Ensure the new text fits naturally within the existing design elements`
  }

  // Add quality instructions
  prompt += `. Ensure high quality, readable text that matches the image's aesthetic and maintains professional appearance`

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
 * Smart prompt wrapper that detects if input needs wrapping
 * @param userInput - User's input (could be raw text or full prompt)
 * @param options - Formatting options
 * @returns Properly formatted prompt
 */
export function smartWrapPrompt(
  userInput: string, 
  options: PromptWrapperOptions = {}
): string {
  // If it looks like raw text, wrap it
  if (isRawTextInput(userInput)) {
    return wrapTextReplacementPrompt(userInput, options)
  }
  
  // Otherwise, assume it's already a formatted prompt
  return userInput
} 