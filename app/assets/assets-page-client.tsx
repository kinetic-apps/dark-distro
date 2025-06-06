'use client'

import { useState, useEffect } from 'react'
import { 
  Upload, 
  Folder, 
  FolderOpen,
  Video,
  Image as ImageIcon,
  Layers,
  Search,
  Filter,
  Grid,
  List,
  Download,
  Trash2,
  Archive,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Eye,
  Move,
  X,
  BarChart3
} from 'lucide-react'
import { StorageService, StorageAsset } from '@/lib/services/storage-service'
import { formatBytes, formatRelativeTime } from '@/lib/utils'
import AssetSelectorModal from '@/components/asset-selector-modal'
import EnhancedUploadModal from '@/components/enhanced-upload-modal'
import VideoThumbnail from '@/components/ui/video-thumbnail'
import { createClient } from '@/lib/supabase/client'

type AssetFolder = 'ready' | 'used' | 'archived'

interface AssetStats {
  ready: number
  used: number
  archived: number
  totalSize: number
}

export default function AssetsPageClient() {
  const [assets, setAssets] = useState<StorageAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolder, setSelectedFolder] = useState<AssetFolder>('ready')
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [showPreview, setShowPreview] = useState<StorageAsset | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [stats, setStats] = useState<AssetStats>({ ready: 0, used: 0, archived: 0, totalSize: 0 })
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set())
  const [assetUsageStats, setAssetUsageStats] = useState<Record<string, any>>({})
  const [showAnalytics, setShowAnalytics] = useState(false)
  
  const storageService = StorageService.getInstance()
  const supabase = createClient()

  useEffect(() => {
    // Initialize storage folders on first load
    storageService.initializeFolders()
  }, [])

  useEffect(() => {
    loadAssets()
    loadStats()
  }, [selectedFolder])

  useEffect(() => {
    // Load usage stats for visible assets
    if (assets.length > 0) {
      loadUsageStats(assets)
    }
  }, [assets])

  const loadAssets = async () => {
    setLoading(true)
    try {
      const folderPath = StorageService.FOLDERS[selectedFolder.toUpperCase() as keyof typeof StorageService.FOLDERS]
      const fetchedAssets = await storageService.listAssets(folderPath)
      setAssets(fetchedAssets)
    } catch (error) {
      console.error('Error loading assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    const fetchedStats = await storageService.getAssetStats()
    setStats(fetchedStats)
  }

  const loadUsageStats = async (assetsToLoad: StorageAsset[]) => {
    const statsMap: Record<string, any> = {}
    
    // Load stats for each asset
    const promises = assetsToLoad.slice(0, 20).map(async (asset) => {
      const stats = await storageService.getAssetUsageStats(asset.path)
      if (stats) {
        statsMap[asset.path] = stats
      }
    })
    
    await Promise.all(promises)
    setAssetUsageStats(statsMap)
  }

  const handleUpload = async (files: FileList) => {
    const uploadPromises = Array.from(files).map(async (file) => {
      // For now, we'll upload to the ready folder
      // In the future, we can add specific upload methods to StorageService
      const path = `${StorageService.FOLDERS.READY}/${file.name}`
      const { data, error } = await supabase.storage
        .from('generated-carousels')
        .upload(path, file, { upsert: true })
      
      if (error) {
        console.error('Upload error:', error)
      }
    })
    
    await Promise.all(uploadPromises)
    await loadAssets()
    await loadStats()
  }

  const handleDelete = async (asset: StorageAsset) => {
    if (!confirm(`Delete ${asset.name}? This action cannot be undone.`)) return
    
    await storageService.deleteAsset(asset)
    await loadAssets()
    await loadStats()
  }

  const handleMove = async (asset: StorageAsset, targetFolder: string) => {
    await storageService.moveAsset(asset, targetFolder)
    await loadAssets()
    await loadStats()
  }

  const handleBulkMove = async (targetFolder: string) => {
    const assetsToMove = assets.filter(a => selectedAssets.has(a.path))
    
    for (const asset of assetsToMove) {
      await storageService.moveAsset(asset, targetFolder)
    }
    
    setSelectedAssets(new Set())
    await loadAssets()
    await loadStats()
  }

  const toggleAssetSelection = (assetPath: string) => {
    const newSelection = new Set(selectedAssets)
    if (newSelection.has(assetPath)) {
      newSelection.delete(assetPath)
    } else {
      newSelection.add(assetPath)
    }
    setSelectedAssets(newSelection)
  }

  const toggleAssetExpansion = (assetPath: string) => {
    const newExpanded = new Set(expandedAssets)
    if (newExpanded.has(assetPath)) {
      newExpanded.delete(assetPath)
    } else {
      newExpanded.add(assetPath)
    }
    setExpandedAssets(newExpanded)
  }

  const filteredAssets = assets.filter(asset => {
    if (!searchQuery) return true
    return asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const getFolderIcon = (folder: AssetFolder) => {
    switch (folder) {
      case 'ready':
        return <Clock className="h-4 w-4 text-green-500" />
      case 'used':
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      case 'archived':
        return <Archive className="h-4 w-4 text-gray-400" />
    }
  }

  const getAssetIcon = (asset: StorageAsset) => {
    switch (asset.type) {
      case 'video':
        return <Video className="h-5 w-5 text-purple-500" />
      case 'carousel':
        return <Layers className="h-5 w-5 text-blue-500" />
      case 'image':
        return <ImageIcon className="h-5 w-5 text-green-500" />
      default:
        return <Folder className="h-5 w-5 text-gray-400" />
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Content Assets</h1>
            <p className="page-description">
              Manage your content assets stored in Supabase storage
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-primary"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Assets
            </button>
            
            <button
              onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
              className="btn-secondary"
            >
              {view === 'grid' ? (
                <>
                  <List className="h-4 w-4 mr-2" />
                  List View
                </>
              ) : (
                <>
                  <Grid className="h-4 w-4 mr-2" />
                  Grid View
                </>
              )}
            </button>
            
            <button
              onClick={() => {
                loadAssets()
                loadStats()
              }}
              className="btn-secondary"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stats Bar with Analytics Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Overview</h2>
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`btn-secondary text-sm ${showAnalytics ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900' : ''}`}
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              {showAnalytics ? 'Hide' : 'Show'} Analytics
            </button>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-dark-400">Total Assets</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
                  {stats.ready + stats.used + stats.archived}
                </p>
              </div>
              <Folder className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-dark-400">Ready</p>
                <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                  {stats.ready}
                </p>
              </div>
              <Clock className="h-8 w-8 text-green-500" />
            </div>
          </div>
          
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-dark-400">Used</p>
                <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
                  {stats.used}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-dark-400">Total Size</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
                  {formatBytes(stats.totalSize)}
                </p>
              </div>
              <Archive className="h-8 w-8 text-gray-400" />
            </div>
          </div>
        </div>
        
        {/* Analytics Section */}
        {showAnalytics && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-3">
              Asset Usage Analytics
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-dark-400">Most Posted Asset</p>
                <p className="font-medium text-gray-900 dark:text-dark-100">
                  {Object.entries(assetUsageStats)
                    .sort(([, a], [, b]) => (b.postCount || 0) - (a.postCount || 0))
                    .slice(0, 1)
                    .map(([path, stats]) => {
                      const asset = assets.find(a => a.path === path)
                      return asset ? `${asset.name} (${stats.postCount}x)` : 'N/A'
                    })[0] || 'No data yet'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-dark-400">Total Posts</p>
                <p className="font-medium text-gray-900 dark:text-dark-100">
                  {Object.values(assetUsageStats).reduce((sum, stats) => sum + (stats.postCount || 0), 0)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-dark-400">Assets Never Posted</p>
                <p className="font-medium text-gray-900 dark:text-dark-100">
                  {assets.filter(a => !assetUsageStats[a.path] || assetUsageStats[a.path].postCount === 0).length}
                </p>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Folder Tabs and Search */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {(['ready', 'used', 'archived'] as AssetFolder[]).map((folder) => (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  selectedFolder === folder
                    ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-dark-400 dark:hover:bg-dark-800'
                }`}
              >
                {getFolderIcon(folder)}
                <span className="capitalize">{folder}</span>
                <span className="text-sm opacity-60">
                  ({stats[folder]})
                </span>
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            {selectedAssets.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-dark-400">
                  {selectedAssets.size} selected
                </span>
                <button
                  onClick={() => handleBulkMove(StorageService.FOLDERS.ARCHIVED)}
                  className="btn-secondary text-sm"
                >
                  <Archive className="h-3.5 w-3.5 mr-1.5" />
                  Archive
                </button>
                {selectedFolder !== 'ready' && (
                  <button
                    onClick={() => handleBulkMove(StorageService.FOLDERS.READY)}
                    className="btn-secondary text-sm"
                  >
                    <Clock className="h-3.5 w-3.5 mr-1.5" />
                    Move to Ready
                  </button>
                )}
              </div>
            )}
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-gray-900 dark:focus:ring-dark-100 dark:bg-dark-800 dark:text-dark-100"
              />
            </div>
          </div>
        </div>

        {/* Assets Display */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="card text-center py-12">
            <FolderOpen className="h-12 w-12 text-gray-400 dark:text-dark-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-dark-400">
              {searchQuery ? 'No assets match your search' : `No assets in ${selectedFolder} folder`}
            </p>
          </div>
        ) : view === 'grid' ? (
          // Grid View
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredAssets.map((asset) => (
              <div
                key={asset.path}
                className={`card hover:shadow-lg transition-all cursor-pointer ${
                  selectedAssets.has(asset.path) ? 'ring-2 ring-gray-900 dark:ring-dark-100' : ''
                }`}
                onClick={() => toggleAssetSelection(asset.path)}
              >
                <div className="aspect-[9/16] bg-gray-100 dark:bg-dark-800 rounded-t-lg overflow-hidden relative">
                  {asset.type === 'video' ? (
                    <VideoThumbnail
                      videoUrl={asset.url}
                      className="w-full h-full"
                      width={300}
                      height={533} // 9:16 aspect ratio
                      showPlayIcon={true}
                      onClick={() => setShowPreview(asset)}
                    />
                  ) : asset.type === 'carousel' && asset.children?.[0] ? (
                    <img
                      src={asset.children[0].thumbnailUrl || asset.children[0].url}
                      alt={asset.name}
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setShowPreview(asset)}
                    />
                  ) : asset.type === 'image' ? (
                    <img
                      src={asset.thumbnailUrl || asset.url}
                      alt={asset.name}
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setShowPreview(asset)}
                    />
                  ) : null}
                  
                  {asset.type === 'carousel' && asset.children && (
                    <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                      {asset.children.length} slides
                    </div>
                  )}
                  
                  {asset.type === 'video' && (
                    <div className="absolute top-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <Video className="h-3 w-3" />
                      Video
                    </div>
                  )}
                </div>
                
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getAssetIcon(asset)}
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                        {asset.name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-400">
                    <span>{formatBytes(asset.size)}</span>
                    <span>{formatRelativeTime(asset.created_at)}</span>
                  </div>
                  
                  {/* Usage stats badge */}
                  {assetUsageStats[asset.path] && assetUsageStats[asset.path].postCount > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs">
                      <BarChart3 className="h-3 w-3 text-blue-500" />
                      <span className="text-blue-600 dark:text-blue-400">
                        Posted {assetUsageStats[asset.path].postCount}x
                      </span>
                    </div>
                  )}
                  
                  <div className="mt-3 flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowPreview(asset)
                      }}
                      className="btn-secondary text-xs flex-1"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMove(asset, selectedFolder === 'ready' ? StorageService.FOLDERS.USED : StorageService.FOLDERS.READY)
                      }}
                      className="btn-secondary text-xs flex-1"
                    >
                      <Move className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(asset)
                      }}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // List View
          <div className="space-y-2">
            {filteredAssets.map((asset) => (
              <div
                key={asset.path}
                className={`card hover:shadow-md transition-all ${
                  selectedAssets.has(asset.path) ? 'ring-2 ring-gray-900 dark:ring-dark-100' : ''
                }`}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedAssets.has(asset.path)}
                        onChange={() => toggleAssetSelection(asset.path)}
                        className="rounded border-gray-300 dark:border-dark-600"
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      {asset.type === 'carousel' ? (
                        <button
                          onClick={() => toggleAssetExpansion(asset.path)}
                          className="p-1"
                        >
                          {expandedAssets.has(asset.path) ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      ) : (
                        <div className="w-6" />
                      )}
                      
                      {/* Thumbnail preview */}
                      <div className="w-16 h-16 bg-gray-100 dark:bg-dark-800 rounded-lg overflow-hidden flex-shrink-0">
                        {asset.type === 'video' ? (
                          <VideoThumbnail
                            videoUrl={asset.url}
                            className="w-full h-full"
                            width={64}
                            height={64}
                            showPlayIcon={false}
                            onClick={() => setShowPreview(asset)}
                          />
                        ) : asset.type === 'carousel' && asset.children?.[0] ? (
                          <img
                            src={asset.children[0].thumbnailUrl || asset.children[0].url}
                            alt={asset.name}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setShowPreview(asset)}
                          />
                        ) : asset.type === 'image' ? (
                          <img
                            src={asset.thumbnailUrl || asset.url}
                            alt={asset.name}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setShowPreview(asset)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {getAssetIcon(asset)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-dark-100">
                          {asset.name}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-dark-400">
                          <span>{formatBytes(asset.size)}</span>
                          {asset.type === 'carousel' && asset.children && (
                            <span>{asset.children.length} slides</span>
                          )}
                          <span>{formatRelativeTime(asset.created_at)}</span>
                          {assetUsageStats[asset.path] && assetUsageStats[asset.path].postCount > 0 && (
                            <span className="text-blue-600 dark:text-blue-400">
                              • Posted {assetUsageStats[asset.path].postCount}x
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowPreview(asset)}
                        className="btn-secondary text-sm"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Preview
                      </button>
                      <button
                        onClick={() => handleMove(asset, selectedFolder === 'ready' ? StorageService.FOLDERS.USED : StorageService.FOLDERS.READY)}
                        className="btn-secondary text-sm"
                      >
                        <Move className="h-3.5 w-3.5 mr-1.5" />
                        Move
                      </button>
                      <button
                        onClick={() => handleDelete(asset)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Expanded carousel slides */}
                  {asset.type === 'carousel' && expandedAssets.has(asset.path) && asset.children && (
                    <div className="mt-4 grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                      {asset.children.map((slide, index) => (
                        <div key={slide.path} className="aspect-[9/16] bg-gray-100 dark:bg-dark-800 rounded overflow-hidden">
                          <img
                            src={slide.thumbnailUrl || slide.url}
                            alt={`Slide ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 dark:bg-black dark:bg-opacity-85 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPreview(null)}
        >
          <div
            className="bg-white dark:bg-dark-850 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100">
                Preview: {showPreview.name}
              </h3>
              <button
                onClick={() => setShowPreview(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-dark-400" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              {showPreview.type === 'video' ? (
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    src={showPreview.url}
                    controls
                    className="w-full h-full"
                  />
                </div>
              ) : showPreview.type === 'carousel' && showPreview.children ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {showPreview.children.map((slide, index) => (
                    <div key={slide.path} className="space-y-2">
                      <div className="aspect-[9/16] bg-gray-100 dark:bg-dark-800 rounded-lg overflow-hidden">
                        <img
                          src={slide.url}
                          alt={`Slide ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-center text-sm text-gray-600 dark:text-dark-400">
                        Slide {index + 1}
                      </p>
                    </div>
                  ))}
                </div>
              ) : showPreview.type === 'image' ? (
                <div className="flex justify-center">
                  <img
                    src={showPreview.url}
                    alt={showPreview.name}
                    className="max-w-full h-auto rounded-lg"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Upload Modal */}
      <EnhancedUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={() => {
          loadAssets()
          loadStats()
        }}
        targetFolder={StorageService.FOLDERS[selectedFolder.toUpperCase() as keyof typeof StorageService.FOLDERS]}
      />
    </>
  )
} 