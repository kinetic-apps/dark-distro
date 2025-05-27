'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Search, 
  Filter,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Image as ImageIcon,
  Calendar,
  Users,
  Wand2,
  TrendingUp,
  BarChart3,
  Layers,
  Activity,
  Sparkles
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'
import type { ImageGenerationJob } from '@/lib/types/image-generation'
import { format } from 'date-fns'
import AgencyWorkflowModal from '@/components/AgencyWorkflowModal'

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

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<ImageGenerationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showAgencyWorkflow, setShowAgencyWorkflow] = useState(false)

  useEffect(() => {
    loadJobs()
    
    // Refresh jobs every 5 seconds to catch status updates
    const interval = setInterval(loadJobs, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadJobs = async () => {
    try {
      const data = await ImageGenerationService.getRecentJobs(50)
      setJobs(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading jobs:', error)
      setLoading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this job?')) return
    
    try {
      await ImageGenerationService.deleteJob(jobId)
      await loadJobs()
    } catch (error) {
      console.error('Error deleting job:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return (
          <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs font-medium">Processing</span>
          </div>
        )
      case 'completed':
        return (
          <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-xs font-medium">Completed</span>
          </div>
        )
      case 'failed':
        return (
          <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full">
            <XCircle className="h-3 w-3" />
            <span className="text-xs font-medium">Failed</span>
          </div>
        )
      default:
        return (
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 px-2 py-1 rounded-full">
            <Clock className="h-3 w-3" />
            <span className="text-xs font-medium">Queued</span>
          </div>
        )
    }
  }

  // Calculate metrics
  const metrics = {
    totalJobs: jobs.length,
    completedJobs: jobs.filter(j => j.status === 'completed').length,
    processingJobs: jobs.filter(j => j.status === 'processing').length,
    failedJobs: jobs.filter(j => j.status === 'failed').length,
    totalCarousels: jobs.reduce((acc, job) => acc + (job.variants || 0), 0),
    successRate: jobs.length > 0 ? Math.round((jobs.filter(j => j.status === 'completed').length / jobs.length) * 100) : 0
  }

  // Filter jobs based on search and status
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.prompt.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    return matchesSearch && matchesStatus
  })

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
              <Wand2 className="h-6 w-6" />
              Carousel Generation Jobs
            </h1>
            <p className="page-description">
              Track and manage your AI-powered carousel generation tasks
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowAgencyWorkflow(true)}
              className="btn-secondary"
            >
              <Users className="mr-2 h-4 w-4" />
              Agency Export
            </button>
            <button
              onClick={() => router.push('/image-generator')}
              className="btn-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Job
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Jobs"
          value={metrics.totalJobs}
          subtitle="All time"
          icon={Layers}
          status="neutral"
        />
        <MetricCard
          title="Success Rate"
          value={`${metrics.successRate}%`}
          subtitle={`${metrics.completedJobs} completed`}
          icon={Activity}
          trend={{ value: 5, positive: true }}
          status="success"
        />
        <MetricCard
          title="Processing"
          value={metrics.processingJobs}
          subtitle="Currently active"
          icon={Loader2}
          status={metrics.processingJobs > 0 ? 'warning' : 'neutral'}
        />
        <MetricCard
          title="Total Carousels"
          value={metrics.totalCarousels}
          subtitle="Generated images"
          icon={Sparkles}
          trend={{ value: 12, positive: true }}
          status="success"
        />
      </div>

      {/* Quick Stats Bar */}
      <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4 border border-gray-200 dark:border-dark-700">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{metrics.completedJobs}</p>
            <p className="text-xs text-gray-600 dark:text-dark-400">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">{metrics.processingJobs}</p>
            <p className="text-xs text-gray-600 dark:text-dark-400">Processing</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-semibold ${metrics.failedJobs > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {metrics.failedJobs}
            </p>
            <p className="text-xs text-gray-600 dark:text-dark-400">Failed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-purple-600 dark:text-purple-400">{metrics.totalCarousels}</p>
            <p className="text-xs text-gray-600 dark:text-dark-400">Carousels</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search jobs by name or prompt..."
              className="input pl-9"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select"
            >
              <option value="all">All Status</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <div className="card-lg text-center py-16">
          <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center mb-4">
            <ImageIcon className="h-8 w-8 text-gray-400 dark:text-dark-500" />
          </div>
          <h3 className="text-base font-medium text-gray-900 dark:text-dark-100">No jobs found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-400">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your filters'
              : 'Get started by creating your first carousel generation job'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={() => router.push('/image-generator')}
              className="mt-4 btn-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Job
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              onClick={() => router.push(`/image-generator/jobs/${job.id}`)}
              className="card-lg hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-dark-800 group-hover:bg-gray-100 dark:group-hover:bg-dark-700 transition-colors">
                      <Wand2 className="h-5 w-5 text-gray-600 dark:text-dark-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                          {job.name}
                        </h3>
                        {getStatusBadge(job.status)}
                      </div>
                      
                      <p className="mt-1 text-sm text-gray-600 dark:text-dark-300 truncate">
                        {job.prompt}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-dark-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(job.created_at), 'MMM d, h:mm a')}
                    </div>
                    
                    {job.status === 'processing' && job.progress > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 dark:bg-dark-700 rounded-full h-1.5">
                          <div 
                            className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="font-medium">{job.progress}%</span>
                      </div>
                    )}
                    
                    {job.variants && (
                      <div className="flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        <span>{job.variants} carousel{job.variants > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => handleDelete(e, job.id)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-dark-300 transition-colors" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agency Workflow Modal */}
      <AgencyWorkflowModal
        isOpen={showAgencyWorkflow}
        onClose={() => setShowAgencyWorkflow(false)}
      />
    </div>
  )
} 