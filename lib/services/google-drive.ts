import { GoogleAuthService } from './google-auth'

interface DriveFile {
  id: string
  name: string
  mimeType: string
  parents?: string[]
}

interface ExportProgress {
  current: number
  total: number
  status: string
}

export class GoogleDriveService {
  private static instance: GoogleDriveService
  private authService: GoogleAuthService
  private baseUrl = 'https://www.googleapis.com/drive/v3'
  private uploadUrl = 'https://www.googleapis.com/upload/drive/v3'

  private constructor() {
    this.authService = GoogleAuthService.getInstance()
  }

  static getInstance(): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService()
    }
    return GoogleDriveService.instance
  }

  // Create a folder in Google Drive
  async createFolder(name: string, parentId?: string): Promise<string | null> {
    const token = this.authService.getAccessToken()
    if (!token) return null

    try {
      const metadata: any = {
        name,
        mimeType: 'application/vnd.google-apps.folder'
      }

      if (parentId) {
        metadata.parents = [parentId]
      }

      const response = await fetch(`${this.baseUrl}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      })

      if (!response.ok) throw new Error('Failed to create folder')

      const data = await response.json()
      return data.id
    } catch (error) {
      console.error('Error creating folder:', error)
      return null
    }
  }

  // Upload a file to Google Drive
  async uploadFile(
    file: Blob,
    filename: string,
    mimeType: string,
    parentId?: string
  ): Promise<string | null> {
    const token = this.authService.getAccessToken()
    if (!token) return null

    try {
      // Create metadata
      const metadata: any = {
        name: filename,
        mimeType
      }

      if (parentId) {
        metadata.parents = [parentId]
      }

      // Create multipart body
      const boundary = '-------314159265358979323846'
      const delimiter = "\r\n--" + boundary + "\r\n"
      const closeDelimiter = "\r\n--" + boundary + "--"

      const metadataString = JSON.stringify(metadata)
      
      // Build the request body
      const multipartBody = new Blob([
        delimiter,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        metadataString,
        delimiter,
        `Content-Type: ${mimeType}\r\n\r\n`,
        file,
        closeDelimiter
      ])

      const response = await fetch(`${this.uploadUrl}/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`
        },
        body: multipartBody
      })

      if (!response.ok) throw new Error('Failed to upload file')

      const data = await response.json()
      return data.id
    } catch (error) {
      console.error('Error uploading file:', error)
      return null
    }
  }

  // Export a single carousel variant to Google Drive
  async exportCarouselVariant(
    variant: any,
    jobName: string,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<boolean> {
    try {
      // Create main folder for the job
      const jobFolderId = await this.createFolder(`${jobName} - Variant ${variant.variant_index + 1}`)
      if (!jobFolderId) throw new Error('Failed to create job folder')

      const totalSlides = variant.slides?.length || 0
      let uploadedCount = 0

      // Upload each slide
      for (const slide of variant.slides || []) {
        onProgress?.({
          current: uploadedCount,
          total: totalSlides,
          status: `Uploading ${slide.filename}...`
        })

        // Fetch the image
        const response = await fetch(slide.image_url)
        const blob = await response.blob()

        // Upload to Google Drive
        await this.uploadFile(
          blob,
          slide.filename,
          'image/png',
          jobFolderId
        )

        uploadedCount++
      }

      onProgress?.({
        current: totalSlides,
        total: totalSlides,
        status: 'Export completed!'
      })

      return true
    } catch (error) {
      console.error('Error exporting variant:', error)
      return false
    }
  }

  // Export entire job with all variants to Google Drive
  async exportEntireJob(
    job: any,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<boolean> {
    try {
      // Create main folder for the job
      const jobFolderId = await this.createFolder(job.name)
      if (!jobFolderId) throw new Error('Failed to create job folder')

      const totalItems = job.carousel_variants?.reduce(
        (sum: number, v: any) => sum + (v.slides?.length || 0), 0
      ) || 0
      let uploadedCount = 0

      // Process each variant
      for (const variant of job.carousel_variants || []) {
        // Create variant folder
        const variantFolderId = await this.createFolder(
          `Variant ${variant.variant_index + 1}`,
          jobFolderId
        )
        if (!variantFolderId) continue

        // Upload each slide
        for (const slide of variant.slides || []) {
          onProgress?.({
            current: uploadedCount,
            total: totalItems,
            status: `Uploading Variant ${variant.variant_index + 1} - ${slide.filename}...`
          })

          // Fetch the image
          const response = await fetch(slide.image_url)
          const blob = await response.blob()

          // Upload to Google Drive
          await this.uploadFile(
            blob,
            slide.filename,
            'image/png',
            variantFolderId
          )

          uploadedCount++
        }
      }

      onProgress?.({
        current: totalItems,
        total: totalItems,
        status: 'Export completed!'
      })

      return true
    } catch (error) {
      console.error('Error exporting job:', error)
      return false
    }
  }

  // Get list of folders in root directory
  async getRootFolders(): Promise<DriveFile[]> {
    const token = this.authService.getAccessToken()
    if (!token) return []

    try {
      const params = new URLSearchParams({
        q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents",
        fields: 'files(id,name,mimeType)'
      })

      const response = await fetch(`${this.baseUrl}/files?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) throw new Error('Failed to fetch folders')

      const data = await response.json()
      return data.files || []
    } catch (error) {
      console.error('Error fetching folders:', error)
      return []
    }
  }
} 