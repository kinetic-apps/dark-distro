import { createClient } from '@/lib/supabase/server'
import { ProfilesPageWrapper } from '@/components/profiles-page-wrapper'
import { ProfilesHeader } from '@/components/profiles-header'
import { ProfileSearch } from '@/components/profile-search'

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
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

  if (params.search) {
    query = query.ilike('tiktok_username', `%${params.search}%`)
  }

  const { data: profiles } = await query

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-dark-100">Profiles</h1>
        <ProfilesHeader />
      </div>

      {/* Filters - handled in ProfilesPageWrapper */}

      {/* Table Wrapper */}
      <ProfilesPageWrapper profiles={profiles || []} />
    </div>
  )
}