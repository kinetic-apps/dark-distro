'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FolderOpen,
  Star,
  Plus,
  Loader2,
  Image as ImageIcon
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'
import type { ImageGenerationTemplate } from '@/lib/types/image-generation'

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<ImageGenerationTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const data = await ImageGenerationService.getTemplates()
      setTemplates(data)
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleFavorite = async (templateId: string) => {
    try {
      await ImageGenerationService.toggleTemplateFavorite(templateId)
      setTemplates(templates.map(t => 
        t.id === templateId ? { ...t, is_favorite: !t.is_favorite } : t
      ))
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  const useTemplate = (template: ImageGenerationTemplate) => {
    router.push(`/image-generator?template=${template.id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-dark-500" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Templates</h1>
            <p className="page-description">
              Reuse successful image generation configurations
            </p>
          </div>
          
          <button
            onClick={() => router.push('/image-generator')}
            className="btn-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="card-lg text-center py-16">
          <FolderOpen className="mx-auto h-12 w-12 text-gray-400 dark:text-dark-500" />
          <h3 className="mt-4 text-base font-medium text-gray-900 dark:text-dark-100">No templates yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-400">
            Save completed jobs as templates to reuse their configurations
          </p>
          <button
            onClick={() => router.push('/image-generator')}
            className="mt-4 btn-primary"
          >
            Generate Your First Carousel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="card hover:shadow-sm transition-shadow">
              {/* Thumbnail */}
              <div className="aspect-square relative mb-3 -m-4 mb-3">
                {template.thumbnail_url ? (
                  <img
                    src={template.thumbnail_url}
                    alt={template.name}
                    className="w-full h-full object-cover rounded-t-lg"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 dark:bg-dark-700 rounded-t-lg flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-gray-400 dark:text-dark-500" />
                  </div>
                )}
                
                {/* Favorite Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFavorite(template.id)
                  }}
                  className={`absolute top-2 right-2 p-2 rounded-md bg-white dark:bg-dark-700 shadow-sm hover:shadow-md transition-all ${
                    template.is_favorite ? 'text-yellow-500' : 'text-gray-400 dark:text-dark-500'
                  }`}
                >
                  <Star className={`h-4 w-4 ${template.is_favorite ? 'fill-current' : ''}`} />
                </button>
              </div>
              
              {/* Content */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">{template.name}</h3>
                  {template.description && (
                    <p className="text-xs text-gray-500 dark:text-dark-400 mt-1 line-clamp-2">{template.description}</p>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-400">
                  <span>{template.source_images.length} images</span>
                </div>
                
                <button
                  onClick={() => useTemplate(template)}
                  className="btn-secondary btn-sm w-full"
                >
                  Use Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 