'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'

interface SimplePhoneStatusProps {
  profileId: string
}

export function SimplePhoneStatus({ profileId }: SimplePhoneStatusProps) {
  const [status, setStatus] = useState<string>('unknown')
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
        setStatus(data.statuses[0].status)
      } else {
        setStatus('unknown')
      }
    } catch (error) {
      console.error('Failed to fetch phone status:', error)
      setStatus('error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [profileId])

  const getIcon = () => {
    switch (status) {
      case 'started': return <Wifi className="h-4 w-4 text-green-500" />
      case 'stopped': return <WifiOff className="h-4 w-4 text-red-500" />
      case 'starting': return <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />
      default: return <WifiOff className="h-4 w-4 text-gray-400" />
    }
  }

  const getText = () => {
    switch (status) {
      case 'started': return 'Online'
      case 'stopped': return 'Offline'
      case 'starting': return 'Starting...'
      case 'expired': return 'Expired'
      default: return 'Unknown'
    }
  }

  return (
    <div className="flex items-center gap-2">
      {getIcon()}
      <span className="text-sm">{getText()}</span>
      <button
        onClick={fetchStatus}
        disabled={isLoading}
        className="text-gray-400 hover:text-gray-600"
      >
        <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}