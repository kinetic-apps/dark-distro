'use client'

import { useState, useEffect } from 'react'
import { formatRelativeTime } from '@/lib/utils'
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  TrendingUp,
  Calendar,
  Target,
  Search,
  Play,
  User,
  BarChart3
} from 'lucide-react'

interface WarmupTask {
  id: string
  geelark_task_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  created_at: string
  started_at: string | null
  completed_at: string | null
  config: {
    planned_duration: number
    strategy: string
    search_terms: string[]
    niche: string | null
  }
  duration: {
    planned_minutes: number
    actual_minutes: number
    current_progress: number
  }
  result: {
    success: boolean
    error_message: string | null
    error_code: number | null
  }
}

interface WarmupStatistics {
  total_sessions: number
  completed_sessions: number
  failed_sessions: number
  total_duration_minutes: number
  total_duration_hours: number
  success_rate: number
  average_duration_minutes: number
  first_warmup_at: string | null
  last_warmup_at: string | null
  currently_warming_up: boolean
}

interface WarmupHistoryProps {
  accountId: string
}

export function WarmupHistory({ accountId }: WarmupHistoryProps) {
  const [statistics, setStatistics] = useState<WarmupStatistics | null>(null)
  const [tasks, setTasks] = useState<WarmupTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchWarmupHistory()
  }, [accountId])

  const fetchWarmupHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/profiles/${accountId}/warmup-history`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch warmup history')
      }

      const data = await response.json()
      setStatistics(data.statistics)
      setTasks(data.tasks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'browse video':
        return <Play className="h-4 w-4 text-purple-500" />
      case 'search video':
        return <Search className="h-4 w-4 text-blue-500" />
      case 'search profile':
        return <User className="h-4 w-4 text-green-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`
    }
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-dark-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 p-6">
        <div className="text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-dark-100">Error loading warmup history</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-400">{error}</p>
          <button
            onClick={fetchWarmupHistory}
            className="mt-4 btn-secondary btn-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!statistics || statistics.total_sessions === 0) {
    return (
      <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 p-6">
        <div className="text-center">
          <Activity className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-dark-100">No warmup history</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-400">This profile hasn't been warmed up yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Warmup History
        </h2>
        {statistics.currently_warming_up && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
            <Clock className="h-3 w-3 animate-pulse" />
            Currently warming up
          </span>
        )}
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
          <div className="flex items-center justify-center gap-1 mb-1">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <span className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
              {statistics.total_sessions}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-dark-400">Total Sessions</p>
        </div>

        <div className="text-center p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="h-4 w-4 text-purple-500" />
            <span className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
              {statistics.total_duration_hours}h
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-dark-400">Total Duration</p>
        </div>

        <div className="text-center p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
              {statistics.success_rate}%
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-dark-400">Success Rate</p>
        </div>

        <div className="text-center p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Target className="h-4 w-4 text-orange-500" />
            <span className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
              {formatDuration(statistics.average_duration_minutes)}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-dark-400">Avg Duration</p>
        </div>
      </div>

      {/* Task History */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Session History ({tasks.length} sessions)
        </h3>

        <div className="space-y-3">
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className="border border-gray-200 dark:border-dark-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(task.status)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                        Session {tasks.length - index}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-dark-400">
                        {formatRelativeTime(task.created_at)}
                      </span>
                      {task.status === 'running' && task.duration.current_progress > 0 && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {task.duration.current_progress}% complete
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        {getStrategyIcon(task.config.strategy)}
                        <span className="text-gray-600 dark:text-dark-400">
                          {task.config.strategy === 'browse video' ? 'Random Browse' :
                           task.config.strategy === 'search video' ? 'Video Search' :
                           'Profile Search'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600 dark:text-dark-400">
                          {task.status === 'completed' || task.status === 'failed' ? (
                            <>
                              {formatDuration(task.duration.actual_minutes)} 
                              <span className="text-gray-400">
                                / {formatDuration(task.duration.planned_minutes)}
                              </span>
                            </>
                          ) : (
                            formatDuration(task.duration.planned_minutes)
                          )}
                        </span>
                      </div>

                      {task.config.search_terms.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-dark-400 truncate">
                            {task.config.search_terms.slice(0, 3).join(', ')}
                            {task.config.search_terms.length > 3 && ` +${task.config.search_terms.length - 3}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {task.result.error_message && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs">
                        <span className="text-red-800 dark:text-red-300 font-medium">Error:</span>
                        <span className="text-red-600 dark:text-red-400 ml-1">
                          {task.result.error_message}
                        </span>
                      </div>
                    )}

                    {task.status === 'running' && task.duration.current_progress > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-1.5">
                          <div 
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${task.duration.current_progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 text-right">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    task.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                    task.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                    task.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                    task.status === 'cancelled' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                  }`}>
                    {task.status === 'completed' ? 'Success' :
                     task.status === 'failed' ? 'Failed' :
                     task.status === 'running' ? 'Running' :
                     task.status === 'cancelled' ? 'Cancelled' :
                     'Pending'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {statistics.first_warmup_at && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-dark-700">
          <p className="text-xs text-gray-500 dark:text-dark-400">
            First warmup: {formatRelativeTime(statistics.first_warmup_at)}
            {statistics.last_warmup_at && statistics.last_warmup_at !== statistics.first_warmup_at && (
              <> • Last warmup: {formatRelativeTime(statistics.last_warmup_at)}</>
            )}
          </p>
        </div>
      )}
    </div>
  )
} 