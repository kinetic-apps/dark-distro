'use client'

import { useState, useEffect } from 'react'
import { Play } from 'lucide-react'
import Link from 'next/link'
import BulkPostLauncher from '@/components/bulk-post-launcher'
import TaskStatusUpdater from '@/components/task-status-updater'
import { useRouter } from 'next/navigation'

interface PostsPageClientProps {
  children: React.ReactNode
}

export default function PostsPageClient({ children }: PostsPageClientProps) {
  const [showBulkLauncher, setShowBulkLauncher] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        router.refresh()
      }, 10000) // Refresh every 10 seconds
      
      return () => clearInterval(interval)
    }
  }, [autoRefresh, router])

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
            <label className="flex items-center text-sm text-gray-600 dark:text-dark-300">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-2 rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-100 dark:focus:ring-dark-400"
              />
              Auto-refresh
            </label>
            <TaskStatusUpdater />
            <Link href="/assets" className="btn-secondary">
              Browse Assets
            </Link>
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