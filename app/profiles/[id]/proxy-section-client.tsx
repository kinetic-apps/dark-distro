'use client'

import { useState } from 'react'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useNotification } from '@/lib/context/notification-context'

interface ProxySectionClientProps {
  profile: any
}

export function ProxySectionClient({ profile }: ProxySectionClientProps) {
  const [isRotating, setIsRotating] = useState(false)
  const router = useRouter()
  const { notify } = useNotification()

  const handleRotateProxy = async () => {
    if (!profile.proxy) return
    
    if (profile.proxy.type === 'sim') {
      notify('info', 'SIM proxies cannot be rotated through the API')
      return
    }

    setIsRotating(true)

    try {
      const response = await fetch(`/api/proxies/rotate/${profile.proxy.id}`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Rotation failed')
      }

      notify('success', `Proxy rotated successfully. New IP: ${data.new_ip || 'Pending...'}`)
      
      // Refresh the page to show updated proxy info
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (error) {
      notify('error', `Failed to rotate proxy: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRotating(false)
    }
  }

  if (!profile.proxy) {
    return (
      <div className="text-center py-4">
        <WifiOff className="mx-auto h-8 w-8 text-gray-400 dark:text-dark-500" />
        <p className="mt-2 text-sm text-gray-500 dark:text-dark-400">No proxy assigned</p>
        <button 
          onClick={() => {
            // This should trigger the assign proxy modal in the parent component
            notify('info', 'Please use the "Assign Proxy" button in the Actions section')
          }}
          className="btn-primary mt-3 text-sm"
        >
          <Wifi className="h-3 w-3 mr-2" />
          Assign Proxy
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-dark-400">Label</span>
        <span className="text-sm font-medium">{profile.proxy.label}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-dark-400">Type</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
          {profile.proxy.type}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-dark-400">Health</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          profile.proxy.health === 'good' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
          profile.proxy.health === 'blocked' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
        }`}>
          {profile.proxy.health}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-dark-400">IP</span>
        <span className="text-sm font-mono">{profile.proxy.current_ip || 'Unknown'}</span>
      </div>
      
      <button 
        onClick={handleRotateProxy}
        disabled={isRotating || profile.proxy.type === 'sim'}
        className="btn-secondary w-full mt-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        title={profile.proxy.type === 'sim' ? 'SIM proxies cannot be rotated through the API' : 'Rotate proxy IP'}
      >
        <RefreshCw className={`h-3 w-3 mr-2 ${isRotating ? 'animate-spin' : ''}`} />
        {isRotating ? 'Rotating...' : 'Rotate Proxy'}
      </button>
      
      {profile.proxy.type === 'sim' && (
        <p className="text-xs text-gray-500 dark:text-dark-400 text-center mt-2">
          SIM proxies must be rotated manually
        </p>
      )}
    </div>
  )
} 