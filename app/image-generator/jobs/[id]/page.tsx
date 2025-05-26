'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Download, 
  CheckCircle2,
  XCircle,
  Clock,
  Grid,
  List,
  Trash2,
  RefreshCw,
  Save,
  FileText,
  Pencil,
  Check,
  X
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'
import type { GeneratedCarouselImage, ImageGenerationSettings } from '@/lib/types/image-generation'
import { forceDownload, downloadMultipleFiles } from '@/lib/utils/download'

export default function JobDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string
  
  const [job, setJob] = useState<any>(null)
  const [images, setImages] = useState<GeneratedCarouselImage[]>([])
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string>('loading')
  const [message, setMessage] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'carousel'>('grid')
  const [selectedVariant, setSelectedVariant] = useState<number>(0)
  const [existingTemplate, setExistingTemplate] = useState<any>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')

  const loadJobData = useCallback(async () => {
    try {
      const { job: jobData, state, images: generatedImages } = await ImageGenerationService.getJobWithState(jobId)
      
      if (!jobData) {
        router.push('/image-generator/jobs')
        return
      }

      setJob(jobData)
      setImages(generatedImages)
      setProgress(state.progress)
      setStatus(state.status)
      setMessage(state.message)
      setLoading(false)

      // Check if a template already exists for this job
      if (jobData.status === 'completed') {
        try {
          const template = await ImageGenerationService.getTemplateByJobId(jobId)
          setExistingTemplate(template)
        } catch (error) {
          console.error('Error checking for existing template:', error)
        }
      }
    } catch (error) {
      console.error('Error loading job:', error)
      setLoading(false)
    }
  }, [jobId, router])

  useEffect(() => {
    loadJobData()
    
    // Poll for updates while job is processing
    const interval = setInterval(() => {
      if (status === 'processing') {
        loadJobData()
      }
    }, 1000) // Faster polling for better responsiveness

    return () => clearInterval(interval)
  }, [loadJobData, status])

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job?')) return
    
    try {
      await ImageGenerationService.deleteJob(jobId)
      router.push('/image-generator/jobs')
    } catch (error) {
      console.error('Error deleting job:', error)
    }
  }

  const handleRetry = async () => {
    if (!confirm('Are you sure you want to retry this job? This will regenerate all images.')) return
    
    try {
      // Start processing in background - this will reset the job state in the database
      await ImageGenerationService.processJobInBackground(jobId)
      
      // Immediately reload job data to get the updated state from database
      await loadJobData()
    } catch (error) {
      console.error('Error retrying job:', error)
      alert('Failed to retry job')
    }
  }

  const downloadAll = async () => {
    const files = images.map((image) => ({
      url: image.generated_image_url,
      filename: `${job.name}_variant${image.carousel_index + 1}_image${image.image_index + 1}.jpg`
    }))
    await downloadMultipleFiles(files)
  }

  const handleSaveAsTemplate = async () => {
    try {
      // Parse the job data to get source images
      const { source_images: sourceImages } = JSON.parse(job.template_description || '{}')
      if (!sourceImages || sourceImages.length === 0) {
        alert('Cannot save as template: No source images found')
        return
      }

      // Convert source image URLs to Files
      const sourceFiles: File[] = []
      for (let i = 0; i < sourceImages.length; i++) {
        const response = await fetch(sourceImages[i])
        const blob = await response.blob()
        const file = new File([blob], `source_${i}.jpg`, { type: blob.type })
        sourceFiles.push(file)
      }

      // Create the template - preserve the original prompt which includes settings
      await ImageGenerationService.createTemplate({
        name: job.template_name || job.name,
        description: `Template created from job: ${job.name}`,
        source_images: sourceFiles,
        default_prompt: job.prompt, // This already contains prompts and settings as JSON
        job_id: jobId
      })

      alert('Template saved successfully!')
      
      // Reload to update the button
      await loadJobData()
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template')
    }
  }

  const handleViewTemplate = () => {
    if (existingTemplate) {
      router.push(`/image-generator?template=${existingTemplate.id}`)
    }
  }

  const handleSaveName = async () => {
    if (!editedName.trim() || editedName === job.name) {
      setIsEditingName(false)
      return
    }

    try {
      await ImageGenerationService.updateJobName(jobId, editedName.trim())
      setJob({ ...job, name: editedName.trim() })
      setIsEditingName(false)
    } catch (error) {
      console.error('Error updating job name:', error)
      // Show more detailed error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to update job name'
      alert(errorMessage)
      // Don't close the edit mode on error
    }
  }

  const handleCancelEdit = () => {
    setEditedName(job.name)
    setIsEditingName(false)
  }

  const startEditingName = () => {
    setEditedName(job.name)
    setIsEditingName(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-2 border-gray-200 dark:border-dark-600"></div>
          <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-transparent border-t-blue-500 dark:border-t-blue-400 animate-spin"></div>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-dark-400">Job not found</p>
      </div>
    )
  }

  // Group images by variant
  const imagesByVariant = images.reduce((acc, img) => {
    if (!acc[img.carousel_index]) acc[img.carousel_index] = []
    acc[img.carousel_index].push(img)
    return acc
  }, {} as Record<number, GeneratedCarouselImage[]>)

  const variantCount = Object.keys(imagesByVariant).length

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/image-generator/jobs')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-md transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    className="input text-2xl font-semibold px-2 py-1"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-1.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded-md transition-colors"
                    title="Save"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-700 rounded-md transition-colors"
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="page-title">{job.name}</h1>
                  <button
                    onClick={startEditingName}
                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-md transition-all"
                    title="Rename job"
                  >
                    <Pencil className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              )}
              <p className="page-description">
                {job.variants} variant{job.variants > 1 ? 's' : ''} • Created {new Date(job.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {status === 'completed' && images.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2">
                {existingTemplate ? (
                  <button
                    onClick={handleViewTemplate}
                    className="btn-secondary whitespace-nowrap"
                  >
                    <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span>View Template</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSaveAsTemplate}
                    className="btn-secondary whitespace-nowrap"
                  >
                    <Save className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span>Save Template</span>
                  </button>
                )}
                <button
                  onClick={downloadAll}
                  className="btn-secondary whitespace-nowrap"
                >
                  <Download className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span>Download All</span>
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleRetry}
                className="btn-secondary whitespace-nowrap"
                disabled={status === 'processing'}
              >
                <RefreshCw className="mr-2 h-4 w-4 flex-shrink-0" />
                <span>Retry</span>
              </button>
              <button
                onClick={handleDelete}
                className="btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 whitespace-nowrap"
              >
                <Trash2 className="mr-2 h-4 w-4 flex-shrink-0" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Card */}
      <div className="card-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status === 'processing' && (
              <div className="relative">
                <div className="h-5 w-5 rounded-full border-2 border-gray-200 dark:border-dark-600"></div>
                <div className="absolute inset-0 h-5 w-5 rounded-full border-2 border-transparent border-t-blue-500 dark:border-t-blue-400 animate-spin"></div>
              </div>
            )}
            {status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />}
            {status === 'failed' && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
            {status === 'queued' && <Clock className="h-5 w-5 text-gray-400 dark:text-dark-500" />}
            
            <div>
              <p className="font-medium capitalize">{status}</p>
              <p className="text-sm text-gray-600 dark:text-dark-300">{message}</p>
            </div>
          </div>
          
          {status === 'processing' && (
            <div className="text-right">
              <p className="text-sm font-medium">{progress}%</p>
              <p className="text-xs text-gray-500 dark:text-dark-400">
                {images.length} of {job.variants * (images.length > 0 ? Math.ceil(images.length / job.variants) : 3)} images
              </p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {status === 'processing' && (
          <div className="mt-4 w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Job Settings */}
      {(() => {
        try {
          const jobData = JSON.parse(job.prompt)
          const settings: ImageGenerationSettings | undefined = jobData.settings
          
          if (settings?.antiShadowban) {
            return (
              <div className="card-lg">
                <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-3">Generation Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-dark-300">Aspect Ratio:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-dark-100">
                      {settings.aspect_ratio === 'auto' ? 'Auto' : settings.aspect_ratio}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-dark-300">Anti-Shadowban:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-dark-100 capitalize">
                      {settings.antiShadowban.preset}
                    </span>
                  </div>
                  {settings.antiShadowban.preset === 'custom' && (
                    <>
                      <div>
                        <span className="text-gray-600 dark:text-dark-300">Metadata:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-dark-100">
                          {settings.antiShadowban.metadata.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-dark-300">Borders:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-dark-100">
                          {settings.antiShadowban.borders.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-dark-300">Fractures:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-dark-100">
                          {settings.antiShadowban.fractures.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-dark-300">Micro-noise:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-dark-100">
                          {settings.antiShadowban.microNoise.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          }
        } catch {
          // Ignore parsing errors for old jobs
        }
        return null
      })()}

      {/* View Mode Toggle */}
      {images.length > 0 && (
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-gray-900 dark:text-dark-100">Generated Carousels</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-gray-100 dark:bg-dark-700' : 'hover:bg-gray-50 dark:hover:bg-dark-800'
              }`}
              title="Grid view"
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('carousel')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'carousel' ? 'bg-gray-100 dark:bg-dark-700' : 'hover:bg-gray-50 dark:hover:bg-dark-800'
              }`}
              title="Carousel view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Images Display */}
      {images.length > 0 && (
        <div>
          {viewMode === 'grid' ? (
            // Grid View - Show carousels as groups
            <div className="space-y-6">
              {Object.entries(imagesByVariant).map(([variantIndex, variantImages]) => (
                <div key={variantIndex} className="card-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">
                      Carousel Variant {parseInt(variantIndex) + 1}
                    </h3>
                    <button
                      onClick={async () => {
                        const files = variantImages.map((image) => ({
                          url: image.generated_image_url,
                          filename: `${job.name}_carousel${parseInt(variantIndex) + 1}_image${image.image_index + 1}.jpg`
                        }))
                        await downloadMultipleFiles(files)
                      }}
                      className="btn-secondary btn-sm"
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download Carousel
                    </button>
                  </div>
                  
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {variantImages
                      .sort((a, b) => a.image_index - b.image_index)
                      .map((image, idx) => (
                        <div key={image.id} className="flex-shrink-0">
                          <div className="relative group">
                            <img
                              src={image.generated_image_url}
                              alt={`Image ${idx + 1}`}
                              className="w-48 h-48 object-cover rounded-lg"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <button
                                className="p-2 bg-white dark:bg-dark-700 rounded-md shadow-lg hover:shadow-xl transition-shadow"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  await forceDownload(
                                    image.generated_image_url,
                                    `${job.name}_carousel${parseInt(variantIndex) + 1}_image${image.image_index + 1}.jpg`
                                  )
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="absolute bottom-1 left-1 bg-black dark:bg-dark-800 bg-opacity-75 dark:bg-opacity-90 text-white dark:text-dark-100 text-xs px-1.5 py-0.5 rounded">
                              {idx + 1}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-dark-400 text-center mt-1 line-clamp-1">
                            {image.prompt_used}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Carousel View - Show one carousel at a time
            <div className="card-lg">
              {variantCount > 1 && (
                <div className="flex items-center justify-between mb-4">
                  <select
                    value={selectedVariant}
                    onChange={(e) => setSelectedVariant(Number(e.target.value))}
                    className="px-3 py-1.5 border border-gray-300 dark:border-dark-600 rounded-md text-sm dark:bg-dark-800 dark:text-dark-100"
                  >
                    {Array.from({ length: variantCount }, (_, i) => (
                      <option key={i} value={i}>
                        Carousel Variant {i + 1}
                      </option>
                    ))}
                  </select>
                  
                  <button
                    onClick={async () => {
                      const variantImages = imagesByVariant[selectedVariant] || []
                      const files = variantImages.map((image) => ({
                        url: image.generated_image_url,
                        filename: `${job.name}_carousel${selectedVariant + 1}_image${image.image_index + 1}.jpg`
                      }))
                      await downloadMultipleFiles(files)
                    }}
                    className="btn-secondary btn-sm"
                  >
                    <Download className="mr-1 h-3 w-3" />
                    Download This Carousel
                  </button>
                </div>
              )}
              
              <div className="space-y-4">
                {imagesByVariant[selectedVariant]
                  ?.sort((a, b) => a.image_index - b.image_index)
                  .map((image, index) => (
                    <div key={image.id} className="space-y-3">
                      <img
                        src={image.generated_image_url}
                        alt={`Generated ${index + 1}`}
                        className="w-full max-h-[600px] object-contain rounded-lg mx-auto"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                            Image {image.image_index + 1} of {imagesByVariant[selectedVariant].length}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-dark-400 truncate">
                            {image.prompt_used}
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            await forceDownload(
                              image.generated_image_url,
                              `${job.name}_carousel${selectedVariant + 1}_image${image.image_index + 1}.jpg`
                            )
                          }}
                          className="btn-secondary btn-sm ml-4"
                        >
                          <Download className="mr-1 h-3 w-3" />
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {status === 'completed' && images.length === 0 && (
        <div className="card-lg text-center py-12">
          <p className="text-gray-500 dark:text-dark-400">No images were generated</p>
        </div>
      )}

      {/* Processing State */}
      {status === 'processing' && images.length === 0 && (
        <div className="card-lg">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="relative">
              {/* Outer ring */}
              <div className="h-20 w-20 rounded-full border-2 border-gray-200 dark:border-dark-600"></div>
              {/* Spinning gradient ring */}
              <div className="absolute inset-0 h-20 w-20 rounded-full animate-spin">
                <div className="h-full w-full rounded-full border-2 border-transparent"
                  style={{
                    borderTopColor: 'rgb(59, 130, 246)', // blue-500
                    borderRightColor: 'rgb(147, 197, 253)', // blue-300
                    background: 'conic-gradient(from 180deg at 50% 50%, transparent 0deg, transparent 270deg, rgba(59, 130, 246, 0.1) 270deg, rgba(59, 130, 246, 0.3) 360deg)'
                  }}
                />
              </div>
              {/* Center dot */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse"></div>
              </div>
            </div>
            <p className="text-gray-900 dark:text-dark-100 font-medium">Generating your images...</p>
            <p className="text-sm text-gray-500 dark:text-dark-400">This typically takes 20-30 seconds per image</p>
          </div>
        </div>
      )}
    </div>
  )
} 