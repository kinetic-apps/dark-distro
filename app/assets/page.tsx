'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { 
  Image as ImageIcon, 
  Play, 
  Send, 
  Download,
  Trash2,
  Filter,
  Grid,
  List
} from 'lucide-react'

interface Asset {
  name: string
  id: string
  updated_at: string
  created_at: string
  metadata: Record<string, any>
  signedUrl?: string
  manifest?: {
    caption: string
    hashtags: string[]
    duration: number
  }
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [filter, setFilter] = useState({
    tag: '',
    dateRange: 'all'
  })

  const supabase = createClient()

  useEffect(() => {
    fetchAssets()
  }, [filter])

  const fetchAssets = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .storage
      .from('ghostpost-outbox')
      .list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      console.error('Error fetching assets:', error)
      setLoading(false)
      return
    }

    // Filter out non-video files and fetch signed URLs
    const videoAssets = data.filter(file => 
      file.name.endsWith('.mp4') && 
      !file.name.startsWith('.')
    )

    // Get signed URLs for thumbnails/videos
    const assetsWithUrls = await Promise.all(
      videoAssets.map(async (asset) => {
        const { data: signedData } = await supabase
          .storage
          .from('ghostpost-outbox')
          .createSignedUrl(asset.name, 3600)

        // Try to fetch manifest
        const manifestName = asset.name.replace('.mp4', '_manifest.json')
        const { data: manifestData } = await supabase
          .storage
          .from('ghostpost-outbox')
          .download(manifestName)

        let manifest = null
        if (manifestData) {
          try {
            const text = await manifestData.text()
            manifest = JSON.parse(text)
          } catch (e) {
            console.error('Error parsing manifest:', e)
          }
        }

        return {
          ...asset,
          signedUrl: signedData?.signedUrl,
          manifest
        }
      })
    )

    setAssets(assetsWithUrls)
    setLoading(false)
  }

  const deleteAsset = async (assetName: string) => {
    const { error } = await supabase
      .storage
      .from('ghostpost-outbox')
      .remove([assetName])

    if (!error) {
      await fetchAssets()
    }
  }

  const postAsset = async (asset: Asset) => {
    // Navigate to posts page with asset pre-selected
    window.location.href = `/posts?asset=${encodeURIComponent(asset.name)}`
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-dark-100">Assets Library</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-dark-400">
            Videos from Ghostpost ready for posting
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
            className="btn-secondary"
          >
            {view === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </button>
          <button
            onClick={fetchAssets}
            className="btn-secondary"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Filter className="h-4 w-4 text-gray-400 dark:text-dark-500" />
        <select
          value={filter.dateRange}
          onChange={(e) => setFilter({ ...filter, dateRange: e.target.value })}
          className="select"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        <input
          type="text"
          placeholder="Filter by tag..."
          value={filter.tag}
          onChange={(e) => setFilter({ ...filter, tag: e.target.value })}
          className="input flex-1"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400 dark:text-dark-500">Loading assets...</div>
        </div>
      ) : assets.length === 0 ? (
        <div className="card text-center py-12">
          <ImageIcon className="h-12 w-12 text-gray-400 dark:text-dark-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-dark-400">No assets found</p>
          <p className="text-sm text-gray-400 dark:text-dark-500 mt-2">
            Upload videos to the ghostpost-outbox bucket to see them here
          </p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group relative bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer dark:bg-dark-850 dark:border-dark-700 dark:hover:shadow-xl"
              onClick={() => setSelectedAsset(asset)}
            >
              <div className="aspect-[9/16] bg-gray-100 dark:bg-dark-800 relative">
                {asset.signedUrl && (
                  <video
                    src={asset.signedUrl}
                    className="absolute inset-0 w-full h-full object-cover"
                    muted
                    playsInline
                  />
                )}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                  <Play className="h-12 w-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                  {asset.name.replace('.mp4', '')}
                </p>
                <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                  {formatFileSize(asset.metadata.size)} • {formatRelativeTime(asset.created_at)}
                </p>
                {asset.manifest && (
                  <p className="text-xs text-gray-400 dark:text-dark-500 mt-1 truncate">
                    {asset.manifest.caption}
                  </p>
                )}
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    postAsset(asset)
                  }}
                  className="bg-white dark:bg-dark-800 rounded-full p-2 shadow-lg hover:shadow-xl dark:hover:bg-dark-700 transition-colors"
                >
                  <Send className="h-4 w-4 text-gray-700 dark:text-dark-300" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg dark:bg-dark-850 dark:border-dark-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
            <thead className="bg-gray-50 dark:bg-dark-800">
              <tr>
                <th scope="col" className="table-header">Name</th>
                <th scope="col" className="table-header">Caption</th>
                <th scope="col" className="table-header">Size</th>
                <th scope="col" className="table-header">Uploaded</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-dark-700 dark:bg-dark-850">
              {assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                  <td className="table-cell">
                    <div className="flex items-center">
                      <ImageIcon className="h-5 w-5 text-gray-400 dark:text-dark-500 mr-3" />
                      <span className="font-medium text-gray-900 dark:text-dark-100">
                        {asset.name.replace('.mp4', '')}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="text-sm text-gray-600 dark:text-dark-300 truncate block max-w-xs">
                      {asset.manifest?.caption || '—'}
                    </span>
                  </td>
                  <td className="table-cell text-sm text-gray-500 dark:text-dark-400">
                    {formatFileSize(asset.metadata.size)}
                  </td>
                  <td className="table-cell text-sm text-gray-500 dark:text-dark-400">
                    {formatRelativeTime(asset.created_at)}
                  </td>
                  <td className="relative whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <button
                      onClick={() => postAsset(asset)}
                      className="text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100 mr-3"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteAsset(asset.name)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedAsset && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 dark:bg-black dark:bg-opacity-85 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedAsset(null)}
        >
          <div
            className="bg-white dark:bg-dark-850 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100">
                {selectedAsset.name.replace('.mp4', '')}
              </h3>
            </div>
            <div className="p-4 flex gap-4">
              <div className="flex-1">
                <video
                  src={selectedAsset.signedUrl}
                  controls
                  className="w-full rounded-lg"
                  style={{ maxHeight: '60vh' }}
                />
              </div>
              <div className="w-80 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">Details</h4>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-dark-400">Size</dt>
                      <dd className="text-sm text-gray-900 dark:text-dark-100">
                        {formatFileSize(selectedAsset.metadata.size)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-dark-400">Uploaded</dt>
                      <dd className="text-sm text-gray-900 dark:text-dark-100">
                        {formatDate(selectedAsset.created_at)}
                      </dd>
                    </div>
                    {selectedAsset.manifest && (
                      <>
                        <div>
                          <dt className="text-xs text-gray-500 dark:text-dark-400">Duration</dt>
                          <dd className="text-sm text-gray-900 dark:text-dark-100">
                            {selectedAsset.manifest.duration}s
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500 dark:text-dark-400">Caption</dt>
                          <dd className="text-sm text-gray-900 dark:text-dark-100">
                            {selectedAsset.manifest.caption}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500 dark:text-dark-400">Hashtags</dt>
                          <dd className="text-sm text-gray-900 dark:text-dark-100">
                            {selectedAsset.manifest.hashtags.join(' ')}
                          </dd>
                        </div>
                      </>
                    )}
                  </dl>
                </div>
                
                <div className="space-y-2">
                  <button
                    onClick={() => postAsset(selectedAsset)}
                    className="btn-primary w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Post to TikTok
                  </button>
                  <a
                    href={selectedAsset.signedUrl}
                    download={selectedAsset.name}
                    className="btn-secondary w-full flex items-center justify-center"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}