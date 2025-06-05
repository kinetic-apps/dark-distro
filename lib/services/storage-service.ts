import { createClient } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export interface StorageAsset {
  id: string
  name: string
  path: string
  type: 'video' | 'carousel' | 'image'
  size: number
  mimetype: string
  created_at: string
  updated_at: string
  url: string
  thumbnailUrl?: string
  metadata: {
    width?: number
    height?: number
    duration?: number
    slideCount?: number
    status?: 'ready' | 'used' | 'archived'
  }
  children?: StorageAsset[] // For carousel folders
}

export interface StorageFolder {
  name: string
  path: string
  assetCount: number
}

export class StorageService {
  private static instance: StorageService
  private supabase = createClient()
  private bucketName = 'generated-carousels'
  
  // Folder structure constants
  static readonly FOLDERS = {
    READY: 'assets/ready',
    USED: 'assets/used',
    ARCHIVED: 'assets/archived',
    TEMP: 'assets/temp'
  }

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService()
    }
    return StorageService.instance
  }

  /**
   * List all assets in a specific folder
   */
  async listAssets(folder: string = StorageService.FOLDERS.READY): Promise<StorageAsset[]> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(folder, {
          limit: 1000,
          offset: 0
        })

      if (error) {
        console.log(`Folder ${folder} doesn't exist yet or error listing:`, error.message)
        return []
      }

      const assets: StorageAsset[] = []
      
      for (const item of data || []) {
        // Skip empty folder placeholders
        if (item.name === '.emptyFolderPlaceholder') continue
        
        const fullPath = `${folder}/${item.name}`
        
        // Check if it's a folder (carousel)
        if (!item.metadata) {
          const carouselAssets = await this.getCarouselAssets(fullPath)
          if (carouselAssets.length > 0) {
            assets.push({
              id: item.id || item.name,
              name: item.name,
              path: fullPath,
              type: 'carousel',
              size: carouselAssets.reduce((sum, asset) => sum + asset.size, 0),
              mimetype: 'folder',
              created_at: item.created_at || new Date().toISOString(),
              updated_at: item.updated_at || item.created_at || new Date().toISOString(),
              url: '',
              metadata: {
                slideCount: carouselAssets.length,
                status: this.getStatusFromPath(fullPath)
              },
              children: carouselAssets
            })
          }
        } else {
          // It's a file
          const asset = await this.getAssetDetails(fullPath, item)
          if (asset) assets.push(asset)
        }
      }

      return assets.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    } catch (error) {
      console.error('Error listing assets:', error)
      return []
    }
  }

  /**
   * Get details for a single asset
   */
  private async getAssetDetails(path: string, fileData: any): Promise<StorageAsset | null> {
    try {
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(path)

      const url = urlData.publicUrl
      const mimetype = fileData.metadata?.mimetype || ''
      
      let type: 'video' | 'image' = 'image'
      if (mimetype.startsWith('video/')) {
        type = 'video'
      }

      // Generate thumbnail URL for images
      let thumbnailUrl = url
      if (type === 'image') {
        // Add transformation parameters for thumbnail
        thumbnailUrl = `${url}?width=300&height=300&resize=contain`
      }

      return {
        id: fileData.id || fileData.name,
        name: fileData.name,
        path,
        type,
        size: parseInt(fileData.metadata?.size || '0'),
        mimetype,
        created_at: fileData.created_at || fileData.metadata?.lastModified || new Date().toISOString(),
        updated_at: fileData.updated_at || fileData.created_at || new Date().toISOString(),
        url,
        thumbnailUrl,
        metadata: {
          width: fileData.metadata?.width,
          height: fileData.metadata?.height,
          duration: fileData.metadata?.duration,
          status: this.getStatusFromPath(path)
        }
      }
    } catch (error) {
      console.error('Error getting asset details:', error)
      return null
    }
  }

  /**
   * Get all images in a carousel folder
   */
  private async getCarouselAssets(folderPath: string): Promise<StorageAsset[]> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(folderPath, {
          limit: 100,
          offset: 0
        })

      if (error) throw error

      const assets: StorageAsset[] = []
      
      for (const item of data || []) {
        if (item.name === '.emptyFolderPlaceholder') continue
        
        const fullPath = `${folderPath}/${item.name}`
        const asset = await this.getAssetDetails(fullPath, item)
        if (asset) assets.push(asset)
      }

      // Sort by filename to maintain slide order
      return assets.sort((a, b) => a.name.localeCompare(b.name))
    } catch (error) {
      console.error('Error getting carousel assets:', error)
      return []
    }
  }

  /**
   * Move an asset between folders
   */
  async moveAsset(asset: StorageAsset, targetFolder: string): Promise<boolean> {
    try {
      const sourcePath = asset.path
      const targetPath = `${targetFolder}/${asset.name}`

      if (asset.type === 'carousel' && asset.children) {
        // Move all files in the carousel
        for (const child of asset.children) {
          const childSourcePath = child.path
          const childTargetPath = `${targetPath}/${child.name}`
          
          const { error: moveError } = await this.supabase.storage
            .from(this.bucketName)
            .move(childSourcePath, childTargetPath)
            
          if (moveError) {
            console.error('Error moving carousel file:', moveError)
            return false
          }
        }
      } else {
        // Move single file
        const { error } = await this.supabase.storage
          .from(this.bucketName)
          .move(sourcePath, targetPath)
          
        if (error) {
          console.error('Error moving asset:', error)
          return false
        }
      }

      // Track the move action
      await this.trackUsage(targetPath, asset.type, 'moved', undefined, undefined, {
        from_folder: this.getFolderFromPath(sourcePath),
        to_folder: this.getFolderFromPath(targetPath)
      })

      return true
    } catch (error) {
      console.error('Error in moveAsset:', error)
      return false
    }
  }

  /**
   * Move multiple assets to a folder
   */
  async moveAssets(assets: StorageAsset[], targetFolder: string): Promise<boolean> {
    try {
      const results = await Promise.all(
        assets.map(asset => this.moveAsset(asset, targetFolder))
      )
      return results.every(result => result === true)
    } catch (error) {
      console.error('Error moving multiple assets:', error)
      return false
    }
  }

  /**
   * Upload files to storage
   */
  async uploadFiles(files: File[], folder: string = StorageService.FOLDERS.READY): Promise<StorageAsset[]> {
    const uploadedAssets: StorageAsset[] = []
    
    // Ensure the folder path doesn't have leading/trailing slashes
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '')
    
    for (const file of files) {
      try {
        const timestamp = Date.now()
        const fileExt = file.name.split('.').pop()
        const fileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${cleanFolder}/${fileName}`

        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (error) {
          console.error('Storage upload error:', error)
          throw error
        }

        // Get the uploaded asset details
        const asset = await this.getAssetDetails(filePath, {
          name: fileName,
          metadata: {
            size: file.size,
            mimetype: file.type,
            lastModified: new Date().toISOString()
          }
        })

        if (asset) {
          uploadedAssets.push(asset)
          
          // Track the upload
          await this.trackUsage(filePath, asset.type, 'uploaded', undefined, undefined, {
            original_filename: file.name,
            size: file.size,
            mimetype: file.type
          })
        }
      } catch (error) {
        console.error('Error uploading file:', error)
      }
    }

    return uploadedAssets
  }

  /**
   * Create a carousel from multiple images
   */
  async createCarousel(images: File[], name: string, folder: string = StorageService.FOLDERS.READY): Promise<StorageAsset | null> {
    try {
      // Add timestamp to avoid conflicts
      const timestamp = Date.now()
      const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '_')
      const carouselFolder = `${folder}/carousel_${timestamp}_${safeName}`
      const uploadedImages: StorageAsset[] = []

      // Upload each image to the carousel folder
      for (let i = 0; i < images.length; i++) {
        const file = images[i]
        const fileExt = file.name.split('.').pop()
        const fileName = `slide_${String(i + 1).padStart(3, '0')}.${fileExt}`
        const filePath = `${carouselFolder}/${fileName}`

        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (error) {
          console.error('Storage upload error in carousel:', error)
          throw error
        }

        const asset = await this.getAssetDetails(filePath, {
          name: fileName,
          metadata: {
            size: file.size,
            mimetype: file.type,
            lastModified: new Date().toISOString()
          }
        })

        if (asset) uploadedImages.push(asset)
      }

      // Track the carousel creation
      await this.trackUsage(carouselFolder, 'carousel', 'uploaded', undefined, undefined, {
        original_name: name,
        slide_count: uploadedImages.length,
        total_size: uploadedImages.reduce((sum, img) => sum + img.size, 0)
      })

      // Return carousel asset
      const carouselName = carouselFolder.split('/').pop() || name
      return {
        id: carouselName,
        name: carouselName,
        path: carouselFolder,
        type: 'carousel',
        size: uploadedImages.reduce((sum, img) => sum + img.size, 0),
        mimetype: 'folder',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        url: '',
        metadata: {
          slideCount: uploadedImages.length,
          status: 'ready'
        },
        children: uploadedImages
      }
    } catch (error) {
      console.error('Error creating carousel:', error)
      return null
    }
  }

  /**
   * Delete an asset
   */
  async deleteAsset(asset: StorageAsset): Promise<boolean> {
    try {
      if (asset.type === 'carousel' && asset.children) {
        // Delete all files in the carousel
        const paths = asset.children.map(child => child.path)
        const { error } = await this.supabase.storage
          .from(this.bucketName)
          .remove(paths)
          
        if (error) throw error
      } else {
        // Delete single file
        const { error } = await this.supabase.storage
          .from(this.bucketName)
          .remove([asset.path])
          
        if (error) throw error
      }

      return true
    } catch (error) {
      console.error('Error deleting asset:', error)
      return false
    }
  }

  /**
   * Get asset statistics
   */
  async getAssetStats(): Promise<{
    ready: number
    used: number
    archived: number
    totalSize: number
  }> {
    try {
      const [ready, used, archived] = await Promise.all([
        this.listAssets(StorageService.FOLDERS.READY),
        this.listAssets(StorageService.FOLDERS.USED),
        this.listAssets(StorageService.FOLDERS.ARCHIVED)
      ])

      const calculateSize = (assets: StorageAsset[]) => 
        assets.reduce((sum, asset) => sum + asset.size, 0)

      return {
        ready: ready.length,
        used: used.length,
        archived: archived.length,
        totalSize: calculateSize(ready) + calculateSize(used) + calculateSize(archived)
      }
    } catch (error) {
      console.error('Error getting asset stats:', error)
      return {
        ready: 0,
        used: 0,
        archived: 0,
        totalSize: 0
      }
    }
  }

  /**
   * Search assets by name or type
   */
  async searchAssets(query: string, folder?: string): Promise<StorageAsset[]> {
    const folders = folder ? [folder] : [
      StorageService.FOLDERS.READY,
      StorageService.FOLDERS.USED,
      StorageService.FOLDERS.ARCHIVED
    ]

    const allAssets: StorageAsset[] = []
    
    for (const f of folders) {
      const assets = await this.listAssets(f)
      allAssets.push(...assets)
    }

    const lowerQuery = query.toLowerCase()
    return allAssets.filter(asset => 
      asset.name.toLowerCase().includes(lowerQuery) ||
      asset.type.includes(lowerQuery)
    )
  }

  /**
   * Initialize storage folders
   */
  async initializeFolders(): Promise<void> {
    const folders = Object.values(StorageService.FOLDERS)
    
    for (const folder of folders) {
      try {
        // Check if folder exists by listing it
        const { data: existingFiles, error: listError } = await this.supabase.storage
          .from(this.bucketName)
          .list(folder, { limit: 1 })
        
        if (listError) {
          console.log(`Folder ${folder} doesn't exist yet, will be created on first upload`)
          continue
        }
        
        // If folder is empty, create a placeholder
        if (!existingFiles || existingFiles.length === 0) {
          const placeholderPath = `${folder}/.emptyFolderPlaceholder`
          const { error: uploadError } = await this.supabase.storage
            .from(this.bucketName)
            .upload(placeholderPath, new Blob(['']))
          
          if (uploadError && !uploadError.message?.includes('already exists')) {
            console.log(`Note: ${folder} will be created when first file is uploaded`)
          }
        }
      } catch (error) {
        console.log(`Folder initialization: ${folder} will be created on demand`)
      }
    }
  }

  /**
   * Get status from asset path
   */
  private getStatusFromPath(path: string): 'ready' | 'used' | 'archived' {
    if (path.includes(StorageService.FOLDERS.READY)) return 'ready'
    if (path.includes(StorageService.FOLDERS.USED)) return 'used'
    if (path.includes(StorageService.FOLDERS.ARCHIVED)) return 'archived'
    return 'ready'
  }

  /**
   * Get public URL for an asset
   */
  getPublicUrl(path: string): string {
    const { data } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(path)
    
    return data.publicUrl
  }

  /**
   * Track asset usage
   */
  async trackUsage(
    assetPath: string,
    assetType: 'video' | 'carousel' | 'image',
    action: 'uploaded' | 'posted' | 'moved' | 'deleted' | 'generated',
    accountId?: string,
    postId?: string,
    metadata?: any
  ): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('track_asset_usage', {
        p_asset_path: assetPath,
        p_asset_type: assetType,
        p_action: action,
        p_account_id: accountId || null,
        p_post_id: postId || null,
        p_metadata: metadata || {}
      })

      if (error) {
        console.error('Error tracking asset usage:', error)
      }
    } catch (error) {
      console.error('Error in trackUsage:', error)
    }
  }

  /**
   * Get folder name from path
   */
  private getFolderFromPath(path: string): string {
    if (path.includes(StorageService.FOLDERS.READY)) return 'ready'
    if (path.includes(StorageService.FOLDERS.USED)) return 'used'
    if (path.includes(StorageService.FOLDERS.ARCHIVED)) return 'archived'
    return 'unknown'
  }

  /**
   * Get asset usage statistics
   */
  async getAssetUsageStats(assetPath: string): Promise<{
    postCount: number
    uniquePhonesUsed: number
    firstUploaded: string | null
    lastPosted: string | null
    successfulPosts: number
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from('asset_statistics')
        .select('*')
        .eq('asset_path', assetPath)
        .single()

      if (error) throw error

      return {
        postCount: data.post_count || 0,
        uniquePhonesUsed: data.unique_phones_used || 0,
        firstUploaded: data.first_uploaded,
        lastPosted: data.last_posted,
        successfulPosts: data.successful_posts || 0
      }
    } catch (error) {
      console.error('Error getting asset usage stats:', error)
      return null
    }
  }
} 