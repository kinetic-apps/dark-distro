import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { 
  ArrowLeft,
  Play,
  Pause,
  Wifi,
  MessageSquare,
  Activity,
  AlertCircle,
  Battery,
  Smartphone
} from 'lucide-react'
import Link from 'next/link'
import { ProfileDetailWrapper } from '@/components/profile-detail-wrapper'

export default async function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: profile } = await supabase
    .from('accounts')
    .select(`
      *,
      proxy:proxies!proxy_id(*),
      phone:phones!fk_account(*),
      tasks(*)
    `)
    .eq('id', id)
    .single()

  if (!profile) {
    notFound()
  }

  const { data: recentPosts } = await supabase
    .from('posts')
    .select('*')
    .eq('account_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: logs } = await supabase
    .from('logs')
    .select('*')
    .eq('account_id', id)
    .order('timestamp', { ascending: false })
    .limit(20)

  const activeTasks = profile.tasks?.filter((t: any) => t.status === 'running') || []
  const completedTasks = profile.tasks?.filter((t: any) => t.status === 'completed') || []

  return (
    <ProfileDetailWrapper profile={profile}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/profiles" className="text-gray-400 hover:text-gray-600 dark:text-dark-500 dark:hover:text-dark-300">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="page-title">
              {profile.tiktok_username || 'Unnamed Profile'}
            </h1>
            <p className="text-sm text-gray-600 dark:text-dark-400">
              Profile ID: {profile.geelark_profile_id || 'Not assigned'}
            </p>
          </div>
        </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Overview</h2>
            
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                <dd className="mt-1">
                  <span className={`status-badge ${
                    profile.status === 'active' ? 'status-active' :
                    profile.status === 'warming_up' ? 'status-warning' :
                    profile.status === 'banned' ? 'status-error' :
                    'status-neutral'
                  }`}>
                    {profile.status.replace('_', ' ')}
                  </span>
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Warm-up Progress</dt>
                <dd className="mt-1">
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${profile.warmup_progress}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile.warmup_progress}%</span>
                  </div>
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(profile.created_at)}
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Error Count</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {profile.error_count} errors
                  {profile.last_error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{profile.last_error}</p>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Device Info</h2>
              {profile.phone && (
                <span className={`status-badge ${
                  profile.phone.status === 'online' ? 'status-active' : 'status-neutral'
                }`}>
                  {profile.phone.status}
                </span>
              )}
            </div>
            
            {profile.phone ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <Smartphone className="h-4 w-4 mr-2" />
                    <span className="text-sm">Model</span>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {profile.phone.device_model || 'Unknown'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <Battery className="h-4 w-4 mr-2" />
                    <span className="text-sm">Battery</span>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {profile.phone.battery || 0}%
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <Activity className="h-4 w-4 mr-2" />
                    <span className="text-sm">Last Heartbeat</span>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {profile.phone.last_heartbeat 
                      ? formatRelativeTime(profile.phone.last_heartbeat)
                      : 'Never'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No device assigned</p>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Recent Activity</h2>
            
            {logs && logs.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start text-sm">
                    <div className={`h-2 w-2 rounded-full mt-1.5 mr-3 flex-shrink-0 ${
                      log.level === 'error' || log.level === 'critical' ? 'bg-red-500' :
                      log.level === 'warning' ? 'bg-yellow-500' :
                      'bg-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-gray-100">{log.message}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {log.component} • {formatRelativeTime(log.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No activity recorded</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Proxy</h3>
            
            {profile.proxy ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Label</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile.proxy.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Type</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile.proxy.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Health</span>
                  <span className={`status-badge ${
                    profile.proxy.health === 'good' ? 'status-active' :
                    profile.proxy.health === 'blocked' ? 'status-error' :
                    'status-warning'
                  }`}>
                    {profile.proxy.health}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Current IP</span>
                  <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                    {profile.proxy.current_ip || 'Unknown'}
                  </span>
                </div>
                
                <button className="btn-secondary w-full mt-4">
                  Change Proxy
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No proxy assigned</p>
                <button className="btn-primary w-full">
                  Assign Proxy
                </button>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Actions</h3>
            
            <div className="space-y-2">
              {profile.status === 'new' && (
                <button className="btn-primary w-full">
                  <Play className="h-4 w-4 mr-2" />
                  Start Warm-Up
                </button>
              )}
              
              {profile.status === 'active' && (
                <>
                  <button className="btn-primary w-full">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Post Content
                  </button>
                  <button className="btn-secondary w-full">
                    <Pause className="h-4 w-4 mr-2" />
                    Pause Profile
                  </button>
                </>
              )}
              
              {profile.status === 'paused' && (
                <button className="btn-primary w-full">
                  <Play className="h-4 w-4 mr-2" />
                  Resume Profile
                </button>
              )}
              
              <button className="btn-danger w-full">
                <AlertCircle className="h-4 w-4 mr-2" />
                Delete Profile
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              Tasks ({activeTasks.length} active)
            </h3>
            
            {activeTasks.length > 0 ? (
              <div className="space-y-2">
                {activeTasks.map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{task.type}</span>
                    <span className="status-warning">Running</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No active tasks</p>
            )}
          </div>
        </div>
      </div>
    </div>
    </ProfileDetailWrapper>
  )
}