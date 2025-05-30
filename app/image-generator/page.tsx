'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Upload,
  Loader2,
  Sparkles,
  X,
  Briefcase,
  FileText,
  Plus,
  Maximize
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'
import { AntiShadowbanSettings } from '@/components/anti-shadowban-settings'
import { DEFAULT_ANTI_SHADOWBAN_SETTINGS } from '@/lib/constants/anti-shadowban'
import type { ImageGenerationSettings, ImageGenerationTemplate } from '@/lib/types/image-generation'

interface ImageWithPrompt {
  file: File
  previewUrl: string
  prompt: string
}

export default function ImageGeneratorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template')
  
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const [images, setImages] = useState<ImageWithPrompt[]>([])
  const [jobName, setJobName] = useState('')
  const [variants, setVariants] = useState(1)
  const [settings, setSettings] = useState<ImageGenerationSettings>({
    aspect_ratio: 'auto',
    antiShadowban: DEFAULT_ANTI_SHADOWBAN_SETTINGS
  })

  // Load template if template ID is provided
  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId)
    }
  }, [templateId])

  const loadTemplate = async (id: string) => {
    setIsLoadingTemplate(true)
    try {
      // Get all templates and find the one with matching ID
      const templates = await ImageGenerationService.getTemplates()
      const template = templates.find(t => t.id === id)
      
      if (!template) {
        console.error('Template not found')
        return
      }

      // Set job name from template
      setJobName(template.name)

      // Load source images from template
      const loadedImages: ImageWithPrompt[] = []
      
      // Parse default prompt to get individual prompts if available
      let prompts: string[] = []
      try {
        const promptData = JSON.parse(template.default_prompt || '{}')
        if (promptData.prompts && Array.isArray(promptData.prompts)) {
          prompts = promptData.prompts
        }
      } catch {
        // If parsing fails, use empty prompts
        prompts = new Array(template.source_images.length).fill('')
      }

      for (let i = 0; i < template.source_images.length; i++) {
        const imageUrl = template.source_images[i]
        
        // Fetch the image
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const file = new File([blob], `template_image_${i}.jpg`, { type: blob.type })
        
        loadedImages.push({
          file,
          previewUrl: imageUrl,
          prompt: prompts[i] || ''
        })
      }

      setImages(loadedImages)

      // Parse and set settings if available from the prompt
      try {
        const promptData = JSON.parse(template.default_prompt || '{}')
        if (promptData.settings) {
          const templateSettings = promptData.settings as ImageGenerationSettings
          if (templateSettings.aspect_ratio) {
            setSettings(prev => ({ ...prev, aspect_ratio: templateSettings.aspect_ratio }))
          }
          if (templateSettings.antiShadowban) {
            setSettings(prev => ({ ...prev, antiShadowban: templateSettings.antiShadowban }))
          }
        }
      } catch {
        // If parsing fails, use default settings
      }
    } catch (error) {
      console.error('Error loading template:', error)
      alert('Failed to load template')
    } finally {
      setIsLoadingTemplate(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      const newImages = files.map(file => ({
        file,
        previewUrl: URL.createObjectURL(file),
        prompt: ''
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
      
      // Create the job with prompts array and settings
      const jobData = {
        prompts: prompts,
        settings: settings
      }
      
      const job = await ImageGenerationService.createJob({
        name: jobName,
        template_name: `${jobName} Template`,
        prompt: JSON.stringify(jobData), // Store prompts and settings as JSON
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
    <div>
      {/* Loading Template Overlay */}
      {isLoadingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-800 rounded-lg p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-gray-900 dark:text-dark-100">Loading template...</span>
          </div>
        </div>
      )}

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
          <h2 className="text-base font-medium text-gray-900 dark:text-dark-100 mb-4">Carousel Images</h2>
          
          {images.length === 0 ? (
            <label className="block">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="border-2 border-dashed border-gray-300 dark:border-dark-600 rounded-lg p-12 text-center cursor-pointer hover:border-gray-400 dark:hover:border-dark-500 transition-colors">
                <Upload className="mx-auto h-10 w-10 text-gray-400 dark:text-dark-500" />
                <p className="mt-3 text-sm font-medium text-gray-900 dark:text-dark-100">
                  Click to upload carousel images
                </p>
                <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
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
                          className="absolute top-2 right-2 p-1.5 bg-white dark:bg-dark-700 rounded-full shadow-sm hover:shadow-md transition-shadow"
                        >
                          <X className="h-4 w-4 text-gray-600 dark:text-dark-300" />
                        </button>
                        <div className="absolute bottom-2 left-2 bg-black dark:bg-dark-800 bg-opacity-75 dark:bg-opacity-90 text-white dark:text-dark-100 px-2 py-1 rounded text-sm">
                          Image {index + 1}
                        </div>
                      </div>
                      
                      <div>
                        <label className="label text-xs">Text to replace in this image</label>
                        <textarea
                          value={image.prompt}
                          onChange={(e) => updateImagePrompt(index, e.target.value)}
                          rows={3}
                          className="input text-sm resize-none placeholder:text-gray-400 dark:placeholder:text-dark-500"
                          placeholder="New Product Launch"
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
                  <div className="card h-full min-h-[320px] flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                    <div className="text-center">
                      <Plus className="mx-auto h-8 w-8 text-gray-400 dark:text-dark-500" />
                      <p className="mt-2 text-sm text-gray-600 dark:text-dark-300">Add more images</p>
                    </div>
                  </div>
                </label>
              </div>
              
              <div className="text-sm text-gray-500 dark:text-dark-400">
                <p>Tip: Each image can have different replacement text. Just enter the text you want - no need for complex prompts!</p>
              </div>
            </div>
          )}
        </div>

        {/* Settings & Actions */}
        {images.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="card-lg space-y-6">
                <h3 className="text-base font-medium text-gray-900 dark:text-dark-100">Generation Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Number of Carousel Variations</label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={variants}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 1
                            setVariants(Math.min(Math.max(value, 1), 500))
                          }}
                          min="1"
                          max="500"
                          className="input flex-1"
                          placeholder="Enter number"
                        />
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              setVariants(parseInt(e.target.value))
                            }
                          }}
                          className="select"
                        >
                          <option value="">Quick select</option>
                          <option value="1">1 variant</option>
                          <option value="5">5 variants</option>
                          <option value="10">10 variants</option>
                          <option value="25">25 variants</option>
                          <option value="50">50 variants</option>
                          <option value="100">100 variants</option>
                          <option value="250">250 variants</option>
                          <option value="500">500 variants</option>
                        </select>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        Each variation will create a full carousel (max: 500)
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="label">
                      <Maximize className="inline h-3 w-3 mr-1" />
                      Aspect Ratio
                    </label>
                    <select
                      value={settings.aspect_ratio || 'auto'}
                      onChange={(e) => setSettings({ ...settings, aspect_ratio: e.target.value as any })}
                      className="select w-full"
                    >
                      <option value="auto">Auto (preserve original)</option>
                      <option value="1:1">1:1 Square</option>
                      <option value="3:2">3:2 Landscape</option>
                      <option value="2:3">2:3 Portrait</option>
                      <option value="16:9">16:9 Widescreen</option>
                      <option value="9:16">9:16 Vertical (Stories)</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                      Auto mode preserves each image's original aspect ratio
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Anti-Shadowban Settings */}
              <div className="mt-6">
                <AntiShadowbanSettings
                  settings={settings.antiShadowban!}
                  onChange={(antiShadowban) => setSettings({ ...settings, antiShadowban })}
                />
              </div>
            </div>

            <div>
              <div className="card-lg">
                <h3 className="text-base font-medium text-gray-900 dark:text-dark-100 mb-4">Summary</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-dark-300">Images per carousel</dt>
                    <dd className="font-medium text-gray-900 dark:text-dark-100">{images.length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-dark-300">Carousel variations</dt>
                    <dd className="font-medium text-gray-900 dark:text-dark-100">{variants.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-dark-300">Total images</dt>
                    <dd className="font-medium text-gray-900 dark:text-dark-100">{(images.length * variants).toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-dark-300">Aspect ratio</dt>
                    <dd className="font-medium text-gray-900 dark:text-dark-100">
                      {settings.aspect_ratio === 'auto' ? 'Auto' : settings.aspect_ratio}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-dark-300">Anti-shadowban</dt>
                    <dd className="font-medium text-gray-900 dark:text-dark-100 capitalize">
                      {settings.antiShadowban?.preset || 'Standard'}
                    </dd>
                  </div>
                </dl>
                
                {/* Warning for large jobs */}
                {variants > 50 && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
                      Large job warning
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      {variants > 100 
                        ? `This will generate ${(images.length * variants).toLocaleString()} images and may take ${Math.ceil((images.length * variants * 30) / 60).toLocaleString()} minutes or more.`
                        : `This job will take approximately ${Math.ceil((images.length * variants * 30) / 60)} minutes to complete.`
                      }
                    </p>
                  </div>
                )}
                
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-700">
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
                        Generate {variants > 1 ? `${variants.toLocaleString()} Carousels` : 'Carousel'}
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 dark:text-dark-400 text-center mt-3">
                    {variants <= 10 
                      ? `~30s per image × ${images.length * variants} images`
                      : `Estimated time: ${Math.ceil((images.length * variants * 30) / 60).toLocaleString()} minutes`
                    }
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