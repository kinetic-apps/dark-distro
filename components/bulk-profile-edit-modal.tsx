'use client'

import { useState, useEffect } from 'react'
import { X, Upload, User, Globe, FileText, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface BulkProfileEditModalProps {
  profileIds: string[]
  profileCount: number
  onConfirm: (params: ProfileEditParams) => void
  onCancel: () => void
}

export interface ProfileEditParams {
  nickName?: string
  bio?: string
  site?: string
  avatar?: string
}

export function BulkProfileEditModal({
  profileIds,
  profileCount,
  onConfirm,
  onCancel
}: BulkProfileEditModalProps) {
  const [params, setParams] = useState<ProfileEditParams>({})
  const [avatarOptions, setAvatarOptions] = useState<string[]>([])
  const [loadingAvatars, setLoadingAvatars] = useState(true)
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)

  useEffect(() => {
    loadAvatarOptions()
  }, [])

  const loadAvatarOptions = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from('profile-pictures')
        .list('', {
          limit: 100,
          offset: 0
        })

      if (error) throw error

      const urls = data
        .filter(file => file.name !== '.emptyFolderPlaceholder')
        .map(file => {
          const { data: { publicUrl } } = supabase.storage
            .from('profile-pictures')
            .getPublicUrl(file.name)
          return publicUrl
        })

      setAvatarOptions(urls)
    } catch (error) {
      console.error('Error loading avatar options:', error)
    } finally {
      setLoadingAvatars(false)
    }
  }

  const handleConfirm = () => {
    const finalParams = { ...params }
    if (selectedAvatar) {
      finalParams.avatar = selectedAvatar
    }
    onConfirm(finalParams)
  }

  const hasAnyParams = () => {
    return params.nickName || params.bio || params.site || selectedAvatar
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-850 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
              Edit {profileCount} Profile{profileCount > 1 ? 's' : ''}
            </h2>
            <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
              Leave fields empty to keep existing values
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-500 dark:text-dark-500 dark:hover:text-dark-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Nickname */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
              <User className="h-4 w-4 inline mr-2" />
              Nickname
            </label>
            <input
              type="text"
              value={params.nickName || ''}
              onChange={(e) => setParams({ ...params, nickName: e.target.value })}
              placeholder="Enter nickname (max 50 characters)"
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100 dark:focus:ring-dark-400"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
              <FileText className="h-4 w-4 inline mr-2" />
              Bio
            </label>
            <textarea
              value={params.bio || ''}
              onChange={(e) => setParams({ ...params, bio: e.target.value })}
              placeholder="Enter bio (max 200 characters)"
              maxLength={200}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100 dark:focus:ring-dark-400"
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
              <Globe className="h-4 w-4 inline mr-2" />
              Website
            </label>
            <input
              type="url"
              value={params.site || ''}
              onChange={(e) => setParams({ ...params, site: e.target.value })}
              placeholder="https://example.com (max 100 characters)"
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100 dark:focus:ring-dark-400"
            />
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
              Must start with http:// or https://
            </p>
          </div>

          {/* Avatar Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
              <ImageIcon className="h-4 w-4 inline mr-2" />
              Profile Picture
            </label>
            
            {loadingAvatars ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-dark-100 mx-auto"></div>
                <p className="text-sm text-gray-500 dark:text-dark-400 mt-2">Loading avatar options...</p>
              </div>
            ) : avatarOptions.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-dark-600 rounded-lg">
                <Upload className="h-8 w-8 text-gray-400 dark:text-dark-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-dark-400">
                  No profile pictures available
                </p>
                <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">
                  Upload images to the profile-pictures bucket in Supabase
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 dark:text-dark-400 mb-2">
                  Note: Profile pictures should have a 1:1 aspect ratio (square) for best results
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-48 overflow-y-auto p-2 border border-gray-200 dark:border-dark-600 rounded-lg">
                  {avatarOptions.map((url, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedAvatar(url === selectedAvatar ? null : url)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedAvatar === url
                          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                          : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Avatar option ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {selectedAvatar === url && (
                        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                          <div className="bg-blue-500 text-white rounded-full p-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors dark:bg-dark-700 dark:text-dark-300 dark:hover:bg-dark-600"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!hasAnyParams()}
            className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-dark-100 dark:text-dark-900 dark:hover:bg-dark-200"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  )
} 