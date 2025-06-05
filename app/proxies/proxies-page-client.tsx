'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import { 
  Wifi, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Plus,
  Edit2,
  Save,
  X,
  Settings,
  Tag,
  Shield
} from 'lucide-react'

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
  created_at: string
  updated_at: string
  synced_at: string
}

interface ProxyGroup {
  id: string
  group_name: string
  allowed_for_phone_creation: boolean
  priority: number
  description: string | null
}

interface ProxyStats {
  total: number
  active: number
  byScheme: {
    socks5: number
    http: number
    https: number
  }
  byGroup: Record<string, number>
}

export default function ProxiesPageClient() {
  const [proxies, setProxies] = useState<Proxy[]>([])
  const [proxyGroups, setProxyGroups] = useState<ProxyGroup[]>([])
  const [stats, setStats] = useState<ProxyStats>({
    total: 0,
    active: 0,
    byScheme: { socks5: 0, http: 0, https: 0 },
    byGroup: {}
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingProxy, setEditingProxy] = useState<string | null>(null)
  const [editingGroup, setEditingGroup] = useState<string>('')
  const [selectedProxies, setSelectedProxies] = useState<Set<string>>(new Set())
  const [showGroupSettings, setShowGroupSettings] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  
  const supabase = createClient()

  const fetchProxies = async () => {
    try {
      setError(null)
      
      // Fetch proxies from our database
      const { data: proxiesData, error: proxiesError } = await supabase
        .from('proxies')
        .select('*')
        .order('server', { ascending: true })
        .order('port', { ascending: true })

      if (proxiesError) throw proxiesError

      setProxies(proxiesData || [])
      
      // Calculate stats
      const stats: ProxyStats = {
        total: proxiesData?.length || 0,
        active: proxiesData?.filter(p => p.is_active).length || 0,
        byScheme: {
          socks5: proxiesData?.filter(p => p.scheme === 'socks5').length || 0,
          http: proxiesData?.filter(p => p.scheme === 'http').length || 0,
          https: proxiesData?.filter(p => p.scheme === 'https').length || 0
        },
        byGroup: {}
      }
      
      // Count by group
      proxiesData?.forEach(proxy => {
        const group = proxy.group_name || 'Unassigned'
        stats.byGroup[group] = (stats.byGroup[group] || 0) + 1
      })
      
      setStats(stats)
      
      // Get last sync time
      if (proxiesData && proxiesData.length > 0) {
        const mostRecentSync = proxiesData.reduce((latest, proxy) => 
          new Date(proxy.synced_at) > new Date(latest.synced_at) ? proxy : latest
        )
        setLastSyncTime(mostRecentSync.synced_at)
      }
      
    } catch (error) {
      console.error('Error fetching proxies:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch proxies')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProxyGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('proxy_group_settings')
        .select('*')
        .order('priority', { ascending: false })
        .order('group_name', { ascending: true })

      if (error) throw error
      setProxyGroups(data || [])
    } catch (error) {
      console.error('Error fetching proxy groups:', error)
    }
  }

  useEffect(() => {
    fetchProxies()
    fetchProxyGroups()
  }, [])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/geelark/sync-proxies-from-geelark', {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to sync proxies')
      }

      const result = await response.json()
      
      // Refresh the list
      await fetchProxies()
      
      // Show success message
      alert(`Successfully synced ${result.stats.total_upserted} proxies from GeeLark`)
    } catch (error) {
      console.error('Error syncing proxies:', error)
      alert(error instanceof Error ? error.message : 'Failed to sync proxies')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleUpdateProxyGroup = async (proxyId: string, groupName: string | null) => {
    try {
      const { error } = await supabase
        .from('proxies')
        .update({ 
          group_name: groupName || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', proxyId)

      if (error) throw error

      // Update local state
      setProxies(prev => prev.map(p => 
        p.id === proxyId ? { ...p, group_name: groupName } : p
      ))
      
      // Refresh stats
      await fetchProxies()
      
      setEditingProxy(null)
      setEditingGroup('')
    } catch (error) {
      console.error('Error updating proxy group:', error)
      alert('Failed to update proxy group')
    }
  }

  const handleBulkUpdateGroup = async (groupName: string | null) => {
    if (selectedProxies.size === 0) {
      alert('Please select proxies to update')
      return
    }

    const confirmMsg = groupName 
      ? `Assign ${selectedProxies.size} proxies to group "${groupName}"?`
      : `Remove group from ${selectedProxies.size} proxies?`
    
    if (!confirm(confirmMsg)) return

    try {
      const { error } = await supabase
        .from('proxies')
        .update({ 
          group_name: groupName || null,
          updated_at: new Date().toISOString()
        })
        .in('id', Array.from(selectedProxies))

      if (error) throw error

      // Clear selection and refresh
      setSelectedProxies(new Set())
      await fetchProxies()
      
      alert(`Successfully updated ${selectedProxies.size} proxies`)
    } catch (error) {
      console.error('Error bulk updating proxies:', error)
      alert('Failed to update proxies')
    }
  }

  const handleToggleProxyGroup = async (groupName: string, allowed: boolean) => {
    try {
      if (allowed) {
        // Add to allowed groups
        const { error } = await supabase
          .from('proxy_group_settings')
          .upsert({
            group_name: groupName,
            allowed_for_phone_creation: true,
            priority: 0
          }, {
            onConflict: 'group_name'
          })
        
        if (error) throw error
      } else {
        // Remove from allowed groups
        const { error } = await supabase
          .from('proxy_group_settings')
          .update({ allowed_for_phone_creation: false })
          .eq('group_name', groupName)
        
        if (error) throw error
      }
      
      await fetchProxyGroups()
    } catch (error) {
      console.error('Error updating proxy group settings:', error)
      alert('Failed to update proxy group settings')
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

  const getGroupColor = (groupName: string | null) => {
    if (!groupName) return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    
    // Use consistent colors for common group names
    const colorMap: Record<string, string> = {
      'residential': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      'mobile': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      'datacenter': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      'premium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      'standard': 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
    
    return colorMap[groupName.toLowerCase()] || 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400'
  }

  const uniqueGroups = Array.from(new Set(proxies.map(p => p.group_name).filter(Boolean))) as string[]

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
            Manage proxies synced from GeeLark
          </p>
          {lastSyncTime && (
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
              Last synced: {formatRelativeTime(lastSyncTime)}
            </p>
          )}
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowGroupSettings(!showGroupSettings)}
            className="btn-secondary"
          >
            <Settings className="h-4 w-4 mr-2" />
            Group Settings
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="btn-primary"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync from GeeLark'}
          </button>
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

      {/* Proxy Group Settings Panel */}
      {showGroupSettings && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100">
              Proxy Group Settings
            </h3>
            <button
              onClick={() => setShowGroupSettings(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-dark-400 mb-4">
            Select which proxy groups are allowed for phone creation
          </p>
          
          <div className="space-y-2">
            {uniqueGroups.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-dark-400">
                No proxy groups found. Assign groups to proxies first.
              </p>
            ) : (
              uniqueGroups.map(groupName => {
                const groupSetting = proxyGroups.find(g => g.group_name === groupName)
                const isAllowed = groupSetting?.allowed_for_phone_creation || false
                const proxyCount = stats.byGroup[groupName] || 0
                
                return (
                  <div key={groupName} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isAllowed}
                        onChange={(e) => handleToggleProxyGroup(groupName, e.target.checked)}
                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className={`status-badge ${getGroupColor(groupName)}`}>
                        {groupName}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-dark-400">
                        ({proxyCount} {proxyCount === 1 ? 'proxy' : 'proxies'})
                      </span>
                    </div>
                    {isAllowed && (
                      <Shield className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Total Proxies</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.total}
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                {stats.active} active
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
                {stats.byScheme.socks5}
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
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">HTTP/HTTPS</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.byScheme.http + stats.byScheme.https}
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
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Groups</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {Object.keys(stats.byGroup).length}
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                {proxyGroups.filter(g => g.allowed_for_phone_creation).length} allowed
              </p>
            </div>
            <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900/20">
              <Tag className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedProxies.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {selectedProxies.size} {selectedProxies.size === 1 ? 'proxy' : 'proxies'} selected
            </p>
            <div className="flex gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkUpdateGroup(e.target.value === 'none' ? null : e.target.value)
                  }
                }}
                className="select text-sm"
                defaultValue=""
              >
                <option value="">Assign to group...</option>
                <option value="none">Remove group</option>
                {uniqueGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
              <button
                onClick={() => setSelectedProxies(new Set())}
                className="btn-secondary text-sm"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proxies Table */}
      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg dark:bg-dark-850 dark:border-dark-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
          <thead className="bg-gray-50 dark:bg-dark-800">
            <tr>
              <th scope="col" className="w-12 px-6 py-3">
                <input
                  type="checkbox"
                  checked={selectedProxies.size === proxies.length && proxies.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedProxies(new Set(proxies.map(p => p.id)))
                    } else {
                      setSelectedProxies(new Set())
                    }
                  }}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </th>
              <th scope="col" className="table-header">
                Server
              </th>
              <th scope="col" className="table-header">
                Port
              </th>
              <th scope="col" className="table-header">
                Type
              </th>
              <th scope="col" className="table-header">
                Group
              </th>
              <th scope="col" className="table-header">
                Status
              </th>
              <th scope="col" className="table-header">
                GeeLark ID
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-dark-700 dark:bg-dark-850">
            {proxies.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-dark-400">
                  No proxies found. Click "Sync from GeeLark" to import proxies.
                </td>
              </tr>
            ) : (
              proxies.map((proxy) => (
                <tr key={proxy.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedProxies.has(proxy.id)}
                      onChange={(e) => {
                        const newSelection = new Set(selectedProxies)
                        if (e.target.checked) {
                          newSelection.add(proxy.id)
                        } else {
                          newSelection.delete(proxy.id)
                        }
                        setSelectedProxies(newSelection)
                      }}
                      className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                    />
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
                    <span className={`status-badge ${getSchemeColor(proxy.scheme)}`}>
                      {proxy.scheme.toUpperCase()}
                    </span>
                  </td>
                  <td className="table-cell">
                    {editingProxy === proxy.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingGroup}
                          onChange={(e) => setEditingGroup(e.target.value)}
                          placeholder="Enter group name"
                          className="input text-sm py-1 px-2"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateProxyGroup(proxy.id, editingGroup)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingProxy(null)
                            setEditingGroup('')
                          }}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {proxy.group_name ? (
                          <span className={`status-badge ${getGroupColor(proxy.group_name)}`}>
                            {proxy.group_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">Unassigned</span>
                        )}
                        <button
                          onClick={() => {
                            setEditingProxy(proxy.id)
                            setEditingGroup(proxy.group_name || '')
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="table-cell">
                    {proxy.is_active ? (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400">
                        <X className="h-4 w-4" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="table-cell">
                    <span className="font-mono text-xs text-gray-500 dark:text-dark-400">
                      {proxy.geelark_id}
                    </span>
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