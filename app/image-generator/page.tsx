'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Upload,
  Loader2,
  Sparkles,
  X,
  Briefcase,
  FileText
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'

export default function ImageGeneratorPage() {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [jobName, setJobName] = useState('')
  const [prompt, setPrompt] = useState('Create a variation of this image')
  const [variants, setVariants] = useState(1)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setSelectedFiles(files)
      
      // Create preview URLs
      const urls = files.map(file => URL.createObjectURL(file))
      setPreviewUrls(urls)
      
      // Set default job name from first file
      if (!jobName) {
        setJobName(files[0].name.split('.')[0])
      }
    }
  }

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    const newUrls = previewUrls.filter((_, i) => i !== index)
    setSelectedFiles(newFiles)
    setPreviewUrls(newUrls)
    
    if (newFiles.length === 0) {
      setJobName('')
    }
  }

  const handleCreateJob = async () => {
    if (!jobName || selectedFiles.length === 0) return

    setIsCreating(true)
    try {
      // Create the job
      const job = await ImageGenerationService.createJob({
        name: jobName,
        template_name: `${jobName} Template`,
        prompt: prompt,
        variants: variants,
        source_images: selectedFiles
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
        <h1 className="page-title">Image Generator</h1>
        <p className="page-description">
          Upload images and create AI-powered variations
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Upload & Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Section */}
          <div className="card-lg">
            <h2 className="text-base font-medium text-gray-900 mb-4">Upload Images</h2>
            
            {previewUrls.length === 0 ? (
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
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PNG, JPG, GIF up to 10MB each
                  </p>
                </div>
              </label>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {previewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  ))}
                </div>
                
                <label className="block">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button type="button" className="btn-secondary btn-sm w-full">
                    Add More Images
                  </button>
                </label>
              </div>
            )}
          </div>

          {/* Settings - Only show when files are selected */}
          {selectedFiles.length > 0 && (
            <div className="card-lg space-y-5">
              <h2 className="text-base font-medium text-gray-900">Generation Settings</h2>
              
              <div>
                <label className="label">Job Name</label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  className="input"
                  placeholder="Enter a name for this job"
                />
              </div>

              <div>
                <label className="label">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="input resize-none"
                  placeholder="Describe how you want to transform the images..."
                />
              </div>

              <div>
                <label className="label">Number of Variations</label>
                <select
                  value={variants}
                  onChange={(e) => setVariants(parseInt(e.target.value))}
                  className="input"
                >
                  {[1, 2, 3, 4, 5].map(num => (
                    <option key={num} value={num}>{num} variation{num > 1 ? 's' : ''}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Each variation will process all {selectedFiles.length} uploaded image{selectedFiles.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Summary & Action */}
        <div className="space-y-6">
          {selectedFiles.length > 0 && (
            <div className="card-lg">
              <h3 className="text-base font-medium text-gray-900 mb-4">Summary</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Images</dt>
                  <dd className="font-medium">{selectedFiles.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Variations</dt>
                  <dd className="font-medium">{variants}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Total Output</dt>
                  <dd className="font-medium">{selectedFiles.length * variants} images</dd>
                </div>
              </dl>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={handleCreateJob}
                  disabled={isCreating || !jobName}
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
                      Generate Images
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 text-center mt-3">
                  Processing takes ~30s per image
                </p>
              </div>
            </div>
          )}
          
          {/* Help Text */}
          <div className="text-sm text-gray-600 space-y-2">
            <p className="font-medium">How it works:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Upload your source images</li>
              <li>Set a descriptive prompt</li>
              <li>Choose number of variations</li>
              <li>Track progress in real-time</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
} 