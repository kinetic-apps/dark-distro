import { createClient } from '@/lib/supabase/client'
import type { 
  ImageGenerationJob, 
  ImageGenerationTemplate, 
  GeneratedCarouselImage,
  CreateJobParams,
  ImageGenerationSettings 
} from '@/lib/types/image-generation'

const supabase = createClient()

export class ImageGenerationService {
  // Job Management
  static async createJob(params: CreateJobParams): Promise<ImageGenerationJob> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // First, upload source images to create a template or use existing
    let templateId = params.template_id
    
    if (!templateId && params.source_images.length > 0) {
      // Create a new template from the uploaded images
      const template = await this.createTemplate({
        name: params.template_name,
        description: params.template_description,
        source_images: params.source_images,
        default_prompt: params.prompt,
        default_settings: params.settings
      })
      templateId = template.id
    }

    const { data: job, error } = await supabase
      .from('image_generation_jobs')
      .insert({
        name: params.name,
        template_id: templateId,
        template_name: params.template_name,
        template_description: params.template_description,
        prompt: params.prompt,
        variants: params.variants,
        settings: params.settings,
        user_id: user.id,
        status: 'queued'
      })
      .select()
      .single()

    if (error) throw error
    return job
  }

  static async createTemplate(params: {
    name: string
    description?: string
    source_images: File[]
    default_prompt?: string
    default_settings?: ImageGenerationSettings
  }): Promise<ImageGenerationTemplate> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Upload source images to storage
    const imageUrls: string[] = []
    
    for (let i = 0; i < params.source_images.length; i++) {
      const file = params.source_images[i]
      const fileName = `${user.id}/templates/${Date.now()}_${i}.${file.name.split('.').pop()}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('generated-carousels')
        .upload(fileName, file)
      
      if (uploadError) throw uploadError
      
      const { data: { publicUrl } } = supabase.storage
        .from('generated-carousels')
        .getPublicUrl(fileName)
      
      imageUrls.push(publicUrl)
    }

    // Create template record
    const { data: template, error } = await supabase
      .from('image_generation_templates')
      .insert({
        name: params.name,
        description: params.description,
        source_images: imageUrls,
        thumbnail_url: imageUrls[0], // Use first image as thumbnail
        default_prompt: params.default_prompt,
        default_settings: params.default_settings || {},
        user_id: user.id
      })
      .select()
      .single()

    if (error) throw error
    return template
  }

  static async processJob(jobId: string): Promise<void> {
    try {
      // Get the job details
      const { data: job, error: jobError } = await supabase
        .from('image_generation_jobs')
        .select('*, template:image_generation_templates(*)')
        .eq('id', jobId)
        .single()

      if (jobError) throw jobError
      if (!job) throw new Error('Job not found')

      // Update job status to processing
      await this.updateJobStatus(jobId, 'processing', 10, 'Starting image generation...')

      // Get source images from template
      const sourceImages = job.template?.source_images || []
      if (sourceImages.length === 0) {
        throw new Error('No source images found in template')
      }

      // Process each carousel variant
      const generatedImages: GeneratedCarouselImage[] = []
      const totalOperations = job.variants * sourceImages.length
      let completedOperations = 0

      for (let carouselIndex = 0; carouselIndex < job.variants; carouselIndex++) {
        const carouselImages: string[] = []
        
        for (let imageIndex = 0; imageIndex < sourceImages.length; imageIndex++) {
          const sourceImageUrl = sourceImages[imageIndex]
          const progress = Math.floor((completedOperations / totalOperations) * 80) + 10
          
          await this.updateJobStatus(
            jobId, 
            'processing', 
            progress, 
            `Generating carousel ${carouselIndex + 1}/${job.variants}, image ${imageIndex + 1}/${sourceImages.length}...`
          )

          // Call the API to generate the image
          const formData = new FormData()
          
          // Download source image and add to form
          const imageResponse = await fetch(sourceImageUrl)
          const imageBlob = await imageResponse.blob()
          formData.append('source_image', imageBlob, 'image.png')
          formData.append('prompt', job.prompt)
          formData.append('carousel_index', carouselIndex.toString())
          formData.append('image_index', imageIndex.toString())
          formData.append('settings', JSON.stringify(job.settings))

          const response = await fetch('/api/image-generator/generate-v2', {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            throw new Error(`Failed to generate image: ${response.statusText}`)
          }

          const result = await response.json()
          
          // Store the generated image record
          const { data: imageRecord, error: imageError } = await supabase
            .from('generated_carousel_images')
            .insert({
              job_id: jobId,
              carousel_index: carouselIndex,
              image_index: imageIndex,
              source_image_url: sourceImageUrl,
              generated_image_url: result.imageUrl,
              storage_path: result.storagePath,
              width: result.width,
              height: result.height,
              prompt_used: job.prompt,
              settings_used: job.settings,
              user_id: job.user_id
            })
            .select()
            .single()

          if (imageError) throw imageError
          
          generatedImages.push(imageRecord)
          carouselImages.push(result.imageUrl)
          completedOperations++
        }
      }

      // Update job as completed
      await this.updateJobStatus(jobId, 'completed', 100, `Successfully generated ${job.variants} carousel(s)`)
      
    } catch (error) {
      console.error('Error processing job:', error)
      await this.updateJobStatus(jobId, 'failed', 0, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  static async updateJobStatus(
    jobId: string, 
    status: ImageGenerationJob['status'], 
    progress: number, 
    message?: string
  ): Promise<void> {
    const updateData: any = { status, progress, message }
    
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('image_generation_jobs')
      .update(updateData)
      .eq('id', jobId)

    if (error) throw error
  }

  static async getJobs(limit = 20, offset = 0): Promise<ImageGenerationJob[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('image_generation_jobs')
      .select(`
        *,
        generated_images:generated_carousel_images(count),
        template:image_generation_templates(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data || []
  }

  static async getJob(jobId: string): Promise<ImageGenerationJob | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('image_generation_jobs')
      .select(`
        *,
        generated_images:generated_carousel_images(*),
        template:image_generation_templates(*)
      `)
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (error) throw error
    return data
  }

  static async getTemplates(): Promise<ImageGenerationTemplate[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('image_generation_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async toggleTemplateFavorite(templateId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Get current state
    const { data: template, error: fetchError } = await supabase
      .from('image_generation_templates')
      .select('is_favorite')
      .eq('id', templateId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) throw fetchError

    // Toggle favorite
    const { error } = await supabase
      .from('image_generation_templates')
      .update({ is_favorite: !template.is_favorite })
      .eq('id', templateId)
      .eq('user_id', user.id)

    if (error) throw error
  }

  static async deleteJob(jobId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Get associated images to delete from storage
    const { data: images, error: fetchError } = await supabase
      .from('generated_carousel_images')
      .select('storage_path')
      .eq('job_id', jobId)
      .eq('user_id', user.id)

    if (fetchError) throw fetchError

    // Delete from storage
    if (images && images.length > 0) {
      const paths = images
        .filter(img => img.storage_path)
        .map(img => img.storage_path!)
      
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('generated-carousels')
          .remove(paths)
        
        if (storageError) console.error('Error deleting images from storage:', storageError)
      }
    }

    // Delete job (cascade will delete images)
    const { error } = await supabase
      .from('image_generation_jobs')
      .delete()
      .eq('id', jobId)
      .eq('user_id', user.id)

    if (error) throw error
  }

  static subscribeToJobUpdates(jobId: string, callback: (job: ImageGenerationJob) => void) {
    return supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'image_generation_jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new as ImageGenerationJob)
          }
        }
      )
      .subscribe()
  }
} 