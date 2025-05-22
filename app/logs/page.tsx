'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { 
  FileText, 
  AlertCircle, 
  AlertTriangle, 
  Info,
  Bug,
  Filter,
  Download
} from 'lucide-react'

interface Log {
  id: string
  timestamp: string
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  component: string
  account_id: string | null
  message: string
  meta: any
  account?: {
    tiktok_username: string | null
  }
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    level: 'all',
    component: 'all',
    search: ''
  })
  const [autoRefresh, setAutoRefresh] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    fetchLogs()

    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 5000)
      return () => clearInterval(interval)
    }
  }, [filters, autoRefresh])

  const fetchLogs = async () => {
    let query = supabase
      .from('logs')
      .select(`
        *,
        account:accounts!logs_account_id_fkey(
          tiktok_username
        )
      `)
      .order('timestamp', { ascending: false })
      .limit(100)

    if (filters.level !== 'all') {
      query = query.eq('level', filters.level)
    }

    if (filters.component !== 'all') {
      query = query.eq('component', filters.component)
    }

    if (filters.search) {
      query = query.ilike('message', `%${filters.search}%`)
    }

    const { data, error } = await query

    if (!error && data) {
      setLogs(data)
    }
    setLoading(false)
  }

  const getLevelIcon = (level: Log['level']) => {
    switch (level) {
      case 'debug':
        return <Bug className="h-4 w-4 text-gray-400" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-700" />
    }
  }

  const getLevelBadge = (level: Log['level']) => {
    const classes = {
      debug: 'bg-gray-100 text-gray-800',
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      critical: 'bg-red-200 text-red-900'
    }
    
    return (
      <span className={`status-badge ${classes[level]}`}>
        {level}
      </span>
    )
  }

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Level', 'Component', 'Account', 'Message', 'Meta'],
      ...logs.map(log => [
        log.timestamp,
        log.level,
        log.component,
        log.account?.tiktok_username || '',
        log.message,
        JSON.stringify(log.meta)
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString()}.csv`
    a.click()
  }

  const components = [...new Set(logs.map(l => l.component))].sort()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Logs</h1>
          <p className="mt-1 text-sm text-gray-600">
            System activity and error tracking
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto-refresh
          </label>
          <button onClick={exportLogs} className="btn-secondary">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-4">
          <Filter className="h-4 w-4 text-gray-400" />
          
          <select
            value={filters.level}
            onChange={(e) => setFilters({ ...filters, level: e.target.value })}
            className="input"
          >
            <option value="all">All levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={filters.component}
            onChange={(e) => setFilters({ ...filters, component: e.target.value })}
            className="input"
          >
            <option value="all">All components</option>
            {components.map(comp => (
              <option key={comp} value={comp}>{comp}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search logs..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="input flex-1"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading logs...</div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="table-header">Timestamp</th>
                  <th scope="col" className="table-header">Level</th>
                  <th scope="col" className="table-header">Component</th>
                  <th scope="col" className="table-header">Account</th>
                  <th scope="col" className="table-header">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="table-cell whitespace-nowrap font-mono text-xs">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center">
                        {getLevelIcon(log.level)}
                        <span className="ml-2">{getLevelBadge(log.level)}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm font-medium text-gray-900">
                        {log.component}
                      </span>
                    </td>
                    <td className="table-cell">
                      {log.account ? (
                        <span className="text-sm text-gray-600">
                          {log.account.tiktok_username || 'Unnamed'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div>
                        <p className="text-sm text-gray-900">{log.message}</p>
                        {log.meta && Object.keys(log.meta).length > 0 && (
                          <details className="mt-1">
                            <summary className="text-xs text-gray-500 cursor-pointer">
                              View metadata
                            </summary>
                            <pre className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.meta, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}