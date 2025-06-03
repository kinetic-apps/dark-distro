'use client'

import { useState } from 'react'
import { formatRelativeTime } from '@/lib/utils'
import { 
  CheckCircle, 
  XCircle, 
  Clock,
  RefreshCw,
  Trash2,
  Ban
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Post {
  id: string
  type: string
  caption: string | null
  content: any
  status: string
  created_at: string
  posted_at: string | null
  tiktok_post_id: string | null
  retry_count: number
  account: {
    id: string
    tiktok_username: string | null
    geelark_profile_id: string | null
  } | null
}

interface PostsTableProps {
  posts: Post[]
}

export default function PostsTable({ posts }: PostsTableProps) {
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPosts(new Set(posts.map(p => p.id)))
    } else {
      setSelectedPosts(new Set())
    }
  }

  const handleSelectPost = (postId: string, checked: boolean) => {
    const newSelected = new Set(selectedPosts)
    if (checked) {
      newSelected.add(postId)
    } else {
      newSelected.delete(postId)
    }
    setSelectedPosts(newSelected)
  }

  const handleCancel = async (postId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/posts/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      })
      
      if (response.ok) {
        router.refresh()
      } else {
        console.error('Failed to cancel post')
      }
    } catch (error) {
      console.error('Error cancelling post:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkAction = async (action: 'cancel' | 'delete') => {
    if (selectedPosts.size === 0) return
    
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${selectedPosts.size} post(s)?`
    )
    
    if (!confirmed) return
    
    setIsLoading(true)
    try {
      const response = await fetch('/api/posts/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          postIds: Array.from(selectedPosts),
          action 
        })
      })
      
      if (response.ok) {
        setSelectedPosts(new Set())
        router.refresh()
      } else {
        console.error(`Failed to ${action} posts`)
      }
    } catch (error) {
      console.error(`Error ${action}ing posts:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
      case 'pending':
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
      pending: 'status-neutral',
      processing: 'status-warning',
      posted: 'status-active',
      failed: 'status-error',
      cancelled: 'status-neutral'
    }
    
    return (
      <span className={classes[status as keyof typeof classes] || 'status-neutral'}>
        {status}
      </span>
    )
  }

  const canBeCancelled = (status: string) => ['queued', 'pending'].includes(status)
  const canBeDeleted = (status: string) => ['cancelled', 'failed'].includes(status)

  const selectedCancellable = Array.from(selectedPosts).some(id => {
    const post = posts.find(p => p.id === id)
    return post && canBeCancelled(post.status)
  })

  const selectedDeletable = Array.from(selectedPosts).some(id => {
    const post = posts.find(p => p.id === id)
    return post && canBeDeleted(post.status)
  })

  return (
    <div className="space-y-4">
      {selectedPosts.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
          <span className="text-sm text-gray-600 dark:text-dark-300">
            {selectedPosts.size} post(s) selected
          </span>
          {selectedCancellable && (
            <button
              onClick={() => handleBulkAction('cancel')}
              disabled={isLoading}
              className="btn-secondary text-sm"
            >
              <Ban className="h-3.5 w-3.5 mr-1.5" />
              Cancel Selected
            </button>
          )}
          {selectedDeletable && (
            <button
              onClick={() => handleBulkAction('delete')}
              disabled={isLoading}
              className="btn-secondary text-sm text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete Selected
            </button>
          )}
          <button
            onClick={() => setSelectedPosts(new Set())}
            className="ml-auto text-sm text-gray-500 hover:text-gray-700 dark:text-dark-400 dark:hover:text-dark-200"
          >
            Clear Selection
          </button>
        </div>
      )}

      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg dark:bg-dark-850 dark:border-dark-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
          <thead className="bg-gray-50 dark:bg-dark-800">
            <tr>
              <th scope="col" className="relative px-6 py-3">
                <input
                  type="checkbox"
                  checked={posts.length > 0 && selectedPosts.size === posts.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-100"
                />
              </th>
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
                <td className="relative px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedPosts.has(post.id)}
                    onChange={(e) => handleSelectPost(post.id, e.target.checked)}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-100"
                  />
                </td>
                <td className="table-cell">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-dark-100">
                      {post.type === 'carousel' ? `Carousel (${post.content?.images_count || 0} images)` : 
                       post.type === 'video' ? 'Video' : post.type}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-dark-400 truncate max-w-xs">
                      {post.caption || 'No caption'}
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
                    <button 
                      className="text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100"
                      disabled={isLoading}
                    >
                      Retry
                    </button>
                  )}
                  {canBeCancelled(post.status) && (
                    <button 
                      onClick={() => handleCancel(post.id)}
                      disabled={isLoading}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-500 dark:text-dark-400">
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