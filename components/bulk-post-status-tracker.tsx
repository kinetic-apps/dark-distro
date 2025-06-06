'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, Clock, RefreshCw, X, TrendingUp } from 'lucide-react'

interface BulkPostStatusTrackerProps {
  isVisible: boolean
  onClose: () => void
  bulkSessionId?: string
}

interface BulkPostStats {
  launched: number
  succeeded: number
  failed: number
  pending: number
  processing: number
}

export default function BulkPostStatusTracker({ 
  isVisible, 
  onClose, 
  bulkSessionId 
}: BulkPostStatusTrackerProps) {
  const [stats, setStats] = useState<BulkPostStats>({
    launched: 0,
    succeeded: 0,
    failed: 0,
    pending: 0,
    processing: 0
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
  const supabase = createClient()

  const fetchStats = async () => {
    if (!isVisible) return
    
    setIsRefreshing(true)
    try {
      // Get posts from the last 10 minutes to capture recent bulk operations
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      
      const { data: posts, error } = await supabase
        .from('posts')
        .select('status, created_at')
        .gte('created_at', tenMinutesAgo)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching bulk post stats:', error)
        return
      }

      if (!posts || posts.length === 0) {
        setStats({
          launched: 0,
          succeeded: 0,
          failed: 0,
          pending: 0,
          processing: 0
        })
        return
      }

      // Calculate stats
      const newStats = {
        launched: posts.length,
        succeeded: posts.filter(p => p.status === 'posted').length,
        failed: posts.filter(p => p.status === 'failed').length,
        pending: posts.filter(p => p.status === 'queued' || p.status === 'pending').length,
        processing: posts.filter(p => p.status === 'processing').length
      }

      setStats(newStats)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error fetching bulk post stats:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (isVisible) {
      // Initial fetch
      fetchStats()
      
      // Set up polling every 3 seconds
      const interval = setInterval(fetchStats, 3000)
      
      return () => clearInterval(interval)
    }
  }, [isVisible])

  const getSuccessRate = () => {
    if (stats.launched === 0) return 0
    return Math.round((stats.succeeded / stats.launched) * 100)
  }

  const getFailureRate = () => {
    if (stats.launched === 0) return 0
    return Math.round((stats.failed / stats.launched) * 100)
  }

  const isComplete = () => {
    return stats.pending === 0 && stats.processing === 0 && stats.launched > 0
  }

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 w-80 bg-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-lg shadow-lg">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold text-gray-900 dark:text-dark-100">
              Bulk Post Status
            </h3>
            {isRefreshing && (
              <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="space-y-3">
          {/* Launched */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-700 dark:text-dark-300">
                Launched
              </span>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-dark-100">
              {stats.launched}
            </span>
          </div>

          {/* Succeeded */}
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Succeeded
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                {stats.succeeded}
              </span>
              {stats.launched > 0 && (
                <div className="text-xs text-green-600 dark:text-green-500">
                  {getSuccessRate()}%
                </div>
              )}
            </div>
          </div>

          {/* Failed */}
          <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                Failed
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-red-600 dark:text-red-400">
                {stats.failed}
              </span>
              {stats.launched > 0 && (
                <div className="text-xs text-red-600 dark:text-red-500">
                  {getFailureRate()}%
                </div>
              )}
            </div>
          </div>

          {/* Processing */}
          {stats.processing > 0 && (
            <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Processing
                </span>
              </div>
              <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                {stats.processing}
              </span>
            </div>
          )}

          {/* Pending */}
          {stats.pending > 0 && (
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-dark-300">
                  Pending
                </span>
              </div>
              <span className="text-lg font-bold text-gray-600 dark:text-dark-400">
                {stats.pending}
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {stats.launched > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 dark:text-dark-400 mb-1">
              <span>Progress</span>
              <span>{stats.succeeded + stats.failed} / {stats.launched}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
              <div className="flex h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-green-500 transition-all duration-300"
                  style={{ width: `${(stats.succeeded / stats.launched) * 100}%` }}
                ></div>
                <div 
                  className="bg-red-500 transition-all duration-300"
                  style={{ width: `${(stats.failed / stats.launched) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Status Message */}
        <div className="mt-4 text-center">
          {isComplete() ? (
            <div className="text-sm text-green-600 dark:text-green-400 font-medium">
              ✅ Bulk operation complete
            </div>
          ) : stats.launched > 0 ? (
            <div className="text-sm text-blue-600 dark:text-blue-400">
              🔄 Bulk operation in progress...
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-dark-400">
              No recent bulk operations
            </div>
          )}
        </div>

        {/* Last Updated */}
        {lastUpdated && (
          <div className="mt-2 text-xs text-gray-400 dark:text-dark-500 text-center">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  )
} 