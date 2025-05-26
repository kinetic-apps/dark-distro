import { createClient } from '@/lib/supabase/client'
import type { 
  ImageGenerationJob, 
  ImageGenerationTemplate, 
  GeneratedCarouselImage,
  CreateJobParams
} from '@/lib/types/image-generation'

const supabase = createClient()

// In-memory job state for real-time updates
const jobStates = new Map<string, {
  status: string
  progress: number
  message: string
  completedImages: GeneratedCarouselImage[]
}>()

export class ImageGenerationService {
  // Job Management
  static async createJob(params: CreateJobParams): Promise<ImageGenerationJob> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Upload source images first
    const imageUrls: string[] = []
    for (let i = 0; i < params.source_images.length; i++) {
      const file = params.source_images[i]
      const fileName = `${user.id}/sources/${Date.now()}_${i}.${file.name.split('.').pop()}`
      
      const { error: uploadError } = await supabase.storage
        .from('generated-carousels')
        .upload(fileName, file)
      
      if (uploadError) throw uploadError
      
      const { data: { publicUrl } } = supabase.storage
        .from('generated-carousels')
        .getPublicUrl(fileName)
      
      imageUrls.push(publicUrl)
    }

    // Create job record
    const { data: job, error } = await supabase
      .from('image_generation_jobs')
      .insert({
        name: params.name,
        template_name: params.template_name,
        prompt: params.prompt,
        variants: params.variants,
        user_id: user.id,
        status: 'processing', // Start as processing immediately
        progress: 0,
        message: 'Initializing...'
      })
      .select()
      .single()

    if (error) throw error

    // Store source images in a simple JSON column if needed
    await supabase
      .from('image_generation_jobs')
      .update({ 
        template_description: JSON.stringify({ source_images: imageUrls })
      })
      .eq('id', job.id)

    // Initialize in-memory state
    jobStates.set(job.id, {
      status: 'processing',
      progress: 0,
      message: 'Starting generation...',
      completedImages: []
    })

    return job
  }

  static async processJobInBackground(jobId: string): Promise<void> {
    try {
      // Call the server-side API to process the job
      const response = await fetch('/api/image-generator/process-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start job processing')
      }

      const result = await response.json()
      console.log('Job processing started:', result)
    } catch (error) {
      console.error('Failed to start job processing:', error)
      
      // Update job state to failed
      const state = jobStates.get(jobId)
      if (state) {
        state.status = 'failed'
        state.message = error instanceof Error ? error.message : 'Failed to start processing'
      }
      
      throw error
    }
  }

  // Get job with real-time state
  static async getJobWithState(jobId: string): Promise<{
    job: ImageGenerationJob | null
    state: typeof jobStates extends Map<string, infer T> ? T : never
    images: GeneratedCarouselImage[]
  }> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Get job from database
    const { data: job } = await supabase
      .from('image_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    // Get generated images
    const { data: images } = await supabase
      .from('generated_carousel_images')
      .select('*')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .order('carousel_index', { ascending: true })
      .order('image_index', { ascending: true })

    // Use database state as source of truth
    const state = {
      status: job?.status || 'unknown',
      progress: job?.progress || 0,
      message: job?.message || '',
      completedImages: images || []
    }

    // Update in-memory state to match database
    if (job) {
      jobStates.set(jobId, state)
    }

    return {
      job,
      state,
      images: images || []
    }
  }

  static async getRecentJobs(limit = 10): Promise<ImageGenerationJob[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('image_generation_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }

  static async deleteJob(jobId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Get images to delete from storage
    const { data: images } = await supabase
      .from('generated_carousel_images')
      .select('storage_path')
      .eq('job_id', jobId)
      .eq('user_id', user.id)

    // Delete from storage
    if (images && images.length > 0) {
      const paths = images
        .filter(img => img.storage_path)
        .map(img => img.storage_path!)
      
      if (paths.length > 0) {
        await supabase.storage
          .from('generated-carousels')
          .remove(paths)
      }
    }

    // Delete job (cascade will delete images)
    await supabase
      .from('image_generation_jobs')
      .delete()
      .eq('id', jobId)
      .eq('user_id', user.id)

    // Clean up in-memory state
    jobStates.delete(jobId)
  }

  static async createTemplate(params: {
    name: string
    description?: string
    source_images: File[]
    default_prompt?: string
    job_id?: string
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
        user_id: user.id,
        job_id: params.job_id
      })
      .select()
      .single()

    if (error) throw error
    return template
  }

  static async getTemplateByJobId(jobId: string): Promise<ImageGenerationTemplate | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('image_generation_templates')
      .select('*')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return null
      }
      throw error
    }
    
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