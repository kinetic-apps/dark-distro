'use client'

import { useState, useEffect } from 'react'
import { X, Check, AlertCircle, Loader2, Download, Upload, Calendar, Users, Tag } from 'lucide-react'
import { AgencyWorkflowService, type AgencyExportOptions } from '@/lib/services/agency-workflow-service'
import { GoogleAuthService } from '@/lib/services/google-auth'
import type { ImageGenerationJob } from '@/lib/types/image-generation'

interface AgencyWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AgencyWorkflowModal({ isOpen, onClose }: AgencyWorkflowModalProps) {
  const [jobs, setJobs] = useState<ImageGenerationJob[]>([])
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, status: '' })
  const [error, setError] = useState<string | null>(null)
  
  // Export options
  const [options, setOptions] = useState<AgencyExportOptions>({
    namingPattern: 'creator_number',
    customNames: [],
    dayLabeling: 'day_number',
    customDayLabels: [],
    exportType: 'local'
  })
  
  const [showCustomNames, setShowCustomNames] = useState(false)
  const [showCustomDays, setShowCustomDays] = useState(false)
  const [creatorCount, setCreatorCount] = useState(0)
  
  const workflowService = AgencyWorkflowService.getInstance()
  const authService = GoogleAuthService.getInstance()
  const isGoogleAuthenticated = authService.isAuthenticated()

  useEffect(() => {
    if (isOpen) {
      loadJobs()
    }
  }, [isOpen])

  useEffect(() => {
    // Update creator count when jobs are selected
    const selectedJobsList = Array.from(selectedJobs).map(id => 
      jobs.find(j => j.id === id)
    ).filter(Boolean) as ImageGenerationJob[]
    
    if (selectedJobsList.length > 0) {
      const counts = selectedJobsList.map(j => j.variants)
      const uniqueCounts = [...new Set(counts)]
      if (uniqueCounts.length === 1) {
        setCreatorCount(uniqueCounts[0])
        setError(null)
      } else {
        setError('All selected jobs must have the same number of variants')
      }
    } else {
      setCreatorCount(0)
    }
  }, [selectedJobs, jobs])

  const loadJobs = async () => {
    try {
      setLoading(true)
      const availableJobs = await workflowService.getAvailableJobs()
      setJobs(availableJobs)
    } catch (err) {
      console.error('Error loading jobs:', err)
      setError('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  const toggleJobSelection = (jobId: string) => {
    const newSelection = new Set(selectedJobs)
    if (newSelection.has(jobId)) {
      newSelection.delete(jobId)
    } else {
      newSelection.add(jobId)
    }
    setSelectedJobs(newSelection)
  }

  const selectAll = () => {
    setSelectedJobs(new Set(jobs.map(j => j.id)))
  }

  const deselectAll = () => {
    setSelectedJobs(new Set())
  }

  const handleExport = async () => {
    if (selectedJobs.size === 0) {
      setError('Please select at least one job')
      return
    }

    setExporting(true)
    setError(null)

    try {
      const selectedJobsList = Array.from(selectedJobs).map(id => 
        jobs.find(j => j.id === id)
      ).filter(Boolean) as ImageGenerationJob[]

      // Sort jobs by creation date
      selectedJobsList.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )

      // Reorganize content
      const creatorFolders = await workflowService.reorganizeForCreators(
        selectedJobsList,
        options
      )

      // Export based on selected type
      if (options.exportType === 'google_drive') {
        if (!isGoogleAuthenticated) {
          // Redirect to Google OAuth
          window.location.href = authService.getAuthUrl()
          return
        }
        
        const success = await workflowService.exportToGoogleDrive(
          creatorFolders,
          undefined,
          setExportProgress
        )
        
        if (success) {
          onClose()
        } else {
          setError('Failed to export to Google Drive')
        }
      } else {
        await workflowService.exportToLocal(
          creatorFolders,
          setExportProgress
        )
        onClose()
      }
    } catch (err) {
      console.error('Export error:', err)
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
      setExportProgress({ current: 0, total: 0, status: '' })
    }
  }

  const updateCustomName = (index: number, name: string) => {
    const newNames = [...options.customNames!]
    newNames[index] = name
    setOptions({ ...options, customNames: newNames })
  }

  const updateCustomDay = (index: number, label: string) => {
    const newLabels = [...options.customDayLabels!]
    newLabels[index] = label
    setOptions({ ...options, customDayLabels: newLabels })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-dark-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
              Agency Workflow Export
            </h2>
            <p className="text-sm text-gray-600 dark:text-dark-400 mt-1">
              Organize carousel variants by creator for agency distribution
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-dark-400" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-200px)]">
          {/* Job Selection Panel */}
          <div className="w-1/2 p-6 border-r border-gray-200 dark:border-dark-700 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 dark:text-dark-100">
                Select Jobs ({selectedJobs.size} selected)
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-dark-400">
                No completed jobs available
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <label
                    key={job.id}
                    className={`
                      flex items-center p-3 rounded-lg border cursor-pointer transition-colors
                      ${selectedJobs.has(job.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                        : 'border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={selectedJobs.has(job.id)}
                      onChange={() => toggleJobSelection(job.id)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-dark-100">
                        {job.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-dark-400">
                        {job.variants} variants • {new Date(job.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Configuration Panel */}
          <div className="w-1/2 p-6 overflow-y-auto">
            <h3 className="font-medium text-gray-900 dark:text-dark-100 mb-4">
              Export Configuration
            </h3>

            {/* Creator Naming */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                <Users className="h-4 w-4" />
                Creator Naming
              </label>
              <select
                value={options.namingPattern}
                onChange={(e) => {
                  setOptions({ ...options, namingPattern: e.target.value as any })
                  setShowCustomNames(e.target.value === 'custom_names')
                }}
                className="select w-full"
              >
                <option value="creator_number">Creator 1, Creator 2, etc.</option>
                <option value="custom_names">Custom Names</option>
              </select>

              {showCustomNames && creatorCount > 0 && (
                <div className="mt-3 space-y-2">
                  {Array.from({ length: creatorCount }).map((_, i) => (
                    <input
                      key={i}
                      type="text"
                      placeholder={`Creator ${i + 1} name`}
                      value={options.customNames?.[i] || ''}
                      onChange={(e) => updateCustomName(i, e.target.value)}
                      className="input"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Day Labeling */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                <Calendar className="h-4 w-4" />
                Day Labeling
              </label>
              <select
                value={options.dayLabeling}
                onChange={(e) => {
                  setOptions({ ...options, dayLabeling: e.target.value as any })
                  setShowCustomDays(e.target.value === 'custom')
                }}
                className="select w-full"
              >
                <option value="day_number">Day 1, Day 2, etc.</option>
                <option value="weekday">Monday, Tuesday, etc.</option>
                <option value="custom">Custom Labels</option>
              </select>

              {showCustomDays && selectedJobs.size > 0 && (
                <div className="mt-3 space-y-2">
                  {Array.from({ length: selectedJobs.size }).map((_, i) => (
                    <input
                      key={i}
                      type="text"
                      placeholder={`Day ${i + 1} label`}
                      value={options.customDayLabels?.[i] || ''}
                      onChange={(e) => updateCustomDay(i, e.target.value)}
                      className="input"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Export Type */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                <Tag className="h-4 w-4" />
                Export Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-dark-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-800">
                  <input
                    type="radio"
                    name="exportType"
                    value="local"
                    checked={options.exportType === 'local'}
                    onChange={() => setOptions({ ...options, exportType: 'local' })}
                    className="mr-3"
                  />
                  <Download className="h-4 w-4 mr-2" />
                  <div>
                    <div className="font-medium">Download ZIP Files</div>
                    <div className="text-sm text-gray-500 dark:text-dark-400">
                      One ZIP file per creator
                    </div>
                  </div>
                </label>
                
                <label className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-dark-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-800">
                  <input
                    type="radio"
                    name="exportType"
                    value="google_drive"
                    checked={options.exportType === 'google_drive'}
                    onChange={() => setOptions({ ...options, exportType: 'google_drive' })}
                    className="mr-3"
                  />
                  <Upload className="h-4 w-4 mr-2" />
                  <div>
                    <div className="font-medium">Export to Google Drive</div>
                    <div className="text-sm text-gray-500 dark:text-dark-400">
                      Organized folder structure in Drive
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Summary */}
            {selectedJobs.size > 0 && creatorCount > 0 && (
              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                  Export Summary
                </h4>
                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                  <li>• {selectedJobs.size} jobs selected</li>
                  <li>• {creatorCount} creators will receive content</li>
                  <li>• Each creator gets {selectedJobs.size} carousel{selectedJobs.size > 1 ? 's' : ''}</li>
                  <li>• Export format: {options.exportType === 'local' ? 'ZIP files' : 'Google Drive folders'}</li>
                </ul>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-dark-700">
          <div>
            {exporting && exportProgress.status && (
              <div className="text-sm text-gray-600 dark:text-dark-400">
                {exportProgress.status}
                {exportProgress.total > 0 && (
                  <span className="ml-2">
                    ({exportProgress.current}/{exportProgress.total})
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={exporting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selectedJobs.size === 0 || exporting || !!error}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  {options.exportType === 'local' ? (
                    <Download className="mr-2 h-4 w-4" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Export
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 