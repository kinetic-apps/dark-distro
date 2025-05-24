'use client'

import { useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'

export default function TestPage() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [generatedImage, setGeneratedImage] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      setPreviewUrl(URL.createObjectURL(file))
      setGeneratedImage('')
      setError('')
    }
  }

  const handleGenerate = async () => {
    if (!selectedImage) return

    setIsLoading(true)
    setError('')
    setGeneratedImage('')

    try {
      const formData = new FormData()
      formData.append('image', selectedImage)

      const response = await fetch('/api/image-generator/test-simple', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate image')
      }

      if (data.imageBase64) {
        setGeneratedImage(`data:image/png;base64,${data.imageBase64}`)
      } else {
        throw new Error('No image returned')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Simple Image Generation Test</h1>
      
      <div className="space-y-6">
        {/* Upload Section */}
        <div className="card">
          <h2 className="text-lg font-medium mb-4">1. Select an Image</h2>
          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                Click to upload an image
              </p>
            </div>
          </label>
        </div>

        {/* Preview Section */}
        {previewUrl && (
          <div className="card">
            <h2 className="text-lg font-medium mb-4">2. Original Image</h2>
            <img
              src={previewUrl}
              alt="Original"
              className="max-w-full h-auto rounded-lg"
            />
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="mt-4 btn-primary"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Variation'
              )}
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="card bg-red-50 border-red-200">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Generated Image */}
        {generatedImage && (
          <div className="card">
            <h2 className="text-lg font-medium mb-4">3. Generated Variation</h2>
            <img
              src={generatedImage}
              alt="Generated"
              className="max-w-full h-auto rounded-lg"
            />
            <p className="mt-2 text-sm text-green-600">
              ✓ Image generated successfully!
            </p>
          </div>
        )}
      </div>
    </div>
  )
} 