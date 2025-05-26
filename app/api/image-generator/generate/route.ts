import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { smartWrapPrompt } from '@/lib/services/prompt-wrapper'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

// Map aspect ratios to OpenAI's supported sizes
function getOpenAISize(width: number, height: number): string {
  const aspectRatio = width / height
  
  // Define supported OpenAI sizes with their aspect ratios
  const supportedSizes = [
    { size: '1024x1024', ratio: 1 },        // 1:1 square
    { size: '1536x1024', ratio: 1.5 },      // 3:2 horizontal/landscape
    { size: '1024x1536', ratio: 0.667 }     // 2:3 vertical/portrait
  ]
  
  // Find the closest matching aspect ratio
  let closestSize = supportedSizes[0]
  let minDifference = Math.abs(aspectRatio - closestSize.ratio)
  
  for (const sizeOption of supportedSizes) {
    const difference = Math.abs(aspectRatio - sizeOption.ratio)
    if (difference < minDifference) {
      minDifference = difference
      closestSize = sizeOption
    }
  }
  
  console.log(`Input aspect ratio: ${aspectRatio.toFixed(2)} (${width}x${height}) -> Using: ${closestSize.size}`)
  return closestSize.size
}

export async function POST(request: NextRequest) {
  try {
    console.log('API: Starting image generation')
    const formData = await request.formData()
    
    // Extract basic parameters
    const prompt = formData.get('prompt') as string || 'Create a variation of this image'
    const carouselIndex = parseInt(formData.get('carouselIndex') as string) || 0
    const aspectRatioOverride = formData.get('aspect_ratio') as string | null
    
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
        
        // Detect image dimensions using sharp
        let size = '1024x1024' // default fallback
        try {
          const imageBuffer = Buffer.from(arrayBuffer)
          const metadata = await sharp(imageBuffer).metadata()
          
          if (metadata.width && metadata.height) {
            // Use override if provided, otherwise detect from image
            if (aspectRatioOverride) {
              // Map aspect ratio string to size
              const aspectRatioMap: Record<string, string> = {
                '1:1': '1024x1024',
                '3:2': '1536x1024',
                '2:3': '1024x1536',
                '16:9': '1536x1024',  // closest to 16:9
                '9:16': '1024x1536',  // closest to 9:16
                'auto': 'auto'        // let OpenAI decide
              }
              size = aspectRatioMap[aspectRatioOverride] || getOpenAISize(metadata.width, metadata.height)
            } else {
              // Use 'auto' mode for better results
              size = 'auto'  // Let OpenAI automatically detect and preserve aspect ratio
            }
          }
        } catch (error) {
          console.error('Error detecting image dimensions:', error)
          // Continue with default size
        }
        
        // Wrap the prompt for text replacement
        const wrappedPrompt = smartWrapPrompt(prompt)
        
        // Create form data for OpenAI
        const openAIForm = new FormData()
        openAIForm.append('model', 'gpt-image-1')
        openAIForm.append('prompt', wrappedPrompt)
        openAIForm.append('n', '1')
        openAIForm.append('size', size)
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