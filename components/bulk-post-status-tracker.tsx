'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Clock, RefreshCw, Smartphone, Layers, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'

interface BulkPostStatusTrackerProps {
  isVisible: boolean
  onClose: () => void
}

interface PostStatus {
  id: string
  account_id: string
  type: string
  status: string
  created_at: string
  posted_at: string | null
  task_id: string | null
  caption: string | null
  meta: any
  account: {
    tiktok_username: string | null
    geelark_profile_id: string | null
    meta: any
  } | null
}

interface LogEntry {
  timestamp: string
  level: string
  message: string
  meta: any
}

export default function BulkPostStatusTracker({ isVisible, onClose }: BulkPostStatusTrackerProps) {
  const [posts, setPosts] = useState<PostStatus[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  
  const supabase = createClient()

  useEffect(() => {
    if (isVisible) {
      loadData()
      const interval = autoRefresh ? setInterval(loadData, 5000) : null
      return () => {
        if (interval) clearInterval(interval)
      }
    }
  }, [isVisible, autoRefresh])

  const loadData = async () => {
    await Promise.all([loadPosts(), loadLogs()])
  }

  const loadPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select(`
        *,
        account:accounts!fk_account(
          tiktok_username,
          geelark_profile_id,
          meta
        )
      `)
      .not('meta', 'is', null)
      .neq('meta->bulk_post', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (data) {
      // Filter for posts that actually have bulk_post = true in meta
      const bulkPosts = data.filter(post => post.meta?.bulk_post === true)
      setPosts(bulkPosts)
    }
    setIsLoading(false)
  }

  const loadLogs = async () => {
    const { data } = await supabase
      .from('logs')
      .select('timestamp, level, message, meta')
      .eq('component', 'api-bulk-post')
      .gte('timestamp', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 minutes
      .order('timestamp', { ascending: false })
      .limit(20)

    if (data) {
      setLogs(data)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'posted':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'processing':
      case 'pending':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'posted':
        return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
      case 'failed':
        return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
      case 'processing':
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20'
      default:
        return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
    }
  }

  // Group posts by batch
  const groupedPosts = posts.reduce((acc, post) => {
    const batchKey = `${post.created_at.substring(0, 16)}_${post.meta?.batch_total || 'unknown'}`
    if (!acc[batchKey]) {
      acc[batchKey] = {
        posts: [],
        total: post.meta?.batch_total || 0,
        timestamp: post.created_at
      }
    }
    acc[batchKey].posts.push(post)
    return acc
  }, {} as Record<string, { posts: PostStatus[]; total: number; timestamp: string }>)

  // Sort posts within each batch by position
  Object.values(groupedPosts).forEach(batch => {
    batch.posts.sort((a, b) => {
      const posA = a.meta?.batch_position || 999
      const posB = b.meta?.batch_position || 999
      return posA - posB
    })
  })

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-850 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
                Bulk Post Status
              </h2>
              <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                Monitor cascading bulk post progress
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 dark:border-dark-600"
                />
                <span className="text-gray-600 dark:text-dark-400">Auto-refresh</span>
              </label>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="p-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-gray-500 dark:text-dark-400">Loading posts...</p>
            </div>
          ) : Object.keys(groupedPosts).length === 0 ? (
            <div className="p-12 text-center">
              <Layers className="h-12 w-12 mx-auto text-gray-300 dark:text-dark-600" />
              <p className="mt-2 text-gray-500 dark:text-dark-400">No bulk posts found</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Bulk Post Batches */}
              {Object.entries(groupedPosts).map(([batchKey, batch]) => {
                const completedCount = batch.posts.filter(p => p.status === 'posted' || p.status === 'failed').length
                const successCount = batch.posts.filter(p => p.status === 'posted').length
                const failCount = batch.posts.filter(p => p.status === 'failed').length
                const isComplete = completedCount === batch.posts.length

                return (
                  <div key={batchKey} className="card">
                    <div className="p-4 border-b border-gray-200 dark:border-dark-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-dark-100">
                            Bulk Post Batch
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-dark-400">
                            Started {formatRelativeTime(batch.timestamp)}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-green-600 dark:text-green-400">
                            {successCount} succeeded
                          </span>
                          <span className="text-red-600 dark:text-red-400">
                            {failCount} failed
                          </span>
                          <span className="text-gray-500 dark:text-dark-400">
                            {completedCount}/{batch.total} complete
                          </span>
                        </div>
                      </div>
                      {!isComplete && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
                            <div 
                              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${(completedCount / batch.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="divide-y divide-gray-200 dark:divide-dark-700">
                      {batch.posts.map((post) => (
                        <div key={post.id} className="p-4 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-dark-400 font-mono">
                                  #{post.meta?.serial_no || '?'}
                                </span>
                                <Smartphone className="h-4 w-4 text-gray-400" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-dark-100">
                                  {post.account?.tiktok_username || post.account?.geelark_profile_id || 'Unknown'}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {post.type === 'video' ? (
                                    <Video className="h-3 w-3 text-purple-500" />
                                  ) : (
                                    <Layers className="h-3 w-3 text-blue-500" />
                                  )}
                                  <p className="text-xs text-gray-500 dark:text-dark-400">
                                    {post.caption ? post.caption.substring(0, 50) + '...' : 'No caption'}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
                                {getStatusIcon(post.status)}
                                {post.status}
                              </span>
                              {post.meta?.batch_position && (
                                <span className="text-xs text-gray-400 dark:text-dark-500">
                                  Position {post.meta.batch_position}/{post.meta.batch_total}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Bulk Post Activity Logs */}
              {logs.length > 0 && (
                <div className="card">
                  <div className="p-4 border-b border-gray-200 dark:border-dark-700">
                    <h3 className="font-medium text-gray-900 dark:text-dark-100">
                      Bulk Post Activity
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-dark-400">
                      Recent bulk post operations
                    </p>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-dark-700 max-h-64 overflow-y-auto">
                    {logs.map((log, index) => (
                      <div key={index} className="p-3 text-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={`font-medium ${
                              log.level === 'error' ? 'text-red-600 dark:text-red-400' : 
                              log.level === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 
                              'text-gray-900 dark:text-dark-100'
                            }`}>
                              {log.message}
                            </p>
                            {log.meta && (
                              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                                {log.meta.account_count && `${log.meta.account_count} accounts • `}
                                {log.meta.position && `Position ${log.meta.position}/${log.meta.total} • `}
                                {log.meta.serial_no && `Serial #${log.meta.serial_no} • `}
                                {log.meta.success_count !== undefined && `${log.meta.success_count} succeeded • `}
                                {log.meta.fail_count !== undefined && `${log.meta.fail_count} failed`}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 dark:text-dark-500 ml-2">
                            {formatRelativeTime(log.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 