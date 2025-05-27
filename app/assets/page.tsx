'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { downloadFile, downloadFilesAsZip } from '@/lib/utils/download'
import { 
  Image as ImageIcon, 
  Play, 
  Send, 
  Download,
  Trash2,
  Filter,
  Grid,
  List,
  Folder,
  CheckCircle,
  Clock,
  User,
  ChevronRight,
  ChevronDown,
  Upload,
  Users
} from 'lucide-react'
import GoogleDriveExportModal from '@/components/GoogleDriveExportModal'
import AgencyWorkflowModal from '@/components/AgencyWorkflowModal'
import { GoogleAuthService } from '@/lib/services/google-auth'
import { useSearchParams } from 'next/navigation'

interface VariantSlide {
  id: string
  slide_order: number
  filename: string
  storage_path: string
  image_url: string
  width: number
  height: number
  caption?: string
  alt_text?: string
}

interface CarouselVariant {
  id: string
  job_id: string
  variant_index: number
  variant_id: string
  folder_path: string
  slide_count: number
  status: 'ready' | 'assigned' | 'posted' | 'archived'
  assigned_profile_id?: string
  assigned_at?: string
  posted_at?: string
  metadata: any
  created_at: string
  slides?: VariantSlide[]
}

interface ImageGenerationJob {
  id: string
  name: string
  template_name: string
  status: string
  variants: number
  created_at: string
  completed_at?: string
  carousel_variants?: CarouselVariant[]
}

export default function AssetsPage() {
  const [jobs, setJobs] = useState<ImageGenerationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedVariant, setSelectedVariant] = useState<CarouselVariant | null>(null)
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState({
    status: 'all',
    dateRange: 'all'
  })
  
  // Google Drive export states
  const [driveExportModal, setDriveExportModal] = useState({
    isOpen: false,
    job: null as any,
    variant: null as any
  })
  
  // Agency workflow state
  const [showAgencyWorkflow, setShowAgencyWorkflow] = useState(false)

  const supabase = createClient()
  const searchParams = useSearchParams()
  const authService = GoogleAuthService.getInstance()

  useEffect(() => {
    fetchJobs()
    
    // Handle Google OAuth callback
    const handleOAuthCallback = async () => {
      const success = searchParams.get('google_auth_success')
      const error = searchParams.get('google_auth_error')
      const accessToken = searchParams.get('access_token')
      const refreshToken = searchParams.get('refresh_token')
      const expiresIn = searchParams.get('expires_in')
      
      if (success && accessToken) {
        // Store tokens from OAuth callback
        await authService.storeTokens({
          access_token: accessToken,
          refresh_token: refreshToken || undefined,
          expires_in: parseInt(expiresIn || '3600'),
          token_type: 'Bearer'
        })
        
        // Clean up URL
        window.history.replaceState({}, '', '/assets')
      } else if (error) {
        console.error('Google auth error:', error)
        // Clean up URL
        window.history.replaceState({}, '', '/assets')
      }
    }
    
    handleOAuthCallback()
  }, [filter, searchParams])

  const fetchJobs = async () => {
    setLoading(true)
    
    // Fetch completed jobs with their variants
    let query = supabase
      .from('image_generation_jobs')
      .select(`
        *,
        carousel_variants (
          *,
          variant_slides (
            *
          )
        )
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    // Apply date filter
    if (filter.dateRange !== 'all') {
      const now = new Date()
      let startDate = new Date()
      
      switch (filter.dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(now.getMonth() - 1)
          break
      }
      
      query = query.gte('created_at', startDate.toISOString())
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching jobs:', error)
      setLoading(false)
      return
    }

    // Process jobs and organize variants with slides
    const processedJobs = data?.map(job => ({
      ...job,
      carousel_variants: job.carousel_variants?.map((variant: any) => ({
        ...variant,
        slides: variant.variant_slides?.sort((a: any, b: any) => a.slide_order - b.slide_order) || []
      })) || []
    })) || []

    setJobs(processedJobs)
    setLoading(false)
  }

  const deleteVariant = async (variant: CarouselVariant) => {
    // Delete all slides from storage
    const paths = variant.slides?.map(slide => slide.storage_path) || []
    
    if (paths.length > 0) {
      await supabase.storage
        .from('generated-carousels')
        .remove(paths)
    }

    // Delete variant from database (cascades to slides)
    await supabase
      .from('carousel_variants')
      .delete()
      .eq('id', variant.id)

    await fetchJobs()
  }

  const assignVariantToProfile = async (variant: CarouselVariant) => {
    // Navigate to profiles page with variant pre-selected
    window.location.href = `/profiles?assign_variant=${variant.id}`
  }

  const toggleJobExpansion = (jobId: string) => {
    const newExpanded = new Set(expandedJobs)
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId)
    } else {
      newExpanded.add(jobId)
    }
    setExpandedJobs(newExpanded)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'text-green-600 dark:text-green-400'
      case 'assigned':
        return 'text-blue-600 dark:text-blue-400'
      case 'posted':
        return 'text-purple-600 dark:text-purple-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <Clock className="h-4 w-4" />
      case 'assigned':
        return <User className="h-4 w-4" />
      case 'posted':
        return <CheckCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  const downloadSlide = async (slide: VariantSlide) => {
    await downloadFile(slide.image_url, slide.filename)
  }

  const downloadVariant = async (variant: CarouselVariant, job: ImageGenerationJob) => {
    if (!variant.slides || variant.slides.length === 0) return
    
    const files = variant.slides.map(slide => ({
      url: slide.image_url,
      filename: slide.filename
    }))
    
    const zipFilename = `${job.name}_variant_${variant.variant_index + 1}.zip`
    await downloadFilesAsZip(files, zipFilename)
  }

  const downloadJob = async (job: ImageGenerationJob) => {
    if (!job.carousel_variants || job.carousel_variants.length === 0) return
    
    const files: { url: string; filename: string }[] = []
    
    job.carousel_variants.forEach(variant => {
      variant.slides?.forEach(slide => {
        files.push({
          url: slide.image_url,
          filename: `variant_${variant.variant_index + 1}/${slide.filename}`
        })
      })
    })
    
    const zipFilename = `${job.name}_all_variants.zip`
    await downloadFilesAsZip(files, zipFilename)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-dark-100">Carousel Assets</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-dark-400">
            Generated carousel variants ready for TikTok posting
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAgencyWorkflow(true)}
            className="btn-secondary"
          >
            <Users className="h-4 w-4 mr-2" />
            Agency Export
          </button>
          <button
            onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
            className="btn-secondary"
          >
            {view === 'grid' ? (
              <>
                <List className="h-4 w-4 mr-2" />
                List
              </>
            ) : (
              <>
                <Grid className="h-4 w-4 mr-2" />
                Grid
              </>
            )}
          </button>
          <button
            onClick={fetchJobs}
            className="btn-secondary"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Filter className="h-4 w-4 text-gray-400 dark:text-dark-500" />
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="select"
        >
          <option value="all">All statuses</option>
          <option value="ready">Ready</option>
          <option value="assigned">Assigned</option>
          <option value="posted">Posted</option>
        </select>
        <select
          value={filter.dateRange}
          onChange={(e) => setFilter({ ...filter, dateRange: e.target.value })}
          className="select"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400 dark:text-dark-500">Loading assets...</div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="card text-center py-12">
          <ImageIcon className="h-12 w-12 text-gray-400 dark:text-dark-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-dark-400">No carousel assets found</p>
          <p className="text-sm text-gray-400 dark:text-dark-500 mt-2">
            Generate some carousels from the Image Generator
          </p>
        </div>
      ) : view === 'grid' ? (
        // Grid View
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <div key={job.id} className="card hover:shadow-lg transition-shadow">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-dark-100">{job.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                      {job.carousel_variants?.length || 0} variants
                    </p>
                  </div>
                  <Folder className="h-5 w-5 text-gray-400 dark:text-dark-500" />
                </div>
                
                {/* Preview thumbnails */}
                <div className="grid grid-cols-3 gap-1 mb-3">
                  {job.carousel_variants?.slice(0, 6).map((variant, idx) => (
                    <div key={variant.id} className="aspect-[9/16] bg-gray-100 dark:bg-dark-800 rounded overflow-hidden">
                      {variant.slides?.[0] && (
                        <img
                          src={variant.slides[0].image_url}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                  {job.carousel_variants && job.carousel_variants.length > 6 && (
                    <div className="col-span-3 text-center text-xs text-gray-500 dark:text-dark-400 mt-1">
                      +{job.carousel_variants.length - 6} more variants
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-400">
                  <span>{formatRelativeTime(job.created_at)}</span>
                  <span>{job.template_name}</span>
                </div>
                
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => toggleJobExpansion(job.id)}
                    className="btn-secondary text-sm flex-1"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => downloadJob(job)}
                    className="btn-secondary text-sm"
                    title="Download all variants"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List View
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="card">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleJobExpansion(job.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedJobs.has(job.id) ? (
                    <ChevronDown className="h-5 w-5 text-gray-400 dark:text-dark-500" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-dark-500" />
                  )}
                  <Folder className="h-5 w-5 text-gray-400 dark:text-dark-500" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-dark-100">{job.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-dark-400">
                      {job.carousel_variants?.length || 0} variants • {formatRelativeTime(job.created_at)}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500 dark:text-dark-400">
                  Template: {job.template_name}
                </div>
              </div>

              {expandedJobs.has(job.id) && job.carousel_variants && (
                <div className="mt-4 space-y-3">
                  {job.carousel_variants.map((variant) => (
                    <div 
                      key={variant.id} 
                      className="border border-gray-200 dark:border-dark-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 dark:text-dark-100">
                              Variant {variant.variant_index + 1}
                            </h4>
                            <div className={`flex items-center gap-1 ${getStatusColor(variant.status)}`}>
                              {getStatusIcon(variant.status)}
                              <span className="text-sm capitalize">{variant.status}</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                            {variant.slide_count} slides • ID: {variant.variant_id.slice(0, 8)}...
                          </p>
                          {variant.assigned_profile_id && (
                            <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">
                              Assigned to: {variant.assigned_profile_id}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {variant.status === 'ready' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                assignVariantToProfile(variant)
                              }}
                              className="btn-secondary text-sm"
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Assign
                            </button>
                                                  )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadVariant(variant, job)
                          }}
                          className="btn-secondary text-sm"
                          title="Download variant as ZIP"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDriveExportModal({
                              isOpen: true,
                              job: job,
                              variant: variant
                            })
                          }}
                          className="btn-secondary text-sm"
                          title="Export to Google Drive"
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Export
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedVariant(variant)
                          }}
                          className="btn-secondary text-sm"
                        >
                          Preview
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('Delete this variant?')) {
                              deleteVariant(variant)
                            }
                          }}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                      {/* Slide thumbnails */}
                      <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                        {variant.slides?.map((slide) => (
                          <div 
                            key={slide.id}
                            className="aspect-[9/16] bg-gray-100 dark:bg-dark-800 rounded overflow-hidden relative group cursor-pointer"
                            onClick={() => downloadSlide(slide)}
                            title={`Download ${slide.filename}`}
                          >
                            <img
                              src={slide.image_url}
                              alt={slide.alt_text || `Slide ${slide.slide_order}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex flex-col items-center justify-center gap-1">
                              <Download className="text-white h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                              <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                Slide {slide.slide_order}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                                      </div>
                ))}
                
                {/* Export entire job button */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => downloadJob(job)}
                    className="btn-secondary text-sm"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download All
                  </button>
                  <button
                    onClick={() => setDriveExportModal({
                      isOpen: true,
                      job: job,
                      variant: null
                    })}
                    className="btn-secondary text-sm"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Export All to Google Drive
                  </button>
                </div>
              </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Variant Preview Modal */}
      {selectedVariant && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 dark:bg-black dark:bg-opacity-85 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedVariant(null)}
        >
          <div
            className="bg-white dark:bg-dark-850 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100">
                Variant {selectedVariant.variant_index + 1} Preview
              </h3>
              <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                {selectedVariant.slide_count} slides • Status: {selectedVariant.status}
              </p>
            </div>
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {selectedVariant.slides?.map((slide) => (
                  <div key={slide.id} className="space-y-2">
                    <div className="aspect-[9/16] bg-gray-100 dark:bg-dark-800 rounded-lg overflow-hidden relative group cursor-pointer"
                         onClick={() => downloadSlide(slide)}>
                      <img
                        src={slide.image_url}
                        alt={slide.alt_text || `Slide ${slide.slide_order}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                        <Download className="text-white h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                        Slide {slide.slide_order}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        {slide.width}x{slide.height}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                {selectedVariant.status === 'ready' && (
                  <button
                    onClick={() => assignVariantToProfile(selectedVariant)}
                    className="btn-primary"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Assign to Profile
                  </button>
                )}
                <button
                  onClick={() => {
                    const job = jobs.find(j => j.carousel_variants?.some(v => v.id === selectedVariant.id))
                    if (job) {
                      downloadVariant(selectedVariant, job)
                    }
                  }}
                  className="btn-secondary"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Google Drive Export Modal */}
      <GoogleDriveExportModal
        isOpen={driveExportModal.isOpen}
        onClose={() => setDriveExportModal({ isOpen: false, job: null, variant: null })}
        job={driveExportModal.job}
        variant={driveExportModal.variant}
      />
      
      {/* Agency Workflow Modal */}
      <AgencyWorkflowModal
        isOpen={showAgencyWorkflow}
        onClose={() => setShowAgencyWorkflow(false)}
      />
    </div>
  )
}