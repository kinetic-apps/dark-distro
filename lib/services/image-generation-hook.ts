import { createClient } from '@/lib/supabase/client'
import { StorageService } from './storage-service'

export class ImageGenerationHook {
  private static instance: ImageGenerationHook
  private supabase = createClient()
  private storageService = StorageService.getInstance()

  private constructor() {}

  static getInstance(): ImageGenerationHook {
    if (!ImageGenerationHook.instance) {
      ImageGenerationHook.instance = new ImageGenerationHook()
    }
    return ImageGenerationHook.instance
  }

  /**
   * Copy generated carousel variants to storage
   */
  async copyGeneratedAssetsToStorage(jobId: string): Promise<void> {
    try {
      // Get job details with variants and slides
      const { data: job, error: jobError } = await this.supabase
        .from('image_generation_jobs')
        .select(`
          *,
          carousel_variants (
            *,
            variant_slides (
              *
            )
          )
        `)
        .eq('id', jobId)
        .single()

      if (jobError || !job) {
        console.error('Error fetching job:', jobError)
        return
      }

      // Process each variant
      for (const variant of job.carousel_variants || []) {
        if (!variant.variant_slides || variant.variant_slides.length === 0) continue

        // Create carousel folder name
        const carouselName = `${job.name}_variant_${variant.variant_index + 1}_${Date.now()}`
        const targetFolder = `${StorageService.FOLDERS.READY}/generated/${carouselName}`

        // Copy each slide to the new folder
        for (const slide of variant.variant_slides) {
          const sourcePath = slide.storage_path
          const targetPath = `${targetFolder}/slide_${String(slide.slide_order).padStart(3, '0')}.jpg`

          try {
            // Download the file
            const { data: fileData, error: downloadError } = await this.supabase.storage
              .from('generated-carousels')
              .download(sourcePath)

            if (downloadError || !fileData) {
              console.error('Error downloading slide:', downloadError)
              continue
            }

            // Upload to new location
            const { error: uploadError } = await this.supabase.storage
              .from('generated-carousels')
              .upload(targetPath, fileData, {
                cacheControl: '3600',
                upsert: false
              })

            if (uploadError) {
              console.error('Error uploading slide:', uploadError)
            }
          } catch (error) {
            console.error('Error copying slide:', error)
          }
        }

        // Track the generation
        await this.storageService.trackUsage(
          targetFolder,
          'carousel',
          'generated',
          undefined,
          undefined,
          {
            job_id: jobId,
            job_name: job.name,
            variant_id: variant.id,
            variant_index: variant.variant_index,
            slide_count: variant.variant_slides.length,
            template: job.template_name
          }
        )
      }
    } catch (error) {
      console.error('Error in copyGeneratedAssetsToStorage:', error)
    }
  }

  /**
   * Set up real-time listener for completed jobs
   */
  setupRealtimeListener(): void {
    this.supabase
      .channel('image-generation-jobs')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'image_generation_jobs',
          filter: 'status=eq.completed'
        },
        async (payload) => {
          console.log('Job completed:', payload.new.id)
          await this.copyGeneratedAssetsToStorage(payload.new.id)
        }
      )
      .subscribe()
  }
} 