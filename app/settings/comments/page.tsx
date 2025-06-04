'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useNotification } from '@/lib/context/notification-context'

interface Comment {
  id: string
  content: string
  category: string
  is_active: boolean
  usage_count: number
  created_at: string
}

export default function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [category, setCategory] = useState('general')
  const { notify } = useNotification()
  const supabase = createClient()

  useEffect(() => {
    fetchComments()
  }, [])

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('Error fetching comments:', error)
      notify('error', 'Failed to load comments')
    } finally {
      setLoading(false)
    }
  }

  const addComment = async () => {
    if (!newComment.trim()) return

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          content: newComment.trim(),
          category
        })

      if (error) throw error

      notify('success', 'Comment added successfully')
      setNewComment('')
      fetchComments()
    } catch (error) {
      console.error('Error adding comment:', error)
      notify('error', 'Failed to add comment')
    }
  }

  const toggleComment = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('comments')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error

      notify('success', `Comment ${!currentStatus ? 'enabled' : 'disabled'}`)
      fetchComments()
    } catch (error) {
      console.error('Error toggling comment:', error)
      notify('error', 'Failed to update comment')
    }
  }

  const deleteComment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', id)

      if (error) throw error

      notify('success', 'Comment deleted successfully')
      fetchComments()
    } catch (error) {
      console.error('Error deleting comment:', error)
      notify('error', 'Failed to delete comment')
    }
  }

  const categoryColors: Record<string, string> = {
    positive: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    emoji: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    casual: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    supportive: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    question: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    mixed: 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400',
    general: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100 flex items-center gap-2">
          <MessageCircle className="h-6 w-6" />
          Comments Pool
        </h1>
        <p className="text-gray-600 dark:text-dark-400 mt-2">
          Manage the pool of comments used for TikTok engagement
        </p>
      </div>

      {/* Add new comment */}
      <div className="bg-white dark:bg-dark-850 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Add New Comment</h2>
        <div className="flex gap-4">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Enter comment text..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-gray-900 focus:border-gray-900 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100"
            onKeyPress={(e) => e.key === 'Enter' && addComment()}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-gray-900 focus:border-gray-900 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100"
          >
            <option value="general">General</option>
            <option value="positive">Positive</option>
            <option value="emoji">Emoji</option>
            <option value="casual">Casual</option>
            <option value="supportive">Supportive</option>
            <option value="question">Question</option>
            <option value="mixed">Mixed</option>
          </select>
          <button
            onClick={addComment}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="bg-white dark:bg-dark-850 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-lg font-semibold">
            Comments ({comments.filter(c => c.is_active).length} active / {comments.length} total)
          </h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No comments yet</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-dark-700">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className={`p-4 flex items-center justify-between ${
                  !comment.is_active ? 'opacity-50' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-gray-900 dark:text-dark-100">{comment.content}</p>
                    <span className={`px-2 py-1 text-xs rounded-full ${categoryColors[comment.category]}`}>
                      {comment.category}
                    </span>
                    {comment.usage_count > 0 && (
                      <span className="text-xs text-gray-500 dark:text-dark-400">
                        Used {comment.usage_count} times
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleComment(comment.id, comment.is_active)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-md transition-colors"
                    title={comment.is_active ? 'Disable' : 'Enable'}
                  >
                    {comment.is_active ? (
                      <ToggleRight className="h-5 w-5 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteComment(comment.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 