'use client'

import { useState, useEffect } from 'react'
import { X, Wifi, Tag, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ProxyGroup {
  group_name: string
  proxy_count: number
}

interface BulkProxyAssignmentModalProps {
  profileIds: string[]
  profileNames: string[]
  onConfirm: (selectedGroups: string[]) => void
  onCancel: () => void
}

export function BulkProxyAssignmentModal({ 
  profileIds, 
  profileNames, 
  onConfirm, 
  onCancel 
}: BulkProxyAssignmentModalProps) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [proxyGroups, setProxyGroups] = useState<ProxyGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [availableProxiesCount, setAvailableProxiesCount] = useState(0)
  
  const supabase = createClient()

  useEffect(() => {
    fetchProxyGroups()
  }, [])

  useEffect(() => {
    if (selectedGroups.length > 0) {
      fetchAvailableProxiesCount()
    } else {
      setAvailableProxiesCount(0)
    }
  }, [selectedGroups])

  const fetchProxyGroups = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get proxy groups with counts
      const { data: proxies, error: proxiesError } = await supabase
        .from('proxies')
        .select('group_name')
        .eq('is_active', true)
        .not('group_name', 'is', null)

      if (proxiesError) throw proxiesError

      // Count proxies by group
      const groupCounts: Record<string, number> = {}
      proxies?.forEach(proxy => {
        if (proxy.group_name) {
          groupCounts[proxy.group_name] = (groupCounts[proxy.group_name] || 0) + 1
        }
      })

      // Build proxy groups array
      const groups: ProxyGroup[] = Object.entries(groupCounts).map(([groupName, count]) => ({
        group_name: groupName,
        proxy_count: count
      }))

      // Sort by name
      groups.sort((a, b) => a.group_name.localeCompare(b.group_name))

      setProxyGroups(groups)
    } catch (err) {
      console.error('Error fetching proxy groups:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch proxy groups')
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableProxiesCount = async () => {
    try {
      const { count, error } = await supabase
        .from('proxies')
        .select('*', { count: 'exact', head: true })
        .in('group_name', selectedGroups)
        .eq('is_active', true)

      if (error) throw error
      setAvailableProxiesCount(count || 0)
    } catch (err) {
      console.error('Error fetching available proxies count:', err)
      setAvailableProxiesCount(0)
    }
  }

  const handleGroupToggle = (groupName: string) => {
    setSelectedGroups(prev => 
      prev.includes(groupName)
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    )
  }

  const getGroupColor = (groupName: string) => {
    const colorMap: Record<string, string> = {
      'residential': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      'mobile': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      'datacenter': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      'premium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      'standard': 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
    
    return colorMap[groupName.toLowerCase()] || 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400'
  }

  const canProceed = selectedGroups.length > 0 && availableProxiesCount > 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
            Bulk Proxy Assignment
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-dark-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Profile Summary */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="h-4 w-4 text-gray-600 dark:text-dark-400" />
            <span className="font-medium text-gray-900 dark:text-dark-100">
              Assigning proxies to {profileIds.length} profile{profileIds.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-sm text-gray-600 dark:text-dark-400">
            {profileNames.slice(0, 3).join(', ')}
            {profileNames.length > 3 && ` and ${profileNames.length - 3} more`}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading proxy groups...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-800 dark:text-red-300 font-medium">Error loading proxy groups</p>
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Proxy Groups Selection */}
        {!loading && !error && (
          <>
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-3">
                Select Proxy Groups
              </h4>
              
              {proxyGroups.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-dark-400">
                  <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No proxy groups available</p>
                  <p className="text-sm">Sync proxies from GeeLark first</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {proxyGroups.map((group) => (
                    <label
                      key={group.group_name}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedGroups.includes(group.group_name)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedGroups.includes(group.group_name)}
                          onChange={() => handleGroupToggle(group.group_name)}
                          className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getGroupColor(group.group_name)}`}>
                            <Tag className="h-3 w-3" />
                            {group.group_name}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-dark-400">
                        {group.proxy_count} {group.proxy_count === 1 ? 'proxy' : 'proxies'}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Assignment Preview */}
            {selectedGroups.length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                      Assignment Preview
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      {availableProxiesCount} proxies available from {selectedGroups.length} selected group{selectedGroups.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      Each profile will receive a randomly assigned proxy from the selected groups
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Warning for insufficient proxies */}
            {selectedGroups.length > 0 && availableProxiesCount === 0 && (
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
                      No proxies available
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      The selected groups don't contain any active proxies
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedGroups)}
            className="btn-primary"
            disabled={!canProceed}
          >
            Assign Proxies
          </button>
        </div>
      </div>
    </div>
  )
} 