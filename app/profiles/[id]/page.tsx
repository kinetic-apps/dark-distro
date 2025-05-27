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
  Smartphone,
  CheckCircle,
  Clock,
  User,
  Shield,
  TrendingUp,
  Calendar,
  Hash,
  Edit,
  Trash2,
  RefreshCw,
  Power,
  LogIn,
  Image as ImageIcon,
  Video,
  Settings,
  ChevronRight,
  Zap,
  WifiOff
} from 'lucide-react'
import Link from 'next/link'
import { ProfileDetailWrapper } from '@/components/profile-detail-wrapper'
import { ProfileStatus } from '@/components/profile-status'
import { ScreenshotViewer } from '@/components/screenshot-viewer'
import { ProfileDetailClient } from './profile-detail-client'
import { ProxySectionClient } from './proxy-section-client'

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
  const failedTasks = profile.tasks?.filter((t: any) => t.status === 'failed') || []
  
  // Check if there's an active warmup task
  const hasActiveWarmup = activeTasks.some((t: any) => t.type === 'warmup')

  // Calculate stats
  const stats = {
    totalPosts: recentPosts?.length || 0,
    successRate: completedTasks.length > 0 
      ? Math.round((completedTasks.length / (completedTasks.length + failedTasks.length)) * 100)
      : 0,
    lastActive: profile.phone?.[0]?.last_heartbeat || profile.updated_at,
    uptime: profile.phone?.[0]?.last_heartbeat 
      ? Math.round((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20'
      case 'warming_up':
        return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20'
      case 'paused':
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20'
      case 'banned':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20'
    }
  }

  return (
    <ProfileDetailWrapper profile={profile} showTikTokActions={false}>
      <div className="space-y-6">
        {/* Enhanced Header */}
        <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <Link 
                href="/profiles" 
                className="mt-1 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-dark-500 dark:hover:text-dark-300 dark:hover:bg-dark-700"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-dark-700 flex items-center justify-center">
                  <User className="h-8 w-8 text-gray-500 dark:text-dark-400" />
                </div>
                
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
                    {profile.tiktok_username || 'Unnamed Profile'}
                  </h1>
                  <div className="mt-1 flex items-center gap-4 text-sm text-gray-500 dark:text-dark-400">
                    <span className="font-mono">ID: {profile.geelark_profile_id?.slice(-8) || 'Not assigned'}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(profile.status)}`}>
                      {profile.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {profile.geelark_profile_id && (
                <ScreenshotViewer
                  profileId={profile.geelark_profile_id}
                  profileName={profile.tiktok_username || 'Unnamed'}
                  phoneStatus="unknown"
                />
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">{profile.warmup_progress}%</p>
              <p className="text-xs text-gray-500 dark:text-dark-400">Warmup Progress</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">{stats.totalPosts}</p>
              <p className="text-xs text-gray-500 dark:text-dark-400">Total Posts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">{stats.successRate}%</p>
              <p className="text-xs text-gray-500 dark:text-dark-400">Success Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">{stats.uptime}d</p>
              <p className="text-xs text-gray-500 dark:text-dark-400">Uptime</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Actions Card - Using Client Component */}
            <ProfileDetailClient profile={profile} />

            {/* Profile Information */}
            <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">Profile Information</h2>
              
              <div className="space-y-4">
                {/* Warmup Progress Bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-dark-300">Warmup Progress</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-100">{profile.warmup_progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${profile.warmup_progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-dark-400">Created</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-dark-100 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {formatDate(profile.created_at)}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-dark-400">Last Active</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-dark-100 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      {formatRelativeTime(stats.lastActive)}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-dark-400">Error Count</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-dark-100">
                      {profile.error_count > 0 ? (
                        <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                          <AlertCircle className="h-4 w-4" />
                          {profile.error_count} errors
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          No errors
                        </span>
                      )}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-dark-400">Warmup Status</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-dark-100">
                      {profile.warmup_done ? (
                        <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          Completed
                        </span>
                      ) : (profile.status === 'warming_up' || hasActiveWarmup) ? (
                        <span className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                          <Clock className="h-4 w-4" />
                          In Progress ({profile.warmup_progress}%)
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <Clock className="h-4 w-4" />
                          Not Started
                        </span>
                      )}
                    </dd>
                  </div>
                </div>

                {profile.last_error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-300 font-medium">Last Error:</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{profile.last_error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Recent Activity</h2>
                <button className="text-sm text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-200">
                  View All
                </button>
              </div>
              
              {logs && logs.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 group">
                      <div className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${
                        log.level === 'error' || log.level === 'critical' ? 'bg-red-500' :
                        log.level === 'warning' ? 'bg-yellow-500' :
                        'bg-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-dark-100 break-words">{log.message}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-dark-400">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-dark-700">
                            {log.component}
                          </span>
                          <span>{formatRelativeTime(log.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="mx-auto h-8 w-8 text-gray-400 dark:text-dark-500" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-dark-400">No activity recorded yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Device & Connection */}
            <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">Device & Connection</h3>
              
              {/* Device Info */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-3 flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Device
                </h4>
                {profile.phone?.[0] ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-dark-400">Status</span>
                      {profile.geelark_profile_id && (
                        <ProfileStatus profileId={profile.geelark_profile_id} />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-dark-400">Battery</span>
                      <div className="flex items-center gap-2">
                        <Battery className={`h-4 w-4 ${
                          (profile.phone[0].battery || 0) > 50 ? 'text-green-500' :
                          (profile.phone[0].battery || 0) > 20 ? 'text-yellow-500' :
                          'text-red-500'
                        }`} />
                        <span className="text-sm font-medium">{profile.phone[0].battery || 0}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-dark-400">Model</span>
                      <span className="text-sm font-medium">{profile.phone[0].device_model || 'Unknown'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Smartphone className="mx-auto h-8 w-8 text-gray-400 dark:text-dark-500" />
                    <p className="mt-2 text-sm text-gray-500 dark:text-dark-400">No device assigned</p>
                  </div>
                )}
              </div>

              <hr className="border-gray-200 dark:border-dark-700" />

              {/* Proxy Info */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-3 flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Proxy Connection
                </h4>
                <ProxySectionClient profile={profile} />
              </div>
            </div>

            {/* Tasks Overview */}
            <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">
                Tasks Overview
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-300">Active</span>
                  </div>
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">{activeTasks.length}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-900 dark:text-green-300">Completed</span>
                  </div>
                  <span className="text-sm font-semibold text-green-900 dark:text-green-300">{completedTasks.length}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-medium text-red-900 dark:text-red-300">Failed</span>
                  </div>
                  <span className="text-sm font-semibold text-red-900 dark:text-red-300">{failedTasks.length}</span>
                </div>
              </div>

              {activeTasks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
                  <p className="text-xs font-medium text-gray-700 dark:text-dark-300 mb-2">Active Tasks:</p>
                  <div className="space-y-1">
                    {activeTasks.slice(0, 3).map((task: any) => (
                      <div key={task.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-dark-400">{task.type}</span>
                        <span className="text-gray-500 dark:text-dark-500">{formatRelativeTime(task.started_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recent Posts */}
            <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Recent Posts</h3>
                <Link href={`/posts?account=${id}`} className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                  View All
                </Link>
              </div>
              
              {recentPosts && recentPosts.length > 0 ? (
                <div className="space-y-3">
                  {recentPosts.slice(0, 5).map((post) => (
                    <div key={post.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {post.type === 'carousel' ? (
                          <ImageIcon className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Video className="h-4 w-4 text-gray-400" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate max-w-[150px]">
                            {post.caption || 'No caption'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-dark-400">
                            {formatRelativeTime(post.created_at)}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        post.status === 'posted' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        post.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {post.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Hash className="mx-auto h-8 w-8 text-gray-400 dark:text-dark-500" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-dark-400">No posts yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProfileDetailWrapper>
  )
}