'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Download, 
  Loader2, 
  CheckCircle2,
  XCircle,
  Clock,
  Grid,
  List,
  Trash2
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'
import type { GeneratedCarouselImage } from '@/lib/types/image-generation'

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
    }, 2000)

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

  const downloadAll = () => {
    images.forEach((image) => {
      const link = document.createElement('a')
      link.href = image.generated_image_url
      link.download = `${job.name}_variant${image.carousel_index + 1}_image${image.image_index + 1}.png`
      link.click()
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Job not found</p>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/image-generator/jobs')}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="page-title">{job.name}</h1>
              <p className="page-description">{job.prompt}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {status === 'completed' && images.length > 0 && (
              <button
                onClick={downloadAll}
                className="btn-secondary"
              >
                <Download className="mr-2 h-4 w-4" />
                Download All
              </button>
            )}
            <button
              onClick={handleDelete}
              className="btn-secondary text-red-600 hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Status Card */}
      <div className="card-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status === 'processing' && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
            {status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            {status === 'failed' && <XCircle className="h-5 w-5 text-red-600" />}
            {status === 'queued' && <Clock className="h-5 w-5 text-gray-400" />}
            
            <div>
              <p className="font-medium capitalize">{status}</p>
              <p className="text-sm text-gray-600">{message}</p>
            </div>
          </div>
          
          {status === 'processing' && (
            <div className="text-right">
              <p className="text-sm font-medium">{progress}%</p>
              <p className="text-xs text-gray-500">
                {images.length} of {job.variants * (images.length > 0 ? Math.ceil(images.length / job.variants) : 3)} images
              </p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {status === 'processing' && (
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* View Mode Toggle */}
      {images.length > 0 && (
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-gray-900">Generated Carousels</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
              title="Grid view"
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('carousel')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'carousel' ? 'bg-gray-100' : 'hover:bg-gray-50'
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
                    <h3 className="text-sm font-medium text-gray-900">
                      Carousel Variant {parseInt(variantIndex) + 1}
                    </h3>
                    <button
                      onClick={() => {
                        variantImages.forEach((image) => {
                          const link = document.createElement('a')
                          link.href = image.generated_image_url
                          link.download = `${job.name}_carousel${parseInt(variantIndex) + 1}_image${image.image_index + 1}.png`
                          link.click()
                        })
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
                              <a
                                href={image.generated_image_url}
                                download={`${job.name}_carousel${parseInt(variantIndex) + 1}_image${image.image_index + 1}.png`}
                                className="p-2 bg-white rounded-md shadow-lg hover:shadow-xl transition-shadow"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </div>
                            <div className="absolute bottom-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded">
                              {idx + 1}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 text-center mt-1 line-clamp-1">
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
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                  >
                    {Array.from({ length: variantCount }, (_, i) => (
                      <option key={i} value={i}>
                        Carousel Variant {i + 1}
                      </option>
                    ))}
                  </select>
                  
                  <button
                    onClick={() => {
                      const variantImages = imagesByVariant[selectedVariant] || []
                      variantImages.forEach((image) => {
                        const link = document.createElement('a')
                        link.href = image.generated_image_url
                        link.download = `${job.name}_carousel${selectedVariant + 1}_image${image.image_index + 1}.png`
                        link.click()
                      })
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
                          <p className="text-sm font-medium text-gray-900">
                            Image {image.image_index + 1} of {imagesByVariant[selectedVariant].length}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {image.prompt_used}
                          </p>
                        </div>
                        <a
                          href={image.generated_image_url}
                          download={`${job.name}_carousel${selectedVariant + 1}_image${image.image_index + 1}.png`}
                          className="btn-secondary btn-sm ml-4"
                        >
                          <Download className="mr-1 h-3 w-3" />
                          Download
                        </a>
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
          <p className="text-gray-500">No images were generated</p>
        </div>
      )}

      {/* Processing State */}
      {status === 'processing' && images.length === 0 && (
        <div className="card-lg">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="relative">
              <div className="h-20 w-20 rounded-full border-4 border-gray-200"></div>
              <div className="absolute inset-0 h-20 w-20 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-gray-900 font-medium">Generating your images...</p>
            <p className="text-sm text-gray-500">This typically takes 20-30 seconds per image</p>
          </div>
        </div>
      )}
    </div>
  )
} 