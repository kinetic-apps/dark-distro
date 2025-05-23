'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Upload, 
  Wand2, 
  X, 
  ChevronRight, 
  ChevronLeft,
  Settings2,
  Briefcase,
  Clock,
  FolderOpen
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'
import type { CreateJobParams, ImageGenerationSettings } from '@/lib/types/image-generation'

interface UploadedImage {
  id: string
  file: File
  url: string
}

export default function ImageGeneratorPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentStep, setCurrentStep] = useState<'upload' | 'settings' | 'creating'>('upload')
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [isCreatingJob, setIsCreatingJob] = useState(false)

  // Job settings
  const [jobName, setJobName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [variants, setVariants] = useState(3)
  const [settings, setSettings] = useState<ImageGenerationSettings>({
    temperature: 0.7,
    use_lowercase: false,
    add_borders: false,
    border_color: '#000000',
    add_effects: false,
    aspect_ratio: '9:16',
    quality: 'standard'
  })

  const handleFileUpload = (files: FileList) => {
    const newImages: UploadedImage[] = []
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const id = Math.random().toString(36).substring(2)
        const url = URL.createObjectURL(file)
        newImages.push({ id, file, url })
      }
    })
    
    setUploadedImages(prev => [...prev, ...newImages])
  }

  const removeImage = (id: string) => {
    setUploadedImages(prev => {
      const image = prev.find(img => img.id === id)
      if (image) {
        URL.revokeObjectURL(image.url)
      }
      return prev.filter(img => img.id !== id)
    })
  }

  const createJob = async () => {
    if (!jobName.trim() || !prompt.trim() || uploadedImages.length === 0) {
      alert('Please fill in all required fields')
      return
    }

    setIsCreatingJob(true)
    setCurrentStep('creating')

    try {
      const params: CreateJobParams = {
        name: jobName,
        template_name: `${jobName} Template`,
        template_description: `Generated from ${uploadedImages.length} images`,
        prompt,
        variants,
        settings,
        source_images: uploadedImages.map(img => img.file)
      }

      const job = await ImageGenerationService.createJob(params)
      
      // Start processing the job
      ImageGenerationService.processJob(job.id).catch(console.error)
      
      // Redirect to job details page
      router.push(`/image-generator/jobs/${job.id}`)
      
    } catch (error) {
      console.error('Error creating job:', error)
      alert('Failed to create job. Please try again.')
      setCurrentStep('settings')
    } finally {
      setIsCreatingJob(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Image Generator</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create AI-powered carousel variations for social media
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/image-generator/templates')}
            className="btn-secondary"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Templates
          </button>
          <button
            onClick={() => router.push('/image-generator/jobs')}
            className="btn-secondary"
          >
            <Clock className="h-4 w-4 mr-2" />
            History
          </button>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-4">
        <div className={`flex items-center ${currentStep === 'upload' ? 'text-gray-900' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep === 'upload' ? 'bg-gray-900 text-white' : 'bg-gray-200'
          }`}>
            1
          </div>
          <span className="ml-2 text-sm font-medium">Upload Images</span>
        </div>
        
        <ChevronRight className="h-4 w-4 text-gray-400" />
        
        <div className={`flex items-center ${currentStep === 'settings' ? 'text-gray-900' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep === 'settings' ? 'bg-gray-900 text-white' : 'bg-gray-200'
          }`}>
            2
          </div>
          <span className="ml-2 text-sm font-medium">Configure</span>
        </div>
      </div>

      {/* Upload Step */}
      {currentStep === 'upload' && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Source Images</h3>
          
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault()
              handleFileUpload(e.dataTransfer.files)
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-600 mb-2">
              Drop carousel images here or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Upload the images you want to create variations of
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  handleFileUpload(e.target.files)
                }
              }}
            />
          </div>
          
          {uploadedImages.length > 0 && (
            <>
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">
                  Uploaded Images ({uploadedImages.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {uploadedImages.map((image) => (
                    <div key={image.id} className="relative group">
                      <img
                        src={image.url}
                        alt="Uploaded"
                        className="w-full h-24 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        onClick={() => removeImage(image.id)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setCurrentStep('settings')}
                  className="btn-primary"
                >
                  Continue
                  <ChevronRight className="h-4 w-4 ml-2" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Settings Step */}
      {currentStep === 'settings' && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Configure Generation</h3>
          
          <div className="space-y-6">
            <div>
              <label className="label">Job Name</label>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                className="input w-full"
                placeholder="e.g., Summer Fashion Carousel"
              />
            </div>
            
            <div>
              <label className="label">Generation Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="input w-full h-24 resize-none"
                placeholder="Describe how you want the images to be modified..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Be specific about the changes you want to see in the variations
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">Number of Variants</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={variants}
                  onChange={(e) => setVariants(parseInt(e.target.value) || 1)}
                  className="input w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How many carousel variations to generate (1-10)
                </p>
              </div>
              
              <div>
                <label className="label">Aspect Ratio</label>
                <select
                  value={settings.aspect_ratio}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    aspect_ratio: e.target.value as ImageGenerationSettings['aspect_ratio']
                  }))}
                  className="input w-full"
                >
                  <option value="1:1">Square (1:1)</option>
                  <option value="4:5">Portrait (4:5)</option>
                  <option value="9:16">TikTok/Reels (9:16)</option>
                </select>
              </div>
            </div>
            
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Style Options</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.use_lowercase}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      use_lowercase: e.target.checked 
                    }))}
                    className="mr-3"
                  />
                  <span className="text-sm text-gray-700">Use only lowercase text</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.add_borders}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      add_borders: e.target.checked 
                    }))}
                    className="mr-3"
                  />
                  <span className="text-sm text-gray-700">Add colored borders</span>
                </label>
                
                {settings.add_borders && (
                  <div className="ml-6">
                    <label className="label text-xs">Border Color</label>
                    <input
                      type="color"
                      value={settings.border_color}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        border_color: e.target.value 
                      }))}
                      className="h-8 w-20"
                    />
                  </div>
                )}
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.add_effects}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      add_effects: e.target.checked 
                    }))}
                    className="mr-3"
                  />
                  <span className="text-sm text-gray-700">Add visual effects</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="label">Quality</label>
              <select
                value={settings.quality}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  quality: e.target.value as ImageGenerationSettings['quality']
                }))}
                className="input w-full"
              >
                <option value="standard">Standard</option>
                <option value="hd">HD (slower, costs more)</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setCurrentStep('upload')}
              className="btn-secondary"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </button>
            <button
              onClick={createJob}
              className="btn-primary"
              disabled={!jobName.trim() || !prompt.trim()}
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Create Job
            </button>
          </div>
        </div>
      )}

      {/* Creating Step */}
      {currentStep === 'creating' && (
        <div className="card text-center py-12">
          <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Creating Job</h3>
          <p className="text-gray-600">
            Setting up your carousel generation job...
          </p>
        </div>
      )}
    </div>
  )
} 