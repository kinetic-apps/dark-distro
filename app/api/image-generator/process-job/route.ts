import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'
import { AntiShadowbanProcessor } from '@/lib/services/anti-shadowban-processor'
import { DEFAULT_ANTI_SHADOWBAN_SETTINGS } from '@/lib/constants/anti-shadowban'
import { smartWrapPrompt } from '@/lib/services/prompt-wrapper'
import type { ImageGenerationSettings, AntiShadowbanSettings } from '@/lib/types/image-generation'
import { v4 as uuidv4 } from 'uuid'
import { ImageGenerationLogger } from '@/lib/services/image-generation-logger'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 2000 // 2 seconds
const OPENAI_TIMEOUT = 120000 // 120 seconds

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

// Helper function for exponential backoff
function getRetryDelay(attempt: number): number {
  return INITIAL_RETRY_DELAY * Math.pow(2, attempt)
}

// Helper function to retry OpenAI API calls
async function callOpenAIWithRetry(
  formData: FormData,
  imageIndex: number,
  jobId: string,
  userId: string,
  maxRetries: number = MAX_RETRIES
): Promise<Response | null> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const startTime = Date.now()
      
      await ImageGenerationLogger.info(
        jobId,
        userId,
        'base_generation',
        `Attempt ${attempt + 1}/${maxRetries} for image ${imageIndex + 1}`,
        { attempt, imageIndex }
      )
      
      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
        signal: AbortSignal.timeout(OPENAI_TIMEOUT)
      })
      
      const responseTime = Date.now() - startTime
      
      if (response.ok) {
        await ImageGenerationLogger.success(
          jobId,
          userId,
          'base_generation',
          `OpenAI API call succeeded for image ${imageIndex + 1}`,
          { 
            attempt: attempt + 1,
            responseTime,
            imageIndex
          }
        )
        return response
      }
      
      // Handle non-OK responses
      const errorText = await response.text()
      lastError = new Error(`OpenAI API error: ${response.status} - ${errorText}`)
      
      // Don't retry on certain error codes
      if (response.status === 401 || response.status === 400) {
        await ImageGenerationLogger.error(
          jobId,
          userId,
          'base_generation',
          `Non-retryable error for image ${imageIndex + 1}`,
          { 
            status: response.status,
            error: errorText,
            imageIndex
          }
        )
        return null
      }
      
      // Log retry attempt
      if (attempt < maxRetries - 1) {
        const retryDelay = getRetryDelay(attempt)
        await ImageGenerationLogger.warning(
          jobId,
          userId,
          'base_generation',
          `Retrying image ${imageIndex + 1} after ${retryDelay}ms`,
          { 
            attempt: attempt + 1,
            retryDelay,
            status: response.status,
            imageIndex
          }
        )
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
      
    } catch (error) {
      lastError = error as Error
      const isTimeout = error instanceof Error && error.name === 'TimeoutError'
      
      await ImageGenerationLogger.error(
        jobId,
        userId,
        'base_generation',
        `${isTimeout ? 'Timeout' : 'Network error'} for image ${imageIndex + 1}, attempt ${attempt + 1}`,
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          attempt: attempt + 1,
          imageIndex,
          isTimeout
        }
      )
      
      // If not the last attempt, wait before retrying
      if (attempt < maxRetries - 1) {
        const retryDelay = getRetryDelay(attempt)
        await ImageGenerationLogger.info(
          jobId,
          userId,
          'base_generation',
          `Waiting ${retryDelay}ms before retry`,
          { retryDelay, imageIndex }
        )
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }
  }
  
  // All retries failed
  await ImageGenerationLogger.error(
    jobId,
    userId,
    'base_generation',
    `All ${maxRetries} attempts failed for image ${imageIndex + 1}`,
    { 
      error: lastError?.message || 'Unknown error',
      imageIndex,
      maxRetries
    }
  )
  
  return null
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

    // Log initialization
    await ImageGenerationLogger.info(
      jobId, 
      job.user_id, 
      'initialization', 
      'Starting image generation job',
      { 
        jobName: job.name,
        variants: job.variants,
        templateName: job.template_name
      }
    )

    // Clear existing data for this job (for retry functionality)
    // First get existing variants
    const { data: existingVariants } = await supabase
      .from('carousel_variants')
      .select('id')
      .eq('job_id', jobId)

    if (existingVariants && existingVariants.length > 0) {
      const variantIds = existingVariants.map(v => v.id)
      
      // Delete slides
      await supabase
        .from('variant_slides')
        .delete()
        .in('variant_id', variantIds)
      
      // Delete assignments
      await supabase
        .from('variant_assignments')
        .delete()
        .in('variant_id', variantIds)
    }

    // Delete variants
    await supabase
      .from('carousel_variants')
      .delete()
      .eq('job_id', jobId)

    // Clear existing generated images for this job
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

    // Log cleanup
    await ImageGenerationLogger.info(
      jobId,
      job.user_id,
      'cleanup',
      'Cleared existing data for retry',
      { deletedImages: existingImages?.length || 0 }
    )

    // Parse source images
    const { source_images: sourceImages } = JSON.parse(job.template_description || '{}')
    if (!sourceImages || sourceImages.length === 0) {
      await ImageGenerationLogger.error(
        jobId,
        job.user_id,
        'validation',
        'No source images found in template',
        { templateDescription: job.template_description }
      )
      return NextResponse.json({ error: 'No source images found' }, { status: 400 })
    }

    await ImageGenerationLogger.info(
      jobId,
      job.user_id,
      'validation',
      `Found ${sourceImages.length} source images`,
      { sourceImages }
    )

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

    // Create job folder path
    const timestamp = Date.now()
    const jobFolderPath = `${job.user_id}/generated/job-${timestamp}-${jobId}`

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

      await ImageGenerationLogger.info(
        jobId,
        job.user_id,
        'base_generation',
        `Starting base image generation ${imageIndex + 1}/${sourceImages.length}`,
        { 
          imageIndex,
          sourceUrl: sourceImageUrl,
          prompt: prompts[imageIndex]
        }
      )

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
        
        await ImageGenerationLogger.info(
          jobId,
          job.user_id,
          'base_generation',
          `Wrapped prompt for image ${imageIndex + 1}`,
          { 
            originalPrompt: prompts[imageIndex],
            wrappedPrompt,
            size
          }
        )

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
        
        const openAIResponse = await callOpenAIWithRetry(
          formData,
          imageIndex,
          jobId,
          job.user_id
        )

        if (!openAIResponse) {
          // Already logged in callOpenAIWithRetry
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
          
          await ImageGenerationLogger.success(
            jobId,
            job.user_id,
            'base_generation',
            `Successfully generated base image ${imageIndex + 1}`,
            { 
              imageIndex,
              width: outputWidth,
              height: outputHeight,
              size
            }
          )
          
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
        await ImageGenerationLogger.error(
          jobId,
          job.user_id,
          'base_generation',
          `Failed to generate base image ${imageIndex + 1}`,
          { 
            imageIndex,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      }
    }

    if (baseImages.length === 0) {
      await ImageGenerationLogger.error(
        jobId,
        job.user_id,
        'base_generation',
        'No base images were successfully generated',
        { attemptedCount: sourceImages.length }
      )
      
      // Mark job as failed if no images were generated
      await supabase
        .from('image_generation_jobs')
        .update({
          status: 'failed',
          progress: 0,
          message: 'Failed to generate any images. Please try again.',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)
      
      return NextResponse.json({
        success: false,
        error: 'Failed to generate any images',
        generatedCount: 0,
        totalExpected: totalOperations
      }, { status: 500 })
    } else if (baseImages.length < sourceImages.length) {
      await ImageGenerationLogger.warning(
        jobId,
        job.user_id,
        'base_generation',
        `Partial success: Generated ${baseImages.length} of ${sourceImages.length} base images`,
        { 
          successCount: baseImages.length,
          totalCount: sourceImages.length,
          failedCount: sourceImages.length - baseImages.length
        }
      )
    } else {
      await ImageGenerationLogger.success(
        jobId,
        job.user_id,
        'base_generation',
        `Generated ${baseImages.length} base images`,
        { totalCount: baseImages.length }
      )
    }

    // Step 2: Create variants by applying anti-shadowban processing
    for (let variantIndex = 0; variantIndex < job.variants; variantIndex++) {
      // Generate unique variant ID
      const variantId = uuidv4()
      const variantFolderPath = `${jobFolderPath}/variant-${variantId}`
      
      await ImageGenerationLogger.info(
        jobId,
        job.user_id,
        'variant_creation',
        `Starting variant ${variantIndex + 1}/${job.variants}`,
        { 
          variantIndex,
          variantId,
          folderPath: variantFolderPath
        }
      )

      // Create variant record
      const { data: variantRecord, error: variantError } = await supabase
        .from('carousel_variants')
        .insert({
          job_id: jobId,
          variant_index: variantIndex,
          variant_id: variantId,
          folder_path: variantFolderPath,
          slide_count: baseImages.length,
          status: 'ready',
          metadata: {
            prompts: prompts,
            settings: settings,
            antiShadowbanSettings: antiShadowbanSettings
          }
        })
        .select()
        .single()

      if (variantError || !variantRecord) {
        console.error('Error creating variant record:', variantError)
        continue
      }

      const variantSlides = []

      for (let imageIndex = 0; imageIndex < baseImages.length; imageIndex++) {
        const baseImage = baseImages[imageIndex]
        
        // Update progress
        const variantProgress = 30 + Math.floor((completedOperations / totalOperations) * 70) // Remaining 70% for variants
        
        // Update progress more frequently for large jobs
        if (job.variants > 50 || (completedOperations % 10 === 0)) {
          await supabase
            .from('image_generation_jobs')
            .update({ 
              progress: variantProgress, 
              message: `Creating variant ${variantIndex + 1} of image ${imageIndex + 1}...` 
            })
            .eq('id', jobId)
        }

        try {
          // Apply anti-shadowban processing
          await ImageGenerationLogger.info(
            jobId,
            job.user_id,
            'processing',
            `Applying anti-shadowban processing to variant ${variantIndex + 1}, image ${imageIndex + 1}`,
            { 
              variantIndex,
              imageIndex,
              antiShadowbanSettings
            }
          )

          const processor = new AntiShadowbanProcessor(antiShadowbanSettings, variantIndex, imageIndex)
          const processedBuffer = await processor.processImage(baseImage.buffer)
          
          // Generate sequential filename
          const slideNumber = String(imageIndex + 1).padStart(3, '0')
          const fileName = `${slideNumber}-${jobId}-${variantId}.jpg`
          const storagePath = `${variantFolderPath}/${fileName}`
          
          // Upload processed image to storage
          const { error: uploadError } = await supabase.storage
            .from('generated-carousels')
            .upload(storagePath, processedBuffer, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true
            })

          if (uploadError) {
            console.error('Upload error:', uploadError)
            await ImageGenerationLogger.error(
              jobId,
              job.user_id,
              'upload',
              `Failed to upload variant ${variantIndex + 1}, image ${imageIndex + 1}`,
              { 
                variantIndex,
                imageIndex,
                error: uploadError.message,
                storagePath
              }
            )
            continue
          }

          await ImageGenerationLogger.success(
            jobId,
            job.user_id,
            'upload',
            `Successfully uploaded variant ${variantIndex + 1}, image ${imageIndex + 1}`,
            { 
              variantIndex,
              imageIndex,
              storagePath,
              fileName
            }
          )

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('generated-carousels')
            .getPublicUrl(storagePath)

          // Save slide record
          const { data: slideRecord, error: slideError } = await supabase
            .from('variant_slides')
            .insert({
              variant_id: variantRecord.id,
              slide_order: imageIndex + 1,
              filename: fileName,
              storage_path: storagePath,
              image_url: publicUrl,
              width: baseImage.width,
              height: baseImage.height,
              caption: `Slide ${imageIndex + 1}`,
              alt_text: baseImage.prompt
            })
            .select()
            .single()

          if (!slideError && slideRecord) {
            variantSlides.push(slideRecord)
          }

          // Also save to generated_carousel_images for backward compatibility
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
              user_id: job.user_id,
              variant_id: variantRecord.id
            })
            .select()
            .single()

          if (!dbError && imageRecord) {
            generatedImages.push(imageRecord)
            completedOperations++
          }
        } catch (error) {
          console.error(`Error processing variant ${variantIndex} of image ${imageIndex}:`, error)
          await ImageGenerationLogger.error(
            jobId,
            job.user_id,
            'variant_creation',
            `Failed to process variant ${variantIndex + 1}, image ${imageIndex + 1}`,
            { 
              variantIndex,
              imageIndex,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          )
        }
      }

      // Update variant with slide count
      await supabase
        .from('carousel_variants')
        .update({ slide_count: variantSlides.length })
        .eq('id', variantRecord.id)
      
      // Log progress for large jobs
      if (job.variants > 50 && (variantIndex + 1) % 10 === 0) {
        await ImageGenerationLogger.info(
          jobId,
          job.user_id,
          'variant_creation',
          `Progress update: Completed ${variantIndex + 1} of ${job.variants} variants`,
          { 
            completedVariants: variantIndex + 1,
            totalVariants: job.variants,
            percentComplete: Math.floor(((variantIndex + 1) / job.variants) * 100)
          }
        )
      }
    }

    // Update job as completed
    const finalStatus = generatedImages.length === 0 ? 'failed' : 
                       generatedImages.length < totalOperations ? 'completed_partial' : 
                       'completed'
    
    const finalMessage = generatedImages.length === 0 
      ? 'Failed to generate any images'
      : generatedImages.length < totalOperations 
      ? `Partially completed: Generated ${generatedImages.length} of ${totalOperations} images (${baseImages.length}/${sourceImages.length} base images succeeded)`
      : `Successfully generated ${generatedImages.length} images in ${job.variants} variants`

    await supabase
      .from('image_generation_jobs')
      .update({
        status: finalStatus,
        progress: 100,
        message: finalMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)

    await ImageGenerationLogger.success(
      jobId,
      job.user_id,
      'completion',
      `Job completed with status: ${finalStatus}`,
      { 
        generatedCount: generatedImages.length,
        totalExpected: totalOperations,
        variantCount: job.variants,
        baseImagesGenerated: baseImages.length,
        baseImagesExpected: sourceImages.length,
        status: finalStatus
      }
    )

    return NextResponse.json({
      success: true,
      generatedCount: generatedImages.length,
      totalExpected: totalOperations,
      variantCount: job.variants
    })

  } catch (error) {
    console.error('Job processing error:', error)
    
    // Mark job as failed
    const supabase = await createClient()
    const { jobId } = await request.json().catch(() => ({ jobId: null }))
    
    if (jobId) {
      // Get job to get user_id for logging
      const { data: job } = await supabase
        .from('image_generation_jobs')
        .select('user_id')
        .eq('id', jobId)
        .single()

      if (job) {
        await ImageGenerationLogger.error(
          jobId,
          job.user_id,
          'processing',
          'Job failed with error',
          { 
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        )
      }

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