import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'
import { AntiShadowbanProcessor } from '@/lib/services/anti-shadowban-processor'
import { DEFAULT_ANTI_SHADOWBAN_SETTINGS } from '@/lib/constants/anti-shadowban'
import { smartWrapPrompt } from '@/lib/services/prompt-wrapper'
import type { ImageGenerationSettings, AntiShadowbanSettings } from '@/lib/types/image-generation'

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

    // Clear existing generated images for this job (for retry functionality)
    const { data: existingImages } = await supabase
      .from('generated_carousel_images')
      .select('storage_path')
      .eq('job_id', jobId)

    // Delete from storage
    if (existingImages && existingImages.length > 0) {
      const paths = existingImages
        .filter(img => img.storage_path)
        .map(img => img.storage_path!)
      
      if (paths.length > 0) {
        await supabase.storage
          .from('generated-carousels')
          .remove(paths)
      }
    }

    // Delete from database
    await supabase
      .from('generated_carousel_images')
      .delete()
      .eq('job_id', jobId)

    // Reset job status
    await supabase
      .from('image_generation_jobs')
      .update({
        status: 'processing',
        progress: 0,
        message: 'Starting generation...',
        completed_at: null
      })
      .eq('id', jobId)

    // Parse source images
    const { source_images: sourceImages } = JSON.parse(job.template_description || '{}')
    if (!sourceImages || sourceImages.length === 0) {
      return NextResponse.json({ error: 'No source images found' }, { status: 400 })
    }

    // Parse job data (prompts and settings)
    let prompts: string[] = []
    let settings: ImageGenerationSettings = { aspect_ratio: 'auto' }
    
    try {
      const jobData = JSON.parse(job.prompt)
      if (jobData.prompts && Array.isArray(jobData.prompts)) {
        prompts = jobData.prompts
        settings = jobData.settings || { aspect_ratio: 'auto' }
      } else {
        // Fallback for old format
        prompts = Array.isArray(jobData) ? jobData : new Array(sourceImages.length).fill(job.prompt)
      }
    } catch {
      // If parsing fails, use the prompt as-is for all images
      prompts = new Array(sourceImages.length).fill(job.prompt)
    }

    // Ensure prompts array matches source images length
    if (prompts.length !== sourceImages.length) {
      prompts = new Array(sourceImages.length).fill(prompts[0] || job.prompt)
    }

    // Get anti-shadowban settings
    const antiShadowbanSettings: AntiShadowbanSettings = settings.antiShadowban || DEFAULT_ANTI_SHADOWBAN_SETTINGS

    const totalOperations = job.variants * sourceImages.length
    let completedOperations = 0
    const generatedImages = []

    // Step 1: Generate base images from OpenAI (one per source image)
    const baseImages: { 
      buffer: Buffer
      width: number
      height: number
      sourceUrl: string
      prompt: string
    }[] = []
    
    for (let imageIndex = 0; imageIndex < sourceImages.length; imageIndex++) {
      const sourceImageUrl = sourceImages[imageIndex]
      
      // Update progress
      const progress = Math.floor((imageIndex / sourceImages.length) * 30) // First 30% for OpenAI generation
      await supabase
        .from('image_generation_jobs')
        .update({ 
          progress, 
          message: `Generating base image ${imageIndex + 1} of ${sourceImages.length}...` 
        })
        .eq('id', jobId)

      try {
        // Download source image
        const imageResponse = await fetch(sourceImageUrl)
        const imageBlob = await imageResponse.blob()
        const arrayBuffer = await imageBlob.arrayBuffer()

        // Detect image dimensions using sharp
        let size = 'auto' // default to auto
        let detectedWidth = 1024
        let detectedHeight = 1024
        
        if (settings.aspect_ratio && settings.aspect_ratio !== 'auto') {
          // Use specified aspect ratio
          const aspectRatioMap: Record<string, string> = {
            '1:1': '1024x1024',
            '3:2': '1536x1024',
            '2:3': '1024x1536',
            '16:9': '1536x1024',  // closest to 16:9
            '9:16': '1024x1536',  // closest to 9:16
          }
          size = aspectRatioMap[settings.aspect_ratio] || 'auto'
        } else {
          // Auto mode - let OpenAI decide based on input
          size = 'auto'
          
          // Still detect dimensions for metadata
          try {
            const imageBuffer = Buffer.from(arrayBuffer)
            const metadata = await sharp(imageBuffer).metadata()
            if (metadata.width && metadata.height) {
              detectedWidth = metadata.width
              detectedHeight = metadata.height
              size = getOpenAISize(detectedWidth, detectedHeight)
            }
          } catch (error) {
            console.error('Error detecting image dimensions:', error)
          }
        }

        // Wrap the prompt for text replacement
        const wrappedPrompt = smartWrapPrompt(prompts[imageIndex])
        console.log(`Original prompt: "${prompts[imageIndex]}"`)
        console.log(`Wrapped prompt: "${wrappedPrompt}"`)
        
        // Create form data for OpenAI
        const formData = new FormData()
        formData.append('model', 'gpt-image-1')
        formData.append('prompt', wrappedPrompt)
        formData.append('n', '1')
        formData.append('size', size)
        formData.append(
          'image',
          new Blob([arrayBuffer], { type: 'image/png' }),
          'image.png'
        )

        // Call OpenAI
        console.log(`Calling OpenAI for base image ${imageIndex + 1} with size: ${size}`)
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
          // Convert base64 to buffer
          const base64 = data.data[0].b64_json
          const binaryString = atob(base64)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          
          // Determine actual dimensions based on size used
          let outputWidth = detectedWidth
          let outputHeight = detectedHeight
          if (size !== 'auto') {
            [outputWidth, outputHeight] = size.split('x').map(Number)
          }
          
          baseImages.push({
            buffer: Buffer.from(bytes),
            width: outputWidth,
            height: outputHeight,
            sourceUrl: sourceImageUrl,
            prompt: prompts[imageIndex]
          })
        }
      } catch (error) {
        console.error(`Error generating base image ${imageIndex}:`, error)
      }
    }

    // Step 2: Create variants by applying anti-shadowban processing
    for (let variantIndex = 0; variantIndex < job.variants; variantIndex++) {
      for (let imageIndex = 0; imageIndex < baseImages.length; imageIndex++) {
        const baseImage = baseImages[imageIndex]
        
        // Update progress
        const variantProgress = 30 + Math.floor((completedOperations / totalOperations) * 70) // Remaining 70% for variants
        await supabase
          .from('image_generation_jobs')
          .update({ 
            progress: variantProgress, 
            message: `Creating variant ${variantIndex + 1} of image ${imageIndex + 1}...` 
          })
          .eq('id', jobId)

        try {
          // Apply anti-shadowban processing
          const processor = new AntiShadowbanProcessor(antiShadowbanSettings, variantIndex, imageIndex)
          const processedBuffer = await processor.processImage(baseImage.buffer)
          const fileName = processor.generateFileName()
          
          // Upload processed image to storage
          const storagePath = `${job.user_id}/generated/${Date.now()}_${fileName}`
          const { error: uploadError } = await supabase.storage
            .from('generated-carousels')
            .upload(storagePath, processedBuffer, {
              contentType: 'image/jpeg',
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
            .getPublicUrl(storagePath)

          // Save to database
          const { data: imageRecord, error: dbError } = await supabase
            .from('generated_carousel_images')
            .insert({
              job_id: jobId,
              carousel_index: variantIndex,
              image_index: imageIndex,
              source_image_url: baseImage.sourceUrl,
              generated_image_url: publicUrl,
              storage_path: storagePath,
              width: baseImage.width,
              height: baseImage.height,
              prompt_used: baseImage.prompt,
              user_id: job.user_id
            })
            .select()
            .single()

          if (!dbError && imageRecord) {
            generatedImages.push(imageRecord)
            completedOperations++
          }
        } catch (error) {
          console.error(`Error processing variant ${variantIndex} of image ${imageIndex}:`, error)
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