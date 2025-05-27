'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Download, 
  CheckCircle2,
  XCircle,
  Clock,
  Grid3x3,
  LayoutGrid,
  Trash2,
  RefreshCw,
  Save,
  FileText,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Image as ImageIcon,
  Timer,
  Calendar,
  Layers,
  Activity
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'
import type { GeneratedCarouselImage, ImageGenerationSettings } from '@/lib/types/image-generation'
import { forceDownload, downloadMultipleFiles } from '@/lib/utils/download'
import { createClient } from '@/lib/supabase/client'

// Apple-inspired loading component
function AppleLoader() {
  return (
    <div className="flex items-center justify-center min-h-[600px]">
      <div className="relative">
        {/* Outer glow effect */}
        <div className="absolute inset-0 h-16 w-16 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 blur-xl opacity-50 animate-pulse" />
        
        {/* Main loader */}
        <div className="relative h-16 w-16">
          {/* Background ring */}
          <div className="absolute inset-0 rounded-full border-2 border-gray-200/30 dark:border-gray-700/30" />
          
          {/* Animated gradient ring */}
          <svg className="absolute inset-0 h-16 w-16 -rotate-90 animate-spin" style={{ animationDuration: '2s' }}>
            <circle
              cx="32"
              cy="32"
              r="30"
              stroke="url(#gradient)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="94.2"
              strokeDashoffset="23.55"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="50%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'processing':
        return {
          icon: <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />,
          text: 'Processing',
          className: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
        }
      case 'completed':
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          text: 'Completed',
          className: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20'
        }
      case 'completed_partial':
        return {
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          text: 'Partially Completed',
          className: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20'
        }
      case 'failed':
        return {
          icon: <XCircle className="h-3.5 w-3.5" />,
          text: 'Failed',
          className: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
        }
      default:
        return {
          icon: <Clock className="h-3.5 w-3.5" />,
          text: 'Queued',
          className: 'bg-gray-50 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-500/20'
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.className}`}>
      {config.icon}
      {config.text}
    </div>
  )
}

export default function JobDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string
  
  const [job, setJob] = useState<any>(null)
  const [images, setImages] = useState<GeneratedCarouselImage[]>([])
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string>('loading')
  const [message, setMessage] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'carousel'>('grid')
  const [selectedVariant, setSelectedVariant] = useState<number>(0)
  const [existingTemplate, setExistingTemplate] = useState<any>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [logs, setLogs] = useState<any[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [hasNewLogs, setHasNewLogs] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const [gridPage, setGridPage] = useState(0)
  const VARIANTS_PER_PAGE = 10

  const loadJobData = useCallback(async () => {
    try {
      const { job: jobData, state, images: generatedImages } = await ImageGenerationService.getJobWithState(jobId)
      
      if (!jobData) {
        router.push('/image-generator/jobs')
        return
      }

      setJob(jobData)
      setImages(generatedImages)
      setProgress(state.progress)
      setStatus(state.status)
      setMessage(state.message)
      setLoading(false)

      // Load logs
      const jobLogs = await ImageGenerationService.getJobLogs(jobId)
      setLogs(jobLogs)

      // Check if a template already exists for this job
      if (jobData.status === 'completed' || jobData.status === 'completed_partial') {
        try {
          const template = await ImageGenerationService.getTemplateByJobId(jobId)
          setExistingTemplate(template)
        } catch (error) {
          console.error('Error checking for existing template:', error)
        }
      }
    } catch (error) {
      console.error('Error loading job:', error)
      setLoading(false)
    }
  }, [jobId, router])

  useEffect(() => {
    loadJobData()
    
    // Poll for updates while job is processing
    const interval = setInterval(() => {
      if (status === 'processing') {
        loadJobData()
      }
    }, 1000)

    // Set up real-time subscription for logs
    const supabase = createClient()
    const channel = supabase
      .channel(`job-logs-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'image_generation_logs',
          filter: `job_id=eq.${jobId}`
        },
        (payload) => {
          setLogs(prev => [...prev, payload.new])
          if (!showLogs) {
            setHasNewLogs(true)
          }
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      channel.unsubscribe()
    }
  }, [loadJobData, status, jobId, showLogs])

  // Auto-scroll to latest log when new logs arrive
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, showLogs])

  // Clear new logs indicator when logs are shown
  useEffect(() => {
    if (showLogs) {
      setHasNewLogs(false)
    }
  }, [showLogs])

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job?')) return
    
    try {
      await ImageGenerationService.deleteJob(jobId)
      router.push('/image-generator/jobs')
    } catch (error) {
      console.error('Error deleting job:', error)
    }
  }

  const handleRetry = async () => {
    if (!confirm('Are you sure you want to retry this job? This will regenerate all images.')) return
    
    try {
      await ImageGenerationService.processJobInBackground(jobId)
      await loadJobData()
    } catch (error) {
      console.error('Error retrying job:', error)
      alert('Failed to retry job')
    }
  }

  const downloadAll = async () => {
    const files = images.map((image) => ({
      url: image.generated_image_url,
      filename: `${job.name}_variant${image.carousel_index + 1}_image${image.image_index + 1}.jpg`
    }))
    await downloadMultipleFiles(files)
  }

  const handleSaveAsTemplate = async () => {
    try {
      const { source_images: sourceImages } = JSON.parse(job.template_description || '{}')
      if (!sourceImages || sourceImages.length === 0) {
        alert('Cannot save as template: No source images found')
        return
      }

      const sourceFiles: File[] = []
      for (let i = 0; i < sourceImages.length; i++) {
        const response = await fetch(sourceImages[i])
        const blob = await response.blob()
        const file = new File([blob], `source_${i}.jpg`, { type: blob.type })
        sourceFiles.push(file)
      }

      await ImageGenerationService.createTemplate({
        name: job.template_name || job.name,
        description: `Template created from job: ${job.name}`,
        source_images: sourceFiles,
        default_prompt: job.prompt,
        job_id: jobId
      })

      alert('Template saved successfully!')
      await loadJobData()
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template')
    }
  }

  const handleViewTemplate = () => {
    if (existingTemplate) {
      router.push(`/image-generator?template=${existingTemplate.id}`)
    }
  }

  const handleSaveName = async () => {
    if (!editedName.trim() || editedName === job.name) {
      setIsEditingName(false)
      return
    }

    try {
      await ImageGenerationService.updateJobName(jobId, editedName.trim())
      setJob({ ...job, name: editedName.trim() })
      setIsEditingName(false)
    } catch (error) {
      console.error('Error updating job name:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update job name'
      alert(errorMessage)
    }
  }

  const handleCancelEdit = () => {
    setEditedName(job.name)
    setIsEditingName(false)
  }

  const startEditingName = () => {
    setEditedName(job.name)
    setIsEditingName(true)
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <div className="p-1 rounded-full bg-red-100 dark:bg-red-500/20"><XCircle className="h-3 w-3 text-red-600 dark:text-red-400" /></div>
      case 'warning':
        return <div className="p-1 rounded-full bg-yellow-100 dark:bg-yellow-500/20"><AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" /></div>
      case 'success':
        return <div className="p-1 rounded-full bg-green-100 dark:bg-green-500/20"><CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" /></div>
      default:
        return <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-500/20"><Info className="h-3 w-3 text-blue-600 dark:text-blue-400" /></div>
    }
  }

  const formatLogTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }

  if (loading) {
    return <AppleLoader />
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="p-4 rounded-full bg-gray-100 dark:bg-dark-800 mb-4">
          <AlertCircle className="h-8 w-8 text-gray-400 dark:text-dark-600" />
        </div>
        <p className="text-lg font-medium text-gray-900 dark:text-dark-100">Job not found</p>
        <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">This job may have been deleted or you don't have access to it.</p>
        <button
          onClick={() => router.push('/image-generator/jobs')}
          className="mt-4 btn-primary"
        >
          Back to Jobs
        </button>
      </div>
    )
  }

  // Group images by variant
  const imagesByVariant = images.reduce((acc, img) => {
    if (!acc[img.carousel_index]) acc[img.carousel_index] = []
    acc[img.carousel_index].push(img)
    return acc
  }, {} as Record<number, GeneratedCarouselImage[]>)

  const variantCount = Object.keys(imagesByVariant).length

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/image-generator/jobs')}
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-dark-100 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </button>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') handleCancelEdit()
                  }}
                  className="text-3xl font-semibold bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 outline-none px-1 py-1"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-green-600 dark:text-green-400 transition-colors"
                  title="Save"
                >
                  <Check className="h-5 w-5" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                  title="Cancel"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 group">
                <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">{job.name}</h1>
                <button
                  onClick={startEditingName}
                  className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                  title="Rename job"
                >
                  <Pencil className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            )}
            
            <div className="flex items-center gap-4 mt-2">
              <StatusBadge status={status} />
              <span className="text-sm text-gray-500 dark:text-dark-400">
                {job.variants.toLocaleString()} variant{job.variants > 1 ? 's' : ''}
              </span>
              <span className="text-sm text-gray-500 dark:text-dark-400">•</span>
              <span className="text-sm text-gray-500 dark:text-dark-400">
                Created {new Date(job.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {(status === 'completed' || status === 'completed_partial') && images.length > 0 && (
              <>
                {existingTemplate ? (
                  <button
                    onClick={handleViewTemplate}
                    className="btn-secondary"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    View Template
                  </button>
                ) : (
                  <button
                    onClick={handleSaveAsTemplate}
                    className="btn-secondary"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save as Template
                  </button>
                )}
                <button
                  onClick={downloadAll}
                  className="btn-secondary"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download All
                </button>
              </>
            )}
            <button
              onClick={handleRetry}
              className="btn-secondary"
              disabled={status === 'processing'}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </button>
            <button
              onClick={handleDelete}
              className="btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Status & Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Status Card */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-4">Status</h3>
            
            {status === 'processing' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-semibold text-gray-900 dark:text-dark-100">{progress}%</span>
                  <span className="text-sm text-gray-500 dark:text-dark-400">
                    {images.length} of {(job.variants * (images.length > 0 ? Math.ceil(images.length / job.variants) : 3)).toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2 overflow-hidden mb-3">
                  <div 
                    className="bg-blue-500 dark:bg-blue-600 h-full transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            )}
            
            <p className="text-sm text-gray-600 dark:text-dark-400">{message}</p>
            
            {status === 'completed_partial' && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">
                      Some images failed
                    </p>
                    <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                      Retry to generate missing images.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Job Info Card */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-4">Information</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700">
                  <Layers className="h-4 w-4 text-gray-600 dark:text-dark-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-dark-400">Template</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{job.template_name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700">
                  <ImageIcon className="h-4 w-4 text-gray-600 dark:text-dark-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-dark-400">Variants</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{job.variants.toLocaleString()}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700">
                  <Calendar className="h-4 w-4 text-gray-600 dark:text-dark-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-dark-400">Created</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                    {new Date(job.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              
              {job.completed_at && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700">
                    <Timer className="h-4 w-4 text-gray-600 dark:text-dark-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-dark-400">Duration</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                      {(() => {
                        const duration = new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()
                        const minutes = Math.floor(duration / 60000)
                        const seconds = Math.floor((duration % 60000) / 1000)
                        return `${minutes}m ${seconds}s`
                      })()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Logs Card */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-sm border border-gray-200 dark:border-dark-700 overflow-hidden">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700">
                  <Activity className="h-4 w-4 text-gray-600 dark:text-dark-400" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">Activity Logs</h3>
                  <p className="text-xs text-gray-500 dark:text-dark-400">{logs.length} events</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasNewLogs && (
                  <span className="px-2 py-1 text-xs bg-blue-500 text-white rounded-full animate-pulse">
                    New
                  </span>
                )}
                {showLogs ? (
                  <ChevronUp className="h-4 w-4 text-gray-400 dark:text-dark-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400 dark:text-dark-500" />
                )}
              </div>
            </button>
            
            {showLogs && (
              <div className="border-t border-gray-200 dark:border-dark-700 max-h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="p-6 text-sm text-gray-500 dark:text-dark-400 text-center">No logs available</p>
                ) : (
                  <div className="p-4 space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                        {getLogIcon(log.level)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-500 dark:text-dark-400">
                              {formatLogTime(log.created_at)}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300">
                              {log.step}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 dark:text-dark-100">{log.message}</p>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-gray-500 dark:text-dark-400 cursor-pointer hover:text-gray-700 dark:hover:text-dark-300">
                                View details
                              </summary>
                              <pre className="mt-2 text-xs bg-gray-100 dark:bg-dark-900 p-3 rounded-lg overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Images */}
        <div className="lg:col-span-2">
          {/* Processing State */}
          {status === 'processing' && images.length === 0 && (
            <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-sm border border-gray-200 dark:border-dark-700 p-12">
              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 h-24 w-24 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 blur-2xl opacity-30 animate-pulse" />
                  <div className="relative h-24 w-24">
                    <svg className="h-24 w-24 -rotate-90 animate-spin" style={{ animationDuration: '3s' }}>
                      <circle
                        cx="48"
                        cy="48"
                        r="42"
                        stroke="url(#processing-gradient)"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray="132"
                        strokeDashoffset="33"
                      />
                      <defs>
                        <linearGradient id="processing-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3B82F6" />
                          <stop offset="50%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#3B82F6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-blue-500" />
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900 dark:text-dark-100">Generating your images</p>
                  <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                    This typically takes 20-30 seconds per image
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {status === 'completed' && images.length === 0 && (
            <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-sm border border-gray-200 dark:border-dark-700 p-12">
              <div className="text-center">
                <div className="inline-flex p-4 rounded-full bg-gray-100 dark:bg-dark-700 mb-4">
                  <ImageIcon className="h-8 w-8 text-gray-400 dark:text-dark-500" />
                </div>
                <p className="text-lg font-medium text-gray-900 dark:text-dark-100">No images generated</p>
                <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                  Try retrying the job or check the logs for errors.
                </p>
              </div>
            </div>
          )}

          {/* Images Grid */}
          {images.length > 0 && (
            <div className="space-y-6">
              {/* View Mode Toggle */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 dark:text-dark-100">Generated Images</h2>
                <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-dark-800 rounded-lg">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-all ${
                      viewMode === 'grid' 
                        ? 'bg-white dark:bg-dark-700 shadow-sm text-gray-900 dark:text-dark-100' 
                        : 'text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-dark-100'
                    }`}
                    title="Grid view"
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('carousel')}
                    className={`p-2 rounded-md transition-all ${
                      viewMode === 'carousel' 
                        ? 'bg-white dark:bg-dark-700 shadow-sm text-gray-900 dark:text-dark-100' 
                        : 'text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-dark-100'
                    }`}
                    title="Carousel view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {viewMode === 'grid' ? (
                // Grid View
                <div className="space-y-6">
                  {(() => {
                    const variantEntries = Object.entries(imagesByVariant)
                    const totalPages = Math.ceil(variantEntries.length / VARIANTS_PER_PAGE)
                    const startIndex = gridPage * VARIANTS_PER_PAGE
                    const endIndex = startIndex + VARIANTS_PER_PAGE
                    const pageVariants = variantEntries.slice(startIndex, endIndex)
                    
                    return (
                      <>
                        {variantEntries.length > VARIANTS_PER_PAGE && (
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600 dark:text-dark-400">
                              Showing {startIndex + 1}-{Math.min(endIndex, variantEntries.length)} of {variantEntries.length} variants
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setGridPage(Math.max(0, gridPage - 1))}
                                disabled={gridPage === 0}
                                className="btn-secondary btn-sm disabled:opacity-50"
                              >
                                <ChevronLeft className="h-3 w-3 mr-1" />
                                Previous
                              </button>
                              <span className="text-sm text-gray-600 dark:text-dark-400 px-3">
                                {gridPage + 1} / {totalPages}
                              </span>
                              <button
                                onClick={() => setGridPage(Math.min(totalPages - 1, gridPage + 1))}
                                disabled={gridPage === totalPages - 1}
                                className="btn-secondary btn-sm disabled:opacity-50"
                              >
                                Next
                                <ChevronRight className="h-3 w-3 ml-1" />
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {pageVariants.map(([variantIndex, variantImages]) => (
                          <div key={variantIndex} className="bg-white dark:bg-dark-850 rounded-2xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">
                                Variant {parseInt(variantIndex) + 1}
                              </h3>
                              <button
                                onClick={async () => {
                                  const files = variantImages.map((image) => ({
                                    url: image.generated_image_url,
                                    filename: `${job.name}_variant${parseInt(variantIndex) + 1}_image${image.image_index + 1}.jpg`
                                  }))
                                  await downloadMultipleFiles(files)
                                }}
                                className="btn-secondary btn-sm"
                              >
                                <Download className="mr-1 h-3 w-3" />
                                Download
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {variantImages
                                .sort((a, b) => a.image_index - b.image_index)
                                .map((image, idx) => (
                                  <div key={image.id} className="relative group">
                                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-700">
                                      <img
                                        src={image.generated_image_url}
                                        alt={`Image ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                                      <button
                                        className="p-2 bg-white dark:bg-dark-800 rounded-lg shadow-lg transform scale-90 group-hover:scale-100 transition-transform"
                                        onClick={async (e) => {
                                          e.stopPropagation()
                                          await forceDownload(
                                            image.generated_image_url,
                                            `${job.name}_variant${parseInt(variantIndex) + 1}_image${image.image_index + 1}.jpg`
                                          )
                                        }}
                                      >
                                        <Download className="h-4 w-4" />
                                      </button>
                                    </div>
                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs rounded-md">
                                      {idx + 1}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                      </>
                    )
                  })()}
                </div>
              ) : (
                // Carousel View
                <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
                  {variantCount > 1 && (
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        {variantCount <= 20 ? (
                          <select
                            value={selectedVariant}
                            onChange={(e) => setSelectedVariant(Number(e.target.value))}
                            className="px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100"
                          >
                            {Array.from({ length: variantCount }, (_, i) => (
                              <option key={i} value={i}>
                                Variant {i + 1}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedVariant(Math.max(0, selectedVariant - 1))}
                              disabled={selectedVariant === 0}
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-dark-400">Variant</span>
                              <input
                                type="number"
                                value={selectedVariant + 1}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 1
                                  setSelectedVariant(Math.min(Math.max(value - 1, 0), variantCount - 1))
                                }}
                                min="1"
                                max={variantCount}
                                className="w-20 px-2 py-1 border border-gray-300 dark:border-dark-600 rounded-lg text-sm bg-white dark:bg-dark-700 text-center"
                              />
                              <span className="text-sm text-gray-600 dark:text-dark-400">of {variantCount.toLocaleString()}</span>
                            </div>
                            <button
                              onClick={() => setSelectedVariant(Math.min(variantCount - 1, selectedVariant + 1))}
                              disabled={selectedVariant === variantCount - 1}
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={async () => {
                          const variantImages = imagesByVariant[selectedVariant] || []
                          const files = variantImages.map((image) => ({
                            url: image.generated_image_url,
                            filename: `${job.name}_variant${selectedVariant + 1}_image${image.image_index + 1}.jpg`
                          }))
                          await downloadMultipleFiles(files)
                        }}
                        className="btn-secondary btn-sm"
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Download Variant
                      </button>
                    </div>
                  )}
                  
                  <div className="space-y-6">
                    {imagesByVariant[selectedVariant]
                      ?.sort((a, b) => a.image_index - b.image_index)
                      .map((image, index) => (
                        <div key={image.id} className="space-y-3">
                          <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-dark-700">
                            <img
                              src={image.generated_image_url}
                              alt={`Generated ${index + 1}`}
                              className="w-full max-h-[600px] object-contain"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                                Image {image.image_index + 1} of {imagesByVariant[selectedVariant].length}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-dark-400 truncate">
                                {image.prompt_used}
                              </p>
                            </div>
                            <button
                              onClick={async () => {
                                await forceDownload(
                                  image.generated_image_url,
                                  `${job.name}_variant${selectedVariant + 1}_image${image.image_index + 1}.jpg`
                                )
                              }}
                              className="btn-secondary btn-sm ml-4"
                            >
                              <Download className="mr-1 h-3 w-3" />
                              Download
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 