'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function SyncProfilesButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const handleSync = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/geelark/sync-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed')
      }

      setMessage(data.message)
      
      // Refresh the page to show new profiles
      setTimeout(() => {
        router.refresh()
        setMessage(null)
      }, 2000)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleSync}
        disabled={isLoading}
        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        {isLoading ? 'Syncing...' : 'Sync from GeeLark'}
      </button>
      
      {message && (
        <div className={`absolute top-full mt-2 left-0 right-0 p-2 text-sm rounded-md whitespace-nowrap ${
          message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
} 