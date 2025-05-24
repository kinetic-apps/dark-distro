import { NextRequest, NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    console.log('=== SIMPLE TEST API ===')
    
    const formData = await request.formData()
    const imageBlob = formData.get('image') as Blob
    
    if (!imageBlob) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }
    
    // Convert to array buffer
    const arrayBuffer = await imageBlob.arrayBuffer()
    console.log(`Image size: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`)
    
    // Create minimal form data
    const openAIForm = new FormData()
    openAIForm.append('model', 'gpt-image-1')
    openAIForm.append('prompt', 'Create a simple variation of this image')
    openAIForm.append('n', '1')
    openAIForm.append('size', '1024x1024')
    openAIForm.append(
      'image',
      new Blob([arrayBuffer], { type: 'image/png' }),
      'test.png'
    )
    
    console.log('Calling OpenAI...')
    const startTime = Date.now()
    
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: openAIForm
    })
    
    const elapsed = Date.now() - startTime
    console.log(`OpenAI responded in ${elapsed}ms with status ${response.status}`)
    
    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI error:', error)
      return NextResponse.json({ error: `OpenAI error: ${response.status}` }, { status: 500 })
    }
    
    const data = await response.json()
    console.log('Response data:', JSON.stringify(data, null, 2))
    
    // Return the base64 image directly
    if (data.data?.[0]?.b64_json) {
      return NextResponse.json({
        success: true,
        imageBase64: data.data[0].b64_json,
        message: 'Image generated successfully!'
      })
    }
    
    return NextResponse.json({ error: 'No image data returned' }, { status: 500 })
    
  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
} 