import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

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
    const prompt = formData.get('prompt') as string
    const carouselIndex = parseInt(formData.get('carousel_index') as string)
    const imageIndex = parseInt(formData.get('image_index') as string)
    const settings = JSON.parse(formData.get('settings') as string || '{}')
    
    if (!sourceImageBlob || !prompt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`Processing carousel ${carouselIndex}, image ${imageIndex}`)
    
    // Build enhanced prompt based on settings
    let enhancedPrompt = `${prompt}\n\n`
    enhancedPrompt += `Create variation #${carouselIndex + 1} of this image.\n`
    enhancedPrompt += `IMPORTANT: Format as a vertical 9:16 aspect ratio image for TikTok/Instagram Reels.\n`
    enhancedPrompt += `Ensure all important content fits well in this vertical format.\n`
    
    if (settings.use_lowercase) {
      enhancedPrompt += '- Use only lowercase letters for all text\n'
    }
    
    if (settings.add_borders) {
      enhancedPrompt += `- Add a ${settings.border_color || 'colorful'} border\n`
    }
    
    if (settings.add_effects) {
      enhancedPrompt += '- Add subtle visual effects for social media appeal\n'
    }
    
    // Determine size based on aspect ratio (matching @dhilan's approach)
    const sizeMap = {
      '1:1': '1024x1024',
      '4:5': '1024x1280',  // Close to 4:5
      '9:16': '1024x1536'  // Vertical portrait format (closest to 9:16 supported by the API)
    }
    const size = sizeMap[settings.aspect_ratio as keyof typeof sizeMap] || '1024x1024'
    
    // Convert blob to array buffer
    const imageArrayBuffer = await sourceImageBlob.arrayBuffer()
    console.log(`Source image size: ${(imageArrayBuffer.byteLength / 1024).toFixed(2)} KB`)
    
    // Create form data for OpenAI (matching @dhilan's approach exactly)
    const openAIForm = new FormData()
    openAIForm.append('model', 'gpt-image-1')
    openAIForm.append('prompt', enhancedPrompt)
    openAIForm.append('n', '1')
    openAIForm.append('size', size)
    openAIForm.append(
      'image',
      new Blob([imageArrayBuffer], { type: 'image/png' }),
      'source.png'
    )

    console.log('Calling OpenAI API...')
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: openAIForm
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('OpenAI API success')

    // Get the generated image
    let imageBlob: Blob

    if (data.data?.[0]?.b64_json) {
      // Convert base64 to blob
      const base64 = data.data[0].b64_json
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      imageBlob = new Blob([bytes], { type: 'image/png' })
    } else if (data.data?.[0]?.url) {
      // Download from URL
      const imgResponse = await fetch(data.data[0].url)
      imageBlob = await imgResponse.blob()
    } else {
      throw new Error('No image data returned from OpenAI')
    }

    // Upload to Supabase storage
    const fileName = `${user.id}/carousels/${Date.now()}_${carouselIndex}_${imageIndex}.png`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generated-carousels')
      .upload(fileName, imageBlob, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw uploadError
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('generated-carousels')
      .getPublicUrl(fileName)

    // Parse dimensions from size
    const [width, height] = size.split('x').map(Number)

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      storagePath: fileName,
      width,
      height,
      carouselIndex,
      imageIndex,
      revised_prompt: data.data?.[0]?.revised_prompt || enhancedPrompt
    })

  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
} 