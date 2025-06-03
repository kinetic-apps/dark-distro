'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, Video, AlertCircle, CheckCircle } from 'lucide-react'
import PostContentModal from './post-content-modal'

interface VideoUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function VideoUploadModal({ isOpen, onClose }: VideoUploadModalProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadedVideo, setUploadedVideo] = useState<{url: string, path: string} | null>(null)
  const [error, setError] = useState('')
  const [showPostModal, setShowPostModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file')
      return
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      setError('Video file must be less than 100MB')
      return
    }

    setUploading(true)
    setError('')

    try {
      // Upload to API endpoint to ensure proper database tracking
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'video')

      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()
      setUploadedVideo({ url: result.url, path: result.storagePath })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video')
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  const handlePostToTikTok = () => {
    if (!uploadedVideo) return
    setShowPostModal(true)
  }

  const handleReset = () => {
    setUploadedVideo(null)
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  if (!isOpen) return null

  if (showPostModal && uploadedVideo) {
    return (
      <PostContentModal
        isOpen={true}
        onClose={() => {
          setShowPostModal(false)
          handleClose()
        }}
        contentType="video"
        content={{ url: uploadedVideo.url }}
      />
    )
  }

  return (
    <>
      {/* Backdrop with blur */}
      <div className="fixed inset-0 z-40" onClick={handleClose}>
        <div className="absolute inset-0 backdrop-blur-xl" />
      </div>
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-dark-850 rounded-lg max-w-lg w-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
              Upload Video
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {!uploadedVideo ? (
              <>
                <div className="border-2 border-dashed border-gray-300 dark:border-dark-600 rounded-lg p-8">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="video-upload"
                  />
                  <label
                    htmlFor="video-upload"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    <Video className="h-12 w-12 text-gray-400 dark:text-dark-500 mb-4" />
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-1">
                      Click to upload video
                    </p>
                    <p className="text-xs text-gray-500 dark:text-dark-400">
                      MP4, MOV, or other video formats (max 100MB)
                    </p>
                  </label>
                </div>

                {uploading && (
                  <div className="mt-4 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-dark-100 mx-auto"></div>
                    <p className="text-sm text-gray-500 dark:text-dark-400 mt-2">Uploading video...</p>
                  </div>
                )}

                {error && (
                  <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-300">
                      Video uploaded successfully!
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                      {uploadedVideo.path}
                    </p>
                  </div>
                </div>

                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    src={uploadedVideo.url}
                    controls
                    className="w-full h-full"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="btn-secondary flex-1"
                  >
                    Upload Another
                  </button>
                  <button
                    onClick={handlePostToTikTok}
                    className="btn-primary flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Post to TikTok
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}