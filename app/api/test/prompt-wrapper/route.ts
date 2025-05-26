import { NextRequest, NextResponse } from 'next/server'
import { smartWrapPrompt, wrapTextReplacementPrompt, isRawTextInput } from '@/lib/services/prompt-wrapper'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    
    if (!text) {
      return NextResponse.json({ error: 'Text input required' }, { status: 400 })
    }

    // Test different wrapper functions
    const smartWrapped = smartWrapPrompt(text)
    const directWrapped = wrapTextReplacementPrompt(text)
    const isRaw = isRawTextInput(text)
    
    // Test with different options
    const boldWrapped = wrapTextReplacementPrompt(text, { fontStyle: 'bold' })
    const elegantWrapped = wrapTextReplacementPrompt(text, { 
      fontStyle: 'elegant', 
      preserveStyle: false 
    })

    return NextResponse.json({
      input: text,
      isRawTextInput: isRaw,
      results: {
        smartWrapped,
        directWrapped,
        boldWrapped,
        elegantWrapped
      }
    })

  } catch (error) {
    console.error('Prompt wrapper test error:', error)
    return NextResponse.json(
      { error: 'Test failed' },
      { status: 500 }
    )
  }
} 