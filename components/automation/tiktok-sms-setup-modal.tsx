'use client'

import { useState, useEffect } from 'react'
import { X, Smartphone, Loader2, CheckCircle, XCircle, AlertCircle, Phone, MessageSquare, Info } from 'lucide-react'
import { useNotification } from '@/lib/context/notification-context'
import { createClient } from '@/lib/supabase/client'
import { ProxySelector } from '@/components/proxy-selector'

interface TikTokSMSSetupModalProps {
  onClose: () => void
  onSuccess?: (accountId: string, profileId: string) => void
}

interface SetupTask {
  step: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  message: string
  error?: string
}

interface ExistingProfile {
  id: string
  profile_id: string
  profile_name: string
  status: string
}

export function TikTokSMSSetupModal({ onClose, onSuccess }: TikTokSMSSetupModalProps) {
  const { notify } = useNotification()
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<string>('')
  const [tasks, setTasks] = useState<SetupTask[]>([
    { step: 'Create/Select Profile', status: 'pending', message: 'Waiting to start...' },
    { step: 'Start Phone', status: 'pending', message: 'Waiting to start...' },
    { step: 'Install TikTok', status: 'pending', message: 'Waiting to start...' },
    { step: 'Rent Phone Number', status: 'pending', message: 'Waiting to start...' },
    { step: 'TikTok Login', status: 'pending', message: 'Waiting to start...' },
    { step: 'Monitor OTP', status: 'pending', message: 'Waiting to start...' }
  ])
  
  // Form state
  const [useExisting, setUseExisting] = useState(false)
  const [existingProfiles, setExistingProfiles] = useState<ExistingProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [proxySource, setProxySource] = useState<'auto' | 'database' | 'geelark' | 'manual'>('auto')
  const [selectedProxyId, setSelectedProxyId] = useState('')
  const [selectedProxyData, setSelectedProxyData] = useState<any>(null)
  const [manualProxy, setManualProxy] = useState({
    typeId: 1, // 1: socks5, 2: http, 3: https
    server: '',
    port: '',
    username: '',
    password: ''
  })
  const [warmupDuration, setWarmupDuration] = useState(30)
  const [warmupAction, setWarmupAction] = useState<'browse video' | 'search video' | 'search profile'>('browse video')
  const [warmupKeywords, setWarmupKeywords] = useState('')
  const [selectedNiche, setSelectedNiche] = useState('')
  const [showWarmupAdvanced, setShowWarmupAdvanced] = useState(false)
  const [longTermRental, setLongTermRental] = useState(false)
  const [groupName, setGroupName] = useState('tiktok-sms-setup')
  const [deviceModel, setDeviceModel] = useState('Pixel 6')
  const [androidVersion, setAndroidVersion] = useState(3) // Android 12

  const NICHE_KEYWORDS: Record<string, string> = {
    fitness: 'fitness, workout, gym, health, exercise, training, yoga, nutrition',
    cooking: 'cooking, recipes, food, chef, kitchen, meal prep, baking, cuisine',
    tech: 'technology, gadgets, tech review, innovation, AI, coding, software, apps',
    fashion: 'fashion, style, outfit, clothing, trends, ootd, designer, streetwear',
    gaming: 'gaming, gamer, gameplay, esports, video games, streaming, twitch, console',
    beauty: 'beauty, makeup, skincare, cosmetics, tutorial, routine, hairstyle, nails',
    travel: 'travel, vacation, destination, adventure, explore, tourism, wanderlust, backpacking',
    music: 'music, songs, artist, concert, playlist, musician, band, producer',
    comedy: 'comedy, funny, humor, jokes, memes, entertainment, standup, pranks',
    education: 'education, learning, tutorial, howto, tips, knowledge, study, teaching',
    pets: 'pets, dogs, cats, animals, puppy, kitten, pet care, animal lover',
    art: 'art, drawing, painting, artist, creative, artwork, illustration, design',
    sports: 'sports, athlete, training, football, basketball, soccer, fitness, workout',
    business: 'business, entrepreneur, startup, marketing, finance, investing, money, success',
    lifestyle: 'lifestyle, daily routine, vlog, life hacks, motivation, wellness, mindfulness',
    dance: 'dance, dancing, choreography, dancer, tiktok dance, moves, performance',
    diy: 'diy, crafts, handmade, tutorial, home improvement, creative, projects',
    photography: 'photography, photo, camera, photographer, editing, photoshoot, portrait'
  }

  const supabase = createClient()

  useEffect(() => {
    fetchExistingProfiles()
  }, [])

  const fetchExistingProfiles = async () => {
    const { data, error } = await supabase
      .from('phones')
      .select('id, profile_id, profile_name, status')
      .order('created_at', { ascending: false })

    if (data && !error) {
      setExistingProfiles(data)
    }
  }

  const updateTaskStatus = (step: string, status: SetupTask['status'], message: string, error?: string) => {
    setTasks(prev => prev.map(task => 
      task.step === step 
        ? { ...task, status, message, error }
        : task
    ))
  }

  const handleSetup = async () => {
    setIsLoading(true)
    setCurrentStep('Initializing...')

    try {
      // Reset all tasks to pending
      setTasks(prev => prev.map(task => ({ ...task, status: 'pending', message: 'Waiting to start...', error: undefined })))

      const requestBody: any = {
        use_existing_profile: useExisting,
        existing_profile_id: useExisting ? selectedProfileId : undefined,
        group_name: groupName,
        warmup_duration_minutes: warmupDuration,
        warmup_action: warmupAction,
        device_model: deviceModel,
        android_version: androidVersion,
        long_term_rental: longTermRental
      }

      // Add warmup keywords if applicable
      if (warmupAction !== 'browse video' && warmupKeywords.trim()) {
        requestBody.warmup_keywords = warmupKeywords
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0)
      }

      // Handle proxy configuration based on source
      if (proxySource === 'auto') {
        // Auto mode - let the backend handle proxy selection
        requestBody.assign_proxy = true
        requestBody.proxy_type = 'sim' // Prefer SIM proxies for TikTok
      } else if (proxySource === 'database' && selectedProxyId) {
        // Database proxy - send the proxy details
        if (selectedProxyData) {
          requestBody.proxy_config = {
            typeId: 1, // SOCKS5
            server: selectedProxyData.host,
            port: selectedProxyData.port,
            username: selectedProxyData.username,
            password: selectedProxyData.password
          }
          requestBody.database_proxy_id = selectedProxyId
        }
      } else if (proxySource === 'geelark' && selectedProxyId) {
        // GeeLark proxy - send the proxy ID
        requestBody.proxy_id = selectedProxyId
      } else if (proxySource === 'manual') {
        // Manual proxy configuration
        const { server, port, username, password, typeId } = manualProxy
        if (server && port) {
          requestBody.proxy_config = {
            typeId: typeId,
            server: server,
            port: parseInt(port),
            username: username || undefined,
            password: password || undefined
          }
        }
      }

      // Start the setup process
      const response = await fetch('/api/automation/setup-tiktok-with-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Setup failed')
      }

      // Update task statuses based on response
      data.tasks.forEach((task: any) => {
        updateTaskStatus(task.step, task.status, task.message, task.error)
      })

      if (data.success) {
        notify('success', 'TikTok SMS setup completed successfully!')
        if (data.phone_number) {
          notify('info', `Phone number rented: ${data.phone_number}. Check SMS rentals for OTP.`)
        }
        if (onSuccess && data.account_id && data.profile_id) {
          onSuccess(data.account_id, data.profile_id)
        }
        // Don't close immediately - let user see the results
      } else {
        const failedSteps = data.tasks.filter((t: any) => t.status === 'failed')
        notify('info', `Setup completed with ${failedSteps.length} failed steps`)
      }
    } catch (error) {
      notify('error', `Setup failed: ${error}`)
      setCurrentStep('Setup failed')
    } finally {
      setIsLoading(false)
      setCurrentStep('')
    }
  }

  const handleNicheChange = (niche: string) => {
    setSelectedNiche(niche)
    if (niche && NICHE_KEYWORDS[niche]) {
      setWarmupKeywords(NICHE_KEYWORDS[niche])
    }
  }

  const getTaskIcon = (status: SetupTask['status']) => {
    switch (status) {
      case 'pending':
        return <div className="h-4 w-4 rounded-full bg-gray-300 dark:bg-dark-600" />
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-850 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                TikTok SMS Setup
              </h2>
              <p className="text-sm text-gray-500 dark:text-dark-400">
                Automated TikTok setup with DaisySMS verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-dark-500 dark:hover:text-dark-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Configuration Section */}
          {!isLoading && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">Configuration</h3>
              
              {/* Profile Selection */}
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useExisting}
                    onChange={(e) => setUseExisting(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-dark-300">
                    Use existing GeeLark profile
                  </span>
                </label>

                {useExisting ? (
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="select w-full"
                  >
                    <option value="">Select a profile</option>
                    {existingProfiles.map(profile => (
                      <option key={profile.profile_id} value={profile.profile_id}>
                        {profile.profile_name} ({profile.status})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Device Model</label>
                        <select
                          value={deviceModel}
                          onChange={(e) => setDeviceModel(e.target.value)}
                          className="select w-full"
                        >
                          <option value="Pixel 6">Pixel 6</option>
                          <option value="Pixel 7">Pixel 7</option>
                          <option value="Galaxy S23">Galaxy S23</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Android Version</label>
                        <select
                          value={androidVersion}
                          onChange={(e) => setAndroidVersion(Number(e.target.value))}
                          className="select w-full"
                        >
                          <option value="1">Android 10</option>
                          <option value="2">Android 11</option>
                          <option value="3">Android 12</option>
                          <option value="4">Android 13</option>
                          <option value="7">Android 14</option>
                          <option value="8">Android 15</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="label">Group Name</label>
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className="input"
                        placeholder="e.g., tiktok-sms-setup"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Proxy Configuration */}
              <div>
                <label className="label mb-3">Proxy Configuration</label>
                <ProxySelector
                  value={selectedProxyId}
                  onChange={(value, proxyData) => {
                    setSelectedProxyId(value)
                    setSelectedProxyData(proxyData)
                  }}
                  source={proxySource}
                  onSourceChange={(source) => {
                    setProxySource(source as any)
                    setSelectedProxyId('')
                    setSelectedProxyData(null)
                  }}
                  showSourceSelector={true}
                  filterAssigned={true}
                />

                {/* Manual proxy configuration */}
                {proxySource === 'manual' && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label htmlFor="manualProxyType" className="label">
                        Proxy Type
                      </label>
                      <select
                        id="manualProxyType"
                        value={manualProxy.typeId}
                        onChange={(e) => setManualProxy({ 
                          ...manualProxy, 
                          typeId: parseInt(e.target.value) 
                        })}
                        className="select w-full"
                      >
                        <option value={1}>SOCKS5</option>
                        <option value={2}>HTTP</option>
                        <option value={3}>HTTPS</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="manualProxyServer" className="label">
                          Server
                        </label>
                        <input
                          id="manualProxyServer"
                          type="text"
                          value={manualProxy.server}
                          onChange={(e) => setManualProxy({ 
                            ...manualProxy, 
                            server: e.target.value 
                          })}
                          className="input"
                          placeholder="proxy.example.com"
                          required={proxySource === 'manual'}
                        />
                      </div>
                      <div>
                        <label htmlFor="manualProxyPort" className="label">
                          Port
                        </label>
                        <input
                          id="manualProxyPort"
                          type="text"
                          value={manualProxy.port}
                          onChange={(e) => setManualProxy({ 
                            ...manualProxy, 
                            port: e.target.value 
                          })}
                          className="input"
                          placeholder="1080"
                          required={proxySource === 'manual'}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="manualProxyUsername" className="label">
                          Username (Optional)
                        </label>
                        <input
                          id="manualProxyUsername"
                          type="text"
                          value={manualProxy.username}
                          onChange={(e) => setManualProxy({ 
                            ...manualProxy, 
                            username: e.target.value 
                          })}
                          className="input"
                          placeholder="username"
                        />
                      </div>
                      <div>
                        <label htmlFor="manualProxyPassword" className="label">
                          Password (Optional)
                        </label>
                        <input
                          id="manualProxyPassword"
                          type="password"
                          value={manualProxy.password}
                          onChange={(e) => setManualProxy({ 
                            ...manualProxy, 
                            password: e.target.value 
                          })}
                          className="input"
                          placeholder="password"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SMS Rental Configuration */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-900 dark:text-dark-100">SMS Rental Options</h4>
                
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>Automated Phone Login:</strong> This setup uses GeeLark RPA (Robotic Process Automation) to automatically:
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>Navigate to TikTok login screen</li>
                        <li>Enter the phone number from DaisySMS</li>
                        <li>Automatically input the OTP when received</li>
                        <li>Complete account creation</li>
                      </ul>
                      <p className="mt-2">
                        <strong>Note:</strong> You need to create a TikTok phone login task flow in your GeeLark dashboard first.
                      </p>
                    </div>
                  </div>
                </div>
                
                <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-700">
                  <input
                    type="checkbox"
                    checked={longTermRental}
                    onChange={(e) => setLongTermRental(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                      Long-term Rental
                    </span>
                    <p className="text-xs text-gray-600 dark:text-dark-400 mt-1">
                      Keep the number for 24 hours (auto-renews daily). Perfect for handling re-logins if TikTok signs out during warmup.
                    </p>
                  </div>
                </label>
                
                {longTermRental && (
                  <div className="ml-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>Cost:</strong> Initial SMS cost + $0.25/day for WhatsApp/TikTok<br/>
                      <strong>Benefits:</strong> Can receive multiple OTPs, handle re-logins, keep number active<br/>
                      <strong>Note:</strong> Auto-renew can be disabled later from the SMS Rentals page
                    </p>
                  </div>
                )}
              </div>

              {/* Warmup Duration */}
              <div>
                <label className="label">Warmup Duration</label>
                <select
                  value={warmupDuration}
                  onChange={(e) => setWarmupDuration(Number(e.target.value))}
                  className="select w-full"
                >
                  <option value={0}>No warmup</option>
                  <option value={10}>10 minutes (Quick test)</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes (Recommended)</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours (Extended)</option>
                  <option value={180}>3 hours</option>
                  <option value={240}>4 hours (Maximum)</option>
                </select>
              </div>

              {/* Warmup Configuration - Only show if warmup is enabled */}
              {warmupDuration > 0 && (
                <div className="space-y-3 border-t border-gray-200 dark:border-dark-700 pt-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-dark-100">Warmup Configuration</h4>
                  
                  {/* Warmup Action */}
                  <div>
                    <label className="label">Warmup Strategy</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setWarmupAction('browse video')
                          setWarmupKeywords('')
                          setSelectedNiche('')
                        }}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          warmupAction === 'browse video'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-left">
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Random Browse</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Natural browsing behavior
                          </p>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setWarmupAction('search video')}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          warmupAction === 'search video'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-left">
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Search Videos</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Target specific content
                          </p>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setWarmupAction('search profile')}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          warmupAction === 'search profile'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-left">
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Search Profiles</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Find niche creators
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Niche/Keywords - Only for search actions */}
                  {warmupAction !== 'browse video' && (
                    <>
                      <div>
                        <label className="label">Select Niche</label>
                        <select
                          value={selectedNiche}
                          onChange={(e) => handleNicheChange(e.target.value)}
                          className="select w-full"
                        >
                          <option value="">Custom Keywords</option>
                          <optgroup label="Popular Niches">
                            <option value="fitness">Fitness & Health</option>
                            <option value="cooking">Cooking & Food</option>
                            <option value="tech">Technology</option>
                            <option value="fashion">Fashion & Style</option>
                            <option value="gaming">Gaming</option>
                            <option value="beauty">Beauty & Makeup</option>
                          </optgroup>
                          <optgroup label="Entertainment">
                            <option value="comedy">Comedy</option>
                            <option value="music">Music</option>
                            <option value="dance">Dance</option>
                            <option value="sports">Sports</option>
                          </optgroup>
                          <optgroup label="Lifestyle">
                            <option value="travel">Travel</option>
                            <option value="pets">Pets & Animals</option>
                            <option value="lifestyle">Lifestyle & Vlogs</option>
                            <option value="diy">DIY & Crafts</option>
                          </optgroup>
                          <optgroup label="Professional">
                            <option value="business">Business & Finance</option>
                            <option value="education">Education</option>
                            <option value="art">Art & Design</option>
                            <option value="photography">Photography</option>
                          </optgroup>
                        </select>
                      </div>

                      <div>
                        <label className="label">
                          Keywords {warmupAction === 'search video' ? '(for video search)' : '(for profile search)'}
                        </label>
                        <textarea
                          placeholder={warmupAction === 'search video' 
                            ? "e.g., fitness, workout, gym, health, exercise" 
                            : "e.g., fitness coach, personal trainer, yoga instructor"}
                          value={warmupKeywords}
                          onChange={(e) => setWarmupKeywords(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Separate keywords with commas. More specific keywords lead to better targeting.
                        </p>
                      </div>
                    </>
                  )}

                  {/* Advanced Tips */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowWarmupAdvanced(!showWarmupAdvanced)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
                    >
                      <Info className="h-4 w-4" />
                      {showWarmupAdvanced ? 'Hide' : 'Show'} Warmup Tips
                    </button>
                    
                    {showWarmupAdvanced && (
                      <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Warmup Best Practices:</h4>
                        <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                          <li>• Start with shorter durations (15-30 min) for new accounts</li>
                          <li>• Use random browsing for the first few warmup sessions</li>
                          <li>• Gradually introduce targeted searches as accounts mature</li>
                          <li>• Mix different niches to appear more natural</li>
                          <li>• Run warmup at different times of day</li>
                          <li>• Avoid using the same keywords repeatedly</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task Progress */}
          {isLoading && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">Progress</h3>
              {currentStep && (
                <p className="text-sm text-gray-600 dark:text-dark-400">{currentStep}</p>
              )}
              <div className="space-y-2">
                {tasks.map((task, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                    {getTaskIcon(task.status)}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                        {task.step}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-dark-400">
                        {task.message}
                      </p>
                      {task.error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Error: {task.error}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Important Notes */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex gap-3">
              <MessageSquare className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Important Notes:
                </p>
                <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
                  <li>A DaisySMS phone number will be rented automatically</li>
                  <li>Check the SMS Rentals page for the verification code</li>
                  <li>Manual intervention may be required to enter the OTP</li>
                  <li>The phone number will be active for 72 hours</li>
                  <li>Make sure you have sufficient DaisySMS balance</li>
                  <li>Proxy is required for TikTok - auto mode will select the best available</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-dark-700">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary"
          >
            {isLoading ? 'Close' : 'Cancel'}
          </button>
          {!isLoading && (
            <button
              onClick={handleSetup}
              disabled={
                (useExisting && !selectedProfileId) ||
                (proxySource === 'database' && !selectedProxyId) ||
                (proxySource === 'geelark' && !selectedProxyId) ||
                (proxySource === 'manual' && (!manualProxy.server || !manualProxy.port))
              }
              className="btn-primary"
            >
              <Smartphone className="h-4 w-4 mr-2" />
              Start Setup
            </button>
          )}
        </div>
      </div>
    </div>
  )
} 