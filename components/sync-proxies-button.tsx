'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function SyncProxiesButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSync = async () => {
    setLoading(true)
    
    try {
      const response = await fetch('/api/geelark/sync-proxies', {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to sync proxies')
      }

      const result = await response.json()
      
      // Show success message (you could use a toast library here)
      alert(`${result.message}`)
      
      // Refresh the page to show updated data
      router.refresh()
    } catch (error) {
      console.error('Sync error:', error)
      alert(error instanceof Error ? error.message : 'Failed to sync proxies')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className="btn-secondary"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Syncing...' : 'Sync with GeeLark'}
    </button>
  )
} 