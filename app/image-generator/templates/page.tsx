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
  AlertTriangle,
  Sparkles,
  Layers,
  Clock,
  TrendingUp,
  FileText,
  Palette
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'
import type { ImageGenerationTemplate } from '@/lib/types/image-generation'

// Metric Card Component
function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  status
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  trend?: { value: number, positive: boolean }
  status?: 'success' | 'warning' | 'error' | 'neutral'
}) {
  const statusColors = {
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-gray-400'
  }

  return (
    <div className="card-lg group hover:shadow-lg transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-dark-400">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
              {value}
            </p>
            {trend && (
              <span className={`flex items-center text-xs font-medium ${
                trend.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
                {trend.value}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500 dark:text-dark-400">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-lg p-2 bg-gray-50 dark:bg-dark-800 group-hover:bg-gray-100 dark:group-hover:bg-dark-700 transition-colors ${status ? statusColors[status] : ''}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

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

  // Calculate metrics
  const metrics = {
    totalTemplates: templates.length,
    favoriteTemplates: templates.filter(t => t.is_favorite).length,
    totalImages: templates.reduce((acc, t) => acc + t.source_images.length, 0),
    avgImagesPerTemplate: templates.length > 0 ? Math.round(templates.reduce((acc, t) => acc + t.source_images.length, 0) / templates.length) : 0
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-dark-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="page-header">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Palette className="h-6 w-6" />
              Templates
            </h1>
            <p className="page-description">
              Save and reuse successful carousel generation configurations
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

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Templates"
          value={metrics.totalTemplates}
          subtitle="Saved configurations"
          icon={FileText}
          status="neutral"
        />
        <MetricCard
          title="Favorites"
          value={metrics.favoriteTemplates}
          subtitle="Quick access"
          icon={Star}
          status={metrics.favoriteTemplates > 0 ? 'success' : 'neutral'}
        />
        <MetricCard
          title="Total Images"
          value={metrics.totalImages}
          subtitle="Across all templates"
          icon={Layers}
          trend={{ value: 8, positive: true }}
          status="neutral"
        />
        <MetricCard
          title="Avg Images"
          value={metrics.avgImagesPerTemplate}
          subtitle="Per template"
          icon={Sparkles}
          status="neutral"
        />
      </div>

      {/* Quick Stats Bar */}
      {templates.length > 0 && (
        <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4 border border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-semibold text-purple-600 dark:text-purple-400">{metrics.favoriteTemplates}</p>
                <p className="text-xs text-gray-600 dark:text-dark-400">Starred</p>
              </div>
              <div className="h-8 w-px bg-gray-300 dark:bg-dark-600" />
              <div>
                <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">{templates.length}</p>
                <p className="text-xs text-gray-600 dark:text-dark-400">Total Templates</p>
              </div>
              <div className="h-8 w-px bg-gray-300 dark:bg-dark-600" />
              <div>
                <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{metrics.totalImages}</p>
                <p className="text-xs text-gray-600 dark:text-dark-400">Source Images</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-dark-400">
              <Clock className="inline h-3 w-3 mr-1" />
              Templates help you quickly recreate successful carousel styles
            </p>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="card-lg text-center py-16">
          <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center mb-4">
            <FolderOpen className="h-8 w-8 text-gray-400 dark:text-dark-500" />
          </div>
          <h3 className="text-base font-medium text-gray-900 dark:text-dark-100">No templates yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-400">
            Save completed jobs as templates to reuse their configurations
          </p>
          <button
            onClick={() => router.push('/image-generator')}
            className="mt-4 btn-primary"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Your First Carousel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="card-lg hover:shadow-md transition-all group">
              {/* Thumbnail */}
              <div className="aspect-square relative -m-6 mb-4">
                {template.thumbnail_url ? (
                  <img
                    src={template.thumbnail_url}
                    alt={template.name}
                    className="w-full h-full object-cover rounded-t-lg"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-700 dark:to-dark-800 rounded-t-lg flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-gray-400 dark:text-dark-500" />
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(template.id)
                    }}
                    className={`p-2.5 rounded-lg bg-white/90 dark:bg-dark-700/90 backdrop-blur-sm shadow-sm hover:shadow-md transition-all ${
                      template.is_favorite ? 'text-yellow-500' : 'text-gray-400 dark:text-dark-500'
                    }`}
                  >
                    <Star className={`h-4 w-4 ${template.is_favorite ? 'fill-current' : ''}`} />
                  </button>
                  
                  <button
                    onClick={(e) => handleDeleteClick(e, template)}
                    className="p-2.5 rounded-lg bg-white/90 dark:bg-dark-700/90 backdrop-blur-sm shadow-sm hover:shadow-md transition-all text-gray-400 dark:text-dark-500 hover:text-red-500 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Favorite Badge */}
                {template.is_favorite && (
                  <div className="absolute top-3 left-3">
                    <div className="bg-yellow-500 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      Favorite
                    </div>
                  </div>
                )}
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
                  <div className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    <span>{template.source_images.length} images</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Quick start</span>
                  </div>
                </div>
                
                <button
                  onClick={() => useTemplate(template)}
                  className="btn-secondary btn-sm w-full group-hover:btn-primary transition-all"
                >
                  <Sparkles className="mr-1.5 h-3 w-3" />
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