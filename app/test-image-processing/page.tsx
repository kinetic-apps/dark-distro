'use client'

import { useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'

export default function TestImageProcessingPage() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [generatedUrl, setGeneratedUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [metadata, setMetadata] = useState<any>(null)
  const [prompt, setPrompt] = useState<string>('')

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      setPreviewUrl(URL.createObjectURL(file))
      setGeneratedUrl('')
      setError('')
      setMetadata(null)
    }
  }

  const handleGenerate = async () => {
    if (!selectedImage) return

    setIsLoading(true)
    setError('')
    
    try {
      const formData = new FormData()
      formData.append('source_image', selectedImage)
      formData.append('prompt', prompt)
      formData.append('carousel_index', '0')
      formData.append('image_index', '0')

      const response = await fetch('/api/image-generator/generate-v2', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate image')
      }

      setGeneratedUrl(data.imageUrl)
      setMetadata(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8">Smart Text Replacement</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-6">
            <div className="card-lg">
              <h2 className="text-lg font-medium mb-4">1. Upload an Image</h2>
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-gray-300 dark:border-dark-600 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 dark:hover:border-dark-500 transition-colors">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-dark-500" />
                  <p className="mt-2 text-sm text-gray-600 dark:text-dark-300">
                    Click to upload an image with any aspect ratio
                  </p>
                </div>
              </label>
            </div>

            {/* Original Image Preview */}
            {previewUrl && (
              <div className="card-lg">
                <h2 className="text-lg font-medium mb-4">2. Original Image</h2>
                <img
                  src={previewUrl}
                  alt="Original"
                  className="max-w-full h-auto rounded-lg mb-4"
                />
                
                {/* Prompt Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                    Text to Replace (just enter the new text)
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-dark-500"
                    rows={3}
                    placeholder="New Product Launch"
                  />
                </div>
                
                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="btn-primary w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Replace Text in Image'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Error Display */}
            {error && (
              <div className="card-lg bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <p className="text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Generated Image */}
            {generatedUrl && (
              <div className="card-lg">
                <h2 className="text-lg font-medium mb-4">3. Generated Image</h2>
                <img
                  src={generatedUrl}
                  alt="Generated"
                  className="max-w-full h-auto rounded-lg mb-4"
                />
                
                {/* Metadata */}
                {metadata && (
                  <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4 space-y-2 text-sm">
                    <h3 className="font-medium mb-2">Generation Details:</h3>
                    <p><span className="font-medium">Detected Input:</span> {metadata.detectedDimensions?.width} × {metadata.detectedDimensions?.height}px</p>
                    <p><span className="font-medium">Used Size:</span> {metadata.usedSize}</p>
                    <p><span className="font-medium">Output:</span> {metadata.width} × {metadata.height}px</p>
                    <p><span className="font-medium">Aspect Ratio:</span> {
                      metadata.width && metadata.height 
                        ? (metadata.width / metadata.height).toFixed(2) 
                        : 'N/A'
                    }</p>
                    {metadata.revised_prompt && (
                      <p className="mt-2"><span className="font-medium">Revised Prompt:</span> {metadata.revised_prompt}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            <div className="card-lg bg-blue-50 dark:bg-blue-900/20">
              <h3 className="font-medium mb-2">How it works:</h3>
              <ul className="text-sm space-y-1 list-disc list-inside text-gray-700 dark:text-dark-300">
                <li>Upload any image with text (portrait, landscape, or square)</li>
                <li>Simply enter the new text you want to replace the existing text with</li>
                <li>The system automatically wraps your input with proper replacement instructions</li>
                <li>Text replacement maintains original styling, positioning, and composition</li>
                <li>No need to write complex prompts - just enter your new text!</li>
              </ul>
              
              <h3 className="font-medium mb-2 mt-4">Examples:</h3>
              <ul className="text-sm space-y-1 list-disc list-inside text-gray-700 dark:text-dark-300">
                <li>Input: "New Product Launch" → Replaces all text with this phrase</li>
                <li>Input: "50% OFF SALE" → Replaces text while maintaining design</li>
                <li>Input: "Your Brand Name" → Professional text replacement</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 