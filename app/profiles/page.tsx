import { createClient } from '@/lib/supabase/server'
import { ProfilesTable } from '@/components/tables/profiles-table'
import { Plus, Filter } from 'lucide-react'
import Link from 'next/link'

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; action?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  
  let query = supabase
    .from('accounts')
    .select(`
      *,
      proxy:proxies!proxy_id(*),
      phone:phones!accounts_phone_account_id_fkey(*)
    `)
    .order('created_at', { ascending: false })

  if (params.status) {
    query = query.eq('status', params.status)
  }

  const { data: profiles } = await query

  const statusCounts = await supabase
    .from('accounts')
    .select('status')
    .then(({ data }) => {
      const counts: Record<string, number> = {
        all: data?.length || 0,
        new: 0,
        warming_up: 0,
        active: 0,
        paused: 0,
        banned: 0
      }
      
      data?.forEach(item => {
        counts[item.status]++
      })
      
      return counts
    })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Profiles</h1>
          <p className="page-description">
            Manage GeeLark phone profiles and associated accounts
          </p>
        </div>
        
        <Link href="/profiles/new" className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          New Profile
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        <nav className="flex gap-1">
          <Link
            href="/profiles"
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              !params.status
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All ({statusCounts.all})
          </Link>
          <Link
            href="/profiles?status=new"
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              params.status === 'new'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            New ({statusCounts.new})
          </Link>
          <Link
            href="/profiles?status=warming_up"
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              params.status === 'warming_up'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Warming Up ({statusCounts.warming_up})
          </Link>
          <Link
            href="/profiles?status=active"
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              params.status === 'active'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Active ({statusCounts.active})
          </Link>
          <Link
            href="/profiles?status=paused"
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              params.status === 'paused'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Paused ({statusCounts.paused})
          </Link>
          <Link
            href="/profiles?status=banned"
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              params.status === 'banned'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Banned ({statusCounts.banned})
          </Link>
        </nav>
      </div>

      <ProfilesTable
        profiles={profiles || []}
        onBulkAction={async (action, ids) => {
          'use server'
          // Server actions will be implemented in API routes
          console.log('Bulk action:', action, ids)
        }}
      />
    </div>
  )
}