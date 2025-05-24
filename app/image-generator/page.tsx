'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Upload,
  Loader2,
  Sparkles,
  X,
  Briefcase,
  FileText,
  Plus
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'

interface ImageWithPrompt {
  file: File
  previewUrl: string
  prompt: string
}

export default function ImageGeneratorPage() {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [images, setImages] = useState<ImageWithPrompt[]>([])
  const [jobName, setJobName] = useState('')
  const [variants, setVariants] = useState(1)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      const newImages = files.map(file => ({
        file,
        previewUrl: URL.createObjectURL(file),
        prompt: 'Create a variation of this image'
      }))
      
      setImages([...images, ...newImages])
      
      // Set default job name from first file if not set
      if (!jobName && images.length === 0) {
        setJobName(files[0].name.split('.')[0])
      }
    }
  }

  const updateImagePrompt = (index: number, prompt: string) => {
    const newImages = [...images]
    newImages[index].prompt = prompt
    setImages(newImages)
  }

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    setImages(newImages)
    
    if (newImages.length === 0) {
      setJobName('')
    }
  }

  const handleCreateJob = async () => {
    if (!jobName || images.length === 0) return

    setIsCreating(true)
    try {
      // Prepare the prompts array in the same order as images
      const prompts = images.map(img => img.prompt)
      
      // Create the job with prompts array
      const job = await ImageGenerationService.createJob({
        name: jobName,
        template_name: `${jobName} Template`,
        prompt: JSON.stringify(prompts), // Store prompts as JSON
        variants: variants,
        source_images: images.map(img => img.file)
      })

      // Start processing in background (fire and forget)
      ImageGenerationService.processJobInBackground(job.id)
        .catch(error => console.error('Background processing error:', error))

      // Redirect to job details page immediately
      router.push(`/image-generator/jobs/${job.id}`)
    } catch (error) {
      console.error('Error creating job:', error)
      alert('Failed to create job')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Carousel Generator</h1>
        <p className="page-description">
          Create AI-powered carousel variations for social media
        </p>
        
        {/* Quick Navigation */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={() => router.push('/image-generator/jobs')}
            className="btn-secondary btn-sm"
          >
            <Briefcase className="mr-2 h-3 w-3" />
            View Jobs
          </button>
          <button
            onClick={() => router.push('/image-generator/templates')}
            className="btn-secondary btn-sm"
          >
            <FileText className="mr-2 h-3 w-3" />
            Templates
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Job Name */}
        <div className="card-lg">
          <label className="label">Carousel Name</label>
          <input
            type="text"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            className="input"
            placeholder="Enter a name for this carousel job"
          />
        </div>

        {/* Images Section */}
        <div className="card-lg">
          <h2 className="text-base font-medium text-gray-900 mb-4">Carousel Images</h2>
          
          {images.length === 0 ? (
            <label className="block">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-gray-400 transition-colors">
                <Upload className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-3 text-sm font-medium text-gray-900">
                  Click to upload carousel images
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Upload multiple images to create a carousel
                </p>
              </div>
            </label>
          ) : (
            <div className="space-y-4">
              {/* Horizontal scrollable carousel */}
              <div className="flex gap-4 overflow-x-auto pb-4">
                {images.map((image, index) => (
                  <div key={index} className="flex-shrink-0 w-80">
                    <div className="card">
                      <div className="relative mb-3">
                        <img
                          src={image.previewUrl}
                          alt={`Image ${index + 1}`}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm hover:shadow-md transition-shadow"
                        >
                          <X className="h-4 w-4 text-gray-600" />
                        </button>
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
                          Image {index + 1}
                        </div>
                      </div>
                      
                      <div>
                        <label className="label text-xs">Prompt for this image</label>
                        <textarea
                          value={image.prompt}
                          onChange={(e) => updateImagePrompt(index, e.target.value)}
                          rows={3}
                          className="input text-sm resize-none"
                          placeholder="Describe how to transform this specific image..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Add more images button */}
                <label className="flex-shrink-0 w-80">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="card h-full min-h-[320px] flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="text-center">
                      <Plus className="mx-auto h-8 w-8 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">Add more images</p>
                    </div>
                  </div>
                </label>
              </div>
              
              <div className="text-sm text-gray-500">
                <p>Tip: Each image in your carousel can have its own unique prompt for targeted variations</p>
              </div>
            </div>
          )}
        </div>

        {/* Settings & Actions */}
        {images.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="card-lg">
                <h3 className="text-base font-medium text-gray-900 mb-4">Generation Settings</h3>
                
                <div>
                  <label className="label">Number of Carousel Variations</label>
                  <select
                    value={variants}
                    onChange={(e) => setVariants(parseInt(e.target.value))}
                    className="input"
                  >
                    {[1, 2, 3, 4, 5].map(num => (
                      <option key={num} value={num}>
                        {num} complete carousel{num > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Each variation will create a full carousel with all {images.length} images
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="card-lg">
                <h3 className="text-base font-medium text-gray-900 mb-4">Summary</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Images per carousel</dt>
                    <dd className="font-medium">{images.length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Carousel variations</dt>
                    <dd className="font-medium">{variants}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Total images</dt>
                    <dd className="font-medium">{images.length * variants}</dd>
                  </div>
                </dl>
                
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleCreateJob}
                    disabled={isCreating || !jobName || images.length === 0}
                    className="btn-primary w-full"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Job...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Carousels
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-3">
                    ~30s per image × {images.length * variants} images
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 