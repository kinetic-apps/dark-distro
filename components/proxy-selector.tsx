'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Loader2, AlertCircle, Tag } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Proxy {
  id: string
  geelark_id: string
  scheme: string
  server: string
  port: number
  username: string | null
  password: string | null
  group_name: string | null
  tags: string[] | null
  is_active: boolean
}

interface ProxySelectorProps {
  value: string
  onChange: (value: string, proxyData?: any) => void
  filterByAllowedGroups?: boolean
  className?: string
}

export function ProxySelector({
  value,
  onChange,
  filterByAllowedGroups = false,
  className = ''
}: ProxySelectorProps) {
  const [loading, setLoading] = useState(false)
  const [proxies, setProxies] = useState<Proxy[]>([])
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchProxies = async () => {
    setLoading(true)
    setError(null)
    
    try {
      let query = supabase
        .from('proxies')
        .select('*')
        .eq('is_active', true)
        .order('group_name', { ascending: true })
        .order('server', { ascending: true })
        .order('port', { ascending: true })

      // If filtering by allowed groups, join with proxy_group_settings
      if (filterByAllowedGroups) {
        // First get allowed groups
        const { data: allowedGroups, error: groupError } = await supabase
          .from('proxy_group_settings')
          .select('group_name')
          .eq('allowed_for_phone_creation', true)
        
        if (groupError) throw groupError
        
        if (allowedGroups && allowedGroups.length > 0) {
          const groupNames = allowedGroups.map(g => g.group_name)
          query = query.in('group_name', groupNames)
        }
      }

      const { data, error } = await query

      if (error) throw error
      setProxies(data || [])
    } catch (err) {
      console.error('Error fetching proxies:', err)
      setError('Failed to fetch proxies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProxies()
  }, [filterByAllowedGroups])

  const handleRefresh = () => {
    fetchProxies()
  }

  const getProxyDisplay = (proxy: Proxy) => {
    const parts = []
    
    if (proxy.group_name) {
      parts.push(`[${proxy.group_name}]`)
    }
    
    parts.push(`${proxy.scheme}://${proxy.server}:${proxy.port}`)
    
    if (proxy.username) {
      parts.push(`(${proxy.username})`)
    }
    
    return parts.join(' ')
  }

  const getGroupColor = (groupName: string | null) => {
    if (!groupName) return ''
    
    const colorMap: Record<string, string> = {
      'residential': 'text-blue-600 dark:text-blue-400',
      'mobile': 'text-green-600 dark:text-green-400',
      'datacenter': 'text-purple-600 dark:text-purple-400',
      'premium': 'text-yellow-600 dark:text-yellow-400',
      'standard': 'text-gray-600 dark:text-gray-400'
    }
    
    return colorMap[groupName.toLowerCase()] || 'text-indigo-600 dark:text-indigo-400'
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label">
            Select Proxy
            {filterByAllowedGroups && (
              <span className="text-xs text-gray-500 dark:text-dark-400 ml-2">
                (Filtered by allowed groups)
              </span>
            )}
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
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm mb-2">
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
          <>
            <select
              value={value}
              onChange={(e) => {
                const selectedProxy = proxies.find(p => p.id === e.target.value)
                onChange(e.target.value, selectedProxy)
              }}
              className="select w-full"
              disabled={proxies.length === 0}
            >
              <option value="">Select a proxy</option>
              {proxies.map((proxy) => (
                <option key={proxy.id} value={proxy.id}>
                  {getProxyDisplay(proxy)}
                </option>
              ))}
            </select>

            {/* Show selected proxy details */}
            {value && proxies.length > 0 && (
              <div className="mt-2 p-2 bg-gray-50 dark:bg-dark-800 rounded-md">
                {(() => {
                  const selectedProxy = proxies.find(p => p.id === value)
                  if (!selectedProxy) return null
                  
                  return (
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-dark-400">GeeLark ID:</span>
                        <span className="font-mono">{selectedProxy.geelark_id}</span>
                      </div>
                      {selectedProxy.group_name && (
                        <div className="flex items-center gap-2">
                          <Tag className="h-3 w-3 text-gray-500 dark:text-dark-400" />
                          <span className={`font-medium ${getGroupColor(selectedProxy.group_name)}`}>
                            {selectedProxy.group_name}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </>
        )}

        {proxies.length === 0 && !loading && !error && (
          <p className="mt-1 text-xs text-gray-500 dark:text-dark-400">
            {filterByAllowedGroups 
              ? 'No proxies found in allowed groups. Configure proxy groups in the Proxies tab.'
              : 'No active proxies found. Sync proxies from GeeLark first.'}
          </p>
        )}

        {proxies.length > 0 && !loading && (
          <p className="mt-1 text-xs text-gray-500 dark:text-dark-400">
            {proxies.length} {proxies.length === 1 ? 'proxy' : 'proxies'} available
          </p>
        )}
      </div>
    </div>
  )
} 