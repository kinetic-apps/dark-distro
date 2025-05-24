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
  Calendar
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'
import type { ImageGenerationJob } from '@/lib/types/image-generation'
import { format } from 'date-fns'

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<ImageGenerationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

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
          <div className="flex items-center gap-1.5 text-blue-700">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs font-medium">Processing</span>
          </div>
        )
      case 'completed':
        return (
          <div className="flex items-center gap-1.5 text-green-700">
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-xs font-medium">Completed</span>
          </div>
        )
      case 'failed':
        return (
          <div className="flex items-center gap-1.5 text-red-700">
            <XCircle className="h-3 w-3" />
            <span className="text-xs font-medium">Failed</span>
          </div>
        )
      default:
        return (
          <div className="flex items-center gap-1.5 text-gray-600">
            <Clock className="h-3 w-3" />
            <span className="text-xs font-medium">Queued</span>
          </div>
        )
    }
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
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Image Generation Jobs</h1>
            <p className="page-description">
              Track and manage your image generation tasks
            </p>
          </div>
          
          <button
            onClick={() => router.push('/image-generator')}
            className="btn-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Job
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search jobs..."
              className="input pl-9"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
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
        <div className="card-lg text-center py-12">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">No jobs found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your filters'
              : 'Get started by creating your first job'}
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
        <div className="space-y-2">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              onClick={() => router.push(`/image-generator/jobs/${job.id}`)}
              className="card hover:shadow-sm transition-shadow cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {job.name}
                    </h3>
                    {getStatusBadge(job.status)}
                  </div>
                  
                  <p className="mt-1 text-sm text-gray-600 truncate">
                    {job.prompt}
                  </p>
                  
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(job.created_at), 'MMM d, h:mm a')}
                    </div>
                    
                    {job.status === 'processing' && job.progress > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-1">
                          <div 
                            className="bg-blue-600 h-1 rounded-full transition-all"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span>{job.progress}%</span>
                      </div>
                    )}
                    
                    {job.variants && (
                      <span>{job.variants} variant{job.variants > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => handleDelete(e, job.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 