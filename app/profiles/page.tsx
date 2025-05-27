import { createClient } from '@/lib/supabase/server'
import { ProfilesPageWrapper } from '@/components/profiles-page-wrapper'
import { 
  Plus, 
  Filter, 
  Search,
  Users,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Smartphone
} from 'lucide-react'
import Link from 'next/link'
import { SyncProfilesButton } from '@/components/sync-profiles-button'
import { ProfileSearch } from '@/components/profile-search'

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; action?: string; search?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  
  let query = supabase
    .from('accounts')
    .select(`
      *,
      proxy:proxies!proxy_id(*),
      phone:phones!fk_account(*)
    `)
    .order('created_at', { ascending: false })

  if (params.status) {
    query = query.eq('status', params.status)
  }

  if (params.search) {
    query = query.ilike('tiktok_username', `%${params.search}%`)
  }

  const { data: profiles } = await query

  // Get status counts
  const statusCounts = await supabase
    .from('accounts')
    .select('status')
    .then(({ data }) => {
      const counts: Record<string, number> = {
        all: data?.length || 0,
        new: 0,
        warming_up: 0,
        active: 0,
        banned: 0
      }
      
      data?.forEach(item => {
        counts[item.status]++
      })
      
      return counts
    })

  // Calculate additional stats
  const stats = {
    totalProfiles: profiles?.length || 0,
    withProxy: profiles?.filter(p => p.proxy_id).length || 0,
    withPhone: profiles?.filter(p => p.phone?.length > 0).length || 0,
    activeToday: profiles?.filter(p => {
      const lastActive = p.phone?.[0]?.last_heartbeat
      if (!lastActive) return false
      const hoursSinceActive = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60)
      return hoursSinceActive < 24
    }).length || 0
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-dark-100">Profiles</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-dark-400">
            Manage GeeLark phone profiles and TikTok accounts
          </p>
        </div>
        
        <div className="flex gap-2">
          <SyncProfilesButton />
          
          <Link href="/profiles/new" className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            New Profile
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Total Profiles</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.totalProfiles}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-dark-500">
                {statusCounts.active} active
              </p>
            </div>
            <div className="rounded-lg bg-gray-100 p-3 dark:bg-dark-700 group-hover:bg-gray-200 dark:group-hover:bg-dark-600 transition-colors">
              <Users className="h-6 w-6 text-gray-600 dark:text-dark-300" />
            </div>
          </div>
        </div>

        <div className="card group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Active Today</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.activeToday}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-dark-500">
                Last 24 hours
              </p>
            </div>
            <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900/20 group-hover:bg-green-200 dark:group-hover:bg-green-900/30 transition-colors">
              <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">With Proxy</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.withProxy}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-dark-500">
                {Math.round((stats.withProxy / stats.totalProfiles) * 100) || 0}% coverage
              </p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/20 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30 transition-colors">
              <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-dark-400">With Phone</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-dark-100">
                {stats.withPhone}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-dark-500">
                Connected devices
              </p>
            </div>
            <div className="rounded-lg bg-purple-100 p-3 dark:bg-purple-900/20 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/30 transition-colors">
              <Smartphone className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Bar */}
        <ProfileSearch />

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <nav className="flex gap-1">
          <Link
            href="/profiles"
              className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all ${
              !params.status
                ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-800 dark:text-dark-400 dark:hover:bg-dark-700'
            }`}
          >
              <span className="flex items-center gap-2">
                All
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-white/20 dark:bg-dark-900/20">
                  {statusCounts.all}
                </span>
              </span>
          </Link>
            
          <Link
            href="/profiles?status=new"
              className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all ${
              params.status === 'new'
                ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-800 dark:text-dark-400 dark:hover:bg-dark-700'
            }`}
          >
              <span className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                New
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-white/20 dark:bg-dark-900/20">
                  {statusCounts.new}
                </span>
              </span>
          </Link>
            
          <Link
            href="/profiles?status=warming_up"
              className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all ${
              params.status === 'warming_up'
                ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-800 dark:text-dark-400 dark:hover:bg-dark-700'
            }`}
          >
              <span className="flex items-center gap-2">
                <Activity className="h-3 w-3" />
                Warming Up
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-white/20 dark:bg-dark-900/20">
                  {statusCounts.warming_up}
                </span>
              </span>
          </Link>
            
          <Link
            href="/profiles?status=active"
              className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all ${
              params.status === 'active'
                ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-800 dark:text-dark-400 dark:hover:bg-dark-700'
            }`}
          >
              <span className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Active
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-white/20 dark:bg-dark-900/20">
                  {statusCounts.active}
                </span>
              </span>
          </Link>
            

            
          <Link
            href="/profiles?status=banned"
              className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all ${
              params.status === 'banned'
                ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-800 dark:text-dark-400 dark:hover:bg-dark-700'
            }`}
          >
              <span className="flex items-center gap-2">
                <AlertCircle className="h-3 w-3" />
                Banned
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-white/20 dark:bg-dark-900/20">
                  {statusCounts.banned}
                </span>
              </span>
          </Link>
        </nav>
        </div>
      </div>

      {/* Table Wrapper */}
      <ProfilesPageWrapper profiles={profiles || []} />
    </div>
  )
}