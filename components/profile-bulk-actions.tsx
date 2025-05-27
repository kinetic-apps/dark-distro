'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useNotification } from '@/lib/context/notification-context'
import { WarmupConfigModal, type WarmupConfig } from './warmup-config-modal'

interface ProfileBulkActionsProps {
  action: string
  profileIds: string[]
  onComplete?: () => void
}

export function ProfileBulkActions({ action, profileIds, onComplete }: ProfileBulkActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [showWarmupConfig, setShowWarmupConfig] = useState(false)
  const router = useRouter()
  const { notify } = useNotification()
  const hasExecuted = useRef(false)

  const handleWarmupConfig = async (config: WarmupConfig) => {
    setShowWarmupConfig(false)
    setIsProcessing(true)

    try {
      const response = await fetch('/api/geelark/start-warmup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          profile_ids: profileIds,
          options: config
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Warmup failed')
      }

      notify('success', data.message || `Warmup started for ${profileIds.length} profiles`)
      
      setTimeout(() => {
        router.refresh()
        onComplete?.()
      }, 2000)

    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAction = async () => {
    // Prevent multiple executions
    if (hasExecuted.current || isProcessing) {
      return
    }
    
    hasExecuted.current = true

    if (profileIds.length === 0) {
      notify('error', 'No profiles selected')
      return
    }

    // Special handling for warmup action
    if (action === 'warmup') {
      setShowWarmupConfig(true)
      return
    }

    setIsProcessing(true)

    try {
      let endpoint = ''
      let body = {}

      switch (action) {
        case 'assign-proxy':
          endpoint = '/api/profiles/assign-proxy'
          body = { profileIds }
          break
        case 'start-phone':
          endpoint = '/api/geelark/phone-control'
          body = { 
            profile_ids: profileIds,
            action: 'start'
          }
          break
        case 'stop-phone':
          endpoint = '/api/geelark/phone-control'
          body = { 
            profile_ids: profileIds,
            action: 'stop'
          }
          break
        case 'screenshot':
          // For screenshot, we'll handle each profile individually with better error handling
          const screenshotResults = []
          const screenshotErrors = []
          
          for (const profileId of profileIds) {
            try {
              const response = await fetch('/api/geelark/screenshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile_id: profileId })
              })
              
              if (response.ok) {
                screenshotResults.push(profileId)
              } else {
                const errorData = await response.json()
                screenshotErrors.push(`Profile ${profileId}: ${errorData.error || 'Unknown error'}`)
              }
            } catch (error) {
              screenshotErrors.push(`Profile ${profileId}: ${error instanceof Error ? error.message : 'Network error'}`)
            }
          }
          
          // Show results
          if (screenshotResults.length > 0) {
            notify('success', `Screenshots requested for ${screenshotResults.length} profile(s)`)
          }
          if (screenshotErrors.length > 0) {
            notify('error', `Failed for ${screenshotErrors.length} profile(s): ${screenshotErrors.slice(0, 2).join(', ')}${screenshotErrors.length > 2 ? '...' : ''}`)
          }
          
          onComplete?.()
          return
        case 'post-video':
          endpoint = '/api/geelark/post-video'
          body = { profile_ids: profileIds }
          break
        case 'post-carousel':
          endpoint = '/api/geelark/post-carousel'
          body = { profile_ids: profileIds }
          break
        case 'tiktok-login':
          endpoint = '/api/geelark/tiktok-login'
          body = { profile_ids: profileIds }
          break
        case 'edit-profile':
          // For edit profile, we need more info, so just show a message
          notify('info', 'Please use the profile details page to edit TikTok profiles')
          onComplete?.()
          return
        case 'upload-files':
          // For file upload, we need file selection, so just show a message
          notify('info', 'Please use the profile details page to upload files')
          onComplete?.()
          return
        case 'sync-profiles':
          endpoint = '/api/geelark/sync-profiles'
          body = {}
          break
        case 'delete':
          endpoint = '/api/profiles/bulk-delete'
          body = { 
            profileIds,
            deleteFromGeelark: false
          }
          break
        case 'delete-from-geelark':
          endpoint = '/api/profiles/bulk-delete'
          body = { 
            profileIds,
            deleteFromGeelark: true
          }
          break
        default:
          throw new Error(`Unknown action: ${action}`)
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Action failed')
      }

      // Check if the operation actually succeeded
      if (data.success === false) {
        // Show specific error message from the API
        notify('error', data.message || `${action} failed`)
        
        // If there are specific failures, show them
        if (data.results?.failures && data.results.failures.length > 0) {
          const failureMessages = data.results.failures
            .slice(0, 3)
            .map((f: any) => `${f.msg || 'Unknown error'}`)
            .join(', ')
          notify('error', `Failures: ${failureMessages}`)
        }
      } else {
        // Show success message
        notify('success', data.message || `${action} completed successfully`)
      }
      
      // Always refresh the page to show updated data
      setTimeout(() => {
        router.refresh()
        onComplete?.()
      }, 2000)

    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Auto-execute when component mounts
  useEffect(() => {
    handleAction()
  }, []) // Empty dependency array to run only once

  // Return the warmup config modal if needed
  return (
    <WarmupConfigModal
      isOpen={showWarmupConfig}
      onClose={() => {
        setShowWarmupConfig(false)
        onComplete?.()
      }}
      onConfirm={handleWarmupConfig}
      selectedCount={profileIds.length}
      isLoading={isProcessing}
    />
  )
} 