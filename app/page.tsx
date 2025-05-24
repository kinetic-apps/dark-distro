import { createClient } from '@/lib/supabase/server'
import { 
  Users, 
  Activity, 
  AlertCircle, 
  Wifi,
  MessageSquare,
  Send,
  CheckCircle,
  Image as ImageIcon,
  Sparkles
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
    activeRentals,
    recentGenerations
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
      .in('status', ['waiting', 'received']),
    supabase
      .from('image_generation_jobs')
      .select(`
        *,
        generated_images:generated_carousel_images(
          id,
          generated_image_url,
          carousel_index,
          image_index
        )
      `)
      .order('created_at', { ascending: false })
      .limit(3)
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
    activeTasks: activeTasks || [],
    recentGenerations: recentGenerations.data || []
  }
}

export default async function DashboardPage() {
  const stats = await getStats()

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">
          Monitor your advanced cloud operations and automation infrastructure
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Active Profiles</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.activeProfiles}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-dark-400">
                {stats.warmingUpProfiles} warming up
              </p>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3">
              <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Today&apos;s Posts</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.todayPosts}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-dark-400">
                Last 24 hours
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3">
              <Send className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Healthy Proxies</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.healthyProxies}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-dark-400">
                Working normally
              </p>
            </div>
            <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 p-3">
              <Wifi className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="card-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">SMS Rentals</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.activeRentals}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-dark-400">
                Active rentals
              </p>
            </div>
            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 p-3">
              <MessageSquare className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Generations - 2 columns */}
        <div className="lg:col-span-2">
          <div className="card-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-900 dark:text-dark-100">Recent Carousel Generations</h2>
              <Link href="/image-generator/jobs" className="text-sm text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-200">
                View all →
              </Link>
            </div>
            
            {stats.recentGenerations.length > 0 ? (
              <div className="space-y-3">
                {stats.recentGenerations.map((job: any) => (
                  <Link 
                    key={job.id} 
                    href={`/image-generator/jobs/${job.id}`}
                    className="block p-3 rounded-lg border border-gray-200 hover:border-gray-300 dark:border-dark-600 dark:hover:border-dark-500 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                            {job.name}
                          </p>
                          {job.status === 'completed' && (
                            <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
                              Completed
                            </span>
                          )}
                          {job.status === 'processing' && (
                            <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                              Processing
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                          {job.variants} carousel{job.variants > 1 ? 's' : ''} • {job.generated_images?.length || 0} total images
                        </p>
                      </div>
                      {job.generated_images && job.generated_images.length > 0 && (
                        <div className="flex -space-x-2 ml-4">
                          {job.generated_images.slice(0, 3).map((img: any, idx: number) => (
                            <img
                              key={img.id}
                              src={img.generated_image_url}
                              alt=""
                              className="w-8 h-8 rounded ring-2 ring-white dark:ring-dark-850 object-cover"
                            />
                          ))}
                          {job.generated_images.length > 3 && (
                            <div className="w-8 h-8 rounded ring-2 ring-white dark:ring-dark-850 bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-dark-300">
                              +{job.generated_images.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ImageIcon className="mx-auto h-8 w-8 text-gray-400 dark:text-dark-500" />
                <p className="mt-2 text-sm text-gray-500 dark:text-dark-400">No recent generations</p>
                <Link href="/image-generator" className="mt-3 inline-flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Generate Carousels
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Activity Section - 1 column */}
        <div className="space-y-6">
          {/* Active Tasks */}
          <div className="card-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-900 dark:text-dark-100">Active Tasks</h2>
              <Link href="/posts" className="text-sm text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-200">
                View all →
              </Link>
            </div>
            
            {stats.activeTasks.length > 0 ? (
              <div className="space-y-3">
                {stats.activeTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Activity className="h-4 w-4 text-gray-400 dark:text-dark-500 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                          {task.type === 'warmup' ? 'Warming up' : 'Posting'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-dark-400">
                          #{task.geelark_task_id?.slice(-8)}
                        </p>
                      </div>
                    </div>
                    <span className="status-warning">Running</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-dark-400">No active tasks</p>
            )}
          </div>

          {/* Recent Errors */}
          <div className="card-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-900 dark:text-dark-100">Recent Errors</h2>
              <Link href="/logs" className="text-sm text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-200">
                View logs →
              </Link>
            </div>
            
            {stats.recentErrors.length > 0 ? (
              <div className="space-y-3">
                {stats.recentErrors.map((error) => (
                  <div key={error.id} className="flex items-start">
                    <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 dark:text-dark-100 truncate">
                        {error.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        {error.component} • {new Date(error.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4 mr-2" />
                <p className="text-sm">No recent errors</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/profiles?action=warmup" className="btn-primary">
          Start Warm-Up Batch
        </Link>
        <Link href="/posts?action=launch" className="btn-secondary">
          Launch Daily Posts
        </Link>
        <Link href="/image-generator" className="btn-secondary">
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Carousels
        </Link>
      </div>
    </div>
  )
}