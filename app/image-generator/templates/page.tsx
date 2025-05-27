'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FolderOpen,
  Star,
  Plus,
  Loader2,
  Image as ImageIcon,
  Trash2,
  AlertTriangle
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'
import type { ImageGenerationTemplate } from '@/lib/types/image-generation'

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<ImageGenerationTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    templateId: string | null
    templateName: string
  }>({
    isOpen: false,
    templateId: null,
    templateName: ''
  })
  const [isDeleting, setIsDeleting] = useState(false)

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

  const handleDeleteClick = (e: React.MouseEvent, template: ImageGenerationTemplate) => {
    e.stopPropagation()
    setDeleteConfirm({
      isOpen: true,
      templateId: template.id,
      templateName: template.name
    })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.templateId) return

    setIsDeleting(true)
    try {
      await ImageGenerationService.deleteTemplate(deleteConfirm.templateId)
      setTemplates(templates.filter(t => t.id !== deleteConfirm.templateId))
      setDeleteConfirm({ isOpen: false, templateId: null, templateName: '' })
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Failed to delete template. Please try again.')
    } finally {
      setIsDeleting(false)
    }
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
                
                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(template.id)
                    }}
                    className={`p-2 rounded-md bg-white dark:bg-dark-700 shadow-sm hover:shadow-md transition-all ${
                      template.is_favorite ? 'text-yellow-500' : 'text-gray-400 dark:text-dark-500'
                    }`}
                  >
                    <Star className={`h-4 w-4 ${template.is_favorite ? 'fill-current' : ''}`} />
                  </button>
                  
                  <button
                    onClick={(e) => handleDeleteClick(e, template)}
                    className="p-2 rounded-md bg-white dark:bg-dark-700 shadow-sm hover:shadow-md transition-all text-gray-400 dark:text-dark-500 hover:text-red-500 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setDeleteConfirm({ isOpen: false, templateId: null, templateName: '' })} />
            
            <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-dark-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 sm:mx-0 sm:h-10 sm:w-10">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-dark-100">
                    Delete Template
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-dark-400">
                      Are you sure you want to delete "{deleteConfirm.templateName}"? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteConfirm}
                  className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteConfirm({ isOpen: false, templateId: null, templateName: '' })}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-dark-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-dark-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-dark-600 hover:bg-gray-50 dark:hover:bg-dark-600 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 