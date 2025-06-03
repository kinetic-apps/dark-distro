'use client'

import { useState, useEffect } from 'react'
import { Play, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import BulkPostLauncher from '@/components/bulk-post-launcher'
import { useRouter } from 'next/navigation'
import { formatRelativeTime } from '@/lib/utils'

interface PostsPageClientProps {
  children: React.ReactNode
}

export default function PostsPageClient({ children }: PostsPageClientProps) {
  const [showBulkLauncher, setShowBulkLauncher] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Initial sync
    handleSync()
    
    // Set up interval for auto-refresh
    const interval = setInterval(() => {
      handleSync()
    }, 10000) // Refresh every 10 seconds
    
    return () => clearInterval(interval)
  }, [])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      router.refresh()
      setLastSyncTime(new Date())
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Posts</h1>
            <p className="page-description">
              Manage content distribution campaigns
            </p>
          </div>
          
          <div className="flex gap-3">
            <div className="flex items-center text-sm">
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 text-blue-500 animate-spin" />
                  <span className="text-gray-600 dark:text-dark-300">Syncing...</span>
                </>
              ) : lastSyncTime ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-gray-600 dark:text-dark-300">
                    Auto-syncing • Last update: {formatRelativeTime(lastSyncTime.toISOString())}
                  </span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2 text-gray-400" />
                  <span className="text-gray-600 dark:text-dark-300">Waiting for first sync...</span>
                </>
              )}
            </div>
            <button 
              onClick={() => setShowBulkLauncher(true)}
              className="btn-primary"
            >
              <Play className="h-4 w-4 mr-2" />
              Launch Daily Campaign
            </button>
          </div>
        </div>

        {showBulkLauncher && (
          <BulkPostLauncher onClose={() => setShowBulkLauncher(false)} />
        )}

        {children}
      </div>
    </>
  )
} 