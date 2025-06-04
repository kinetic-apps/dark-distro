'use client'

import { useState, useEffect } from 'react'
import { formatRelativeTime } from '@/lib/utils'
import { 
  Wifi, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Plus
} from 'lucide-react'
import { ImportProxiesButton } from '@/components/import-proxies-button'

interface GeelarkProxy {
  id: string
  scheme: string
  server: string
  port: number
  username: string
  password: string
}

interface ProxyStats {
  total: number
  socks5: number
  http: number
  https: number
}

export default function ProxiesPageClient() {
  const [proxies, setProxies] = useState<GeelarkProxy[]>([])
  const [stats, setStats] = useState<ProxyStats>({
    total: 0,
    socks5: 0,
    http: 0,
    https: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProxies = async () => {
    try {
      setError(null)
      const response = await fetch('/api/geelark/list-proxies', {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch proxies')
      }

      const data = await response.json()
      setProxies(data.proxies || [])
      
      // Calculate stats
      const newStats = {
        total: data.proxies.length || 0,
        socks5: data.proxies.filter((p: GeelarkProxy) => p.scheme === 'socks5').length || 0,
        http: data.proxies.filter((p: GeelarkProxy) => p.scheme === 'http').length || 0,
        https: data.proxies.filter((p: GeelarkProxy) => p.scheme === 'https').length || 0
      }
      setStats(newStats)
    } catch (error) {
      console.error('Error fetching proxies:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch proxies')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProxies()
  }, [])

  const handleSync = async () => {
    setIsSyncing(true)
    await fetchProxies()
    setIsSyncing(false)
  }

  const handleDeleteProxy = async (proxyId: string) => {
    if (!confirm('Are you sure you want to delete this proxy?')) {
      return
    }

    try {
      const response = await fetch(`/api/proxies/delete/${proxyId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete proxy')
      }

      // Refresh the list
      await fetchProxies()
    } catch (error) {
      console.error('Error deleting proxy:', error)
      alert('Failed to delete proxy')
    }
  }

  const getSchemeColor = (scheme: string) => {
    switch (scheme) {
      case 'socks5':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      case 'http':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'https':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

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
          <h1 className="page-title">Proxies</h1>
          <p className="page-description">
            Manage proxies from GeeLark
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync with GeeLark'}
          </button>
          <ImportProxiesButton onImportComplete={fetchProxies} />
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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Total Proxies</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.total}
              </p>
            </div>
            <div className="rounded-lg bg-gray-100 p-3 dark:bg-dark-700">
              <Wifi className="h-6 w-6 text-gray-600 dark:text-dark-300" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">SOCKS5</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.socks5}
              </p>
            </div>
            <div className="rounded-lg bg-purple-100 p-3 dark:bg-purple-900/20">
              <Wifi className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">HTTP</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.http}
              </p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/20">
              <Wifi className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">HTTPS</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.https}
              </p>
            </div>
            <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900/20">
              <Wifi className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg dark:bg-dark-850 dark:border-dark-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
          <thead className="bg-gray-50 dark:bg-dark-800">
            <tr>
              <th scope="col" className="table-header">
                ID
              </th>
              <th scope="col" className="table-header">
                Type
              </th>
              <th scope="col" className="table-header">
                Server
              </th>
              <th scope="col" className="table-header">
                Port
              </th>
              <th scope="col" className="table-header">
                Username
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-dark-700 dark:bg-dark-850">
            {proxies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-dark-400">
                  No proxies found. Click "Import Proxies" to add some.
                </td>
              </tr>
            ) : (
              proxies.map((proxy) => (
                <tr key={proxy.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                  <td className="table-cell">
                    <span className="font-mono text-xs text-gray-500 dark:text-dark-400">
                      {proxy.id}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`status-badge ${getSchemeColor(proxy.scheme)}`}>
                      {proxy.scheme.toUpperCase()}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="font-mono text-sm">
                      {proxy.server}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="font-mono text-sm">
                      {proxy.port}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="font-mono text-sm">
                      {proxy.username || '-'}
                    </span>
                  </td>
                  <td className="relative whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteProxy(proxy.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}