'use client'

import { useState } from 'react'
import { Wifi, WifiOff, Shield, Tag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useNotification } from '@/lib/context/notification-context'

interface ProxySectionClientProps {
  profile: any
}

export function ProxySectionClient({ profile }: ProxySectionClientProps) {
  const router = useRouter()
  const { notify } = useNotification()

  // Get proxy data from meta field
  const proxy = profile.meta?.proxy

  if (!proxy) {
    return (
      <div className="text-center py-4">
        <WifiOff className="mx-auto h-8 w-8 text-gray-400 dark:text-dark-500" />
        <p className="mt-2 text-sm text-gray-500 dark:text-dark-400">No proxy information available</p>
        <p className="mt-1 text-xs text-gray-400 dark:text-dark-400">Run profile sync to update proxy data</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-dark-400">Server</span>
        <span className="text-sm font-medium">{proxy.server}:{proxy.port}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-dark-400">Protocol</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
          {proxy.scheme?.toUpperCase() || 'SOCKS5'}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-dark-400">Status</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          Active
        </span>
      </div>
      {proxy.username && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-dark-400">Username</span>
          <span className="text-sm font-mono">{proxy.username}</span>
        </div>
      )}
      {proxy.id && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-dark-400">GeeLark ID</span>
          <span className="text-sm font-mono text-gray-500">{proxy.id}</span>
        </div>
      )}
      
      <div className="pt-3 border-t border-gray-200 dark:border-dark-700">
        <p className="text-xs text-gray-500 dark:text-dark-400 text-center">
          Proxy assigned by GeeLark
        </p>
      </div>
    </div>
  )
} 