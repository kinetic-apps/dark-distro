'use client'

import { useEffect, useState } from 'react'
import { Activity, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react'

interface TaskActivityStatusProps {
  accountId: string
  className?: string
}

interface TaskStatus {
  current_activity: string
  active_tasks: number
  latest_task?: {
    type: string
    status: string
    progress?: number
    started_at: string
  }
}

export function TaskActivityStatus({ accountId, className = '' }: TaskActivityStatusProps) {
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchTaskStatus = async () => {
    if (!accountId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/accounts/${accountId}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Find the most recent active task
        const activeTasks = data.tasks?.filter((t: any) => t.status === 'running') || []
        const latestTask = data.tasks?.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
        
        setTaskStatus({
          current_activity: data.current_activity || 'Idle',
          active_tasks: activeTasks.length,
          latest_task: latestTask
        })
      }
    } catch (error) {
      console.error('Failed to fetch task status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTaskStatus()
    
    // Refresh every 30 seconds for active tasks, 60 seconds for idle
    const refreshInterval = taskStatus?.active_tasks && taskStatus.active_tasks > 0 ? 30000 : 60000
    const interval = setInterval(fetchTaskStatus, refreshInterval)
    
    return () => clearInterval(interval)
  }, [accountId, taskStatus?.active_tasks])

  const getActivityIcon = () => {
    if (isLoading) {
      return <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
    }

    if (!taskStatus) {
      return <Clock className="h-4 w-4 text-gray-400" />
    }

    if (taskStatus.active_tasks > 0) {
      return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
    }

    if (taskStatus.latest_task?.status === 'completed') {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }

    if (taskStatus.latest_task?.status === 'failed') {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    }

    return <Clock className="h-4 w-4 text-gray-400" />
  }

  const getActivityText = () => {
    if (!taskStatus) return 'Loading...'

    // Show current activity if there are active tasks
    if (taskStatus.active_tasks > 0) {
      let activity = taskStatus.current_activity
      
      // Add progress if available
      if (taskStatus.latest_task?.progress) {
        activity += ` (${taskStatus.latest_task.progress}%)`
      }
      
      return activity
    }

    // Show last task status if no active tasks
    if (taskStatus.latest_task) {
      const task = taskStatus.latest_task
      const taskTypeDisplay = task.type === 'login' ? 'Login' :
                             task.type === 'warmup' ? 'Warmup' :
                             task.type === 'post' ? 'Posting' :
                             task.type === 'otp_entry' ? 'OTP Entry' :
                             'Task'
      
      if (task.status === 'completed') {
        return `${taskTypeDisplay} Completed`
      } else if (task.status === 'failed') {
        return `${taskTypeDisplay} Failed`
      } else {
        return `${taskTypeDisplay} ${task.status}`
      }
    }

    return 'No Tasks Yet'
  }

  const getActivityColor = () => {
    if (!taskStatus) return 'text-gray-500'

    if (taskStatus.active_tasks > 0) {
      return 'text-blue-600 dark:text-blue-400'
    }

    if (taskStatus.latest_task?.status === 'completed') {
      return 'text-green-600 dark:text-green-400'
    }

    if (taskStatus.latest_task?.status === 'failed') {
      return 'text-red-600 dark:text-red-400'
    }

    return 'text-gray-500 dark:text-gray-400'
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {getActivityIcon()}
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${getActivityColor()}`}>
          {getActivityText()}
        </span>
        
        {/* Show active task count if > 0 */}
        {taskStatus?.active_tasks && taskStatus.active_tasks > 0 && (
          <span className="text-xs text-blue-500 dark:text-blue-400">
            {taskStatus.active_tasks} active task{taskStatus.active_tasks !== 1 ? 's' : ''}
          </span>
        )}
        
        {/* Show time since last task */}
        {taskStatus?.latest_task && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {(() => {
              const taskTime = taskStatus.latest_task.started_at
              const minutes = Math.floor((Date.now() - new Date(taskTime).getTime()) / 60000)
              return minutes < 1 ? 'just now' : 
                     minutes < 60 ? `${minutes}m ago` : 
                     `${Math.floor(minutes / 60)}h ago`
            })()}
          </span>
        )}
      </div>
    </div>
  )
} 