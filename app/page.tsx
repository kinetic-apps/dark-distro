import { createClient } from '@/lib/supabase/server'
import { 
  Users, 
  Activity, 
  AlertCircle, 
  Wifi,
  MessageSquare,
  Send,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'

async function getStats() {
  const supabase = await createClient()
  
  const [
    profiles,
    warmingUp,
    activePosts,
    recentErrors,
    healthyProxies,
    activeRentals
  ] = await Promise.all([
    supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'warming_up'),
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 86400000).toISOString())
      .eq('status', 'posted'),
    supabase
      .from('logs')
      .select('*')
      .in('level', ['error', 'critical'])
      .gte('timestamp', new Date(Date.now() - 3600000).toISOString())
      .limit(5),
    supabase
      .from('proxies')
      .select('*', { count: 'exact', head: true })
      .eq('health', 'good'),
    supabase
      .from('sms_rentals')
      .select('*', { count: 'exact', head: true })
      .in('status', ['waiting', 'received'])
  ])

  const { data: activeTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(10)

  return {
    activeProfiles: profiles.count || 0,
    warmingUpProfiles: warmingUp.count || 0,
    todayPosts: activePosts.count || 0,
    recentErrors: recentErrors.data || [],
    healthyProxies: healthyProxies.count || 0,
    activeRentals: activeRentals.count || 0,
    activeTasks: activeTasks || []
  }
}

export default async function DashboardPage() {
  const stats = await getStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Monitor your TikTok cloud phone farm operations
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Profiles</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {stats.activeProfiles}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {stats.warmingUpProfiles} warming up
              </p>
            </div>
            <div className="rounded-lg bg-green-100 p-3">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today&apos;s Posts</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {stats.todayPosts}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Last 24 hours
              </p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3">
              <Send className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Healthy Proxies</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {stats.healthyProxies}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Working normally
              </p>
            </div>
            <div className="rounded-lg bg-purple-100 p-3">
              <Wifi className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">SMS Rentals</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {stats.activeRentals}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Active rentals
              </p>
            </div>
            <div className="rounded-lg bg-orange-100 p-3">
              <MessageSquare className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Active Tasks</h2>
            <Link href="/posts" className="text-sm text-gray-600 hover:text-gray-900">
              View all →
            </Link>
          </div>
          
          {stats.activeTasks.length > 0 ? (
            <div className="space-y-3">
              {stats.activeTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Activity className="h-4 w-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {task.type === 'warmup' ? 'Warming up' : 'Posting'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Task #{task.geelark_task_id?.slice(-8)}
                      </p>
                    </div>
                  </div>
                  <span className="status-warning">Running</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No active tasks</p>
          )}
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Recent Errors</h2>
            <Link href="/logs" className="text-sm text-gray-600 hover:text-gray-900">
              View logs →
            </Link>
          </div>
          
          {stats.recentErrors.length > 0 ? (
            <div className="space-y-3">
              {stats.recentErrors.map((error) => (
                <div key={error.id} className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 truncate">
                      {error.message}
                    </p>
                    <p className="text-xs text-gray-500">
                      {error.component} • {new Date(error.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-4 w-4 mr-2" />
              <p className="text-sm">No recent errors</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <Link href="/profiles?action=warmup" className="btn-primary">
          New Warm-Up Batch
        </Link>
        <Link href="/posts?action=launch" className="btn-secondary">
          Launch Daily Posts
        </Link>
      </div>
    </div>
  )
}