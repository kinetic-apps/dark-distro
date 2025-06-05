'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, Image as ImageIcon, Trash2 } from 'lucide-react'
import { useNotification } from '@/lib/context/notification-context'

export default function ProfilePicturesPage() {
  const [uploading, setUploading] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const { notify } = useNotification()
  const supabase = createClient()

  // Load existing images on mount
  useEffect(() => {
    loadImages()
  }, [])

  const loadImages = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('profile-pictures')
        .list('', {
          limit: 100,
          offset: 0
        })

      if (error) throw error

      const urls = data
        .filter(file => file.name !== '.emptyFolderPlaceholder')
        .map(file => {
          const { data: { publicUrl } } = supabase.storage
            .from('profile-pictures')
            .getPublicUrl(file.name)
          return publicUrl
        })

      setImages(urls)
    } catch (error) {
      console.error('Error loading images:', error)
      notify('error', 'Failed to load profile pictures')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const uploadedUrls: string[] = []

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          notify('error', `${file.name} is not an image file`)
          continue
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          notify('error', `${file.name} is too large (max 5MB)`)
          continue
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

        // Upload to Supabase storage
        const { error: uploadError } = await supabase.storage
          .from('profile-pictures')
          .upload(fileName, file, {
            contentType: file.type,
            upsert: false
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          notify('error', `Failed to upload ${file.name}`)
          continue
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('profile-pictures')
          .getPublicUrl(fileName)

        uploadedUrls.push(publicUrl)
        notify('success', `Uploaded ${file.name}`)
      }

      // Update images list
      setImages([...images, ...uploadedUrls])
    } catch (error) {
      console.error('Upload error:', error)
      notify('error', 'Failed to upload files')
    } finally {
      setUploading(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleDelete = async (url: string) => {
    try {
      // Extract filename from URL
      const urlParts = url.split('/')
      const fileName = urlParts[urlParts.length - 1]

      const { error } = await supabase.storage
        .from('profile-pictures')
        .remove([fileName])

      if (error) throw error

      setImages(images.filter(img => img !== url))
      notify('success', 'Image deleted')
    } catch (error) {
      console.error('Delete error:', error)
      notify('error', 'Failed to delete image')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-dark-100">Profile Pictures</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-dark-400">
          Upload profile pictures that can be used for bulk profile editing
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white dark:bg-dark-850 rounded-lg p-6 border border-gray-200 dark:border-dark-700">
        <h2 className="text-lg font-medium text-gray-900 dark:text-dark-100 mb-4">Upload New Pictures</h2>
        
        <div className="border-2 border-dashed border-gray-300 dark:border-dark-600 rounded-lg p-8">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center cursor-pointer"
          >
            <Upload className="h-12 w-12 text-gray-400 dark:text-dark-500 mb-3" />
            <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
              {uploading ? 'Uploading...' : 'Click to upload images'}
            </span>
            <span className="text-xs text-gray-500 dark:text-dark-400 mt-1">
              PNG, JPG, JPEG, WEBP up to 5MB each
            </span>
          </label>
        </div>
      </div>

      {/* Gallery Section */}
      <div className="bg-white dark:bg-dark-850 rounded-lg p-6 border border-gray-200 dark:border-dark-700">
        <h2 className="text-lg font-medium text-gray-900 dark:text-dark-100 mb-4">
          Available Pictures ({images.length})
        </h2>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-dark-100 mx-auto"></div>
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-8">
            <ImageIcon className="h-12 w-12 text-gray-400 dark:text-dark-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-dark-400">
              No profile pictures uploaded yet
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.map((url, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-700">
                  <img
                    src={url}
                    alt={`Profile picture ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  onClick={() => handleDelete(url)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete image"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 