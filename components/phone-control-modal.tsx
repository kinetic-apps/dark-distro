'use client'

import { useState, useEffect } from 'react'
import { 
  X, 
  Power, 
  RefreshCw, 
  Smartphone,
  LogIn,
  Download,
  Activity,
  Camera,
  Loader2
} from 'lucide-react'
import { useNotification } from '@/lib/context/notification-context'
import { TikTokLoginModal } from '@/components/tiktok-login-modal'

interface PhoneControlModalProps {
  profileId: string
  profileName: string
  accountId?: string
  onClose: () => void
}

export function PhoneControlModal({ 
  profileId, 
  profileName,
  accountId, 
  onClose
}: PhoneControlModalProps) {
  const [phoneStatus, setPhoneStatus] = useState<'started' | 'starting' | 'stopped' | 'expired' | 'unknown'>('unknown')
  const [isLoading, setIsLoading] = useState(false)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [showTikTokLogin, setShowTikTokLogin] = useState(false)
  const { notify } = useNotification()

  useEffect(() => {
    checkPhoneStatus()
  }, [profileId])

  const checkPhoneStatus = async () => {
    try {
      const response = await fetch('/api/geelark/phone-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_ids: [profileId] })
      })

      const data = await response.json()
      if (response.ok && data.statuses?.[0]) {
        setPhoneStatus(data.statuses[0].status || 'unknown')
      }
    } catch (error) {
      console.error('Failed to check phone status:', error)
    }
  }

  const handlePhoneControl = async (action: 'start' | 'stop') => {
    setIsLoading(true)
    setActiveAction(action)
    
    try {
      const response = await fetch('/api/geelark/phone-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_ids: [profileId],
          action
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      notify('success', `Phone ${action === 'start' ? 'started' : 'stopped'} successfully`)
      setPhoneStatus(action === 'start' ? 'starting' : 'stopped')
      
      // Check status after a delay
      if (action === 'start') {
        setTimeout(checkPhoneStatus, 3000)
      }
    } catch (error) {
      notify('error', `Failed to ${action} phone: ${error}`)
    } finally {
      setIsLoading(false)
      setActiveAction(null)
    }
  }

  const handleInstallTikTok = async () => {
    setIsLoading(true)
    setActiveAction('install')
    
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

      notify('success', 'TikTok installed successfully')
    } catch (error) {
      notify('error', `Failed to install TikTok: ${error}`)
    } finally {
      setIsLoading(false)
      setActiveAction(null)
    }
  }

  const handleTakeScreenshot = async () => {
    setIsLoading(true)
    setActiveAction('screenshot')
    
    try {
      const response = await fetch('/api/geelark/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      notify('success', 'Screenshot captured successfully')
      
      // Open screenshot in new tab
      if (data.screenshot_url) {
        window.open(data.screenshot_url, '_blank')
      }
    } catch (error) {
      notify('error', `Failed to capture screenshot: ${error}`)
    } finally {
      setIsLoading(false)
      setActiveAction(null)
    }
  }

  const getStatusColor = () => {
    switch (phoneStatus) {
      case 'started':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20'
      case 'starting':
        return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20'
      case 'stopped':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
      case 'expired':
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20'
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20'
    }
  }

  const getStatusText = () => {
    switch (phoneStatus) {
      case 'started':
        return 'Running'
      case 'starting':
        return 'Starting...'
      case 'stopped':
        return 'Stopped'
      case 'expired':
        return 'Expired'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-850 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Phone Control</h3>
            <p className="text-sm text-gray-600 dark:text-dark-400 mt-1">{profileName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-dark-500 dark:hover:text-dark-300 dark:hover:bg-dark-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Phone Status */}
          <div className="mb-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-gray-600 dark:text-dark-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-100">Phone Status</p>
                  <p className="text-xs text-gray-500 dark:text-dark-500">GeeLark Profile ID: {profileId.slice(-8)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
                  {getStatusText()}
                </span>
                <button
                  onClick={checkPhoneStatus}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:text-dark-500 dark:hover:text-dark-300"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {phoneStatus !== 'started' && phoneStatus !== 'starting' ? (
              <button
                onClick={() => handlePhoneControl('start')}
                disabled={isLoading || phoneStatus === 'expired'}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {activeAction === 'start' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
                Start Phone
              </button>
            ) : (
              <button
                onClick={() => handlePhoneControl('stop')}
                disabled={isLoading}
                className="w-full btn-secondary flex items-center justify-center gap-2"
              >
                {activeAction === 'stop' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Power className="h-4 w-4 text-red-500" />
                )}
                Stop Phone
              </button>
            )}

            {phoneStatus === 'started' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleInstallTikTok}
                    disabled={isLoading}
                    className="btn-secondary flex items-center justify-center gap-2 text-sm"
                  >
                    {activeAction === 'install' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    Install TikTok
                  </button>

                  <button
                    onClick={handleTakeScreenshot}
                    disabled={isLoading}
                    className="btn-secondary flex items-center justify-center gap-2 text-sm"
                  >
                    {activeAction === 'screenshot' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Camera className="h-3 w-3" />
                    )}
                    Screenshot
                  </button>
                </div>

                <button
                  onClick={() => setShowTikTokLogin(true)}
                  className="w-full btn-secondary flex items-center justify-center gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  TikTok Login
                </button>

                <button
                  onClick={() => {
                    onClose()
                    // Navigate to warmup or open warmup modal
                  }}
                  className="w-full btn-secondary flex items-center justify-center gap-2"
                >
                  <Activity className="h-4 w-4" />
                  Start Warmup
                </button>
              </>
            )}
          </div>

          {phoneStatus === 'expired' && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                This phone session has expired. Please start a new session.
              </p>
            </div>
          )}
        </div>
      </div>

      {showTikTokLogin && accountId && (
        <TikTokLoginModal
          profileId={profileId}
          profileName={profileName}
          accountId={accountId}
          onClose={() => setShowTikTokLogin(false)}
        />
      )}
    </div>
  )
} 