import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    console.log('API: Starting image generation v2')
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    
    // Extract parameters
    const sourceImageBlob = formData.get('source_image') as Blob
    const prompt = formData.get('prompt') as string || 'Create a variation of this image'
    const carouselIndex = parseInt(formData.get('carousel_index') as string) || 0
    const imageIndex = parseInt(formData.get('image_index') as string) || 0
    const aspectRatioOverride = formData.get('aspect_ratio') as string | null
    
    if (!sourceImageBlob) {
      return NextResponse.json({ error: 'No source image provided' }, { status: 400 })
    }

    console.log(`Processing carousel ${carouselIndex}, image ${imageIndex}`)
    
    // Convert blob to array buffer
    const arrayBuffer = await sourceImageBlob.arrayBuffer()
    console.log(`Source image size: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`)
    
    // Detect image dimensions using sharp
    let size = '1024x1024' // default fallback
    let detectedWidth = 1024
    let detectedHeight = 1024
    
    try {
      const imageBuffer = Buffer.from(arrayBuffer)
      const metadata = await sharp(imageBuffer).metadata()
      
      if (metadata.width && metadata.height) {
        detectedWidth = metadata.width
        detectedHeight = metadata.height
        
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
          size = aspectRatioMap[aspectRatioOverride] || getOpenAISize(detectedWidth, detectedHeight)
        } else {
          // Consider using 'auto' mode for better results
          size = 'auto'  // Let OpenAI automatically detect and preserve aspect ratio
        }
      }
    } catch (error) {
      console.error('Error detecting image dimensions:', error)
      // Continue with default size
    }
    
    // Wrap the prompt for text replacement
    const wrappedPrompt = smartWrapPrompt(prompt)
    
    // Create minimal form data for OpenAI
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

    console.log('Calling OpenAI API...')
    const startTime = Date.now()
    
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: openAIForm
    })
    
    const elapsed = Date.now() - startTime
    console.log(`OpenAI API responded in ${elapsed}ms with status ${response.status}`)

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      return NextResponse.json({ error: `OpenAI API error: ${response.status}` }, { status: 500 })
    }

    const data = await response.json()
    console.log('OpenAI API response received')

    // Get the generated image
    let imageBlob: Blob

    if (data.data?.[0]?.b64_json) {
      console.log('Converting base64 to blob...')
      const base64 = data.data[0].b64_json
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      imageBlob = new Blob([bytes], { type: 'image/png' })
      console.log('Image blob created, size:', imageBlob.size)
    } else {
      console.error('No image data in response')
      return NextResponse.json({ error: 'No image data returned from OpenAI' }, { status: 500 })
    }

    // Upload to Supabase storage
    const fileName = `${user.id}/carousels/${Date.now()}_${carouselIndex}_${imageIndex}.png`
    console.log('Uploading to storage:', fileName)
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generated-carousels')
      .upload(fileName, imageBlob, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw uploadError
    }

    console.log('Upload successful')

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('generated-carousels')
      .getPublicUrl(fileName)

    console.log('Public URL:', publicUrl)

    // Parse dimensions from the size string or use detected dimensions for 'auto'
    let outputWidth: number, outputHeight: number
    if (size === 'auto') {
      // When using 'auto', OpenAI preserves the original aspect ratio
      // We'll use the detected dimensions as approximation
      outputWidth = detectedWidth
      outputHeight = detectedHeight
    } else {
      [outputWidth, outputHeight] = size.split('x').map(Number)
    }

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      storagePath: fileName,
      width: outputWidth,
      height: outputHeight,
      carouselIndex,
      imageIndex,
      revised_prompt: data.data?.[0]?.revised_prompt || prompt,
      detectedDimensions: {
        width: detectedWidth,
        height: detectedHeight
      },
      usedSize: size
    })

  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
} 