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
  Sparkles,
  TrendingUp,
  Clock,
  Smartphone,
  Power,
  Zap,
  BarChart3,
  Camera,
  Globe,
  Shield,
  PlayCircle,
  PauseCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  // Profile & Phone Stats
  totalProfiles: number
  activePhones: number
  runningPhones: number
  stoppedPhones: number
  
  // Task & Activity Stats
  activeTasks: any[]
  completedTasksToday: number
  failedTasksToday: number
  avgTaskDuration: number
  
  // Content Stats
  postsToday: number
  postsThisWeek: number
  carouselsGenerated: number
  totalImagesGenerated: number
  
  // Proxy & Infrastructure Stats
  totalProxies: number
  healthyProxies: number
  assignedProxies: number
  proxyRotationsToday: number
  
  // SMS Stats
  activeRentals: number
  smsReceivedToday: number
  smsBalance: number
  
  // Performance Metrics
  systemHealth: 'excellent' | 'good' | 'degraded' | 'critical'
  apiSuccessRate: number
  avgResponseTime: number
  
  // Recent Data
  recentTasks: any[]
  recentGenerations: any[]
  recentErrors: any[]
  recentScreenshots: any[]
  phoneStatuses: any[]
}

async function getComprehensiveStats(): Promise<DashboardStats> {
  const supabase = await createClient()
  const now = new Date()
  const todayStart = new Date(now.setHours(0, 0, 0, 0))
  const weekStart = new Date(now.setDate(now.getDate() - 7))
  
  // Parallel fetch all data
  const [
    profiles,
    phones,
    activeTasks,
    todayTasks,
    posts,
    weekPosts,
    proxies,
    rentals,
    generations,
    errors,
    screenshots,
    logs
  ] = await Promise.all([
    // Profile stats
    supabase.from('accounts').select('*', { count: 'exact' }),
    
    // Phone stats from accounts - get profiles with GeeLark IDs
    supabase.from('accounts').select('id, geelark_profile_id, tiktok_username').not('geelark_profile_id', 'is', null),
    
    // Active tasks
    supabase.from('tasks')
      .select('*, accounts(tiktok_username)')
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(20),
    
    // Today's tasks
    supabase.from('tasks')
      .select('status, started_at, completed_at')
      .gte('started_at', todayStart.toISOString()),
    
    // Posts today
    supabase.from('posts')
      .select('*', { count: 'exact' })
      .gte('created_at', todayStart.toISOString()),
    
    // Posts this week
    supabase.from('posts')
      .select('*', { count: 'exact' })
      .gte('created_at', weekStart.toISOString()),
    
    // Proxy stats
    supabase.from('proxies').select('health, assigned_account_id'),
    
    // SMS rentals
    supabase.from('sms_rentals')
      .select('status, created_at')
      .gte('created_at', todayStart.toISOString()),
    
    // Image generations
    supabase.from('image_generation_jobs')
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
      .limit(5),
    
    // Recent errors
    supabase.from('logs')
      .select('*')
      .in('level', ['error', 'critical'])
      .gte('timestamp', new Date(Date.now() - 3600000).toISOString())
      .order('timestamp', { ascending: false })
      .limit(10),
    
    // Recent screenshots
    supabase.from('screenshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(4),
    
    // API logs for success rate
    supabase.from('logs')
      .select('level, meta')
      .gte('timestamp', new Date(Date.now() - 3600000).toISOString())
      .in('component', ['geelark-api', 'soax-api', 'daisy-api'])
  ])

  // Process task durations
  const completedTasks = todayTasks.data?.filter(t => t.status === 'completed') || []
  const avgDuration = completedTasks.length > 0
    ? completedTasks.reduce((acc, task) => {
        const duration = new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()
        return acc + duration
      }, 0) / completedTasks.length / 1000 / 60 // Convert to minutes
    : 0

  // Process proxy health
  const proxyStats = proxies.data?.reduce((acc, proxy) => {
    acc.total++
    if (proxy.health === 'good') acc.healthy++
    if (proxy.assigned_account_id) acc.assigned++
    return acc
  }, { total: 0, healthy: 0, assigned: 0 }) || { total: 0, healthy: 0, assigned: 0 }

  // Calculate API success rate
  const apiLogs = logs.data || []
  const apiCalls = apiLogs.length
  const apiErrors = apiLogs.filter(log => log.level === 'error').length
  const apiSuccessRate = apiCalls > 0 ? ((apiCalls - apiErrors) / apiCalls) * 100 : 100

  // Determine system health
  let systemHealth: DashboardStats['systemHealth'] = 'excellent'
  if (apiSuccessRate < 95) systemHealth = 'good'
  if (apiSuccessRate < 85) systemHealth = 'degraded'
  if (apiSuccessRate < 70) systemHealth = 'critical'

  // Count total images generated
  const totalImages = generations.data?.reduce((acc, job) => 
    acc + (job.generated_images?.length || 0), 0) || 0

  // Get actual phone statuses from GeeLark
  let phoneStatuses: any[] = []
  let runningPhones = 0
  let stoppedPhones = 0
  
  if (phones.data && phones.data.length > 0) {
    const profileIds = phones.data.map(p => p.geelark_profile_id).filter(Boolean)
    
    try {
      // Fetch actual phone statuses from GeeLark API
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/geelark/phone-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_ids: profileIds })
      })
      
      if (response.ok) {
        const data = await response.json()
        phoneStatuses = data.statuses || []
        
        // Count running and stopped phones
        runningPhones = phoneStatuses.filter(p => p.status === 'started').length
        stoppedPhones = phoneStatuses.filter(p => p.status === 'stopped' || p.status === 'expired').length
      }
    } catch (error) {
      console.error('Failed to fetch phone statuses:', error)
      // Fallback to assuming all phones are stopped
      phoneStatuses = profileIds.map(id => ({ profile_id: id, status: 'unknown' }))
    }
  }

  const activePhones = phoneStatuses.length

  return {
    // Profile & Phone Stats
    totalProfiles: profiles.count || 0,
    activePhones,
    runningPhones,
    stoppedPhones,
    
    // Task & Activity Stats
    activeTasks: activeTasks.data || [],
    completedTasksToday: todayTasks.data?.filter(t => t.status === 'completed').length || 0,
    failedTasksToday: todayTasks.data?.filter(t => t.status === 'failed').length || 0,
    avgTaskDuration: Math.round(avgDuration),
    
    // Content Stats
    postsToday: posts.count || 0,
    postsThisWeek: weekPosts.count || 0,
    carouselsGenerated: generations.data?.length || 0,
    totalImagesGenerated: totalImages,
    
    // Proxy & Infrastructure Stats
    totalProxies: proxyStats.total,
    healthyProxies: proxyStats.healthy,
    assignedProxies: proxyStats.assigned,
    proxyRotationsToday: 0, // Would need to track this separately
    
    // SMS Stats
    activeRentals: rentals.data?.filter(r => r.status === 'waiting' || r.status === 'received').length || 0,
    smsReceivedToday: rentals.data?.filter(r => r.status === 'received').length || 0,
    smsBalance: 0, // Would need to fetch from DaisySMS API
    
    // Performance Metrics
    systemHealth,
    apiSuccessRate: Math.round(apiSuccessRate),
    avgResponseTime: 245, // Mock for now
    
    // Recent Data
    recentTasks: activeTasks.data?.slice(0, 5) || [],
    recentGenerations: generations.data || [],
    recentErrors: errors.data || [],
    recentScreenshots: screenshots.data || [],
    phoneStatuses
  }
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  color = 'blue' 
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  trend?: { value: number, positive: boolean }
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
  }

  return (
    <div className="card-lg">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-dark-400">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-semibold text-gray-900 dark:text-dark-100">
              {value}
            </p>
            {trend && (
              <span className={`flex items-center text-sm font-medium ${
                trend.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {trend.positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {trend.value}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500 dark:text-dark-400">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

function SystemHealthIndicator({ health }: { health: DashboardStats['systemHealth'] }) {
  const healthConfig = {
    excellent: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20', label: 'Excellent' },
    good: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/20', label: 'Good' },
    degraded: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/20', label: 'Degraded' },
    critical: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/20', label: 'Critical' }
  }

  const config = healthConfig[health]

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.color}`}>
      <Shield className="h-4 w-4" />
      System {config.label}
    </div>
  )
}

export default async function DashboardPage() {
  const stats = await getComprehensiveStats()

  return (
    <div>
      {/* Enhanced Header with System Status */}
      <div className="page-header mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="page-title">Command Center</h1>
            <p className="page-description">
              Real-time monitoring and control of your TikTok automation infrastructure
            </p>
          </div>
          <div className="flex items-center gap-4">
            <SystemHealthIndicator health={stats.systemHealth} />
            <Link href="/logs" className="btn-secondary text-sm">
              View Logs
            </Link>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid - 6 columns on large screens */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
        <MetricCard
          title="Active Phones"
          value={stats.runningPhones}
          subtitle={`${stats.activePhones} total`}
          icon={Smartphone}
          color="green"
          trend={{ value: 12, positive: true }}
        />
        <MetricCard
          title="Running Tasks"
          value={stats.activeTasks.length}
          subtitle={`${stats.completedTasksToday} completed`}
          icon={Activity}
          color="blue"
        />
        <MetricCard
          title="Posts Today"
          value={stats.postsToday}
          subtitle={`${stats.postsThisWeek} this week`}
          icon={Send}
          color="purple"
          trend={{ value: 8, positive: true }}
        />
        <MetricCard
          title="Healthy Proxies"
          value={stats.healthyProxies}
          subtitle={`${stats.assignedProxies} assigned`}
          icon={Wifi}
          color="green"
        />
        <MetricCard
          title="API Success"
          value={`${stats.apiSuccessRate}%`}
          subtitle={`${stats.avgResponseTime}ms avg`}
          icon={Zap}
          color={stats.apiSuccessRate > 95 ? 'green' : 'yellow'}
        />
        <MetricCard
          title="Images Created"
          value={stats.totalImagesGenerated}
          subtitle={`${stats.carouselsGenerated} carousels`}
          icon={ImageIcon}
          color="orange"
        />
      </div>

      {/* Quick Actions Bar */}
      <div className="mb-8 p-4 bg-gray-50 dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Link href="/profiles?action=sync" className="btn-primary text-sm">
            <RefreshCw className="h-4 w-4 mr-1" />
            Sync Profiles
          </Link>
          <Link href="/profiles?action=warmup" className="btn-secondary text-sm">
            <Activity className="h-4 w-4 mr-1" />
            Start Warmup
          </Link>
          <Link href="/image-generator" className="btn-secondary text-sm">
            <Sparkles className="h-4 w-4 mr-1" />
            Generate Content
          </Link>
          <Link href="/proxies?action=import" className="btn-secondary text-sm">
            <Globe className="h-4 w-4 mr-1" />
            Import Proxies
          </Link>
          <Link href="/tasks" className="btn-secondary text-sm">
            <BarChart3 className="h-4 w-4 mr-1" />
            View All Tasks
          </Link>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Phone Status Panel - 4 columns */}
        <div className="lg:col-span-4">
          <div className="card-lg h-full">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-900 dark:text-dark-100">Phone Status</h2>
              <Link href="/profiles" className="text-sm text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-200">
                Manage →
              </Link>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Power className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-green-900 dark:text-green-100">Running</span>
                </div>
                <span className="text-2xl font-semibold text-green-900 dark:text-green-100">{stats.runningPhones}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <PauseCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">Stopped</span>
                </div>
                <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.stoppedPhones}</span>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-dark-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Avg Task Duration</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{stats.avgTaskDuration}m</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-600 dark:text-gray-400">Failed Today</span>
                  <span className="font-medium text-red-600 dark:text-red-400">{stats.failedTasksToday}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Tasks - 4 columns */}
        <div className="lg:col-span-4">
          <div className="card-lg h-full">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-900 dark:text-dark-100">Active Tasks</h2>
              <Link href="/tasks" className="text-sm text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-200">
                View all →
              </Link>
            </div>
            
            {stats.recentTasks.length > 0 ? (
              <div className="space-y-2">
                {stats.recentTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-1.5 rounded ${
                        task.type === 'warmup' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                        task.type === 'post' ? 'bg-blue-100 dark:bg-blue-900/20' :
                        task.type === 'login' ? 'bg-green-100 dark:bg-green-900/20' :
                        'bg-gray-100 dark:bg-gray-900/20'
                      }`}>
                        {task.type === 'warmup' ? <Activity className="h-4 w-4 text-yellow-600 dark:text-yellow-400" /> :
                         task.type === 'post' ? <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" /> :
                         task.type === 'login' ? <Users className="h-4 w-4 text-green-600 dark:text-green-400" /> :
                         <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                          {task.type === 'warmup' ? 'Warmup' : 
                           task.type === 'post' ? 'Posting' :
                           task.type === 'login' ? 'Login' : 
                           task.type}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-dark-400 truncate">
                          {task.accounts?.tiktok_username || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="mx-auto h-8 w-8 text-gray-400 dark:text-dark-500" />
                <p className="mt-2 text-sm text-gray-500 dark:text-dark-400">No active tasks</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Screenshots - 4 columns */}
        <div className="lg:col-span-4">
          <div className="card-lg h-full">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-900 dark:text-dark-100">Recent Screenshots</h2>
              <Link href="/screenshots" className="text-sm text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-200">
                View all →
              </Link>
            </div>
            
            {stats.recentScreenshots.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {stats.recentScreenshots.map((screenshot) => (
                  <Link
                    key={screenshot.id}
                    href={`/screenshots?id=${screenshot.id}`}
                    className="relative group aspect-[9/16] rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-700"
                  >
                    <img
                      src={screenshot.image_url}
                      alt="Screenshot"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="text-xs text-white truncate">
                          {new Date(screenshot.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Camera className="mx-auto h-8 w-8 text-gray-400 dark:text-dark-500" />
                <p className="mt-2 text-sm text-gray-500 dark:text-dark-400">No recent screenshots</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Generations - Full width */}
        <div className="lg:col-span-8">
          <div className="card-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-900 dark:text-dark-100">Recent Content Generation</h2>
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
                    className="block p-4 rounded-lg border border-gray-200 hover:border-gray-300 dark:border-dark-600 dark:hover:border-dark-500 transition-all hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                            {job.name}
                          </p>
                          {job.status === 'completed' && (
                            <span className="status-active text-xs">Completed</span>
                          )}
                          {job.status === 'processing' && (
                            <span className="status-info text-xs">Processing</span>
                          )}
                          {job.status === 'failed' && (
                            <span className="status-error text-xs">Failed</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-xs text-gray-500 dark:text-dark-400">
                            {job.variants} carousel{job.variants > 1 ? 's' : ''}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-dark-400">
                            {job.generated_images?.length || 0} images
                          </p>
                          <p className="text-xs text-gray-500 dark:text-dark-400">
                            {new Date(job.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {job.generated_images && job.generated_images.length > 0 && (
                        <div className="flex -space-x-2 ml-4">
                          {job.generated_images.slice(0, 4).map((img: any, idx: number) => (
                            <img
                              key={img.id}
                              src={img.generated_image_url}
                              alt=""
                              className="w-10 h-10 rounded-lg ring-2 ring-white dark:ring-dark-850 object-cover"
                            />
                          ))}
                          {job.generated_images.length > 4 && (
                            <div className="w-10 h-10 rounded-lg ring-2 ring-white dark:ring-dark-850 bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-dark-300">
                              +{job.generated_images.length - 4}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <ImageIcon className="mx-auto h-8 w-8 text-gray-400 dark:text-dark-500" />
                <p className="mt-2 text-sm text-gray-500 dark:text-dark-400">No recent generations</p>
                <Link href="/image-generator" className="mt-3 inline-flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Generate Content
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* System Status - 4 columns */}
        <div className="lg:col-span-4">
          <div className="card-lg h-full">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-900 dark:text-dark-100">System Status</h2>
              <span className="text-xs text-gray-500 dark:text-dark-400">Last hour</span>
            </div>
            
            <div className="space-y-4">
              {/* API Performance */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">API Performance</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{stats.apiSuccessRate}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      stats.apiSuccessRate > 95 ? 'bg-green-500' :
                      stats.apiSuccessRate > 85 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${stats.apiSuccessRate}%` }}
                  />
                </div>
              </div>

              {/* Recent Errors */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Recent Issues</span>
                  {stats.recentErrors.length > 0 && (
                    <Link href="/logs?level=error" className="text-xs text-red-600 hover:text-red-700 dark:text-red-400">
                      View all
                    </Link>
                  )}
                </div>
                {stats.recentErrors.length > 0 ? (
                  <div className="space-y-2">
                    {stats.recentErrors.slice(0, 3).map((error) => (
                      <div key={error.id} className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-900 dark:text-dark-100 truncate">
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

              {/* Infrastructure Health */}
              <div className="pt-3 border-t border-gray-200 dark:border-dark-700">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Response Time</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{stats.avgResponseTime}ms</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Active Rentals</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{stats.activeRentals}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}