'use client'

import { useState } from 'react'
import { X, Heart, Hash } from 'lucide-react'

interface EngagementModalProps {
  profileIds: string[]
  profileCount: number
  onConfirm: (config: EngagementConfig) => void
  onCancel: () => void
}

export interface EngagementConfig {
  target_usernames: string[]
  posts_per_user: number
  like_only: boolean
}

export function EngagementModal({ profileIds, profileCount, onConfirm, onCancel }: EngagementModalProps) {
  const [usernames, setUsernames] = useState('')
  const [postsPerUser, setPostsPerUser] = useState(3)
  const [likeOnly, setLikeOnly] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const targetUsernames = usernames
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0)
      .map(u => u.replace('@', '')) // Remove @ if present
    
    if (targetUsernames.length === 0) {
      alert('Please enter at least one username')
      return
    }
    
    setIsProcessing(true)
    
    onConfirm({
      target_usernames: targetUsernames,
      posts_per_user: postsPerUser,
      like_only: likeOnly
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-850 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
              TikTok Engagement
            </h2>
            <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
              Configure engagement for {profileCount} selected profile{profileCount > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-500 dark:text-dark-500 dark:hover:text-dark-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {/* Target Usernames */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-200 mb-2">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Target Usernames
              </div>
            </label>
            <textarea
              value={usernames}
              onChange={(e) => setUsernames(e.target.value)}
              placeholder="Enter usernames, one per line (without @)&#10;Example:&#10;cristiano&#10;leomessi&#10;neymarjr"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-gray-900 focus:border-gray-900 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100 dark:focus:ring-dark-400 dark:focus:border-dark-400"
              rows={5}
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-dark-400">
              Enter TikTok usernames to engage with, one per line
            </p>
          </div>

          {/* Posts per User */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-200 mb-2">
              Posts per User
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={postsPerUser}
              onChange={(e) => setPostsPerUser(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-gray-900 focus:border-gray-900 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100 dark:focus:ring-dark-400 dark:focus:border-dark-400"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-dark-400">
              Number of posts to engage with per user (1-10)
            </p>
          </div>

          {/* Like Only Mode */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="likeOnly"
              checked={likeOnly}
              onChange={(e) => setLikeOnly(e.target.checked)}
              className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded dark:text-dark-100 dark:focus:ring-dark-400 dark:border-dark-600"
            />
            <label htmlFor="likeOnly" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-dark-200">
              <Heart className="h-4 w-4" />
              Like Only (no comments)
            </label>
          </div>
        </form>
        
        <div className="px-6 py-4 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className="btn-primary"
          >
            {isProcessing ? 'Starting...' : 'Start Engagement'}
          </button>
        </div>
      </div>
    </div>
  )
} 