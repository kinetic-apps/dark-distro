'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Loader2, Database, Cloud, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Proxy {
  id: string
  label?: string
  type?: string
  host?: string
  port?: number
  username?: string
  geelark_proxy_id?: string
  assigned_account_id?: string
  health?: string
  // GeeLark proxy fields
  scheme?: string
  server?: string
}

interface ProxySelectorProps {
  value: string
  onChange: (value: string, proxyData?: any) => void
  source: 'auto' | 'database' | 'geelark' | 'manual'
  onSourceChange?: (source: string) => void
  showSourceSelector?: boolean
  filterAssigned?: boolean
  className?: string
}

export function ProxySelector({
  value,
  onChange,
  source = 'auto',
  onSourceChange,
  showSourceSelector = true,
  filterAssigned = true,
  className = ''
}: ProxySelectorProps) {
  const [loading, setLoading] = useState(false)
  const [databaseProxies, setDatabaseProxies] = useState<Proxy[]>([])
  const [geelarkProxies, setGeelarkProxies] = useState<Proxy[]>([])
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (source === 'database' || source === 'auto') {
      fetchDatabaseProxies()
    }
    if (source === 'geelark') {
      fetchGeelarkProxies()
    }
  }, [source])

  const fetchDatabaseProxies = async () => {
    setLoading(true)
    setError(null)
    
    try {
      let query = supabase
        .from('proxies')
        .select('*')
        .order('created_at', { ascending: false })

      if (filterAssigned) {
        query = query.is('assigned_account_id', null)
      }

      const { data, error } = await query

      if (error) throw error
      setDatabaseProxies(data || [])
    } catch (err) {
      console.error('Error fetching database proxies:', err)
      setError('Failed to fetch database proxies')
    } finally {
      setLoading(false)
    }
  }

  const fetchGeelarkProxies = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/geelark/list-proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch GeeLark proxies')
      }

      const data = await response.json()
      setGeelarkProxies(data.proxies || [])
    } catch (err) {
      console.error('Error fetching GeeLark proxies:', err)
      setError('Failed to fetch GeeLark proxies')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    if (source === 'database' || source === 'auto') {
      fetchDatabaseProxies()
    }
    if (source === 'geelark') {
      fetchGeelarkProxies()
    }
  }

  const getProxyDisplay = (proxy: Proxy) => {
    if (proxy.label) {
      return proxy.label
    }
    
    const host = proxy.host || proxy.server || 'Unknown'
    const port = proxy.port || 'Unknown'
    const type = proxy.type || proxy.scheme || 'proxy'
    
    return `${type}://${host}:${port}`
  }

  const getProxyHealth = (proxy: Proxy) => {
    if (!proxy.health || proxy.health === 'unknown') return null
    
    const healthColors = {
      good: 'text-green-600 dark:text-green-400',
      slow: 'text-yellow-600 dark:text-yellow-400',
      blocked: 'text-red-600 dark:text-red-400',
      unknown: 'text-gray-600 dark:text-gray-400'
    }
    
    return (
      <span className={`text-xs ${healthColors[proxy.health as keyof typeof healthColors]}`}>
        {proxy.health}
      </span>
    )
  }

  const proxies = source === 'geelark' ? geelarkProxies : databaseProxies

  return (
    <div className={`space-y-3 ${className}`}>
      {showSourceSelector && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-dark-300">
            Proxy Source:
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSourceChange?.('auto')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                source === 'auto'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-dark-800 dark:text-dark-300 hover:bg-gray-200 dark:hover:bg-dark-700'
              }`}
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => onSourceChange?.('database')}
              className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
                source === 'database'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-dark-800 dark:text-dark-300 hover:bg-gray-200 dark:hover:bg-dark-700'
              }`}
            >
              <Database className="h-3 w-3" />
              Database
            </button>
            <button
              type="button"
              onClick={() => onSourceChange?.('geelark')}
              className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
                source === 'geelark'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-dark-800 dark:text-dark-300 hover:bg-gray-200 dark:hover:bg-dark-700'
              }`}
            >
              <Cloud className="h-3 w-3" />
              GeeLark
            </button>
            <button
              type="button"
              onClick={() => onSourceChange?.('manual')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                source === 'manual'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-dark-800 dark:text-dark-300 hover:bg-gray-200 dark:hover:bg-dark-700'
              }`}
            >
              Manual
            </button>
          </div>
        </div>
      )}

      {source !== 'manual' && source !== 'auto' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label">
              Select {source === 'geelark' ? 'GeeLark' : 'Database'} Proxy
            </label>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading proxies...</span>
            </div>
          ) : (
            <select
              value={value}
              onChange={(e) => {
                const selectedProxy = proxies.find(p => 
                  source === 'geelark' ? p.id === e.target.value : p.id === e.target.value
                )
                onChange(e.target.value, selectedProxy)
              }}
              className="select w-full"
              disabled={proxies.length === 0}
            >
              <option value="">Select a proxy</option>
              {proxies.map((proxy) => (
                <option key={proxy.id} value={proxy.id}>
                  {getProxyDisplay(proxy)}
                  {proxy.username && ` (${proxy.username})`}
                  {proxy.type && ` - ${proxy.type}`}
                  {proxy.assigned_account_id && ' [Assigned]'}
                </option>
              ))}
            </select>
          )}

          {proxies.length === 0 && !loading && !error && (
            <p className="mt-1 text-xs text-gray-500 dark:text-dark-400">
              {source === 'geelark' 
                ? 'No proxies found in GeeLark. Add proxies in GeeLark first.'
                : filterAssigned 
                  ? 'No available proxies found. All proxies are assigned.'
                  : 'No proxies found in database.'}
            </p>
          )}

          {source === 'database' && proxies.length > 0 && (
            <div className="mt-2 text-xs text-gray-500 dark:text-dark-400 space-y-1">
              <p>Available: {proxies.filter(p => !p.assigned_account_id).length}</p>
              <p>Total: {proxies.length}</p>
            </div>
          )}
        </div>
      )}

      {source === 'auto' && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Auto mode will automatically select an available proxy from your database.
            Priority: Unassigned SIM proxies → Sticky proxies → Rotating proxies
          </p>
        </div>
      )}
    </div>
  )
} 