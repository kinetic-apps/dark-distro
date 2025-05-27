'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Send, AlertCircle, Users, User, Calendar, Music, Hash } from 'lucide-react'

interface PostContentModalProps {
  isOpen: boolean
  onClose: () => void
  contentType: 'video' | 'carousel'
  content?: {
    id?: string
    url?: string
    images?: string[]
    variant?: any
  }
  preSelectedAccounts?: string[]
}

export default function PostContentModal({ 
  isOpen, 
  onClose, 
  contentType,
  content,
  preSelectedAccounts = []
}: PostContentModalProps) {
  const [mode, setMode] = useState<'individual' | 'bulk'>('individual')
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(preSelectedAccounts)
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [musicUrl, setMusicUrl] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      fetchAccounts()
      setSelectedAccounts(preSelectedAccounts)
    }
  }, [isOpen, preSelectedAccounts])

  const fetchAccounts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*, phones(*)')
      .eq('status', 'active')
      .order('tiktok_username')

    setAccounts(data || [])
    setLoading(false)
  }

  const handlePost = async () => {
    if (selectedAccounts.length === 0) {
      setError('Please select at least one account')
      return
    }

    setPosting(true)
    setError('')
    setSuccess('')

    try {
      const hashtagsArray = hashtags
        .split(/[,\s]+/)
        .filter(tag => tag.length > 0)
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)

      const results = await Promise.allSettled(
        selectedAccounts.map(async (accountId) => {
          const endpoint = contentType === 'video' 
            ? '/api/geelark/post-video'
            : '/api/geelark/post-carousel'

          const body = contentType === 'video'
            ? {
                account_id: accountId,
                video_url: content?.url,
                caption,
                hashtags: hashtagsArray,
                music: musicUrl || undefined
              }
            : {
                account_id: accountId,
                images: content?.images || content?.variant?.slides?.map((s: any) => s.image_url) || [],
                caption,
                hashtags: hashtagsArray,
                music: musicUrl || undefined
              }

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error('Post failed:', errorData)
            throw new Error(errorData.error || `Failed to post (${response.status})`)
          }

          return await response.json()
        })
      )

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      if (successful > 0) {
        setSuccess(`Successfully initiated ${successful} post${successful > 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`)
        
        // Mark variant as assigned if posting carousel
        if (contentType === 'carousel' && content?.variant) {
          await supabase
            .from('carousel_variants')
            .update({ 
              status: 'assigned',
              assigned_at: new Date().toISOString()
            })
            .eq('id', content.variant.id)
        }

        setTimeout(() => {
          onClose()
          window.location.reload()
        }, 2000)
      } else {
        setError('All posts failed to initiate')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post content')
    } finally {
      setPosting(false)
    }
  }

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    )
  }

  const selectAllAccounts = () => {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([])
    } else {
      setSelectedAccounts(accounts.map(a => a.id))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-850 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
            Post {contentType === 'video' ? 'Video' : 'Carousel'} to TikTok
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Mode Selection */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('individual')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                mode === 'individual'
                  ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-800 dark:text-dark-400'
              }`}
            >
              <User className="h-4 w-4 inline mr-2" />
              Individual
            </button>
            <button
              onClick={() => setMode('bulk')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                mode === 'bulk'
                  ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-800 dark:text-dark-400'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Bulk
            </button>
          </div>

          {/* Account Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700 dark:text-dark-300">
                Select Accounts
              </label>
              {mode === 'bulk' && (
                <button
                  onClick={selectAllAccounts}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  {selectedAccounts.length === accounts.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            
            {loading ? (
              <div className="text-center py-4 text-gray-500">Loading accounts...</div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-dark-700 rounded-lg p-2">
                {accounts.map((account) => (
                  <label
                    key={account.id}
                    className={`flex items-center p-2 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-800 ${
                      mode === 'individual' && selectedAccounts.length > 0 && !selectedAccounts.includes(account.id)
                        ? 'opacity-50'
                        : ''
                    }`}
                  >
                    <input
                      type={mode === 'individual' ? 'radio' : 'checkbox'}
                      name="account"
                      checked={selectedAccounts.includes(account.id)}
                      onChange={() => {
                        if (mode === 'individual') {
                          setSelectedAccounts([account.id])
                        } else {
                          toggleAccount(account.id)
                        }
                      }}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                        {account.tiktok_username || 'Unnamed Account'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        {account.geelark_profile_id}
                      </p>
                    </div>
                    {account.phones?.[0]?.status === 'online' && (
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    )}
                  </label>
                ))}
              </div>
            )}
            {selectedAccounts.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-dark-400 mt-2">
                {selectedAccounts.length} account{selectedAccounts.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
              Caption
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className="input"
              placeholder="Enter your caption..."
            />
          </div>

          {/* Hashtags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
              <Hash className="h-4 w-4 inline mr-1" />
              Hashtags
            </label>
            <input
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              className="input"
              placeholder="Enter hashtags separated by commas or spaces"
            />
          </div>

          {/* Music URL (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
              <Music className="h-4 w-4 inline mr-1" />
              Music URL (Optional)
            </label>
            <input
              type="text"
              value={musicUrl}
              onChange={(e) => setMusicUrl(e.target.value)}
              className="input"
              placeholder="TikTok music URL"
            />
          </div>

          {/* Schedule (Future Enhancement) */}
          {false && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Schedule (Optional)
              </label>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="input"
              />
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Send className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-dark-700">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={posting}
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            className="btn-primary"
            disabled={posting || selectedAccounts.length === 0}
          >
            {posting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Posting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Post to TikTok
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
} 