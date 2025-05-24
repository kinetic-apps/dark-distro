import { NextRequest, NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    console.log('API: Starting image generation')
    const formData = await request.formData()
    
    // Extract basic parameters
    const prompt = formData.get('prompt') as string || 'Create a variation of this image'
    const carouselIndex = parseInt(formData.get('carouselIndex') as string) || 0
    
    // Extract uploaded images
    const images: Blob[] = []
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('image_') && value instanceof Blob) {
        images.push(value)
      }
    }
    
    console.log('API: Found', images.length, 'images')
    
    if (images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }
    
    // Process each image
    const generatedImages: string[] = []
    
    for (let i = 0; i < images.length; i++) {
      const imageBlob = images[i]
      
      try {
        console.log(`Processing image ${i + 1}/${images.length}`)
        
        // Convert to array buffer
        const arrayBuffer = await imageBlob.arrayBuffer()
        console.log(`Image size: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`)
        
        // Create form data for OpenAI
        const openAIForm = new FormData()
        openAIForm.append('model', 'gpt-image-1')
        openAIForm.append('prompt', prompt)
        openAIForm.append('n', '1')
        openAIForm.append('size', '1024x1024')
        openAIForm.append(
          'image',
          new Blob([arrayBuffer], { type: 'image/png' }),
          'image.png'
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
        console.log(`OpenAI responded in ${elapsed}ms`)
        
        if (!response.ok) {
          const error = await response.text()
          console.error('OpenAI error:', error)
          throw new Error(`OpenAI error: ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data.data?.[0]?.b64_json) {
          generatedImages.push(`data:image/png;base64,${data.data[0].b64_json}`)
        } else {
          throw new Error('No image data returned')
        }
        
        console.log(`Image ${i + 1} processed successfully`)
        
      } catch (error) {
        console.error(`Error processing image ${i}:`, error)
        // Skip failed images instead of returning original
        continue
      }
    }
    
    console.log('Successfully generated', generatedImages.length, 'images')
    
    return NextResponse.json({
      success: true,
      images: generatedImages,
      carouselIndex,
      processedAt: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate images' },
      { status: 500 }
    )
  }
} 