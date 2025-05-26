'use client'

import { useState, useEffect } from 'react'
import { Camera, Loader2, X, RefreshCw, Maximize2 } from 'lucide-react'

interface ScreenshotViewerProps {
  profileId: string
  profileName?: string
  phoneStatus?: 'started' | 'starting' | 'stopped' | 'expired' | 'unknown'
}

export function ScreenshotViewer({ profileId, profileName, phoneStatus }: ScreenshotViewerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Take a new screenshot
  const takeScreenshot = async () => {
    if (!profileId || phoneStatus !== 'started') return

    setIsLoading(true)
    setError(null)
    setScreenshotUrl(null)

    try {
      const response = await fetch('/api/geelark/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setTaskId(data.task_id)
      setIsPolling(true)
    } catch (error) {
      setError(`Failed to take screenshot: ${error}`)
      setIsLoading(false)
    }
  }

  // Poll for screenshot result
  useEffect(() => {
    if (!isPolling || !taskId) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/geelark/screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: taskId })
        })

        const data = await response.json()
        
        if (data.status === 'completed' && data.download_url) {
          setScreenshotUrl(data.download_url)
          setLastUpdated(new Date())
          setIsPolling(false)
          setIsLoading(false)
        } else if (data.status === 'failed' || data.status === 'error') {
          setError('Screenshot failed')
          setIsPolling(false)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 2000) // Poll every 2 seconds

    // Stop polling after 30 seconds
    const timeout = setTimeout(() => {
      setIsPolling(false)
      setIsLoading(false)
      setError('Screenshot timeout')
    }, 30000)

    return () => {
      clearInterval(pollInterval)
      clearTimeout(timeout)
    }
  }, [isPolling, taskId])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !isOpen || phoneStatus !== 'started') return

    const refreshInterval = setInterval(() => {
      takeScreenshot()
    }, 10000) // Refresh every 10 seconds

    return () => clearInterval(refreshInterval)
  }, [autoRefresh, isOpen, phoneStatus, profileId])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true)
          if (!screenshotUrl && phoneStatus === 'started') {
            takeScreenshot()
          }
        }}
        disabled={phoneStatus !== 'started'}
        className="btn-secondary text-xs flex items-center gap-2"
        title={phoneStatus !== 'started' ? 'Phone must be running' : 'View screen'}
      >
        <Camera className="h-4 w-4" />
        View Screen
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Phone Screen - {profileName || 'Unknown'}
                </h3>
                {lastUpdated && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Last updated: {formatTime(lastUpdated)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Auto-refresh toggle */}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Auto-refresh</span>
                </label>

                {/* Manual refresh */}
                <button
                  onClick={takeScreenshot}
                  disabled={isLoading || phoneStatus !== 'started'}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Refresh screenshot"
                >
                  <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                {/* Close button */}
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setAutoRefresh(false)
                  }}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900">
              {error ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                  <button
                    onClick={takeScreenshot}
                    disabled={phoneStatus !== 'started'}
                    className="btn-primary"
                  >
                    Try Again
                  </button>
                </div>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Taking screenshot...</p>
                </div>
              ) : screenshotUrl ? (
                <div className="flex items-center justify-center h-full">
                  <div className="relative group">
                    <img
                      src={screenshotUrl}
                      alt="Phone screenshot"
                      className="max-w-full max-h-[70vh] rounded-lg shadow-lg"
                      onError={() => setError('Failed to load screenshot')}
                    />
                    <a
                      href={screenshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Open in new tab"
                    >
                      <Maximize2 className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <Camera className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">No screenshot available</p>
                  <button
                    onClick={takeScreenshot}
                    disabled={phoneStatus !== 'started'}
                    className="btn-primary"
                  >
                    Take Screenshot
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
} 