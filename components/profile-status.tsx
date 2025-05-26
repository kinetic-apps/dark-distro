'use client'

import { useEffect, useState } from 'react'
import { Battery, Wifi, WifiOff, RefreshCw } from 'lucide-react'

interface ProfileStatusProps {
  profileId: string
  className?: string
}

interface PhoneStatusData {
  status: 'started' | 'starting' | 'stopped' | 'expired' | 'unknown'
  name?: string
  battery?: number
  last_heartbeat?: string
}

export function ProfileStatus({ profileId, className = '' }: ProfileStatusProps) {
  const [status, setStatus] = useState<PhoneStatusData>({ status: 'unknown' })
  const [isLoading, setIsLoading] = useState(false)

  const fetchStatus = async () => {
    if (!profileId) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/geelark/phone-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_ids: [profileId]
        })
      })

      const data = await response.json()
      if (response.ok && data.statuses?.[0]) {
        setStatus(data.statuses[0])
      }
    } catch (error) {
      console.error('Failed to fetch phone status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [profileId])

  const getStatusColor = () => {
    switch (status.status) {
      case 'started': return 'text-green-600 dark:text-green-400'
      case 'starting': return 'text-yellow-600 dark:text-yellow-400'
      case 'stopped': return 'text-red-600 dark:text-red-400'
      case 'expired': return 'text-gray-600 dark:text-gray-400'
      default: return 'text-gray-500 dark:text-gray-500'
    }
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case 'started': return <Wifi className="h-4 w-4" />
      case 'starting': return <Wifi className="h-4 w-4 animate-pulse" />
      case 'stopped': return <WifiOff className="h-4 w-4" />
      case 'expired': return <WifiOff className="h-4 w-4" />
      default: return <WifiOff className="h-4 w-4" />
    }
  }

  const getStatusText = () => {
    switch (status.status) {
      case 'started': return 'Online'
      case 'starting': return 'Starting...'
      case 'stopped': return 'Offline'
      case 'expired': return 'Expired'
      default: return 'Unknown'
    }
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`flex items-center gap-2 ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>

      {status.battery !== undefined && status.status === 'started' && (
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <Battery className="h-4 w-4" />
          <span className="text-sm">{status.battery}%</span>
        </div>
      )}

      <button
        onClick={fetchStatus}
        disabled={isLoading}
        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        title="Refresh status"
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
} 