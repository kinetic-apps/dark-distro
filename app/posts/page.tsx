import { createClient } from '@/lib/supabase/server'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { 
  Send, 
  CheckCircle, 
  XCircle, 
  Clock,
  RefreshCw,
  Play,
  Filter
} from 'lucide-react'
import Link from 'next/link'

async function getPosts(searchParams: { status?: string }) {
  const supabase = await createClient()
  
  let query = supabase
    .from('posts')
    .select(`
      *,
      account:accounts!posts_account_id_fkey(
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
        processing: 0,
        posted: 0,
        failed: 0,
        cancelled: 0
      }
      
      data?.forEach(item => {
        counts[item.status]++
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock className="h-4 w-4 text-gray-400 dark:text-dark-500" />
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 dark:text-blue-400 animate-spin" />
      case 'posted':
        return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-400 dark:text-dark-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    const classes = {
      queued: 'status-neutral',
      processing: 'status-warning',
      posted: 'status-active',
      failed: 'status-error',
      cancelled: 'status-neutral'
    }
    
    return (
      <span className={classes[status as keyof typeof classes]}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Posts</h1>
          <p className="page-description">
            Manage content distribution campaigns
          </p>
        </div>
        
        <div className="flex gap-3">
          <Link href="/assets" className="btn-secondary">
            Browse Assets
          </Link>
          <button className="btn-primary">
            <Play className="h-4 w-4 mr-2" />
            Launch Daily Campaign
          </button>
        </div>
      </div>

      {params.action === 'launch' && (
        <div className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30">
          <div className="flex items-start">
            <Send className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Launch Daily Campaign
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-400/80 mt-1">
                This will automatically pair unused assets with all active profiles and create posts.
              </p>
              <button className="btn-primary mt-3">
                Confirm Launch
              </button>
            </div>
          </div>
        </div>
      )}

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

      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg dark:bg-dark-850 dark:border-dark-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
          <thead className="bg-gray-50 dark:bg-dark-800">
            <tr>
              <th scope="col" className="table-header">
                Post
              </th>
              <th scope="col" className="table-header">
                Account
              </th>
              <th scope="col" className="table-header">
                Status
              </th>
              <th scope="col" className="table-header">
                Created
              </th>
              <th scope="col" className="table-header">
                Posted
              </th>
              <th scope="col" className="table-header">
                TikTok ID
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-dark-700 dark:bg-dark-850">
            {posts.map((post) => (
              <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                <td className="table-cell">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-dark-100">
                      {post.asset_path.replace('.mp4', '')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-dark-400 truncate max-w-xs">
                      {post.caption}
                    </p>
                  </div>
                </td>
                <td className="table-cell">
                  {post.account ? (
                    <Link 
                      href={`/profiles/${post.account.id}`}
                      className="text-sm text-gray-900 hover:text-gray-700 dark:text-dark-100 dark:hover:text-dark-200"
                    >
                      {post.account.tiktok_username || 'Unnamed'}
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-dark-500">Unknown</span>
                  )}
                </td>
                <td className="table-cell">
                  <div className="flex items-center">
                    {getStatusIcon(post.status)}
                    <span className="ml-2">{getStatusBadge(post.status)}</span>
                  </div>
                </td>
                <td className="table-cell text-sm text-gray-500 dark:text-dark-400">
                  {formatRelativeTime(post.created_at)}
                </td>
                <td className="table-cell text-sm text-gray-500 dark:text-dark-400">
                  {post.posted_at ? formatRelativeTime(post.posted_at) : '—'}
                </td>
                <td className="table-cell">
                  {post.tiktok_post_id ? (
                    <a
                      href={`https://www.tiktok.com/@${post.account?.tiktok_username}/video/${post.tiktok_post_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-mono"
                    >
                      {post.tiktok_post_id.slice(-8)}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-dark-500">—</span>
                  )}
                </td>
                <td className="relative whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  {post.status === 'failed' && post.retry_count < 3 && (
                    <button className="text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100">
                      Retry
                    </button>
                  )}
                  {post.status === 'queued' && (
                    <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500 dark:text-dark-400">
                  No posts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}