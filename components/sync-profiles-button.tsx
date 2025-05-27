'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useNotification } from '@/lib/context/notification-context'

export function SyncProfilesButton() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { notify } = useNotification()

  const handleSync = async () => {
    setIsLoading(true)

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

      // Show detailed sync results
      notify('success', data.message)
      
      if (data.auto_cleanup) {
        notify('info', 'Database automatically cleaned up since no cloud phones exist in GeeLark')
      }
      
      if (data.stats) {
        const { imported, updated, deleted, errors } = data.stats
        
        if (imported > 0) {
          notify('info', `Imported ${imported} new profile${imported !== 1 ? 's' : ''} from GeeLark`)
        }
        
        if (updated > 0) {
          notify('info', `Updated ${updated} existing profile${updated !== 1 ? 's' : ''}`)
        }
        
        if (deleted > 0 && !data.auto_cleanup) {
          notify('info', `Removed ${deleted} profile${deleted !== 1 ? 's' : ''} no longer in GeeLark`)
        }
        
        if (errors > 0) {
          notify('error', `${errors} error${errors !== 1 ? 's' : ''} occurred during sync`)
        }
      }
      
      // Refresh the page to show updated profiles
      setTimeout(() => {
        router.refresh()
      }, 2000)
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Unknown sync error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={isLoading}
      className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
      title="Sync profiles with GeeLark - imports new profiles and removes deleted ones"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Syncing...' : 'Sync from GeeLark'}
    </button>
  )
} 