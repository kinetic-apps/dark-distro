'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { 
  ArrowLeft,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Grid3x3,
  Eye,
  X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ImageGenerationService } from '@/lib/services/image-generation-service'
import type { ImageGenerationJob, GeneratedCarouselImage } from '@/lib/types/image-generation'

export default function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [job, setJob] = useState<ImageGenerationJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCarousel, setSelectedCarousel] = useState<number | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  useEffect(() => {
    loadJob()
    
    // Subscribe to job updates
    const channel = ImageGenerationService.subscribeToJobUpdates(id, (updatedJob) => {
      setJob(updatedJob)
    })

    return () => {
      channel.unsubscribe()
    }
  }, [id])

  const loadJob = async () => {
    try {
      setIsLoading(true)
      const data = await ImageGenerationService.getJob(id)
      setJob(data)
    } catch (error) {
      console.error('Error loading job:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: ImageGenerationJob['status']) => {
    switch (status) {
      case 'queued':
        return <Clock className="h-5 w-5 text-gray-500" />
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
    }
  }

  const getStatusText = (status: ImageGenerationJob['status']) => {
    switch (status) {
      case 'queued':
        return 'Queued'
      case 'processing':
        return 'Processing'
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
    }
  }

  const groupImagesByCarousel = (images: GeneratedCarouselImage[]) => {
    const grouped: Record<number, GeneratedCarouselImage[]> = {}
    images.forEach(image => {
      if (!grouped[image.carousel_index]) {
        grouped[image.carousel_index] = []
      }
      grouped[image.carousel_index].push(image)
    })
    
    // Sort images within each carousel by image_index
    Object.values(grouped).forEach(carouselImages => {
      carouselImages.sort((a, b) => a.image_index - b.image_index)
    })
    
    return grouped
  }

  const downloadCarousel = async (carouselIndex: number) => {
    if (!job?.generated_images) return
    
    const carouselImages = job.generated_images.filter(
      img => img.carousel_index === carouselIndex
    )
    
    // Download each image
    for (const image of carouselImages) {
      const response = await fetch(image.generated_image_url)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${job.name}_carousel${carouselIndex + 1}_image${image.image_index + 1}.png`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Job not found</p>
      </div>
    )
  }

  const groupedImages = job.generated_images ? groupImagesByCarousel(job.generated_images) : {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/image-generator/jobs')}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{job.name}</h1>
            <p className="text-sm text-gray-600">
              Created {format(new Date(job.created_at), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {getStatusIcon(job.status)}
          <span className="text-sm font-medium">{getStatusText(job.status)}</span>
        </div>
      </div>

      {/* Progress and Status */}
      {job.status === 'processing' && (
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-500">{job.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
          {job.message && (
            <p className="mt-2 text-sm text-gray-600">{job.message}</p>
          )}
        </div>
      )}

      {/* Job Details */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Job Details</h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Template</dt>
            <dd className="mt-1 text-sm text-gray-900">{job.template_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Variants</dt>
            <dd className="mt-1 text-sm text-gray-900">{job.variants}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Prompt</dt>
            <dd className="mt-1 text-sm text-gray-900">{job.prompt}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Settings</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <pre className="text-xs bg-gray-50 p-2 rounded">
                {JSON.stringify(job.settings, null, 2)}
              </pre>
            </dd>
          </div>
        </dl>
      </div>

      {/* Generated Carousels */}
      {job.status === 'completed' && Object.keys(groupedImages).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Generated Carousels</h3>
          
          {Object.entries(groupedImages).map(([carouselIndex, images]) => (
            <div key={carouselIndex} className="card">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium text-gray-900">
                  Carousel {parseInt(carouselIndex) + 1}
                </h4>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedCarousel(parseInt(carouselIndex))}
                    className="btn-secondary text-sm"
                  >
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    View All
                  </button>
                  <button
                    onClick={() => downloadCarousel(parseInt(carouselIndex))}
                    className="btn-primary text-sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="relative group cursor-pointer"
                    onClick={() => setPreviewImage(image.generated_image_url)}
                  >
                    <img
                      src={image.generated_image_url}
                      alt={`Generated ${image.image_index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg flex items-center justify-center">
                      <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      {image.image_index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Failed State */}
      {job.status === 'failed' && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 text-red-500 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Generation Failed</h3>
              <p className="text-sm text-red-700 mt-1">{job.message || 'An unknown error occurred'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Full Carousel Preview Modal */}
      {selectedCarousel !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCarousel(null)}
        >
          <div
            className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Carousel {selectedCarousel + 1} - Full View
              </h3>
              <button
                onClick={() => setSelectedCarousel(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {groupedImages[selectedCarousel]?.map((image) => (
                  <div key={image.id} className="relative">
                    <img
                      src={image.generated_image_url}
                      alt={`Generated ${image.image_index + 1}`}
                      className="w-full h-auto rounded-lg border border-gray-200"
                    />
                    <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      Image {image.image_index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
          />
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  )
} 