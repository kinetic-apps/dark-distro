'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Mail, Shield, Zap, Info, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ProxySelector } from '@/components/proxy-selector'

interface TikTokCredentialsSetupModalProps {
  onClose: () => void
  onSuccess?: (accountId: string, profileId: string) => void
}

export function TikTokCredentialsSetupModal({ onClose, onSuccess }: TikTokCredentialsSetupModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [useExistingProfile, setUseExistingProfile] = useState(false)
  const [existingProfileId, setExistingProfileId] = useState('')
  const [profiles, setProfiles] = useState<any[]>([])
  const [deviceModel, setDeviceModel] = useState('Pixel 6')
  const [androidVersion, setAndroidVersion] = useState(3) // Android 12
  const [groupName, setGroupName] = useState('tiktok-credentials')
  const [warmupDuration, setWarmupDuration] = useState(30)
  const [warmupAction, setWarmupAction] = useState<'browse video' | 'search video' | 'search profile'>('browse video')
  const [warmupKeywords, setWarmupKeywords] = useState('')
  const [availableCredentials, setAvailableCredentials] = useState(0)
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | undefined>()
  
  // Proxy selection state
  const [selectedProxyId, setSelectedProxyId] = useState<string | undefined>()
  const [selectedProxyData, setSelectedProxyData] = useState<any>(null)
  const [assignProxy, setAssignProxy] = useState(true)
  
  const supabase = createClient()

  useEffect(() => {
    fetchProfiles()
    fetchAvailableCredentials()
  }, [])

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('phones')
      .select('profile_id, profile_name')
      .order('created_at', { ascending: false })
    
    if (data) {
      setProfiles(data)
    }
  }

  const fetchAvailableCredentials = async () => {
    const { data } = await supabase
      .from('tiktok_credentials')
      .select('id, email, creator_name')
      .eq('status', 'active')
      .order('last_used_at', { ascending: true, nullsFirst: true })
    
    if (data) {
      setAvailableCredentials(data.length)
      // Optionally, you could allow selecting a specific credential
      // For now, we'll just use the next available one automatically
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    
    try {
      // Prepare request body based on proxy source
      const requestBody: any = {
        use_existing_profile: useExistingProfile,
        existing_profile_id: useExistingProfile ? existingProfileId : undefined,
        device_model: deviceModel,
        android_version: androidVersion,
        group_name: groupName,
        tags: ['auto-setup', 'credentials'],
        remark: 'Automated TikTok setup with credentials',
        region: 'us',
        warmup_duration_minutes: warmupDuration,
        warmup_action: warmupAction,
        warmup_keywords: warmupAction !== 'browse video' ? warmupKeywords.split(',').map(k => k.trim()).filter(k => k) : undefined,
        credential_id: selectedCredentialId
      }

      // Handle proxy configuration based on source
      if (assignProxy) {
        requestBody.assign_proxy = true
      } else if (selectedProxyId) {
        requestBody.database_proxy_id = selectedProxyId
      }

      const response = await fetch('/api/automation/setup-tiktok-with-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Setup failed')
      }

      if (data.success && onSuccess) {
        onSuccess(data.account_id, data.profile_id)
      }
      
      onClose()
    } catch (error) {
      console.error('Setup error:', error)
      alert(error instanceof Error ? error.message : 'Setup failed')
    } finally {
      setIsLoading(false)
    }
  }

  const deviceModels = [
    { value: 'Pixel 6', label: 'Google Pixel 6' },
    { value: 'Pixel 7', label: 'Google Pixel 7' },
    { value: 'Galaxy S23', label: 'Samsung Galaxy S23' }
  ]

  const androidVersions = [
    { value: 1, label: 'Android 10' },
    { value: 2, label: 'Android 11' },
    { value: 3, label: 'Android 12' },
    { value: 4, label: 'Android 13' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-850 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-dark-850 border-b border-gray-200 dark:border-dark-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
              TikTok Credentials Setup
            </h2>
            <p className="text-sm text-gray-600 dark:text-dark-400 mt-1">
              Automated TikTok setup using email/password authentication
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-dark-500 dark:hover:text-dark-300 dark:hover:bg-dark-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Credentials Status */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Available Credentials
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {availableCredentials > 0 ? (
                    <>You have <span className="font-semibold">{availableCredentials}</span> active TikTok credentials available.</>
                  ) : (
                    <>No active credentials found. Please add credentials in the TikTok Credentials page.</>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="use-existing"
                checked={useExistingProfile}
                onChange={(e) => setUseExistingProfile(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="use-existing" className="text-sm font-medium text-gray-700 dark:text-dark-300">
                Use existing GeeLark profile
              </label>
            </div>

            {useExistingProfile ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  Select Profile
                </label>
                <select
                  value={existingProfileId}
                  onChange={(e) => setExistingProfileId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100"
                  required
                >
                  <option value="">Choose a profile...</option>
                  {profiles.map((profile) => (
                    <option key={profile.profile_id} value={profile.profile_id}>
                      {profile.profile_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                      Device Model
                    </label>
                    <select
                      value={deviceModel}
                      onChange={(e) => setDeviceModel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100"
                    >
                      {deviceModels.map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                      Android Version
                    </label>
                    <select
                      value={androidVersion}
                      onChange={(e) => setAndroidVersion(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100"
                    >
                      {androidVersions.map((version) => (
                        <option key={version.value} value={version.value}>
                          {version.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g., tiktok-batch-1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100"
                  />
                </div>

                {/* Proxy Selection */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      id="assign-proxy"
                      checked={assignProxy}
                      onChange={(e) => setAssignProxy(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="assign-proxy" className="text-sm font-medium text-gray-700 dark:text-dark-300">
                      Auto-assign proxy from allowed groups
                    </label>
                  </div>
                  
                  {!assignProxy && (
                    <ProxySelector
                      value={selectedProxyId || ''}
                      onChange={(value, proxyData) => {
                        setSelectedProxyId(value)
                        setSelectedProxyData(proxyData)
                      }}
                      filterByAllowedGroups={true}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Warmup Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">
              Warmup Configuration (After Login)
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  Warmup Duration (minutes)
                </label>
                <select
                  value={warmupDuration}
                  onChange={(e) => setWarmupDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100"
                >
                  <option value={0}>No warmup</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  Warmup Action
                </label>
                <select
                  value={warmupAction}
                  onChange={(e) => setWarmupAction(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100"
                  disabled={warmupDuration === 0}
                >
                  <option value="browse video">Browse Videos</option>
                  <option value="search video">Search Videos</option>
                  <option value="search profile">Search Profiles</option>
                </select>
              </div>
            </div>

            {warmupAction !== 'browse video' && warmupDuration > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  Search Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={warmupKeywords}
                  onChange={(e) => setWarmupKeywords(e.target.value)}
                  placeholder="e.g., funny, cats, dance"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100"
                />
              </div>
            )}
          </div>

          {/* Process Overview */}
          <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Setup Process
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-dark-400">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Get available TikTok credentials from database</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Create or use existing GeeLark profile</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Start phone and install TikTok v39.1.0</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Login with email/password automatically</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Monitor login status and start warmup if configured</span>
              </div>
            </div>
          </div>

          {/* Warning for no credentials */}
          {availableCredentials === 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-900 dark:text-red-100">
                    No Credentials Available
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Please add TikTok credentials before running this setup.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 dark:bg-dark-800 px-6 py-4 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || availableCredentials === 0 || (useExistingProfile && !existingProfileId)}
            className="btn-primary flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Start Setup
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
} 