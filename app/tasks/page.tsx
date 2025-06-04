'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, X, RotateCcw, CheckCircle, AlertCircle, Clock, Heart } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface Task {
  id: string
  type: string
  geelark_task_id: string
  account_id: string
  profile_id?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  completed_at: string | null
  meta: any
  accounts?: {
    id: string
    tiktok_username: string | null
  }
  geelark_status?: {
    status: number
    failCode?: number
    failDesc?: string
    cost?: number
  }
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const fetchTasks = async () => {
    const supabase = createClient()
    
    // Method 1: Get tasks from tasks table
    const { data: dbTasks, error: dbError } = await supabase
      .from('tasks')
      .select('*, accounts(id, tiktok_username)')
      .order('started_at', { ascending: false })
      .limit(100)

    // Method 2: Get accounts with active GeeLark tasks (fallback for broken task tracking)
    const { data: accountTasks, error: accountError } = await supabase
      .from('accounts')
      .select('id, tiktok_username, geelark_task_id, status, current_setup_step, meta, updated_at')
      .not('geelark_task_id', 'is', null)
      .in('status', ['creating_profile', 'starting_phone', 'installing_tiktok', 'running_geelark_task', 'renting_number', 'pending_verification'])
      .order('updated_at', { ascending: false })

    const allTasks: Task[] = []
    
    // Add tasks from tasks table
    if (dbTasks && !dbError) {
      allTasks.push(...dbTasks)
    }
    
    // Add missing tasks from account records (accounts that have task IDs but no corresponding task record)
    if (accountTasks && !accountError) {
      for (const account of accountTasks) {
        // Check if this task is already in our tasks list
        const existingTask = allTasks.find(t => t.geelark_task_id === account.geelark_task_id)
        
        if (!existingTask && account.geelark_task_id) {
          // Create a synthetic task record from account data
          const syntheticTask: Task = {
            id: `synthetic-${account.id}`,
            type: 'login',
            geelark_task_id: account.geelark_task_id,
            account_id: account.id,
            status: account.status === 'running_geelark_task' ? 'running' : 'pending',
            started_at: account.updated_at,
            completed_at: null,
            meta: {
              synthetic: true,
              from_account_record: true,
              setup_step: account.current_setup_step,
              username: account.meta?.username
            },
            accounts: {
              id: account.id,
              tiktok_username: account.tiktok_username
            }
          }
          allTasks.push(syntheticTask)
        }
      }
    }

    // Sort all tasks by started_at
    allTasks.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    
    setTasks(allTasks)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchTasks()
    
    // Refresh every 30 seconds to show updated data
    const interval = setInterval(fetchTasks, 30000)
    return () => clearInterval(interval)
  }, [])

  const syncAllTasks = async () => {
    setIsSyncing(true)
    try {
      // Get all running/pending tasks
      const tasksToSync = tasks.filter(t => t.status === 'running' || t.status === 'pending')
      
      if (tasksToSync.length === 0) {
        setLastSyncTime(new Date())
        return
      }

      const response = await fetch('/api/geelark/task-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: tasksToSync.map(t => t.geelark_task_id) })
      })

      if (response.ok) {
        const data = await response.json()
        setLastSyncTime(new Date())
        // Refresh tasks to show updated data
        await fetchTasks()
      }
    } catch (error) {
      console.error('Failed to sync task statuses:', error)
    } finally {
      setIsSyncing(false)
    }
  }


  const cancelTasks = async () => {
    if (selectedTasks.length === 0) return

    try {
      const response = await fetch('/api/geelark/cancel-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: selectedTasks })
      })

      if (response.ok) {
        await fetchTasks()
        setSelectedTasks([])
      }
    } catch (error) {
      console.error('Failed to cancel tasks:', error)
    }
  }

  const retryTasks = async () => {
    if (selectedTasks.length === 0) return

    try {
      const response = await fetch('/api/geelark/retry-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: selectedTasks })
      })

      if (response.ok) {
        await fetchTasks()
        setSelectedTasks([])
      }
    } catch (error) {
      console.error('Failed to retry tasks:', error)
    }
  }

  const getStatusIcon = (status: Task['status']) => {
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

  const getStatusBadge = (status: Task['status']) => {
    const classes = {
      pending: 'status-neutral',
      running: 'status-info',
      completed: 'status-active',
      failed: 'status-error',
      cancelled: 'status-neutral'
    }

    return (
      <span className={classes[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getGeeLarkStatusBadge = (geelarkStatus?: number) => {
    if (!geelarkStatus) return null
    
    const statusMap: { [key: number]: { label: string, class: string } } = {
      1: { label: 'Waiting', class: 'status-neutral' },
      2: { label: 'In Progress', class: 'status-info' },
      3: { label: 'Completed', class: 'status-active' },
      4: { label: 'Failed', class: 'status-error' },
      7: { label: 'Cancelled', class: 'status-neutral' }
    }

    const status = statusMap[geelarkStatus] || { label: `Status ${geelarkStatus}`, class: 'status-neutral' }
    
    return (
      <span className={status.class}>
        {status.label}
      </span>
    )
  }

  const getTaskTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      warmup: 'Warmup',
      post: 'Post',
      login: 'Login',
      profile_edit: 'Profile Edit',
      engagement: 'Engagement'
    }
    return labels[type] || type
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500 dark:text-dark-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-description">
            Monitor and manage automation tasks. Tasks are sourced from both the database and active account records for complete visibility.
            {tasks.filter(t => t.status === 'running' || t.status === 'pending').length > 0 && (
              <span className="ml-2 text-sm text-blue-600 dark:text-blue-400">
                ({tasks.filter(t => t.status === 'running' || t.status === 'pending').length} active)
              </span>
            )}
            {tasks.filter(t => t.meta?.synthetic).length > 0 && (
              <span className="ml-2 text-sm text-amber-600 dark:text-amber-400">
                ({tasks.filter(t => t.meta?.synthetic).length} from account records)
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Sync Button */}
          <button
            onClick={syncAllTasks}
            disabled={isSyncing}
            className="btn-secondary"
          >
            <RotateCcw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Tasks'}
          </button>

          {/* Sync Status */}
          {lastSyncTime && !isSyncing && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last synced: {formatRelativeTime(lastSyncTime.toISOString())}
            </span>
          )}

          {selectedTasks.length > 0 && (
            <>
              <button
                onClick={cancelTasks}
                className="btn-secondary"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel ({selectedTasks.length})
              </button>

              <button
                onClick={retryTasks}
                className="btn-secondary"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry ({selectedTasks.length})
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg dark:bg-dark-850 dark:border-dark-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
          <thead className="bg-gray-50 dark:bg-dark-800">
            <tr>
              <th scope="col" className="relative w-12 px-6 sm:w-16 sm:px-8">
                <input
                  type="checkbox"
                  className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-dark-600 dark:bg-dark-700 dark:focus:ring-dark-400"
                  checked={selectedTasks.length === tasks.length && tasks.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTasks(tasks.map(t => t.geelark_task_id))
                    } else {
                      setSelectedTasks([])
                    }
                  }}
                />
              </th>
              <th scope="col" className="table-header">Type</th>
              <th scope="col" className="table-header">Account</th>
              <th scope="col" className="table-header">Local Status</th>
              <th scope="col" className="table-header">GeeLark Status</th>
              <th scope="col" className="table-header">Task ID</th>
              <th scope="col" className="table-header">Started</th>
              <th scope="col" className="table-header">Duration</th>
              <th scope="col" className="table-header">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-dark-700 dark:bg-dark-850">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                <td className="relative w-12 px-6 sm:w-16 sm:px-8">
                  <input
                    type="checkbox"
                    className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-dark-600 dark:bg-dark-700 dark:focus:ring-dark-400"
                    checked={selectedTasks.includes(task.geelark_task_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTasks([...selectedTasks, task.geelark_task_id])
                      } else {
                        setSelectedTasks(selectedTasks.filter(id => id !== task.geelark_task_id))
                      }
                    }}
                  />
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    {task.type === 'engagement' && <Heart className="h-4 w-4 text-pink-500" />}
                  <div className="text-sm font-medium text-gray-900 dark:text-dark-100">
                    {getTaskTypeLabel(task.type)}
                    </div>
                  </div>
                  {task.meta?.debug && (
                    <div className="text-xs text-blue-600 dark:text-blue-400">DEBUG</div>
                  )}
                  {task.meta?.synthetic && (
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      FROM ACCOUNT RECORD
                    </div>
                  )}
                </td>
                <td className="table-cell">
                  <div className="text-sm text-gray-900 dark:text-dark-100">
                    {task.accounts?.tiktok_username || task.meta?.email || task.meta?.username || 'Unknown'}
                  </div>
                  {task.profile_id && (
                    <div className="text-xs text-gray-500 dark:text-dark-400">
                      Profile: {task.profile_id}
                    </div>
                  )}
                  {task.meta?.synthetic && (
                    <div className="text-xs text-amber-500 dark:text-amber-400">
                      Step: {task.meta.setup_step}
                    </div>
                  )}
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(task.status)}
                    {getStatusBadge(task.status)}
                  </div>
                </td>
                <td className="table-cell">
                  {task.meta?.geelark_status ? (
                    <div className="space-y-1">
                      {getGeeLarkStatusBadge(task.meta.geelark_status)}
                      {task.meta.fail_code && (
                        <div className="text-xs text-red-600 dark:text-red-400">
                          Code: {task.meta.fail_code}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-dark-500">-</span>
                  )}
                </td>
                <td className="table-cell">
                  <div className="text-sm font-mono text-gray-600 dark:text-dark-400">
                    {task.geelark_task_id}
                  </div>
                </td>
                <td className="table-cell text-sm text-gray-500 dark:text-dark-400">
                  {formatRelativeTime(task.started_at)}
                </td>
                <td className="table-cell text-sm text-gray-500 dark:text-dark-400">
                  {task.completed_at && task.started_at
                    ? `${Math.round((new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 1000)}s`
                    : task.meta?.cost_seconds ? `${task.meta.cost_seconds}s` : '-'}
                </td>
                <td className="table-cell text-sm text-gray-500 dark:text-dark-400">
                  {task.type === 'engagement' && task.meta?.target_usernames && (
                    <div className="text-gray-600 dark:text-dark-400">
                      Targets: {task.meta.target_usernames.slice(0, 3).join(', ')}
                      {task.meta.target_usernames.length > 3 && ` +${task.meta.target_usernames.length - 3} more`}
                    </div>
                  )}
                  {task.meta?.fail_desc && (
                    <div className="text-red-600 dark:text-red-400 max-w-xs truncate" title={task.meta.fail_desc}>
                      {task.meta.fail_desc}
                    </div>
                  )}
                  {task.meta?.error && (
                    <div className="text-red-600 dark:text-red-400 max-w-xs truncate" title={task.meta.error}>
                      {task.meta.error}
                    </div>
                  )}
                  {task.meta?.retry_count && (
                    <span className="text-gray-600 dark:text-dark-400">Retry #{task.meta.retry_count}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {tasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-dark-400">No tasks found</p>
          </div>
        )}
      </div>
    </div>
  )
} 