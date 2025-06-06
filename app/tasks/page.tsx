'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Loader2, 
  X, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Heart,
  Video,
  Flame,
  Images,
  LogIn,
  Edit,
  Bot,
  PlayCircle,
  PauseCircle,
  XCircle,
  RefreshCw,
  Activity,
  TrendingUp,
  Timer,
  AlertTriangle
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface GeeLarkTask {
  id: string
  planName: string
  taskType: number
  serialName: string
  envId: string
  scheduleAt: number
  status: number
  failCode?: number
  failDesc?: string
  cost?: number
}

interface Task {
  id: string
  type: string
  task_type?: string
  geelark_task_id: string
  account_id: string
  profile_id?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
  meta: any
  accounts?: {
    id: string
    tiktok_username: string | null
  }
}

interface TaskStats {
  total: number
  byStatus: {
    pending: number
    running: number
    completed: number
    failed: number
    cancelled: number
  }
  byType: Record<string, number>
  avgExecutionTime: number
  successRate: number
}

const GEELARK_STATUS_MAP: Record<number, { label: string; status: Task['status']; class: string }> = {
  1: { label: 'Waiting', status: 'pending', class: 'status-neutral' },
  2: { label: 'In Progress', status: 'running', class: 'status-info' },
  3: { label: 'Completed', status: 'completed', class: 'status-active' },
  4: { label: 'Failed', status: 'failed', class: 'status-error' },
  7: { label: 'Cancelled', status: 'cancelled', class: 'status-neutral' }
}

const TASK_TYPE_MAP: Record<number, { label: string; icon: any; class: string }> = {
  1: { label: 'Video Post', icon: Video, class: 'text-purple-500' },
  2: { label: 'Warmup', icon: Flame, class: 'text-orange-500' },
  3: { label: 'Carousel', icon: Images, class: 'text-blue-500' },
  4: { label: 'Login', icon: LogIn, class: 'text-green-500' },
  6: { label: 'Profile Edit', icon: Edit, class: 'text-yellow-500' },
  42: { label: 'Custom RPA', icon: Bot, class: 'text-indigo-500' }
}

// Map our task types to GeeLark task types
const OUR_TYPE_TO_GEELARK: Record<string, number> = {
  'post': 1,
  'warmup': 2,
  'login': 4,
  'profile_edit': 6,
  'engagement': 42,
  'sms_login': 4
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    byStatus: { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 },
    byType: {},
    avgExecutionTime: 0,
    successRate: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  
  const supabase = createClient()

  const calculateStats = (tasks: Task[]): TaskStats => {
    const stats: TaskStats = {
      total: tasks.length,
      byStatus: { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 },
      byType: {},
      avgExecutionTime: 0,
      successRate: 0
    }

    let totalExecutionTime = 0
    let completedTasks = 0

    tasks.forEach(task => {
      // Count by status
      stats.byStatus[task.status]++

      // Count by type
      const taskType = task.type || task.task_type || 'unknown'
      stats.byType[taskType] = (stats.byType[taskType] || 0) + 1

      // Calculate execution time for completed tasks
      if (task.completed_at && task.started_at) {
        const executionTime = new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()
        totalExecutionTime += executionTime
        completedTasks++
      } else if (task.meta?.cost_seconds) {
        totalExecutionTime += task.meta.cost_seconds * 1000
        completedTasks++
      }
    })

    // Calculate average execution time
    if (completedTasks > 0) {
      stats.avgExecutionTime = Math.round(totalExecutionTime / completedTasks / 1000) // in seconds
    }

    // Calculate success rate
    const totalFinished = stats.byStatus.completed + stats.byStatus.failed + stats.byStatus.cancelled
    if (totalFinished > 0) {
      stats.successRate = Math.round((stats.byStatus.completed / totalFinished) * 100)
    }

    return stats
  }

  const fetchTasks = async () => {
    try {
      setError(null)
      
      // Only fetch tasks from the past 24 hours
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
      
      const { data: dbTasks, error: dbError } = await supabase
        .from('tasks')
        .select('*, accounts(id, tiktok_username)')
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(200)

      if (dbError) throw dbError

      setTasks(dbTasks || [])
      setStats(calculateStats(dbTasks || []))
      
      // Get last sync time from the most recently updated task
      if (dbTasks && dbTasks.length > 0) {
        const mostRecentUpdate = dbTasks.reduce((latest, task) => 
          new Date(task.updated_at) > new Date(latest.updated_at) ? task : latest
        )
        setLastSyncTime(mostRecentUpdate.updated_at)
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch tasks')
    } finally {
      setIsLoading(false)
    }
  }

  const syncWithGeeLark = async () => {
    setIsSyncing(true)
    try {
      // Get all task IDs that need syncing (only from past 24 hours)
      const taskIds = tasks
        .filter(t => {
          if (!t.geelark_task_id) return false
          
          // Only sync tasks created in the past 24 hours
          const taskAge = Date.now() - new Date(t.created_at).getTime()
          const twentyFourHours = 24 * 60 * 60 * 1000
          return taskAge <= twentyFourHours
        })
        .map(t => t.geelark_task_id)

      if (taskIds.length === 0) {
        setLastSyncTime(new Date().toISOString())
        return
      }

      // Sync in batches of 100 (GeeLark limit)
      const batches = []
      for (let i = 0; i < taskIds.length; i += 100) {
        batches.push(taskIds.slice(i, i + 100))
      }

      let totalUpdated = 0
      for (const batch of batches) {
        const response = await fetch('/api/geelark/task-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_ids: batch })
        })

        if (response.ok) {
          const data = await response.json()
          totalUpdated += data.updated || 0
        }
      }

      setLastSyncTime(new Date().toISOString())
      
      // Refresh tasks to show updated data
      await fetchTasks()
      
      // Show success message
      if (totalUpdated > 0) {
        console.log(`Successfully synced ${totalUpdated} tasks`)
      }
    } catch (error) {
      console.error('Failed to sync with GeeLark:', error)
      setError('Failed to sync with GeeLark')
    } finally {
      setIsSyncing(false)
    }
  }

  const cancelTask = async (taskId: string) => {
    try {
      const response = await fetch('/api/geelark/cancel-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: [taskId] })
      })

      if (response.ok) {
        await fetchTasks()
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel task')
      }
    } catch (error) {
      console.error('Failed to cancel task:', error)
      alert(error instanceof Error ? error.message : 'Failed to cancel task')
    }
  }

  const retryTask = async (taskId: string) => {
    try {
      const response = await fetch('/api/geelark/retry-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: [taskId] })
      })

      if (response.ok) {
        await fetchTasks()
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to retry task')
      }
    } catch (error) {
      console.error('Failed to retry task:', error)
      alert(error instanceof Error ? error.message : 'Failed to retry task')
    }
  }

  const bulkCancel = async () => {
    if (selectedTasks.size === 0) return

    const taskIds = Array.from(selectedTasks)
    
    if (!confirm(`Cancel ${taskIds.length} tasks?`)) return

    try {
      const response = await fetch('/api/geelark/cancel-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: taskIds })
      })

      if (response.ok) {
        setSelectedTasks(new Set())
        await fetchTasks()
      }
    } catch (error) {
      console.error('Failed to cancel tasks:', error)
      alert('Failed to cancel tasks')
    }
  }

  const bulkRetry = async () => {
    if (selectedTasks.size === 0) return

    const taskIds = Array.from(selectedTasks)
    
    if (!confirm(`Retry ${taskIds.length} tasks?`)) return

    try {
      const response = await fetch('/api/geelark/retry-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: taskIds })
      })

      if (response.ok) {
        setSelectedTasks(new Set())
        await fetchTasks()
      }
    } catch (error) {
      console.error('Failed to retry tasks:', error)
      alert('Failed to retry tasks')
    }
  }

  const getTaskIcon = (task: Task) => {
    const geelarkType = task.meta?.geelark_task_type || OUR_TYPE_TO_GEELARK[task.type || task.task_type || ''] || 0
    const typeInfo = TASK_TYPE_MAP[geelarkType]
    
    if (typeInfo) {
      const Icon = typeInfo.icon
      return <Icon className={`h-4 w-4 ${typeInfo.class}`} />
    }
    
    return <Activity className="h-4 w-4 text-gray-500" />
  }

  const getTaskTypeLabel = (task: Task) => {
    const geelarkType = task.meta?.geelark_task_type || OUR_TYPE_TO_GEELARK[task.type || task.task_type || ''] || 0
    return TASK_TYPE_MAP[geelarkType]?.label || task.type || task.task_type || 'Unknown'
  }

  const getStatusIcon = (status: Task['status'], geelarkStatus?: number) => {
    // Use GeeLark status if available
    if (geelarkStatus) {
      const mapped = GEELARK_STATUS_MAP[geelarkStatus]
      if (mapped) {
        status = mapped.status
      }
    }

    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'cancelled':
        return <X className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (task: Task) => {
    const geelarkStatus = task.meta?.geelark_status
    const mapped = geelarkStatus ? GEELARK_STATUS_MAP[geelarkStatus] : null
    
    const status = mapped?.status || task.status
    const label = mapped?.label || status.charAt(0).toUpperCase() + status.slice(1)
    
    const classes = {
      pending: 'status-neutral',
      running: 'status-info',
      completed: 'status-active',
      failed: 'status-error',
      cancelled: 'status-neutral'
    }

    return (
      <span className={classes[status]}>
        {label}
      </span>
    )
  }

  // Auto-refresh every minute
  useEffect(() => {
    if (!autoRefreshEnabled) return

    const interval = setInterval(() => {
      fetchTasks()
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [autoRefreshEnabled])

  // Initial fetch
  useEffect(() => {
    fetchTasks()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-description">
            Monitor and manage GeeLark automation tasks from the past 24 hours
          </p>
          {lastSyncTime && (
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
              Last synced: {formatRelativeTime(lastSyncTime)}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-400">
            <input
              type="checkbox"
              checked={autoRefreshEnabled}
              onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
            />
            Auto-refresh
          </label>

          {/* Sync button */}
          <button
            onClick={syncWithGeeLark}
            disabled={isSyncing}
            className="btn-primary"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync with GeeLark'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Total Tasks</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.total}
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                {stats.byStatus.running} running
              </p>
            </div>
            <div className="rounded-lg bg-gray-100 p-3 dark:bg-dark-700">
              <Activity className="h-6 w-6 text-gray-600 dark:text-dark-300" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Success Rate</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.successRate}%
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                {stats.byStatus.completed} completed
              </p>
            </div>
            <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900/20">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Failed</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.byStatus.failed}
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                {stats.byStatus.cancelled} cancelled
              </p>
            </div>
            <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/20">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Avg Time</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.avgExecutionTime}s
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                per task
              </p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/20">
              <Timer className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Pending</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.byStatus.pending}
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                waiting to run
              </p>
            </div>
            <div className="rounded-lg bg-yellow-100 p-3 dark:bg-yellow-900/20">
              <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedTasks.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {selectedTasks.size} {selectedTasks.size === 1 ? 'task' : 'tasks'} selected
            </p>
            <div className="flex gap-2">
              <button
                onClick={bulkCancel}
                className="btn-secondary text-sm"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel Selected
              </button>
              <button
                onClick={bulkRetry}
                className="btn-secondary text-sm"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Retry Selected
              </button>
              <button
                onClick={() => setSelectedTasks(new Set())}
                className="btn-secondary text-sm"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tasks Table */}
      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg dark:bg-dark-850 dark:border-dark-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
          <thead className="bg-gray-50 dark:bg-dark-800">
            <tr>
              <th scope="col" className="relative w-12 px-6 sm:w-16 sm:px-8">
                <input
                  type="checkbox"
                  className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-dark-600 dark:bg-dark-700 dark:focus:ring-dark-400"
                  checked={selectedTasks.size === tasks.length && tasks.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTasks(new Set(tasks.map(t => t.geelark_task_id)))
                    } else {
                      setSelectedTasks(new Set())
                    }
                  }}
                />
              </th>
              <th scope="col" className="table-header">Type</th>
              <th scope="col" className="table-header">Account</th>
              <th scope="col" className="table-header">Status</th>
              <th scope="col" className="table-header">Task ID</th>
              <th scope="col" className="table-header">Started</th>
              <th scope="col" className="table-header">Duration</th>
              <th scope="col" className="table-header">Error</th>
              <th scope="col" className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-dark-700 dark:bg-dark-850">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                <td className="relative w-12 px-6 sm:w-16 sm:px-8">
                  <input
                    type="checkbox"
                    className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-dark-600 dark:bg-dark-700 dark:focus:ring-dark-400"
                    checked={selectedTasks.has(task.geelark_task_id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedTasks)
                      if (e.target.checked) {
                        newSelected.add(task.geelark_task_id)
                      } else {
                        newSelected.delete(task.geelark_task_id)
                      }
                      setSelectedTasks(newSelected)
                    }}
                  />
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    {getTaskIcon(task)}
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-dark-100">
                        {getTaskTypeLabel(task)}
                      </div>
                      {task.meta?.plan_name && (
                        <div className="text-xs text-gray-500 dark:text-dark-400">
                          {task.meta.plan_name}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="table-cell">
                  <div className="text-sm text-gray-900 dark:text-dark-100">
                    {task.accounts?.tiktok_username || task.meta?.email || task.meta?.username || 'Unknown'}
                  </div>
                  {task.meta?.serial_name && (
                    <div className="text-xs text-gray-500 dark:text-dark-400">
                      Phone: {task.meta.serial_name}
                    </div>
                  )}
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(task.status, task.meta?.geelark_status)}
                    {getStatusBadge(task)}
                  </div>
                </td>
                <td className="table-cell">
                  <div className="text-sm font-mono text-gray-600 dark:text-dark-400">
                    {task.geelark_task_id}
                  </div>
                </td>
                <td className="table-cell text-sm text-gray-500 dark:text-dark-400">
                  {formatRelativeTime(task.started_at || task.created_at)}
                </td>
                <td className="table-cell text-sm text-gray-500 dark:text-dark-400">
                  {task.meta?.cost || task.meta?.cost_seconds 
                    ? `${task.meta.cost || task.meta.cost_seconds}s`
                    : task.completed_at && task.started_at
                    ? `${Math.round((new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 1000)}s`
                    : '-'}
                </td>
                <td className="table-cell">
                  {task.meta?.fail_code && (
                    <div className="text-xs">
                      <span className="font-medium text-red-600 dark:text-red-400">
                        Code: {task.meta.fail_code}
                      </span>
                      {task.meta?.fail_desc && (
                        <div className="text-gray-600 dark:text-dark-400 max-w-xs truncate" title={task.meta.fail_desc}>
                          {task.meta.fail_desc}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="table-cell text-right">
                  <div className="flex items-center justify-end gap-2">
                    {(task.status === 'running' || task.status === 'pending') && (
                      <button
                        onClick={() => cancelTask(task.geelark_task_id)}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Cancel task"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                    {(task.status === 'failed' || task.status === 'cancelled') && (
                      <button
                        onClick={() => retryTask(task.geelark_task_id)}
                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Retry task"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {tasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-dark-400">No tasks found in the past 24 hours</p>
          </div>
        )}
      </div>
    </div>
  )
} 