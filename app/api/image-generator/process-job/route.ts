import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json()
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    const supabase = await createClient()
    
    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('image_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Parse source images
    const { source_images: sourceImages } = JSON.parse(job.template_description || '{}')
    if (!sourceImages || sourceImages.length === 0) {
      return NextResponse.json({ error: 'No source images found' }, { status: 400 })
    }

    // Parse prompts array
    let prompts: string[] = []
    try {
      prompts = JSON.parse(job.prompt)
      if (!Array.isArray(prompts) || prompts.length !== sourceImages.length) {
        // Fallback to single prompt for all images
        prompts = new Array(sourceImages.length).fill(job.prompt)
      }
    } catch {
      // If parsing fails, use the prompt as-is for all images
      prompts = new Array(sourceImages.length).fill(job.prompt)
    }

    const totalOperations = job.variants * sourceImages.length
    let completedOperations = 0
    const generatedImages = []

    // Process each variant
    for (let variantIndex = 0; variantIndex < job.variants; variantIndex++) {
      for (let imageIndex = 0; imageIndex < sourceImages.length; imageIndex++) {
        const sourceImageUrl = sourceImages[imageIndex]
        
        // Update progress
        const progress = Math.floor((completedOperations / totalOperations) * 100)
        await supabase
          .from('image_generation_jobs')
          .update({ 
            progress, 
            message: `Processing variant ${variantIndex + 1}, image ${imageIndex + 1}...` 
          })
          .eq('id', jobId)

        try {
          // Download source image
          const imageResponse = await fetch(sourceImageUrl)
          const imageBlob = await imageResponse.blob()
          const arrayBuffer = await imageBlob.arrayBuffer()

          // Create form data for OpenAI
          const formData = new FormData()
          formData.append('model', 'gpt-image-1')
          formData.append('prompt', prompts[imageIndex])
          formData.append('n', '1')
          formData.append('size', '1024x1024')
          formData.append(
            'image',
            new Blob([arrayBuffer], { type: 'image/png' }),
            'image.png'
          )

          // Call OpenAI
          console.log(`Calling OpenAI for variant ${variantIndex + 1}, image ${imageIndex + 1}`)
          const openAIResponse = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: formData
          })

          if (!openAIResponse.ok) {
            const error = await openAIResponse.text()
            console.error('OpenAI error:', error)
            continue
          }

          const data = await openAIResponse.json()
          
          if (data.data?.[0]?.b64_json) {
            // Convert base64 to blob
            const base64 = data.data[0].b64_json
            const binaryString = atob(base64)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            const generatedBlob = new Blob([bytes], { type: 'image/png' })

            // Upload to storage
            const fileName = `${job.user_id}/generated/${Date.now()}_${variantIndex}_${imageIndex}.png`
            const { error: uploadError } = await supabase.storage
              .from('generated-carousels')
              .upload(fileName, generatedBlob, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: true
              })

            if (uploadError) {
              console.error('Upload error:', uploadError)
              continue
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('generated-carousels')
              .getPublicUrl(fileName)

            // Save to database
            const { data: imageRecord, error: dbError } = await supabase
              .from('generated_carousel_images')
              .insert({
                job_id: jobId,
                carousel_index: variantIndex,
                image_index: imageIndex,
                source_image_url: sourceImageUrl,
                generated_image_url: publicUrl,
                storage_path: fileName,
                width: 1024,
                height: 1024,
                prompt_used: prompts[imageIndex],
                user_id: job.user_id
              })
              .select()
              .single()

            if (!dbError && imageRecord) {
              generatedImages.push(imageRecord)
              completedOperations++
            }
          }
        } catch (error) {
          console.error(`Error processing image ${imageIndex} for variant ${variantIndex}:`, error)
        }
      }
    }

    // Update job as completed
    await supabase
      .from('image_generation_jobs')
      .update({
        status: 'completed',
        progress: 100,
        message: `Successfully generated ${generatedImages.length} images`,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)

    return NextResponse.json({
      success: true,
      generatedCount: generatedImages.length,
      totalExpected: totalOperations
    })

  } catch (error) {
    console.error('Job processing error:', error)
    
    // Mark job as failed
    const supabase = await createClient()
    const { jobId } = await request.json().catch(() => ({ jobId: null }))
    
    if (jobId) {
      await supabase
        .from('image_generation_jobs')
        .update({
          status: 'failed',
          progress: 0,
          message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', jobId)
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    )
  }
} 