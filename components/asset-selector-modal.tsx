'use client'

import { useState, useEffect } from 'react'
import { StorageService, StorageAsset } from '@/lib/services/storage-service'
import { 
  X, 
  Search, 
  Image as ImageIcon, 
  Play, 
  Layers, 
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FolderOpen
} from 'lucide-react'
import { formatBytes } from '@/lib/utils'

interface AssetSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (assets: StorageAsset[]) => void
  multiple?: boolean
  assetTypes?: ('video' | 'carousel' | 'image')[]
  title?: string
}

export default function AssetSelectorModal({
  isOpen,
  onClose,
  onSelect,
  multiple = false,
  assetTypes = ['video', 'carousel', 'image'],
  title = 'Select Assets'
}: AssetSelectorModalProps) {
  const [assets, setAssets] = useState<StorageAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [currentFolder, setCurrentFolder] = useState(StorageService.FOLDERS.READY)
  const [previewAsset, setPreviewAsset] = useState<StorageAsset | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)

  const storageService = StorageService.getInstance()

  useEffect(() => {
    if (isOpen) {
      loadAssets()
    }
  }, [isOpen, currentFolder])

  const loadAssets = async () => {
    setLoading(true)
    try {
      const allAssets = await storageService.listAssets(currentFolder)
      // Filter by allowed asset types
      const filteredAssets = allAssets.filter(asset => assetTypes.includes(asset.type))
      setAssets(filteredAssets)
    } catch (error) {
      console.error('Error loading assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadAssets()
      return
    }

    setLoading(true)
    try {
      const results = await storageService.searchAssets(searchQuery, currentFolder)
      const filteredResults = results.filter(asset => assetTypes.includes(asset.type))
      setAssets(filteredResults)
    } catch (error) {
      console.error('Error searching assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleAssetSelection = (assetId: string) => {
    const newSelection = new Set(selectedAssets)
    
    if (multiple) {
      if (newSelection.has(assetId)) {
        newSelection.delete(assetId)
      } else {
        newSelection.add(assetId)
      }
    } else {
      // Single selection mode
      newSelection.clear()
      newSelection.add(assetId)
    }
    
    setSelectedAssets(newSelection)
  }

  const handleConfirm = () => {
    const selected = assets.filter(asset => selectedAssets.has(asset.id))
    onSelect(selected)
    onClose()
    setSelectedAssets(new Set())
  }

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Play className="h-5 w-5" />
      case 'carousel':
        return <Layers className="h-5 w-5" />
      default:
        return <ImageIcon className="h-5 w-5" />
    }
  }

  const getFolderName = (folder: string) => {
    switch (folder) {
      case StorageService.FOLDERS.READY:
        return 'Ready to Post'
      case StorageService.FOLDERS.USED:
        return 'Already Posted'
      case StorageService.FOLDERS.ARCHIVED:
        return 'Archived'
      default:
        return 'Assets'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
                {title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-dark-400 mt-1">
                {selectedAssets.size > 0 
                  ? `${selectedAssets.size} asset${selectedAssets.size > 1 ? 's' : ''} selected`
                  : `Select ${multiple ? 'one or more assets' : 'an asset'} to continue`
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500 dark:text-dark-400" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-4">
            {/* Folder Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentFolder(StorageService.FOLDERS.READY)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  currentFolder === StorageService.FOLDERS.READY
                    ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                    : 'text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100'
                }`}
              >
                Ready
              </button>
              <button
                onClick={() => setCurrentFolder(StorageService.FOLDERS.USED)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  currentFolder === StorageService.FOLDERS.USED
                    ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                    : 'text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100'
                }`}
              >
                Used
              </button>
              <button
                onClick={() => setCurrentFolder(StorageService.FOLDERS.ARCHIVED)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  currentFolder === StorageService.FOLDERS.ARCHIVED
                    ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                    : 'text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100'
                }`}
              >
                Archived
              </button>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search assets..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-gray-900 dark:focus:ring-dark-100 dark:bg-dark-800 dark:text-dark-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-dark-500" />
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-gray-300 dark:text-dark-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-dark-400">
                No assets found in {getFolderName(currentFolder)}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => toggleAssetSelection(asset.id)}
                  className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                    selectedAssets.has(asset.id)
                      ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20'
                      : 'border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
                  }`}
                >
                  {/* Selection indicator */}
                  {selectedAssets.has(asset.id) && (
                    <div className="absolute top-2 right-2 z-10 bg-blue-500 text-white rounded-full p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  )}

                  {/* Asset preview */}
                  <div className="aspect-square bg-gray-100 dark:bg-dark-800 relative">
                    {asset.type === 'video' ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play className="h-12 w-12 text-gray-400 dark:text-dark-500" />
                      </div>
                    ) : asset.type === 'carousel' && asset.children?.[0] ? (
                      <img
                        src={asset.children[0].thumbnailUrl || asset.children[0].url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : asset.type === 'image' ? (
                      <img
                        src={asset.thumbnailUrl || asset.url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : null}

                    {/* Carousel slide count */}
                    {asset.type === 'carousel' && (
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {asset.metadata.slideCount} slides
                      </div>
                    )}
                  </div>

                  {/* Asset info */}
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`text-gray-400 dark:text-dark-500 ${
                        asset.type === 'video' ? 'text-purple-500' :
                        asset.type === 'carousel' ? 'text-blue-500' :
                        'text-green-500'
                      }`}>
                        {getAssetIcon(asset.type)}
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                        {asset.name}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-dark-400">
                      {formatBytes(asset.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-dark-400">
              {assets.length} asset{assets.length !== 1 ? 's' : ''} in {getFolderName(currentFolder)}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedAssets.size === 0}
                className="btn-primary"
              >
                Select {selectedAssets.size > 0 ? `(${selectedAssets.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewAsset && previewAsset.type === 'carousel' && previewAsset.children && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60 p-4">
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setPreviewAsset(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            <div className="relative">
              <img
                src={previewAsset.children[currentSlide].url}
                alt={`Slide ${currentSlide + 1}`}
                className="w-full h-auto rounded-lg"
              />

              {/* Navigation */}
              {previewAsset.children.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                    disabled={currentSlide === 0}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="h-6 w-6 text-white" />
                  </button>
                  <button
                    onClick={() => setCurrentSlide(Math.min(previewAsset.children!.length - 1, currentSlide + 1))}
                    disabled={currentSlide === previewAsset.children.length - 1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50"
                  >
                    <ChevronRight className="h-6 w-6 text-white" />
                  </button>

                  {/* Slide indicators */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {previewAsset.children.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentSlide(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === currentSlide ? 'bg-white' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 