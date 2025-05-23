'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { 
  Briefcase, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  ChevronRight,
  Trash2,
  Eye
} from 'lucide-react'
import { ImageGenerationService } from '@/lib/services/image-generation-service'
import type { ImageGenerationJob } from '@/lib/types/image-generation'

export default function ImageGeneratorJobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<ImageGenerationJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null)

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      setIsLoading(true)
      const data = await ImageGenerationService.getJobs()
      setJobs(data)
    } catch (error) {
      console.error('Error loading jobs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job and all its generated images?')) {
      return
    }

    try {
      setDeletingJobId(jobId)
      await ImageGenerationService.deleteJob(jobId)
      setJobs(jobs.filter(job => job.id !== jobId))
    } catch (error) {
      console.error('Error deleting job:', error)
      alert('Failed to delete job')
    } finally {
      setDeletingJobId(null)
    }
  }

  const getStatusIcon = (status: ImageGenerationJob['status']) => {
    switch (status) {
      case 'queued':
        return <Clock className="h-4 w-4 text-gray-500" />
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusColor = (status: ImageGenerationJob['status']) => {
    switch (status) {
      case 'queued':
        return 'text-gray-600 bg-gray-100'
      case 'processing':
        return 'text-blue-600 bg-blue-100'
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'failed':
        return 'text-red-600 bg-red-100'
    }
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
          <h1 className="text-2xl font-semibold text-gray-900">Image Generation Jobs</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage your carousel generation history
          </p>
        </div>
        
        <button
          onClick={() => router.push('/image-generator')}
          className="btn-primary"
        >
          New Generation
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="card text-center py-12">
          <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs yet</h3>
          <p className="text-gray-600 mb-4">
            Start by creating your first carousel generation job
          </p>
          <button
            onClick={() => router.push('/image-generator')}
            className="btn-primary"
          >
            Create First Job
          </button>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {jobs.map((job) => (
              <li key={job.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {getStatusIcon(job.status)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {job.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {job.variants} variant{job.variants !== 1 ? 's' : ''} • 
                          Created {format(new Date(job.created_at), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                      
                      {job.status === 'processing' && (
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => router.push(`/image-generator/jobs/${job.id}`)}
                          className="text-gray-400 hover:text-gray-600"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="text-gray-400 hover:text-red-600"
                          disabled={deletingJobId === job.id}
                          title="Delete job"
                        >
                          {deletingJobId === job.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {job.message && (
                    <div className="mt-2 text-sm text-gray-600">
                      {job.message}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
} 