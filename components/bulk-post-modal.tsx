'use client'

import { useState, useEffect } from 'react'
import { X, Tag, Users, Play, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useNotification } from '@/lib/context/notification-context'
import AssetSelectorModal from '@/components/asset-selector-modal'
import { StorageAsset } from '@/lib/services/storage-service'

interface BulkPostModalProps {
  isOpen: boolean
  onClose: () => void
  onPostsLaunched?: (phoneIds: string[], assetType: string) => void
}

export default function BulkPostModal({ isOpen, onClose, onPostsLaunched }: BulkPostModalProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [selectedAsset, setSelectedAsset] = useState<StorageAsset | null>(null)
  const [showAssetSelector, setShowAssetSelector] = useState(false)
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [matchingProfiles, setMatchingProfiles] = useState(0)
  const [isPosting, setIsPosting] = useState(false)
  
  const supabase = createClient()
  const { notify } = useNotification()

  useEffect(() => {
    if (isOpen) {
      loadAvailableTags()
    }
  }, [isOpen])

  useEffect(() => {
    if (selectedTags.length > 0) {
      countMatchingProfiles()
    } else {
      setMatchingProfiles(0)
    }
  }, [selectedTags])

  const loadAvailableTags = async () => {
    const { data: phones } = await supabase
      .from('phones')
      .select('tags')
      .not('tags', 'is', null)

    const allTags = new Set<string>()
    phones?.forEach(phone => {
      if (Array.isArray(phone.tags)) {
        phone.tags.forEach(tag => allTags.add(tag))
      }
    })
    
    setAvailableTags(Array.from(allTags).sort())
  }

  const countMatchingProfiles = async () => {
    const { data: phones } = await supabase
      .from('phones')
      .select('account_id, tags')
      .not('tags', 'is', null)

    const matchingAccountIds = (phones || [])
      .filter(p => Array.isArray(p.tags) && p.tags.some((t: string) => selectedTags.includes(t)))
      .map(p => p.account_id)

    const { count } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .in('id', matchingAccountIds)
      .eq('status', 'active')
      .eq('ready_for_actions', true)

    setMatchingProfiles(count || 0)
  }

  const handleSelectAsset = (assets: StorageAsset[]) => {
    setSelectedAsset(assets[0])
    setShowAssetSelector(false)
  }

  const handlePost = async () => {
    if (!selectedAsset || selectedTags.length === 0) return

    setIsPosting(true)
    
    try {
      // Get matching profiles
      const { data: phones } = await supabase
        .from('phones')
        .select('account_id, tags')
        .not('tags', 'is', null)

      const matchingAccountIds = (phones || [])
        .filter(p => Array.isArray(p.tags) && p.tags.some((t: string) => selectedTags.includes(t)))
        .map(p => p.account_id)

      const { data: profiles } = await supabase
        .from('accounts')
        .select('*')
        .in('id', matchingAccountIds)
        .eq('status', 'active')
        .eq('ready_for_actions', true)

      if (!profiles || profiles.length === 0) {
        throw new Error('No matching profiles found')
      }

      const hashtagsArray = hashtags
        .split(/[,\s]+/)
        .filter(tag => tag.length > 0)
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)

      // Create posts
      let successCount = 0
      let failCount = 0

      for (const profile of profiles) {
        try {
          let response
          
          if (selectedAsset.type === 'video') {
            response = await fetch('/api/geelark/post-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                account_id: profile.id,
                video_url: selectedAsset.url,
                caption: caption || '',
                hashtags: hashtagsArray
              })
            })
          } else if (selectedAsset.type === 'carousel') {
            const images = selectedAsset.children?.map(child => child.url) || []
            response = await fetch('/api/geelark/post-carousel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                account_id: profile.id,
                images,
                caption: caption || '',
                hashtags: hashtagsArray
              })
            })
          }

          if (response?.ok) {
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          failCount++
        }
      }

      notify('success', `Bulk post launched: ${successCount + failCount} posts initiated`)
      
      // Trigger the status tracker with phone IDs and asset type
      const phoneIds = profiles.map(p => p.id)
      onPostsLaunched?.(phoneIds, selectedAsset.type)
      
      if (successCount > 0) {
        onClose()
      }
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Failed to create posts')
    } finally {
      setIsPosting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-dark-850 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
                Bulk Post by Tags
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step 1: Select Asset */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gray-900 dark:bg-dark-100 text-white dark:text-dark-900 text-xs flex items-center justify-center">1</span>
                Select Asset
              </h3>
              {selectedAsset ? (
                <div className="p-4 bg-gray-50 dark:bg-dark-800 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedAsset.type === 'carousel' && selectedAsset.children?.[0] && (
                      <img 
                        src={selectedAsset.children[0].thumbnailUrl || selectedAsset.children[0].url}
                        alt=""
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-dark-100">{selectedAsset.name}</p>
                      <p className="text-sm text-gray-500 dark:text-dark-400">
                        {selectedAsset.type === 'carousel' ? `Carousel (${selectedAsset.children?.length || 0} images)` : 'Video'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAssetSelector(true)}
                    className="btn-secondary btn-sm"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAssetSelector(true)}
                  className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-dark-600 rounded-lg hover:border-gray-400 dark:hover:border-dark-500 transition-colors"
                >
                  <p className="text-gray-500 dark:text-dark-400">Click to select an asset</p>
                </button>
              )}
            </div>

            {/* Step 2: Select Tags */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gray-900 dark:bg-dark-100 text-white dark:text-dark-900 text-xs flex items-center justify-center">2</span>
                Select Target Tags
              </h3>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        if (selectedTags.includes(tag)) {
                          setSelectedTags(selectedTags.filter(t => t !== tag))
                        } else {
                          setSelectedTags([...selectedTags, tag])
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-dark-800 dark:text-dark-300 dark:hover:bg-dark-700'
                      }`}
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </button>
                  ))}
                </div>
                {selectedTags.length > 0 && (
                  <p className="text-sm text-gray-600 dark:text-dark-400">
                    <Users className="h-4 w-4 inline mr-1" />
                    {matchingProfiles} active profiles will receive this post
                  </p>
                )}
              </div>
            </div>

            {/* Step 3: Content Details */}
            <div className="mb-6 space-y-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-dark-300 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gray-900 dark:bg-dark-100 text-white dark:text-dark-900 text-xs flex items-center justify-center">3</span>
                Content Details (Optional)
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Caption
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                  className="input"
                  placeholder="Enter caption..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Hashtags
                </label>
                <input
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className="input"
                  placeholder="Enter hashtags separated by commas"
                />
              </div>
            </div>

            {/* Warning */}
            {selectedTags.length > 0 && matchingProfiles === 0 && (
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">No matching profiles</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    No active profiles have the selected tags. Try selecting different tags.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="btn-secondary"
                disabled={isPosting}
              >
                Cancel
              </button>
              <button
                onClick={handlePost}
                className="btn-primary"
                disabled={!selectedAsset || selectedTags.length === 0 || matchingProfiles === 0 || isPosting}
              >
                {isPosting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Posting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Post to {matchingProfiles} Profiles
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Selector Modal */}
      {showAssetSelector && (
        <AssetSelectorModal
          isOpen={showAssetSelector}
          onClose={() => setShowAssetSelector(false)}
          onSelect={handleSelectAsset}
          multiple={false}
          title="Select Asset for Bulk Post"
        />
      )}
    </>
  )
} 