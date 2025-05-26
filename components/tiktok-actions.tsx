'use client'

import { useState, useEffect } from 'react'
import { Loader2, Smartphone, LogIn, Activity, Image, Video, X, Power, RefreshCw } from 'lucide-react'

interface TikTokActionsProps {
  accountId: string
  profileId?: string
  onActionComplete?: () => void
}

export function TikTokActions({ accountId, profileId, onActionComplete }: TikTokActionsProps) {
  const [isInstalling, setIsInstalling] = useState(false)
  const [isStartingPhone, setIsStartingPhone] = useState(false)
  const [isStoppingPhone, setIsStoppingPhone] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [phoneStatus, setPhoneStatus] = useState<'started' | 'starting' | 'stopped' | 'expired' | 'unknown'>('unknown')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showWarmupModal, setShowWarmupModal] = useState(false)
  const [showPostModal, setShowPostModal] = useState(false)
  const [showAppsModal, setShowAppsModal] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  const [appExplorationResults, setAppExplorationResults] = useState<any>(null)
  
  // Login form state
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  
  // Warmup options
  const [warmupDuration, setWarmupDuration] = useState('30')
  const [isWarmingUp, setIsWarmingUp] = useState(false)
  
  // Post content state
  const [postType, setPostType] = useState<'carousel' | 'video'>('carousel')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [imageUrls, setImageUrls] = useState('')
  const [isPosting, setIsPosting] = useState(false)

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  // Check phone status on mount and periodically
  useEffect(() => {
    if (profileId) {
      checkPhoneStatus()
      // Check status every 30 seconds
      const interval = setInterval(checkPhoneStatus, 30000)
      return () => clearInterval(interval)
    }
  }, [profileId])

  const checkPhoneStatus = async () => {
    if (!profileId) return

    setIsCheckingStatus(true)
    try {
      const response = await fetch('/api/geelark/phone-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_ids: [profileId]
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      const status = data.statuses?.[0]
      if (status) {
        setPhoneStatus(status.status || 'unknown')
      }
    } catch (error) {
      console.error('Failed to check phone status:', error)
    } finally {
      setIsCheckingStatus(false)
    }
  }

  const handleStartPhone = async () => {
    if (!profileId) {
      showNotification('error', 'No profile ID available')
      return
    }

    setIsStartingPhone(true)
    try {
      const response = await fetch('/api/geelark/phone-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_ids: [profileId],
          action: 'start'
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      showNotification('success', 'Phone started successfully')
      setPhoneStatus('starting')
      // Check status after a delay
      setTimeout(checkPhoneStatus, 3000)
      onActionComplete?.()
    } catch (error) {
      showNotification('error', `Failed to start phone: ${error}`)
    } finally {
      setIsStartingPhone(false)
    }
  }

  const handleStopPhone = async () => {
    if (!profileId) {
      showNotification('error', 'No profile ID available')
      return
    }

    setIsStoppingPhone(true)
    try {
      const response = await fetch('/api/geelark/phone-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_ids: [profileId],
          action: 'stop'
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      showNotification('success', 'Phone stopped successfully')
      setPhoneStatus('stopped')
      onActionComplete?.()
    } catch (error) {
      showNotification('error', `Failed to stop phone: ${error}`)
    } finally {
      setIsStoppingPhone(false)
    }
  }

  const handleExploreApps = async () => {
    if (!profileId) {
      showNotification('error', 'No profile ID available')
      return
    }

    try {
      const response = await fetch('/api/geelark/test-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: profileId
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      console.log('App exploration results:', data)
      setAppExplorationResults(data)
      setShowAppsModal(true)
      showNotification('info', `Found ${data.tiktok_apps?.length || 0} TikTok variants`)
    } catch (error) {
      showNotification('error', `Failed to explore apps: ${error}`)
    }
  }

  const handleInstallTikTok = async () => {
    if (!profileId) {
      showNotification('error', 'No profile ID available')
      return
    }

    setIsInstalling(true)
    try {
      const response = await fetch('/api/geelark/install-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_ids: [profileId],
          app_package: 'com.zhiliaoapp.musically',
          version: '39.1.0',
          app_version_id: '1901590921383706626'
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      showNotification('success', 'TikTok v39.1.0 installed successfully')
      onActionComplete?.()
    } catch (error) {
      showNotification('error', `Failed to install TikTok: ${error}`)
    } finally {
      setIsInstalling(false)
    }
  }

  const handleLogin = async () => {
    if (!profileId) {
      showNotification('error', 'No profile ID available')
      return
    }

    setIsLoggingIn(true)
    try {
      const response = await fetch('/api/geelark/tiktok-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          profile_id: profileId,
          phone_number: phoneNumber || undefined,
          otp_code: otpCode || undefined
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      if (data.status === 'waiting_for_otp') {
        showNotification('info', 'Waiting for OTP code. Check SMS messages.')
      } else {
        showNotification('success', 'TikTok login initiated')
      }
      
      setPhoneNumber('')
      setOtpCode('')
      setShowLoginModal(false)
      onActionComplete?.()
    } catch (error) {
      showNotification('error', `Failed to login: ${error}`)
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleWarmup = async () => {
    setIsWarmingUp(true)
    try {
      const response = await fetch('/api/geelark/start-warmup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_ids: [accountId],
          options: {
            duration_minutes: parseInt(warmupDuration),
            actions: ['browse', 'like', 'follow', 'comment', 'watch']
          }
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      showNotification('success', `Warmup started for ${warmupDuration} minutes`)
      setShowWarmupModal(false)
      onActionComplete?.()
    } catch (error) {
      showNotification('error', `Failed to start warmup: ${error}`)
    } finally {
      setIsWarmingUp(false)
    }
  }

  const handlePost = async () => {
    setIsPosting(true)
    try {
      const endpoint = postType === 'carousel' 
        ? '/api/geelark/post-carousel'
        : '/api/geelark/post-video'

      const hashtagsArray = hashtags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      let body: any = {
        account_id: accountId,
        caption,
        hashtags: hashtagsArray
      }

      if (postType === 'carousel') {
        const images = imageUrls
          .split('\n')
          .map(url => url.trim())
          .filter(url => url.length > 0)
        
        if (images.length < 2 || images.length > 35) {
          throw new Error('Carousel requires 2-35 images')
        }
        
        body.images = images
      } else {
        if (!videoUrl) {
          throw new Error('Video URL is required')
        }
        body.video_url = videoUrl
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      showNotification('success', `${postType === 'carousel' ? 'Carousel' : 'Video'} post initiated`)
      
      // Reset form
      setCaption('')
      setHashtags('')
      setVideoUrl('')
      setImageUrls('')
      setShowPostModal(false)
      onActionComplete?.()
    } catch (error) {
      showNotification('error', `Failed to post: ${error}`)
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <>
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
          notification.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100' :
          notification.type === 'info' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100' :
          'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Phone Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-xs">
          <div className={`w-2 h-2 rounded-full ${
            phoneStatus === 'started' ? 'bg-green-500' :
            phoneStatus === 'starting' ? 'bg-yellow-500 animate-pulse' :
            phoneStatus === 'stopped' ? 'bg-red-500' :
            phoneStatus === 'expired' ? 'bg-gray-500' :
            'bg-gray-400'
          }`} />
          <span className="text-gray-700 dark:text-gray-300">
            {phoneStatus === 'started' ? 'Running' :
             phoneStatus === 'starting' ? 'Starting...' :
             phoneStatus === 'stopped' ? 'Stopped' :
             phoneStatus === 'expired' ? 'Expired' :
             'Unknown'}
          </span>
          <button
            onClick={checkPhoneStatus}
            disabled={isCheckingStatus}
            className="ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <RefreshCw className={`h-3 w-3 ${isCheckingStatus ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Start/Stop Phone - Show based on status */}
        {phoneStatus !== 'started' && phoneStatus !== 'starting' ? (
          <button
            onClick={handleStartPhone}
            disabled={isStartingPhone || !profileId || phoneStatus === 'expired'}
            className="btn-secondary text-xs flex items-center gap-2"
          >
            {isStartingPhone ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Power className="h-4 w-4" />
            )}
            Start Phone
          </button>
        ) : (
          <button
            onClick={handleStopPhone}
            disabled={isStoppingPhone || !profileId}
            className="btn-secondary text-xs flex items-center gap-2"
          >
            {isStoppingPhone ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Power className="h-4 w-4 text-red-500" />
            )}
            Stop Phone
          </button>
        )}

        {/* Explore Apps (Debug) - Only show when phone is running */}
        {phoneStatus === 'started' && (
          <button
            onClick={handleExploreApps}
            disabled={!profileId}
            className="btn-secondary text-xs flex items-center gap-2"
          >
            <Smartphone className="h-4 w-4" />
            Explore Apps
          </button>
        )}

        {/* Install TikTok - Only show when phone is running */}
        {phoneStatus === 'started' && (
          <button
            onClick={handleInstallTikTok}
            disabled={isInstalling || !profileId}
            className="btn-secondary text-xs flex items-center gap-2"
          >
            {isInstalling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            Install TikTok
          </button>
        )}

        {/* Login Button - Only show when phone is running */}
        {phoneStatus === 'started' && (
          <button
            onClick={() => setShowLoginModal(true)}
            disabled={!profileId}
            className="btn-secondary text-xs flex items-center gap-2"
          >
            <LogIn className="h-4 w-4" />
            Login
          </button>
        )}

        {/* Warmup Button */}
        <button
          onClick={() => setShowWarmupModal(true)}
          className="btn-secondary text-xs flex items-center gap-2"
        >
          <Activity className="h-4 w-4" />
          Warmup
        </button>

        {/* Post Button */}
        <button
          onClick={() => setShowPostModal(true)}
          className="btn-secondary text-xs flex items-center gap-2"
        >
          <Image className="h-4 w-4" />
          Post
        </button>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">TikTok Login</h3>
              <button onClick={() => setShowLoginModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Login to TikTok using phone number and OTP verification
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Phone Number (optional)</label>
                <input
                  type="text"
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Leave empty to use DaisySMS rental
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">OTP Code (if available)</label>
                <input
                  type="text"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="btn-primary w-full"
              >
                {isLoggingIn ? 'Logging in...' : 'Start Login'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warmup Modal */}
      {showWarmupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Start Warmup</h3>
              <button onClick={() => setShowWarmupModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Run automated warmup activities on TikTok
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Duration (minutes)</label>
                <select
                  value={warmupDuration}
                  onChange={(e) => setWarmupDuration(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
              <button
                onClick={handleWarmup}
                disabled={isWarmingUp}
                className="btn-primary w-full"
              >
                {isWarmingUp ? 'Starting...' : 'Start Warmup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Modal */}
      {showPostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create TikTok Post</h3>
              <button onClick={() => setShowPostModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Post a carousel or video to TikTok
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Post Type</label>
                <select
                  value={postType}
                  onChange={(e) => setPostType(e.target.value as 'carousel' | 'video')}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                >
                  <option value="carousel">Carousel (2-35 images)</option>
                  <option value="video">Video</option>
                </select>
              </div>

              {postType === 'carousel' ? (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Image URLs (one per line)</label>
                  <textarea
                    placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                    value={imageUrls}
                    onChange={(e) => setImageUrls(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Video URL</label>
                  <input
                    type="text"
                    placeholder="https://example.com/video.mp4"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Caption</label>
                <textarea
                  placeholder="Write your caption here..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Hashtags (comma separated)</label>
                <input
                  type="text"
                  placeholder="#tiktok, #viral, #fyp"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>

              <button
                onClick={handlePost}
                disabled={isPosting}
                className="btn-primary w-full"
              >
                {isPosting ? 'Creating Post...' : 'Create Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apps Modal */}
      {showAppsModal && appExplorationResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Available TikTok Apps</h3>
              <button onClick={() => setShowAppsModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Installed Apps ({appExplorationResults.installed_apps?.total || 0})
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 text-sm">
                  {appExplorationResults.installed_apps?.apps?.map((app: any, idx: number) => (
                    <div key={idx} className="mb-2">
                      <span className="font-medium">{app.appName}</span> - 
                      <span className="text-gray-600 dark:text-gray-400"> v{app.versionName} ({app.packageName})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  TikTok Variants Found ({appExplorationResults.tiktok_apps?.length || 0})
                </h4>
                <div className="space-y-3">
                  {appExplorationResults.tiktok_apps?.map((app: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{app.appName}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Package: {app.packageName}</div>
                      <div className="mt-2">
                        <span className="text-sm font-medium">Available versions:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {app.versions?.map((v: any, vIdx: number) => (
                            <span key={vIdx} className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                              v{v.versionName} {v.installStatus === 1 && '(installed)'}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
} 