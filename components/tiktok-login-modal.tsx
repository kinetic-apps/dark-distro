'use client'

import { useState, useEffect } from 'react'
import { 
  X, 
  LogIn, 
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Key,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react'
import { useNotification } from '@/lib/context/notification-context'
import { createClient } from '@/lib/supabase/client'

interface TikTokLoginModalProps {
  profileId: string
  profileName: string
  accountId: string
  onClose: () => void
}

interface Credentials {
  email?: string
  password?: string
  phone?: string
  source: 'tiktok_credentials' | 'phones_table' | 'manual'
}

export function TikTokLoginModal({ 
  profileId, 
  profileName,
  accountId,
  onClose
}: TikTokLoginModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [authMethod, setAuthMethod] = useState<'daisysms' | 'tiktok'>('daisysms')
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [manualEmail, setManualEmail] = useState('')
  const [manualPassword, setManualPassword] = useState('')
  const [useManual, setUseManual] = useState(false)
  const [loginStatus, setLoginStatus] = useState<'idle' | 'fetching' | 'logging_in' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  
  // Try to use notification context, but provide a fallback
  let notify: (type: 'success' | 'error' | 'info', message: string) => void
  try {
    const context = useNotification()
    notify = context.notify
  } catch (error) {
    // Fallback notification function if context is not available
    notify = (type, message) => {
      console.log(`[${type.toUpperCase()}] ${message}`)
      if (type === 'error') {
        setErrorMessage(message)
      }
    }
  }
  
  const supabase = createClient()

  useEffect(() => {
    fetchAuthMethodAndCredentials()
  }, [])

  const fetchAuthMethodAndCredentials = async () => {
    setLoginStatus('fetching')
    try {
      // Get auth method from settings
      const { data: settingData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'geelark_auth_method')
        .single()

      const method = settingData?.value?.replace(/"/g, '') || 'daisysms'
      setAuthMethod(method as 'daisysms' | 'tiktok')

      if (method === 'tiktok') {
        // Fetch available TikTok credentials
        const { data: credData } = await supabase
          .from('tiktok_credentials')
          .select('*')
          .eq('status', 'active')
          .order('last_used_at', { ascending: true, nullsFirst: true })
          .limit(1)

        if (credData && credData.length > 0) {
          setCredentials({
            email: credData[0].email,
            password: credData[0].password,
            source: 'tiktok_credentials'
          })
        } else {
          setErrorMessage('No active TikTok credentials found in database')
          setUseManual(true)
        }
      } else {
        // For DaisySMS method, check if phone has stored credentials
        const { data: phoneData } = await supabase
          .from('phones')
          .select('meta')
          .eq('profile_id', profileId)
          .single()

        if (phoneData?.meta?.tiktok_credentials) {
          setCredentials({
            email: phoneData.meta.tiktok_credentials.email,
            password: phoneData.meta.tiktok_credentials.password,
            source: 'phones_table'
          })
        } else {
          setErrorMessage('Phone authentication not yet implemented. Please use manual credentials.')
          setUseManual(true)
        }
      }
      setLoginStatus('idle')
    } catch (error) {
      console.error('Error fetching credentials:', error)
      setErrorMessage('Failed to fetch authentication settings')
      setLoginStatus('error')
    }
  }

  const handleLogin = async () => {
    setIsLoading(true)
    setLoginStatus('logging_in')
    setErrorMessage('')

    try {
      const loginCredentials = useManual 
        ? { email: manualEmail, password: manualPassword }
        : credentials

      if (!loginCredentials?.email || !loginCredentials?.password) {
        throw new Error('Email and password are required')
      }

      const response = await fetch('/api/geelark/tiktok-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          profile_id: profileId,
          login_method: 'email',
          email: loginCredentials.email,
          password: loginCredentials.password
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setLoginStatus('success')
      notify('success', 'TikTok login initiated successfully')
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (error) {
      setLoginStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Login failed')
      notify('error', `Failed to login: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = () => {
    switch (loginStatus) {
      case 'fetching':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      case 'logging_in':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <LogIn className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusText = () => {
    switch (loginStatus) {
      case 'fetching':
        return 'Fetching credentials...'
      case 'logging_in':
        return 'Logging in to TikTok...'
      case 'success':
        return 'Login successful!'
      case 'error':
        return errorMessage || 'Login failed'
      default:
        return 'Ready to login'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-850 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">TikTok Login</h3>
            <p className="text-sm text-gray-600 dark:text-dark-400 mt-1">{profileName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-dark-500 dark:hover:text-dark-300 dark:hover:bg-dark-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Status Display */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
            {getStatusIcon()}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                {getStatusText()}
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-500">
                Auth Method: {authMethod === 'tiktok' ? 'TikTok Credentials' : 'DaisySMS Phone'}
              </p>
            </div>
          </div>

          {/* Credentials Display */}
          {!useManual && credentials && loginStatus !== 'error' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-400">
                <Info className="h-4 w-4" />
                <span>Using credentials from: {
                  credentials.source === 'tiktok_credentials' 
                    ? 'TikTok Credentials Table'
                    : credentials.source === 'phones_table'
                    ? 'Phone Metadata'
                    : 'Manual Entry'
                }</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-100">Email:</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-dark-400 font-mono">
                    {credentials.email}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-100">Password:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-dark-400 font-mono">
                      {showPassword ? credentials.password : '••••••••'}
                    </span>
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:text-dark-500 dark:hover:text-dark-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setUseManual(true)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Use different credentials
              </button>
            </div>
          )}

          {/* Manual Entry Form */}
          {(useManual || !credentials) && loginStatus !== 'success' && (
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-dark-400">
                Enter TikTok login credentials:
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:text-dark-500 dark:hover:text-dark-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {credentials && (
                <button
                  onClick={() => setUseManual(false)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Use saved credentials
                </button>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 btn-secondary"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleLogin}
              disabled={isLoading || loginStatus === 'success' || loginStatus === 'fetching'}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Login to TikTok
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 