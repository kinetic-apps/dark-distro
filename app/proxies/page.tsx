import { createClient } from '@/lib/supabase/server'
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
import { RotateProxyButton } from '@/components/rotate-proxy-button'
import { SyncProxiesButton } from '@/components/sync-proxies-button'

async function getProxies() {
  const supabase = await createClient()
  
  const { data: proxies } = await supabase
    .from('proxies')
    .select(`
      *,
      account:accounts!proxies_assigned_account_id_fkey(
        id,
        tiktok_username,
        status
      )
    `)
    .order('created_at', { ascending: false })

  const stats = {
    total: proxies?.length || 0,
    healthy: proxies?.filter(p => p.health === 'good').length || 0,
    blocked: proxies?.filter(p => p.health === 'blocked').length || 0,
    assigned: proxies?.filter(p => p.assigned_account_id).length || 0
  }

  return { proxies: proxies || [], stats }
}

export default async function ProxiesPage() {
  const { proxies, stats } = await getProxies()

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'slow':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'blocked':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getHealthBadge = (health: string) => {
    const classes = {
      good: 'status-active',
      slow: 'status-warning',
      blocked: 'status-error',
      unknown: 'status-neutral'
    }
    
    return (
      <span className={classes[health as keyof typeof classes] || 'status-neutral'}>
        {health}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Proxies</h1>
          <p className="page-description">
            Manage SOAX proxy connections
          </p>
        </div>
        
        <div className="flex gap-3">
          <SyncProxiesButton />
        <ImportProxiesButton />
        </div>
      </div>

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
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Healthy</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.healthy}
              </p>
            </div>
            <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900/20">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Blocked</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.blocked}
              </p>
            </div>
            <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/20">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Assigned</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.assigned}
              </p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/20">
              <Wifi className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg dark:bg-dark-850 dark:border-dark-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
          <thead className="bg-gray-50 dark:bg-dark-800">
            <tr>
              <th scope="col" className="table-header">
                Proxy
              </th>
              <th scope="col" className="table-header">
                Type
              </th>
              <th scope="col" className="table-header">
                Current IP
              </th>
              <th scope="col" className="table-header">
                Health
              </th>
              <th scope="col" className="table-header">
                Assigned To
              </th>
              <th scope="col" className="table-header">
                Last Rotated
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-dark-700 dark:bg-dark-850">
            {proxies.map((proxy) => (
              <tr key={proxy.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                <td className="table-cell">
                                      <div>
                      <p className="font-medium text-gray-900 dark:text-dark-100">{proxy.label}</p>
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        {proxy.host}:{proxy.port}
                      </p>
                    </div>
                </td>
                <td className="table-cell">
                  <span className={`status-badge ${
                    proxy.type === 'sim' ? 'bg-purple-100 text-purple-800' :
                    proxy.type === 'sticky' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {proxy.type}
                  </span>
                </td>
                <td className="table-cell">
                  <span className="font-mono text-sm">
                    {proxy.current_ip || 'Unknown'}
                  </span>
                </td>
                <td className="table-cell">
                  <div className="flex items-center">
                    {getHealthIcon(proxy.health)}
                    <span className="ml-2">{getHealthBadge(proxy.health)}</span>
                  </div>
                </td>
                <td className="table-cell">
                  {proxy.account ? (
                    <div>
                      <p className="text-sm text-gray-900 dark:text-dark-100">
                        {proxy.account.tiktok_username || 'Unnamed'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        {proxy.account.status}
                      </p>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-dark-500">Unassigned</span>
                  )}
                </td>
                <td className="table-cell text-sm text-gray-500 dark:text-dark-400">
                  {formatRelativeTime(proxy.last_rotated)}
                </td>
                <td className="relative whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  <RotateProxyButton proxyId={proxy.id} proxyType={proxy.type} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}