'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

export default function TaskStatusUpdater() {
  const [updating, setUpdating] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const updateStatuses = async () => {
    setUpdating(true)
    try {
      const response = await fetch('/api/geelark/update-task-status', {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Task status update:', data)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error updating task statuses:', error)
    } finally {
      setUpdating(false)
    }
  }

  // Auto-update every 30 seconds
  useEffect(() => {
    updateStatuses() // Initial update
    
    const interval = setInterval(() => {
      updateStatuses()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <button
      onClick={updateStatuses}
      disabled={updating}
      className="btn-secondary text-sm"
      title={lastUpdate ? `Last updated: ${lastUpdate.toLocaleTimeString()}` : 'Update task statuses'}
    >
      <RefreshCw className={`h-3 w-3 mr-1 ${updating ? 'animate-spin' : ''}`} />
      {updating ? 'Updating...' : 'Sync Status'}
    </button>
  )
} 