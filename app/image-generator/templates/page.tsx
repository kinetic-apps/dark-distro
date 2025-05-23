'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FolderOpen,
  Star,
  StarOff,
  Plus,
  Loader2,
  Grid3x3
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'
import type { ImageGenerationTemplate } from '@/lib/types/image-generation'

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<ImageGenerationTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      const data = await ImageGenerationService.getTemplates()
      setTemplates(data)
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleFavorite = async (templateId: string) => {
    try {
      setTogglingFavorite(templateId)
      await ImageGenerationService.toggleTemplateFavorite(templateId)
      setTemplates(templates.map(t => 
        t.id === templateId ? { ...t, is_favorite: !t.is_favorite } : t
      ))
    } catch (error) {
      console.error('Error toggling favorite:', error)
    } finally {
      setTogglingFavorite(null)
    }
  }

  const useTemplate = (template: ImageGenerationTemplate) => {
    // Navigate to image generator with template preloaded
    router.push(`/image-generator?template=${template.id}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Templates</h1>
          <p className="mt-1 text-sm text-gray-600">
            Reuse successful carousel configurations
          </p>
        </div>
        
        <button
          onClick={() => router.push('/image-generator')}
          className="btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="card text-center py-12">
          <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
          <p className="text-gray-600 mb-4">
            Templates are created automatically when you generate carousels
          </p>
          <button
            onClick={() => router.push('/image-generator')}
            className="btn-primary"
          >
            Create First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div key={template.id} className="card hover:shadow-lg transition-shadow">
              <div className="aspect-w-16 aspect-h-9 mb-4">
                {template.thumbnail_url ? (
                  <img
                    src={template.thumbnail_url}
                    alt={template.name}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                    <Grid3x3 className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
              
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-medium text-gray-900">{template.name}</h3>
                <button
                  onClick={() => toggleFavorite(template.id)}
                  className="text-gray-400 hover:text-yellow-500"
                  disabled={togglingFavorite === template.id}
                >
                  {togglingFavorite === template.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : template.is_favorite ? (
                    <Star className="h-5 w-5 fill-current text-yellow-500" />
                  ) : (
                    <StarOff className="h-5 w-5" />
                  )}
                </button>
              </div>
              
              {template.description && (
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
              )}
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span>{template.source_images.length} source images</span>
                <span>Used {template.usage_count} times</span>
              </div>
              
              <button
                onClick={() => useTemplate(template)}
                className="btn-primary w-full"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 