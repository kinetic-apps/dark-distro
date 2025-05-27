'use client'

import { useState, useEffect } from 'react'
import { Loader2, Smartphone, LogIn, Activity, Image, Video, X, Power, RefreshCw } from 'lucide-react'
import { ScreenshotViewer } from './screenshot-viewer'
import { useNotification } from '@/lib/context/notification-context'

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
  const [appExplorationResults, setAppExplorationResults] = useState<any>(null)
  const { notify } = useNotification()
  
  // Login form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  
  // Warmup options
  const [warmupDuration, setWarmupDuration] = useState('30')
  const [warmupAction, setWarmupAction] = useState<'browse video' | 'search video' | 'search profile'>('browse video')
  const [warmupKeywords, setWarmupKeywords] = useState('')
  const [selectedNiche, setSelectedNiche] = useState('')
  const [isWarmingUp, setIsWarmingUp] = useState(false)
  
  // Post content state
  const [postType, setPostType] = useState<'carousel' | 'video'>('carousel')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [imageUrls, setImageUrls] = useState('')
  const [isPosting, setIsPosting] = useState(false)

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
      notify('error', 'No profile ID available')
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

      notify('success', 'Phone started successfully')
      setPhoneStatus('starting')
      // Check status after a delay
      setTimeout(checkPhoneStatus, 3000)
      onActionComplete?.()
    } catch (error) {
      notify('error', `Failed to start phone: ${error}`)
    } finally {
      setIsStartingPhone(false)
    }
  }

  const handleStopPhone = async () => {
    if (!profileId) {
      notify('error', 'No profile ID available')
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

      notify('success', 'Phone stopped successfully')
      setPhoneStatus('stopped')
      onActionComplete?.()
    } catch (error) {
      notify('error', `Failed to stop phone: ${error}`)
    } finally {
      setIsStoppingPhone(false)
    }
  }

  const handleExploreApps = async () => {
    if (!profileId) {
      notify('error', 'No profile ID available')
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
      notify('info', `Found ${data.tiktok_apps?.length || 0} TikTok variants`)
    } catch (error) {
      notify('error', `Failed to explore apps: ${error}`)
    }
  }

  const handleInstallTikTok = async () => {
    if (!profileId) {
      notify('error', 'No profile ID available')
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

      notify('success', 'TikTok v39.1.0 installed successfully')
      onActionComplete?.()
    } catch (error) {
      notify('error', `Failed to install TikTok: ${error}`)
    } finally {
      setIsInstalling(false)
    }
  }

  const handleLogin = async () => {
    if (!profileId) {
      notify('error', 'No profile ID available')
      return
    }

    if (!email || !password) {
      notify('error', 'Email and password are required')
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
          login_method: 'email',
          email: email,
          password: password
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      notify('success', 'TikTok login initiated')
      
      setEmail('')
      setPassword('')
      setShowLoginModal(false)
      onActionComplete?.()
    } catch (error) {
      notify('error', `Failed to login: ${error}`)
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleWarmup = async () => {
    setIsWarmingUp(true)
    try {
      // Prepare keywords array
      const keywordsArray = warmupKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0)

      const options: any = {
        duration_minutes: parseInt(warmupDuration),
        action: warmupAction
      }

      // Only add keywords for search actions
      if (warmupAction !== 'browse video' && keywordsArray.length > 0) {
        options.keywords = keywordsArray
      }

      const response = await fetch('/api/geelark/start-warmup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_ids: [accountId],
          options
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      const actionText = warmupAction === 'browse video' ? 'browsing videos' :
                        warmupAction === 'search video' ? 'searching videos' :
                        'searching profiles'
      
      notify('success', `Warmup started: ${actionText} for ${warmupDuration} minutes`)
      setShowWarmupModal(false)
      onActionComplete?.()
    } catch (error) {
      notify('error', `Failed to start warmup: ${error}`)
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

      notify('success', `${postType === 'carousel' ? 'Carousel' : 'Video'} post initiated`)
      
      // Reset form
      setCaption('')
      setHashtags('')
      setVideoUrl('')
      setImageUrls('')
      setShowPostModal(false)
      onActionComplete?.()
    } catch (error) {
      notify('error', `Failed to post: ${error}`)
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <>
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

        {/* Screenshot Viewer */}
        {profileId && (
          <ScreenshotViewer 
            profileId={profileId} 
            phoneStatus={phoneStatus}
            profileName="TikTok Profile"
          />
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
              Login to TikTok using email and password
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email</label>
                <input
                  type="email"
                  placeholder="example@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password</label>
                <input
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  required
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={isLoggingIn || !email || !password}
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Configure Warmup</h3>
              <button onClick={() => setShowWarmupModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Customize your TikTok warmup strategy
            </p>
            <div className="space-y-4">
              {/* Action Type */}
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Action Type</label>
                <select
                  value={warmupAction}
                  onChange={(e) => {
                    setWarmupAction(e.target.value as any)
                    // Clear keywords if switching to browse
                    if (e.target.value === 'browse video') {
                      setWarmupKeywords('')
                      setSelectedNiche('')
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                >
                  <option value="browse video">Browse Videos (Random)</option>
                  <option value="search video">Search Videos (Targeted)</option>
                  <option value="search profile">Search Profiles (Targeted)</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {warmupAction === 'browse video' && 'Randomly browse TikTok videos without specific targeting'}
                  {warmupAction === 'search video' && 'Search for videos using specific keywords or niches'}
                  {warmupAction === 'search profile' && 'Search for user profiles in your target niche'}
                </p>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Duration</label>
                <select
                  value={warmupDuration}
                  onChange={(e) => setWarmupDuration(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                >
                  <option value="10">10 minutes (Quick)</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes (Recommended)</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours (Extended)</option>
                </select>
              </div>

              {/* Niche Presets - Only show for search actions */}
              {warmupAction !== 'browse video' && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Quick Niche Selection</label>
                  <select
                    value={selectedNiche}
                    onChange={(e) => {
                      setSelectedNiche(e.target.value)
                      // Set predefined keywords based on niche
                      const nicheKeywords: Record<string, string> = {
                        fitness: 'fitness, workout, gym, health, exercise, training',
                        cooking: 'cooking, recipes, food, chef, kitchen, meal prep',
                        tech: 'technology, gadgets, tech review, innovation, AI, coding',
                        fashion: 'fashion, style, outfit, clothing, trends, ootd',
                        gaming: 'gaming, gamer, gameplay, esports, video games, streaming',
                        beauty: 'beauty, makeup, skincare, cosmetics, tutorial, routine',
                        travel: 'travel, vacation, destination, adventure, explore, tourism',
                        music: 'music, songs, artist, concert, playlist, musician',
                        comedy: 'comedy, funny, humor, jokes, memes, entertainment',
                        education: 'education, learning, tutorial, howto, tips, knowledge',
                        pets: 'pets, dogs, cats, animals, puppy, kitten',
                        art: 'art, drawing, painting, artist, creative, artwork'
                      }
                      if (e.target.value && nicheKeywords[e.target.value]) {
                        setWarmupKeywords(nicheKeywords[e.target.value])
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Custom Keywords</option>
                    <option value="fitness">Fitness & Health</option>
                    <option value="cooking">Cooking & Food</option>
                    <option value="tech">Technology</option>
                    <option value="fashion">Fashion & Style</option>
                    <option value="gaming">Gaming</option>
                    <option value="beauty">Beauty & Makeup</option>
                    <option value="travel">Travel</option>
                    <option value="music">Music</option>
                    <option value="comedy">Comedy & Entertainment</option>
                    <option value="education">Education & Learning</option>
                    <option value="pets">Pets & Animals</option>
                    <option value="art">Art & Design</option>
                  </select>
                </div>
              )}

              {/* Keywords - Only show for search actions */}
              {warmupAction !== 'browse video' && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Keywords (comma separated)
                  </label>
                  <textarea
                    placeholder={warmupAction === 'search video' 
                      ? "e.g., fitness, workout, gym, health" 
                      : "e.g., fitness coach, personal trainer, nutritionist"}
                    value={warmupKeywords}
                    onChange={(e) => setWarmupKeywords(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {warmupAction === 'search video' 
                      ? "Enter keywords related to your niche to find relevant videos" 
                      : "Enter profile types or usernames to search for"}
                  </p>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">Warmup Summary:</p>
                <ul className="text-gray-600 dark:text-gray-400 space-y-1 text-xs">
                  <li>• Action: {warmupAction === 'browse video' ? 'Random browsing' : 
                               warmupAction === 'search video' ? 'Targeted video search' : 
                               'Profile search'}</li>
                  <li>• Duration: {warmupDuration} minutes</li>
                  {warmupAction !== 'browse video' && warmupKeywords && (
                    <li>• Keywords: {warmupKeywords.split(',').length} terms</li>
                  )}
                  {selectedNiche && (
                    <li>• Niche: {selectedNiche.charAt(0).toUpperCase() + selectedNiche.slice(1)}</li>
                  )}
                </ul>
              </div>

              <button
                onClick={handleWarmup}
                disabled={isWarmingUp || (warmupAction !== 'browse video' && !warmupKeywords.trim())}
                className="btn-primary w-full"
              >
                {isWarmingUp ? 'Starting Warmup...' : 'Start Warmup'}
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