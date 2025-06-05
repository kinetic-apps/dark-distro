'use client'

import { useState, useEffect } from 'react'
import { 
  Play, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  Smartphone,
  Image as ImageIcon,
  Video,
  Layers,
  Plus,
  Send,
  AlertCircle,
  Filter,
  Search,
  Users,
  X
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatRelativeTime } from '@/lib/utils'
import { StorageService, StorageAsset } from '@/lib/services/storage-service'
import AssetSelectorModal from '@/components/asset-selector-modal'
import { createClient } from '@/lib/supabase/client'
import BulkPostModal from '@/components/bulk-post-modal'

interface CloudPhone {
  id: string
  geelark_profile_id: string
  tiktok_username: string | null
  status: string
  ready_for_actions: boolean
  last_used: string | null
  phone?: {
    profile_id: string
    status: string
    device_model: string
    android_version: string
    country: string
    last_heartbeat: string
  }
}

interface Post {
  id: string
  type: string
  caption: string | null
  content: any
  status: string
  created_at: string
  posted_at: string | null
  tiktok_post_id: string | null
  account: {
    id: string
    tiktok_username: string | null
    geelark_profile_id: string | null
  } | null
}

interface PostsPageClientProps {
  cloudPhones: CloudPhone[]
  recentPosts: Post[]
}

interface PostAssignment {
  phone: CloudPhone
  asset: StorageAsset
  caption?: string
  hashtags?: string[]
}

export default function PostsPageClient({ cloudPhones, recentPosts }: PostsPageClientProps) {
  const [showAssetSelector, setShowAssetSelector] = useState(false)
  const [showBulkPostLauncher, setShowBulkPostLauncher] = useState(false)
  const [selectedPhone, setSelectedPhone] = useState<CloudPhone | null>(null)
  const [postAssignments, setPostAssignments] = useState<PostAssignment[]>([])
  const [isPosting, setIsPosting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'ready'>('ready')
  const [assetStats, setAssetStats] = useState({ ready: 0, used: 0, archived: 0, totalSize: 0 })
  
  const router = useRouter()
  const supabase = createClient()
  const storageService = StorageService.getInstance()

  useEffect(() => {
    loadAssetStats()
    // Initialize storage folders on first load
    storageService.initializeFolders()
  }, [])

  const loadAssetStats = async () => {
    const stats = await storageService.getAssetStats()
    setAssetStats(stats)
  }

  const handleSelectAssets = (assets: StorageAsset[]) => {
    if (!selectedPhone) return
    
    // Add new assignments
    const newAssignments = assets.map(asset => ({
      phone: selectedPhone,
      asset,
      caption: '',
      hashtags: []
    }))
    
    setPostAssignments([...postAssignments, ...newAssignments])
    setSelectedPhone(null)
  }

  const removeAssignment = (index: number) => {
    setPostAssignments(postAssignments.filter((_, i) => i !== index))
  }

  const updateAssignment = (index: number, updates: Partial<PostAssignment>) => {
    const updated = [...postAssignments]
    updated[index] = { ...updated[index], ...updates }
    setPostAssignments(updated)
  }

  const createPosts = async () => {
    if (postAssignments.length === 0) return
    
    setIsPosting(true)
    const results = []
    
    for (const assignment of postAssignments) {
      try {
        let response
        
        if (assignment.asset.type === 'video') {
          // Post video
          response = await fetch('/api/geelark/post-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account_id: assignment.phone.id,
              video_url: assignment.asset.url,
              caption: assignment.caption || '',
              hashtags: assignment.hashtags || []
            })
          })
        } else if (assignment.asset.type === 'carousel') {
          // Post carousel
          const images = assignment.asset.children?.map(child => child.url) || []
          response = await fetch('/api/geelark/post-carousel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account_id: assignment.phone.id,
              images,
              caption: assignment.caption || '',
              hashtags: assignment.hashtags || []
            })
          })
        }
        
        if (response?.ok) {
          const data = await response.json()
          
          // Track the post
          await storageService.trackUsage(
            assignment.asset.path,
            assignment.asset.type,
            'posted',
            assignment.phone.id,
            data.postId, // Assuming the API returns a post ID
            {
              caption: assignment.caption,
              hashtags: assignment.hashtags
            }
          )
          
          // Move asset to used folder
          await storageService.moveAsset(assignment.asset, StorageService.FOLDERS.USED)
          results.push({ success: true, assignment })
        } else {
          const error = await response?.json()
          results.push({ success: false, assignment, error: error?.error })
        }
      } catch (error) {
        results.push({ success: false, assignment, error: String(error) })
      }
    }
    
    // Clear successful assignments
    const failedAssignments = results
      .filter(r => !r.success)
      .map(r => r.assignment)
    
    setPostAssignments(failedAssignments)
    setIsPosting(false)
    
    // Refresh stats and page
    loadAssetStats()
    router.refresh()
  }

  const filteredPhones = cloudPhones.filter(phone => {
    // Apply status filter
    if (filterStatus === 'active' && phone.status !== 'active') return false
    if (filterStatus === 'ready' && !phone.ready_for_actions) return false
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        phone.tiktok_username?.toLowerCase().includes(query) ||
        phone.geelark_profile_id.toLowerCase().includes(query) ||
        phone.phone?.device_model?.toLowerCase().includes(query)
      )
    }
    
    return true
  })

  const getPhoneStatusColor = (phone: CloudPhone) => {
    if (!phone.ready_for_actions) return 'text-gray-400'
    if (phone.status === 'active') return 'text-green-500'
    if (phone.status === 'warming_up') return 'text-yellow-500'
    return 'text-gray-400'
  }

  const getPhoneStatusIcon = (phone: CloudPhone) => {
    if (!phone.ready_for_actions) return <Clock className="h-4 w-4" />
    if (phone.status === 'active') return <CheckCircle className="h-4 w-4" />
    if (phone.status === 'warming_up') return <RefreshCw className="h-4 w-4 animate-spin" />
    return <AlertCircle className="h-4 w-4" />
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Content Distribution</h1>
            <p className="page-description">
              Pair assets from storage with cloud phones to create posts
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Asset Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-dark-400">
                  {assetStats.ready} ready
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-dark-400">
                  {assetStats.used} used
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-gray-600 dark:text-dark-400">
                  {assetStats.archived} archived
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => router.push('/assets')}
              className="btn-secondary"
            >
              Manage Assets
            </button>
            <button 
              onClick={() => setShowBulkPostLauncher(true)}
              className="btn-primary"
            >
              <Users className="h-4 w-4 mr-2" />
              Bulk Post
            </button>
          </div>
        </div>

        {/* Post Assignments */}
        {postAssignments.length > 0 && (
          <div className="card">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                  Pending Assignments ({postAssignments.length})
                </h3>
                <button
                  onClick={createPosts}
                  disabled={isPosting}
                  className="btn-primary"
                >
                  {isPosting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating Posts...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Create All Posts
                    </>
                  )}
                </button>
              </div>
              
              <div className="space-y-3">
                {postAssignments.map((assignment, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                    {/* Asset Preview */}
                    <div className="w-20 h-20 bg-gray-200 dark:bg-dark-700 rounded-lg overflow-hidden flex-shrink-0">
                      {assignment.asset.type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="h-8 w-8 text-gray-400" />
                        </div>
                      ) : assignment.asset.type === 'carousel' && assignment.asset.children?.[0] ? (
                        <img 
                          src={assignment.asset.children[0].thumbnailUrl || assignment.asset.children[0].url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                    
                    {/* Assignment Details */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-dark-100">
                          {assignment.phone.tiktok_username || assignment.phone.geelark_profile_id}
                        </span>
                        <span className="text-gray-400">→</span>
                        {assignment.asset.type === 'video' ? (
                          <Video className="h-4 w-4 text-purple-500" />
                        ) : (
                          <Layers className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="text-sm text-gray-600 dark:text-dark-400">
                          {assignment.asset.name}
                        </span>
                      </div>
                      
                      {/* Caption Input */}
                      <input
                        type="text"
                        placeholder="Add caption (optional)"
                        value={assignment.caption}
                        onChange={(e) => updateAssignment(index, { caption: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-dark-600 rounded-md focus:ring-2 focus:ring-gray-900 dark:focus:ring-dark-100 dark:bg-dark-800"
                      />
                    </div>
                    
                    {/* Remove Button */}
                    <button
                      onClick={() => removeAssignment(index)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Cloud Phones Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
              Cloud Phones ({filteredPhones.length})
            </h2>
            
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search phones..."
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-gray-900 dark:focus:ring-dark-100 dark:bg-dark-800 text-sm"
                />
              </div>
              
              {/* Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-gray-900 dark:focus:ring-dark-100 dark:bg-dark-800 text-sm"
              >
                <option value="all">All Phones</option>
                <option value="active">Active Only</option>
                <option value="ready">Ready Only</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPhones.map((phone) => (
              <div
                key={phone.id}
                className="card hover:shadow-lg transition-shadow"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-dark-100">
                          {phone.tiktok_username || 'No username'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-dark-400">
                          {phone.geelark_profile_id}
                        </p>
                      </div>
                    </div>
                    <div className={getPhoneStatusColor(phone)}>
                      {getPhoneStatusIcon(phone)}
                    </div>
                  </div>
                  
                  {phone.phone && (
                    <div className="text-xs text-gray-500 dark:text-dark-400 space-y-1 mb-3">
                      <p>{phone.phone.device_model}</p>
                      <p>Android {phone.phone.android_version}</p>
                      <p>{phone.phone.country}</p>
                    </div>
                  )}
                  
                  {phone.last_used && (
                    <p className="text-xs text-gray-400 dark:text-dark-500 mb-3">
                      Last used {formatRelativeTime(phone.last_used)}
                    </p>
                  )}
                  
                  <button
                    onClick={() => {
                      setSelectedPhone(phone)
                      setShowAssetSelector(true)
                    }}
                    disabled={!phone.ready_for_actions}
                    className="w-full btn-primary text-sm"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Assign Asset
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Posts */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">
            Recent Posts
          </h2>
          
          <div className="card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                <thead className="bg-gray-50 dark:bg-dark-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                      Post
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                      Account
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-dark-850 divide-y divide-gray-200 dark:divide-dark-700">
                  {recentPosts.map((post) => (
                    <tr key={post.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {post.type === 'video' ? (
                            <Video className="h-4 w-4 text-purple-500" />
                          ) : post.type === 'carousel' ? (
                            <Layers className="h-4 w-4 text-blue-500" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-green-500" />
                          )}
                          <span className="text-sm text-gray-900 dark:text-dark-100">
                            {post.type === 'carousel' ? `Carousel (${post.content?.images_count || 0} images)` : post.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-dark-400">
                        {post.account?.tiktok_username || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          post.status === 'posted' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          post.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                          post.status === 'processing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {post.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-dark-400">
                        {formatRelativeTime(post.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Selector Modal */}
      {showAssetSelector && selectedPhone && (
        <AssetSelectorModal
          isOpen={showAssetSelector}
          onClose={() => {
            setShowAssetSelector(false)
            setSelectedPhone(null)
          }}
          onSelect={handleSelectAssets}
          multiple={true}
          title={`Select Assets for ${selectedPhone?.tiktok_username || selectedPhone?.geelark_profile_id}`}
        />
      )}

      {/* Bulk Post Launcher Modal */}
      <BulkPostModal 
        isOpen={showBulkPostLauncher} 
        onClose={() => setShowBulkPostLauncher(false)} 
      />
    </>
  )
} 