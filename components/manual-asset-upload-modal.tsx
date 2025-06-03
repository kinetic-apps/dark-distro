'use client'

import React, { useState, useCallback } from 'react'
import { Upload, X, FileImage, FileVideo, FileJson, File, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface ManualAssetUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

interface UploadFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'completed' | 'error'
  progress: number
  error?: string
}

const ACCEPTED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/json': ['.json'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/x-matroska': ['.mkv'],
  'video/webm': ['.webm']
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export default function ManualAssetUploadModal({ isOpen, onClose }: ManualAssetUploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <FileImage className="w-4 h-4" />
    if (fileType.startsWith('video/')) return <FileVideo className="w-4 h-4" />
    if (fileType === 'application/json') return <FileJson className="w-4 h-4" />
    return <File className="w-4 h-4" />
  }

  const validateFile = (file: File): string | null => {
    if (!Object.keys(ACCEPTED_FILE_TYPES).includes(file.type)) {
      return `File type ${file.type} is not supported`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
    }
    return null
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    const newFiles: UploadFile[] = []

    droppedFiles.forEach(file => {
      const error = validateFile(file)
      newFiles.push({
        file,
        id: `${Date.now()}-${Math.random()}`,
        status: error ? 'error' : 'pending',
        progress: 0,
        error: error || undefined
      })
    })

    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    const selectedFiles = Array.from(e.target.files)
    const newFiles: UploadFile[] = []

    selectedFiles.forEach(file => {
      const error = validateFile(file)
      newFiles.push({
        file,
        id: `${Date.now()}-${Math.random()}`,
        status: error ? 'error' : 'pending',
        progress: 0,
        error: error || undefined
      })
    })

    setFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const uploadFiles = async () => {
    setIsUploading(true)
    const pendingFiles = files.filter(f => f.status === 'pending')

    for (const uploadFile of pendingFiles) {
      try {
        // Update status to uploading
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
        ))

        // Upload to API endpoint
        const formData = new FormData()
        formData.append('file', uploadFile.file)
        formData.append('type', uploadFile.file.type.startsWith('video/') ? 'video' : 
                              uploadFile.file.type.startsWith('image/') ? 'carousel' : 'other')

        const response = await fetch('/api/assets/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`)
        }

        // Update status to completed
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'completed', progress: 100 } : f
        ))
      } catch (error) {
        // Update status to error
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { 
            ...f, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Upload failed' 
          } : f
        ))
      }
    }

    setIsUploading(false)
    
    // If all uploads completed successfully, close modal and refresh
    if (files.every(f => f.status === 'completed' || f.status === 'error')) {
      setTimeout(() => {
        router.refresh()
        onClose()
        setFiles([])
      }, 1000)
    }
  }

  const totalProgress = files.length > 0 
    ? files.reduce((sum, f) => sum + f.progress, 0) / files.length 
    : 0

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop with blur */}
      <div className="fixed inset-0 z-40" onClick={onClose}>
        <div className="absolute inset-0 backdrop-blur-xl" />
      </div>
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-dark-850 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-dark-700">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
                  Upload Assets
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-dark-400">
                  Upload images, videos, or JSON files to use as assets for your cloud phones
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:text-dark-400 dark:hover:text-dark-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
            {/* Drop zone */}
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${isDragging ? 'border-gray-900 bg-gray-50 dark:border-dark-200 dark:bg-dark-800' : 'border-gray-300 dark:border-dark-600 hover:border-gray-400 dark:hover:border-dark-500'}
              `}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-dark-500" />
              <p className="text-gray-600 dark:text-dark-300 mb-2">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-gray-400 dark:text-dark-500">
                Supports: Images (JPG, PNG, WebP), Videos (MP4, MOV, AVI, MKV, WebM), JSON
              </p>
              <p className="text-sm text-gray-400 dark:text-dark-500 mt-1">
                Max file size: 100MB
              </p>
              <input
                id="file-input"
                type="file"
                multiple
                accept={Object.keys(ACCEPTED_FILE_TYPES).join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium">Files to upload ({files.length})</p>
                  {isUploading && (
                    <div className="w-48 bg-gray-200 dark:bg-dark-700 rounded-full h-2">
                      <div 
                        className="bg-gray-900 dark:bg-dark-100 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${totalProgress}%` }}
                      />
                    </div>
                  )}
                </div>
                {files.map(uploadFile => (
                  <div key={uploadFile.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                    {getFileIcon(uploadFile.file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                      <p className="text-xs text-gray-500 dark:text-dark-500">
                        {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {uploadFile.error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{uploadFile.error}</p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        uploadFile.status === 'completed' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        uploadFile.status === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        uploadFile.status === 'uploading' ? 'bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-dark-300' : 
                        'bg-gray-50 text-gray-700 dark:bg-dark-700/50 dark:text-dark-300'
                      }`}
                    >
                      {uploadFile.status}
                    </span>
                    {!isUploading && (
                      <button
                        className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded"
                        onClick={() => removeFile(uploadFile.id)}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={uploadFiles}
              disabled={files.filter(f => f.status === 'pending').length === 0 || isUploading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading && (
                <div className="w-4 h-4 border-2 border-white dark:border-dark-900 border-t-transparent rounded-full animate-spin mr-2" />
              )}
              Upload {files.filter(f => f.status === 'pending').length} Files
            </button>
          </div>
        </div>
      </div>
    </>
  )
}