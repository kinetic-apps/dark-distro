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
    const prompt = formData.get('prompt') as string || 'Create a variation of this image'
    const carouselIndex = parseInt(formData.get('carousel_index') as string) || 0
    const imageIndex = parseInt(formData.get('image_index') as string) || 0
    
    if (!sourceImageBlob) {
      return NextResponse.json({ error: 'No source image provided' }, { status: 400 })
    }

    console.log(`Processing carousel ${carouselIndex}, image ${imageIndex}`)
    
    // Convert blob to array buffer
    const arrayBuffer = await sourceImageBlob.arrayBuffer()
    console.log(`Source image size: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`)
    
    // Create minimal form data for OpenAI
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

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      storagePath: fileName,
      width: 1024,
      height: 1024,
      carouselIndex,
      imageIndex,
      revised_prompt: data.data?.[0]?.revised_prompt || prompt
    })

  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
} 