'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ProfileBulkActionsProps {
  action: string
  profileIds: string[]
  onComplete?: () => void
}

export function ProfileBulkActions({ action, profileIds, onComplete }: ProfileBulkActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const handleAction = async () => {
    if (profileIds.length === 0) {
      setMessage('No profiles selected')
      return
    }

    setIsProcessing(true)
    setMessage(null)

    try {
      let endpoint = ''
      let body = {}

      switch (action) {
        case 'assign-proxy':
          endpoint = '/api/profiles/assign-proxy'
          body = { profileIds }
          break
        case 'warmup':
          endpoint = '/api/profiles/start-warmup'
          body = { profileIds }
          break
        case 'pause':
          endpoint = '/api/profiles/pause'
          body = { profileIds }
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
        throw new Error(data.error || 'Action failed')
      }

      setMessage(data.message)
      
      // Refresh the page to show updated data
      setTimeout(() => {
        router.refresh()
        setMessage(null)
        onComplete?.()
      }, 2000)

    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // Auto-execute when component mounts
  useEffect(() => {
    handleAction()
  }, [])

  if (!message && !isProcessing) {
    return null
  }

  return (
    <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      message?.includes('Error') 
        ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' 
        : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    }`}>
      {isProcessing ? (
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-3"></div>
          Processing {profileIds.length} profile(s)...
        </div>
      ) : (
        <div>{message}</div>
      )}
    </div>
  )
} 