'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Play, AlertCircle, CheckCircle, Users, Image as ImageIcon, Shuffle } from 'lucide-react'

interface BulkPostLauncherProps {
  onClose?: () => void
}

export default function BulkPostLauncher({ onClose }: BulkPostLauncherProps) {
  const [loading, setLoading] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [stats, setStats] = useState({
    availableVariants: 0,
    activeProfiles: 0,
    postsToCreate: 0
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')

  const supabase = createClient()

  const fetchStats = async () => {
    setLoading(true)
    try {
      // Get available carousel variants
      const { data: variants } = await supabase
        .from('carousel_variants')
        .select('id')
        .eq('status', 'ready')

      // Get active profiles
      const { data: profiles } = await supabase
        .from('accounts')
        .select('id')
        .eq('status', 'active')

      const availableVariants = variants?.length || 0
      const activeProfiles = profiles?.length || 0
      const postsToCreate = Math.min(availableVariants, activeProfiles)

      setStats({
        availableVariants,
        activeProfiles,
        postsToCreate
      })
    } catch (err) {
      setError('Failed to fetch campaign stats')
    } finally {
      setLoading(false)
    }
  }

  useState(() => {
    fetchStats()
  })

  const launchCampaign = async () => {
    if (stats.postsToCreate === 0) {
      setError('No posts can be created. Check available variants and active profiles.')
      return
    }

    setLaunching(true)
    setError('')
    setSuccess('')

    try {
      // Fetch available variants
      const { data: variants } = await supabase
        .from('carousel_variants')
        .select(`
          *,
          variant_slides (
            *
          )
        `)
        .eq('status', 'ready')
        .order('created_at', { ascending: true })
        .limit(stats.postsToCreate)

      // Fetch active profiles
      const { data: profiles } = await supabase
        .from('accounts')
        .select('*')
        .eq('status', 'active')
        .order('last_used', { ascending: true, nullsFirst: true })
        .limit(stats.postsToCreate)

      if (!variants || !profiles || variants.length === 0 || profiles.length === 0) {
        throw new Error('No available variants or profiles')
      }

      const hashtagsArray = hashtags
        .split(/[,\s]+/)
        .filter(tag => tag.length > 0)
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)

      // Create posts by pairing variants with profiles
      const results = await Promise.allSettled(
        variants.slice(0, profiles.length).map(async (variant, index) => {
          const profile = profiles[index]
          
          // Get image URLs from variant slides
          const images = variant.variant_slides
            ?.sort((a: any, b: any) => a.slide_order - b.slide_order)
            .map((slide: any) => slide.image_url) || []

          if (images.length === 0) {
            throw new Error('No images found in variant')
          }

          // Post to TikTok
          const response = await fetch('/api/geelark/post-carousel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account_id: profile.id,
              images,
              caption: caption || `Check out this amazing content! Variant ${variant.variant_index + 1}`,
              hashtags: hashtagsArray
            })
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to post')
          }

          // Update variant status
          await supabase
            .from('carousel_variants')
            .update({
              status: 'assigned',
              assigned_profile_id: profile.geelark_profile_id,
              assigned_at: new Date().toISOString()
            })
            .eq('id', variant.id)

          // Update profile last used
          await supabase
            .from('accounts')
            .update({
              last_used: new Date().toISOString()
            })
            .eq('id', profile.id)

          return { variant: variant.id, profile: profile.id }
        })
      )

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      setSuccess(`Campaign launched! ${successful} posts created${failed > 0 ? `, ${failed} failed` : ''}`)
      
      // Refresh stats
      await fetchStats()

      if (onClose) {
        setTimeout(onClose, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch campaign')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="card">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Play className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
              Launch Daily Campaign
            </h3>
            <p className="text-sm text-gray-600 dark:text-dark-400">
              Automatically pair available assets with active profiles
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-dark-100 mx-auto"></div>
            <p className="text-sm text-gray-500 dark:text-dark-400 mt-2">Loading campaign stats...</p>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                <ImageIcon className="h-8 w-8 text-gray-400 dark:text-dark-500 mx-auto mb-2" />
                <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
                  {stats.availableVariants}
                </p>
                <p className="text-sm text-gray-600 dark:text-dark-400">Available Variants</p>
              </div>
              
              <div className="text-center p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                <Users className="h-8 w-8 text-gray-400 dark:text-dark-500 mx-auto mb-2" />
                <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
                  {stats.activeProfiles}
                </p>
                <p className="text-sm text-gray-600 dark:text-dark-400">Active Profiles</p>
              </div>
              
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <Shuffle className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                  {stats.postsToCreate}
                </p>
                <p className="text-sm text-gray-600 dark:text-dark-400">Posts to Create</p>
              </div>
            </div>

            {/* Campaign Settings */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  Default Caption (Optional)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                  className="input"
                  placeholder="Leave empty to use auto-generated captions"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  Hashtags (Optional)
                </label>
                <input
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className="input"
                  placeholder="Enter hashtags separated by commas or spaces"
                />
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>How it works:</strong> This will pair {stats.postsToCreate} available carousel variants 
                with active profiles, prioritizing profiles that haven't posted recently. Each profile will 
                receive one unique variant.
              </p>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-4">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              {onClose && (
                <button
                  onClick={onClose}
                  className="btn-secondary"
                  disabled={launching}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={launchCampaign}
                className="btn-primary"
                disabled={launching || stats.postsToCreate === 0}
              >
                {launching ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Launching Campaign...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Launch {stats.postsToCreate} Posts
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
} 