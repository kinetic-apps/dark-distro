import { createClient } from '@/lib/supabase/server'
import { ProfilesPageWrapper } from '@/components/profiles-page-wrapper'
import { 
  Filter, 
  Activity,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import Link from 'next/link'
import { ProfilesHeader } from '@/components/profiles-header'
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
      ready_for_actions,
      proxy:proxies!proxy_id(*),
      phone:phones!fk_account(
        *,
        tags,
        remark
      ),
      tasks!fk_account(
        id,
        type,
        status,
        created_at,
        completed_at,
        started_at
      )
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-dark-100">Profiles</h1>
        <ProfilesHeader />
      </div>

      {/* Filters */}
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