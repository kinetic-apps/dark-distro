'use client'

import { useState, useEffect } from 'react'
import { Camera, RefreshCw, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PhoneProfile {
  id: string
  profile_id: string
  account_id: string
  meta: any
  accounts: {
    id: string
    tiktok_username: string | null
  }[]
}

interface ScreenshotData {
  profileId: string
  profileName: string
  status: 'loading' | 'completed' | 'failed' | 'idle'
  url?: string
  taskId?: string
  lastUpdated?: Date
}

export default function ScreenshotsPage() {
  const [profiles, setProfiles] = useState<PhoneProfile[]>([])
  const [screenshots, setScreenshots] = useState<Record<string, ScreenshotData>>({})
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch profiles with phones
  useEffect(() => {
    const fetchProfiles = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('phones')
        .select('*, accounts(*)')
        .order('created_at', { ascending: false })

      if (data && !error) {
        setProfiles(data)
        // Initialize screenshot data
        const initialScreenshots: Record<string, ScreenshotData> = {}
        data.forEach((profile: PhoneProfile) => {
          initialScreenshots[profile.profile_id] = {
            profileId: profile.profile_id,
            profileName: profile.accounts?.[0]?.tiktok_username || 'Unnamed',
            status: 'idle'
          }
        })
        setScreenshots(initialScreenshots)
      }
      setIsLoading(false)
    }

    fetchProfiles()
  }, [])

  // Take screenshot for a specific profile
  const takeScreenshot = async (profileId: string) => {
    setScreenshots(prev => ({
      ...prev,
      [profileId]: { ...prev[profileId], status: 'loading', url: undefined }
    }))

    try {
      // Request screenshot
      const response = await fetch('/api/geelark/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      const taskId = data.task_id

      // Poll for result
      const pollInterval = setInterval(async () => {
        try {
          const pollResponse = await fetch('/api/geelark/screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_id: taskId })
          })

          const pollData = await pollResponse.json()
          
          if (pollData.status === 'completed' && pollData.download_url) {
            setScreenshots(prev => ({
              ...prev,
              [profileId]: {
                ...prev[profileId],
                status: 'completed',
                url: pollData.download_url,
                lastUpdated: new Date()
              }
            }))
            clearInterval(pollInterval)
          } else if (pollData.status === 'failed') {
            setScreenshots(prev => ({
              ...prev,
              [profileId]: { ...prev[profileId], status: 'failed' }
            }))
            clearInterval(pollInterval)
          }
        } catch (error) {
          console.error('Polling error:', error)
        }
      }, 2000)

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(pollInterval)
        setScreenshots(prev => {
          if (prev[profileId].status === 'loading') {
            return {
              ...prev,
              [profileId]: { ...prev[profileId], status: 'failed' }
            }
          }
          return prev
        })
      }, 30000)

    } catch (error) {
      setScreenshots(prev => ({
        ...prev,
        [profileId]: { ...prev[profileId], status: 'failed' }
      }))
    }
  }

  // Take screenshots for all profiles
  const takeAllScreenshots = async () => {
    const runningProfiles = profiles.filter(p => {
      // Only take screenshots for profiles that appear to be running
      // You might want to check actual phone status here
      return true
    })

    for (const profile of runningProfiles) {
      await takeScreenshot(profile.profile_id)
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      takeAllScreenshots()
    }, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, profiles])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500 dark:text-dark-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Phone Screenshots</h1>
          <p className="page-description">
            Capture and view screenshots from GeeLark phone profiles
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={takeAllScreenshots}
            className="btn-primary"
          >
            <Camera className="h-4 w-4 mr-2" />
            Capture All Screens
          </button>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-dark-600 dark:bg-dark-700 dark:focus:ring-dark-400"
            />
            <span className="text-sm text-gray-700 dark:text-dark-300">Auto-refresh (30s)</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {profiles.map(profile => {
          const screenshot = screenshots[profile.profile_id]
          
          return (
            <div
              key={profile.profile_id}
              className="card overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-dark-700">
                <h3 className="font-medium text-gray-900 dark:text-dark-100">
                  {screenshot?.profileName}
                </h3>
                <p className="text-xs text-gray-500 dark:text-dark-400">
                  {profile.profile_id.slice(-8)}
                </p>
                {screenshot?.lastUpdated && (
                  <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                    Updated: {screenshot.lastUpdated.toLocaleTimeString()}
                  </p>
                )}
              </div>

              <div className="relative aspect-[9/16] bg-gray-100 dark:bg-dark-900">
                {screenshot?.status === 'loading' ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-dark-500" />
                  </div>
                ) : screenshot?.status === 'completed' && screenshot.url ? (
                  <img
                    src={screenshot.url}
                    alt={`Screenshot of ${screenshot.profileName}`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = ''
                      setScreenshots(prev => ({
                        ...prev,
                        [profile.profile_id]: { ...prev[profile.profile_id], status: 'failed' }
                      }))
                    }}
                  />
                ) : screenshot?.status === 'failed' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    <Camera className="h-12 w-12 text-gray-300 dark:text-dark-600 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-dark-400">Failed to capture</p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    <Camera className="h-12 w-12 text-gray-300 dark:text-dark-600 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-dark-400">No screenshot</p>
                  </div>
                )}

                <button
                  onClick={() => takeScreenshot(profile.profile_id)}
                  disabled={screenshot?.status === 'loading'}
                  className="absolute bottom-2 right-2 p-2 bg-black bg-opacity-50 rounded-lg text-white hover:bg-opacity-70 transition-opacity disabled:opacity-50"
                  title="Refresh screenshot"
                >
                  <RefreshCw className={`h-4 w-4 ${screenshot?.status === 'loading' ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {profiles.length === 0 && (
        <div className="text-center py-12">
          <Camera className="h-16 w-16 text-gray-300 dark:text-dark-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-dark-400">No phone profiles found</p>
        </div>
      )}
    </div>
  )
} 