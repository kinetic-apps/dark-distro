import { createClient } from '@/lib/supabase/client'
import { GoogleDriveService } from './google-drive'
import { downloadFilesAsZip } from '@/lib/utils/download'
import type { ImageGenerationJob, GeneratedCarouselImage } from '@/lib/types/image-generation'

export interface AgencyWorkflowJob {
  job: ImageGenerationJob
  selected: boolean
  dayLabel?: string // e.g., "Day 1", "Monday", etc.
}

export interface CreatorFolder {
  creatorIndex: number
  creatorName: string
  days: {
    dayLabel: string
    jobId: string
    jobName: string
    variantIndex: number
    images: GeneratedCarouselImage[]
  }[]
}

export interface AgencyExportOptions {
  namingPattern: 'creator_number' | 'custom_names'
  customNames?: string[]
  dayLabeling: 'day_number' | 'weekday' | 'custom'
  customDayLabels?: string[]
  exportType: 'local' | 'google_drive'
  googleDriveFolderId?: string
}

export class AgencyWorkflowService {
  private static instance: AgencyWorkflowService
  private supabase = createClient()
  private driveService = GoogleDriveService.getInstance()

  static getInstance(): AgencyWorkflowService {
    if (!AgencyWorkflowService.instance) {
      AgencyWorkflowService.instance = new AgencyWorkflowService()
    }
    return AgencyWorkflowService.instance
  }

  /**
   * Reorganize selected jobs into creator-specific folders
   * Each creator gets one variant from each job
   */
  async reorganizeForCreators(
    selectedJobs: ImageGenerationJob[],
    options: AgencyExportOptions
  ): Promise<CreatorFolder[]> {
    // Validate that all jobs have the same number of variants
    const variantCounts = selectedJobs.map(job => job.variants)
    const uniqueCounts = [...new Set(variantCounts)]
    
    if (uniqueCounts.length > 1) {
      throw new Error('All selected jobs must have the same number of variants')
    }

    const creatorCount = uniqueCounts[0]
    const creatorFolders: CreatorFolder[] = []

    // Create a folder for each creator
    for (let creatorIndex = 0; creatorIndex < creatorCount; creatorIndex++) {
      const creatorName = this.getCreatorName(creatorIndex, options)
      const creatorFolder: CreatorFolder = {
        creatorIndex,
        creatorName,
        days: []
      }

      // Add one variant from each job to this creator's folder
      for (let jobIndex = 0; jobIndex < selectedJobs.length; jobIndex++) {
        const job = selectedJobs[jobIndex]
        const dayLabel = this.getDayLabel(jobIndex, options)
        
        // Get the images for this variant
        const { data: images } = await this.supabase
          .from('generated_carousel_images')
          .select('*')
          .eq('job_id', job.id)
          .eq('carousel_index', creatorIndex)
          .order('image_index', { ascending: true })

        if (images && images.length > 0) {
          creatorFolder.days.push({
            dayLabel,
            jobId: job.id,
            jobName: job.name,
            variantIndex: creatorIndex,
            images
          })
        }
      }

      creatorFolders.push(creatorFolder)
    }

    return creatorFolders
  }

  /**
   * Export reorganized content to local ZIP files
   */
  async exportToLocal(
    creatorFolders: CreatorFolder[],
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<void> {
    const totalCreators = creatorFolders.length
    
    for (let i = 0; i < creatorFolders.length; i++) {
      const folder = creatorFolders[i]
      onProgress?.({
        current: i,
        total: totalCreators,
        status: `Preparing ${folder.creatorName}...`
      })

      const files: { url: string; filename: string }[] = []
      
      // Organize files by day
      for (const day of folder.days) {
        for (const image of day.images) {
          files.push({
            url: image.generated_image_url,
            filename: `${day.dayLabel}/${day.jobName}_image${image.image_index + 1}.jpg`
          })
        }
      }

      // Create ZIP for this creator
      const zipFilename = `${folder.creatorName}_content.zip`
      await downloadFilesAsZip(files, zipFilename)

      // Add delay between downloads to prevent browser blocking
      if (i < creatorFolders.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    onProgress?.({
      current: totalCreators,
      total: totalCreators,
      status: 'Export completed!'
    })
  }

  /**
   * Export reorganized content to Google Drive
   */
  async exportToGoogleDrive(
    creatorFolders: CreatorFolder[],
    parentFolderId?: string,
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<boolean> {
    try {
      const totalItems = creatorFolders.reduce(
        (sum, folder) => sum + folder.days.reduce(
          (daySum, day) => daySum + day.images.length, 0
        ), 0
      )
      let uploadedCount = 0

      // Create main folder for this export
      const mainFolderId = await this.driveService.createFolder(
        `Agency Content Export - ${new Date().toLocaleDateString()}`,
        parentFolderId
      )
      if (!mainFolderId) throw new Error('Failed to create main folder')

      // Process each creator
      for (const creatorFolder of creatorFolders) {
        // Create creator folder
        const creatorFolderId = await this.driveService.createFolder(
          creatorFolder.creatorName,
          mainFolderId
        )
        if (!creatorFolderId) continue

        // Process each day
        for (const day of creatorFolder.days) {
          // Create day folder
          const dayFolderId = await this.driveService.createFolder(
            day.dayLabel,
            creatorFolderId
          )
          if (!dayFolderId) continue

          // Upload images
          for (const image of day.images) {
            onProgress?.({
              current: uploadedCount,
              total: totalItems,
              status: `Uploading ${creatorFolder.creatorName} - ${day.dayLabel} - Image ${image.image_index + 1}...`
            })

            // Fetch the image
            const response = await fetch(image.generated_image_url)
            const blob = await response.blob()

            // Upload to Google Drive
            await this.driveService.uploadFile(
              blob,
              `${day.jobName}_image${image.image_index + 1}.jpg`,
              'image/jpeg',
              dayFolderId
            )

            uploadedCount++
          }
        }
      }

      onProgress?.({
        current: totalItems,
        total: totalItems,
        status: 'Export completed!'
      })

      return true
    } catch (error) {
      console.error('Error exporting to Google Drive:', error)
      return false
    }
  }

  private getCreatorName(index: number, options: AgencyExportOptions): string {
    if (options.namingPattern === 'custom_names' && options.customNames?.[index]) {
      return options.customNames[index]
    }
    return `Creator ${index + 1}`
  }

  private getDayLabel(index: number, options: AgencyExportOptions): string {
    switch (options.dayLabeling) {
      case 'weekday':
        const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        return weekdays[index % 7]
      case 'custom':
        return options.customDayLabels?.[index] || `Day ${index + 1}`
      default:
        return `Day ${index + 1}`
    }
  }

  /**
   * Get jobs suitable for agency workflow (completed with variants)
   */
  async getAvailableJobs(limit = 50): Promise<ImageGenerationJob[]> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await this.supabase
      .from('image_generation_jobs')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['completed', 'completed_partial'])
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }
} 