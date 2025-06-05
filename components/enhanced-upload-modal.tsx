'use client'

import { useState, useCallback, useRef } from 'react'
import { 
  X, 
  Upload, 
  Folder, 
  Image as ImageIcon, 
  Video, 
  Check,
  AlertCircle,
  Loader2,
  FolderOpen,
  Layers
} from 'lucide-react'
import { StorageService } from '@/lib/services/storage-service'
import { formatBytes } from '@/lib/utils'

interface FileWithPath {
  file: File
  path: string
  relativePath: string
}

interface CarouselGroup {
  name: string
  files: FileWithPath[]
  totalSize: number
}

interface EnhancedUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: () => void
  targetFolder?: string
}

export default function EnhancedUploadModal({
  isOpen,
  onClose,
  onUploadComplete,
  targetFolder = StorageService.FOLDERS.READY
}: EnhancedUploadModalProps) {
  const [files, setFiles] = useState<FileWithPath[]>([])
  const [carouselGroups, setCarouselGroups] = useState<CarouselGroup[]>([])
  const [individualFiles, setIndividualFiles] = useState<FileWithPath[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const storageService = StorageService.getInstance()

  const processFiles = useCallback((fileList: FileList) => {
    const filesWithPath: FileWithPath[] = []
    const folderMap = new Map<string, FileWithPath[]>()

    // Process files and detect folder structure
    Array.from(fileList).forEach(file => {
      // @ts-ignore - webkitRelativePath is a non-standard property
      const relativePath = file.webkitRelativePath || file.name
      const pathParts = relativePath.split('/')
      
      const fileWithPath: FileWithPath = {
        file,
        path: relativePath,
        relativePath: relativePath
      }
      
      filesWithPath.push(fileWithPath)

      // If file is in a folder, group it
      if (pathParts.length > 1) {
        const folderName = pathParts[pathParts.length - 2] // Parent folder
        if (!folderMap.has(folderName)) {
          folderMap.set(folderName, [])
        }
        folderMap.get(folderName)!.push(fileWithPath)
      }
    })

    // Create carousel groups from folders
    const groups: CarouselGroup[] = []
    const individual: FileWithPath[] = []

    folderMap.forEach((files, folderName) => {
      // Only create carousel if folder contains images
      const imageFiles = files.filter(f => f.file.type.startsWith('image/'))
      if (imageFiles.length > 0) {
        groups.push({
          name: folderName,
          files: imageFiles.sort((a, b) => a.file.name.localeCompare(b.file.name)),
          totalSize: imageFiles.reduce((sum, f) => sum + f.file.size, 0)
        })
      }
      
      // Non-image files go to individual
      const nonImageFiles = files.filter(f => !f.file.type.startsWith('image/'))
      individual.push(...nonImageFiles)
    })

    // Files not in folders
    filesWithPath.forEach(f => {
      const pathParts = f.relativePath.split('/')
      if (pathParts.length === 1) {
        individual.push(f)
      }
    })

    setFiles(filesWithPath)
    setCarouselGroups(groups)
    setIndividualFiles(individual)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const items = Array.from(e.dataTransfer.items)
    const files: File[] = []

    // Handle dropped folders
    items.forEach(item => {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    })

    if (files.length > 0) {
      const dt = new DataTransfer()
      files.forEach(file => dt.items.add(file))
      processFiles(dt.files)
    }
  }, [processFiles])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
    }
  }

  const uploadFiles = async () => {
    setIsUploading(true)
    setUploadProgress({})
    setUploadErrors({})

    try {
      // Upload carousel groups
      for (const group of carouselGroups) {
        const groupId = `carousel_${Date.now()}_${group.name}`
        setUploadProgress(prev => ({ ...prev, [groupId]: 0 }))

        try {
          // Create carousel from group files
          const images = group.files.map(f => f.file)
          const carousel = await storageService.createCarousel(
            images,
            group.name,
            targetFolder
          )

          if (carousel) {
            setUploadProgress(prev => ({ ...prev, [groupId]: 100 }))
          } else {
            throw new Error('Failed to create carousel')
          }
        } catch (error) {
          console.error('Carousel upload error:', error)
          setUploadErrors(prev => ({ 
            ...prev, 
            [groupId]: error instanceof Error ? error.message : 'Upload failed' 
          }))
        }
      }

      // Upload individual files
      for (const fileWithPath of individualFiles) {
        const fileId = fileWithPath.file.name
        setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))

        try {
          await storageService.uploadFiles([fileWithPath.file], targetFolder)
          setUploadProgress(prev => ({ ...prev, [fileId]: 100 }))
        } catch (error) {
          console.error('File upload error:', error)
          setUploadErrors(prev => ({ 
            ...prev, 
            [fileId]: error instanceof Error ? error.message : 'Upload failed' 
          }))
        }
      }

      // If all successful, close modal
      const hasErrors = Object.keys(uploadErrors).length > 0
      if (!hasErrors) {
        setTimeout(() => {
          onUploadComplete()
          onClose()
          resetState()
        }, 500)
      }
    } finally {
      setIsUploading(false)
    }
  }

  const resetState = () => {
    setFiles([])
    setCarouselGroups([])
    setIndividualFiles([])
    setUploadProgress({})
    setUploadErrors({})
  }

  const getTotalSize = () => {
    return files.reduce((sum, f) => sum + f.file.size, 0)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
                Upload Assets
              </h2>
              <p className="text-sm text-gray-600 dark:text-dark-400 mt-1">
                Upload individual files or folders containing carousel variants
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500 dark:text-dark-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {files.length === 0 ? (
            // Drop zone
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 dark:border-dark-600 rounded-lg p-12 text-center hover:border-gray-400 dark:hover:border-dark-500 transition-colors"
            >
              <Upload className="h-12 w-12 text-gray-400 dark:text-dark-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-dark-400 mb-2">
                Drag and drop files or folders here
              </p>
              <p className="text-sm text-gray-500 dark:text-dark-500 mb-4">
                Folders with images will be automatically grouped as carousels
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Select Files
                </button>
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="btn-secondary"
                >
                  <Folder className="h-4 w-4 mr-2" />
                  Select Folder
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory="true"
                directory="true"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            // File preview
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                      {files.length} files selected
                    </p>
                    <p className="text-xs text-gray-500 dark:text-dark-400">
                      Total size: {formatBytes(getTotalSize())}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {carouselGroups.length > 0 && (
                      <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        <Layers className="h-4 w-4" />
                        {carouselGroups.length} carousels
                      </span>
                    )}
                    {individualFiles.length > 0 && (
                      <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                        <ImageIcon className="h-4 w-4" />
                        {individualFiles.length} files
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Carousel Groups */}
              {carouselGroups.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-3">
                    Carousel Variants ({carouselGroups.length})
                  </h3>
                  <div className="space-y-3">
                    {carouselGroups.map((group, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 dark:border-dark-700 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-4 w-4 text-blue-500" />
                              <span className="font-medium text-gray-900 dark:text-dark-100">
                                {group.name}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                              {group.files.length} slides • {formatBytes(group.totalSize)}
                            </p>
                          </div>
                          {uploadProgress[`carousel_${Date.now()}_${group.name}`] === 100 && (
                            <Check className="h-5 w-5 text-green-500" />
                          )}
                          {uploadErrors[`carousel_${Date.now()}_${group.name}`] && (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          {group.files.slice(0, 6).map((file, fileIndex) => (
                            <div
                              key={fileIndex}
                              className="aspect-square bg-gray-100 dark:bg-dark-800 rounded overflow-hidden"
                            >
                              <img
                                src={URL.createObjectURL(file.file)}
                                alt={file.file.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                          {group.files.length > 6 && (
                            <div className="aspect-square bg-gray-100 dark:bg-dark-800 rounded flex items-center justify-center">
                              <span className="text-sm text-gray-500 dark:text-dark-400">
                                +{group.files.length - 6}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual Files */}
              {individualFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-3">
                    Individual Files ({individualFiles.length})
                  </h3>
                  <div className="space-y-2">
                    {individualFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border border-gray-200 dark:border-dark-700 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {file.file.type.startsWith('video/') ? (
                            <Video className="h-5 w-5 text-purple-500" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-green-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                              {file.file.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-dark-400">
                              {formatBytes(file.file.size)}
                            </p>
                          </div>
                        </div>
                        {uploadProgress[file.file.name] === 100 && (
                          <Check className="h-5 w-5 text-green-500" />
                        )}
                        {uploadErrors[file.file.name] && (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {files.length > 0 && (
          <div className="p-6 border-t border-gray-200 dark:border-dark-700">
            <div className="flex items-center justify-between">
              <button
                onClick={resetState}
                className="btn-secondary"
                disabled={isUploading}
              >
                Clear All
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="btn-secondary"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  onClick={uploadFiles}
                  disabled={isUploading}
                  className="btn-primary"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload All
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 