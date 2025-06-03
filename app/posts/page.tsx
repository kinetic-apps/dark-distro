import { createClient } from '@/lib/supabase/server'
import { Filter } from 'lucide-react'
import Link from 'next/link'
import PostsPageClient from './posts-page-client'
import PostsTable from '@/components/posts-table'

async function getPosts(searchParams: { status?: string }) {
  const supabase = await createClient()
  
  let query = supabase
    .from('posts')
    .select(`
      *,
      account:accounts!fk_account(
        id,
        tiktok_username,
        geelark_profile_id
      )
    `)
    .order('created_at', { ascending: false })

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }

  const { data: posts } = await query

  const statusCounts = await supabase
    .from('posts')
    .select('status')
    .then(({ data }) => {
      const counts: Record<string, number> = {
        all: data?.length || 0,
        queued: 0,
        pending: 0,
        processing: 0,
        posted: 0,
        failed: 0,
        cancelled: 0
      }
      
      data?.forEach(item => {
        if (item.status && counts.hasOwnProperty(item.status)) {
          counts[item.status]++
        }
      })
      
      return counts
    })

  return { posts: posts || [], statusCounts }
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; action?: string; asset?: string }>
}) {
  const params = await searchParams
  const { posts, statusCounts } = await getPosts(params)

  return (
    <PostsPageClient>
      <>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        <nav className="flex gap-1">
          <Link
            href="/posts"
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              !params.status
                ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                : 'text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100'
            }`}
          >
            All ({statusCounts.all})
          </Link>
          <Link
            href="/posts?status=queued"
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              params.status === 'queued'
                ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                : 'text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100'
            }`}
          >
            Queued ({statusCounts.queued})
          </Link>
          <Link
            href="/posts?status=pending"
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              params.status === 'pending'
                ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                : 'text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100'
            }`}
          >
            Pending ({statusCounts.pending})
          </Link>
          <Link
            href="/posts?status=processing"
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              params.status === 'processing'
                ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                : 'text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100'
            }`}
          >
            Processing ({statusCounts.processing})
          </Link>
          <Link
            href="/posts?status=posted"
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              params.status === 'posted'
                ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                : 'text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100'
            }`}
          >
            Posted ({statusCounts.posted})
          </Link>
          <Link
            href="/posts?status=failed"
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              params.status === 'failed'
                ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                : 'text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100'
            }`}
          >
            Failed ({statusCounts.failed})
          </Link>
        </nav>
      </div>

      <PostsTable posts={posts} />
      </>
    </PostsPageClient>
  )
}