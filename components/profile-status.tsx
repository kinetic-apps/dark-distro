'use client'

import { useEffect, useState } from 'react'
import { Battery, Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react'

interface ProfileStatusProps {
  profileId: string
  accountId?: string
  className?: string
  showProgress?: boolean
}

interface PhoneStatusData {
  status: 'started' | 'starting' | 'stopped' | 'expired' | 'unknown' | 'error'
  name?: string
  battery?: number
  last_heartbeat?: string
  profile_id?: string
  status_code?: number
  error?: string
  error_code?: number
}

export function ProfileStatus({ profileId, accountId, className = '', showProgress = false }: ProfileStatusProps) {
  const [status, setStatus] = useState<PhoneStatusData>({ status: 'unknown' })
  const [isLoading, setIsLoading] = useState(false)
  const [accountStatus, setAccountStatus] = useState<any>(null)

  const fetchStatus = async () => {
    if (!profileId) return

    setIsLoading(true)
    try {
      // Fetch phone status
      const phoneResponse = await fetch('/api/geelark/phone-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_ids: [profileId]
        })
      })

      const phoneData = await phoneResponse.json()
      
      if (phoneResponse.ok && phoneData.statuses?.[0]) {
        const newStatus = phoneData.statuses[0]
        setStatus(newStatus)
      } else {
        setStatus({ status: 'unknown' })
      }

      // Get account status via API if accountId is provided
      if (accountId) {
        try {
          const accountResponse = await fetch(`/api/accounts/${accountId}/status`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })
          
          if (accountResponse.ok) {
            const accountData = await accountResponse.json()
            const activeTasks = accountData.tasks?.filter((t: any) => t.status === 'running') || []
            setAccountStatus({
              ...accountData,
              active_tasks: activeTasks.length
            })
          }
        } catch (error) {
          console.error('Failed to fetch account status:', error)
        }
      }
    } catch (error) {
      console.error('Failed to fetch status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [profileId, accountId])

  useEffect(() => {
    // Set up refresh interval separately
    const isSetupInProgress = accountStatus?.status?.includes('creating') ||
                             accountStatus?.status?.includes('starting') ||
                             accountStatus?.status?.includes('installing') ||
                             accountStatus?.status?.includes('renting') ||
                             accountStatus?.status?.includes('running')
    
    const interval = setInterval(fetchStatus, isSetupInProgress ? 5000 : 10000) // Refresh every 10 seconds instead of 30
    return () => clearInterval(interval)
  }, [profileId, accountId, accountStatus?.status])

  const getStatusColor = () => {
    // If we have account status, prioritize it for setup states
    if (accountStatus?.status) {
      switch (accountStatus.status) {
        case 'creating_profile':
        case 'starting_phone':
        case 'installing_tiktok':
        case 'renting_number':
        case 'running_geelark_task':
          return 'text-blue-600 dark:text-blue-400'
        case 'pending_verification':
        case 'warming_up':
          return 'text-yellow-600 dark:text-yellow-400'
        case 'active':
          return 'text-green-600 dark:text-green-400'
        case 'error':
        case 'banned':
          return 'text-red-600 dark:text-red-400'
        case 'paused':
          return 'text-gray-600 dark:text-gray-400'
        default: break
      }
    }

    // Fallback to phone status
    switch (status.status) {
      case 'started': return 'text-green-600 dark:text-green-400'
      case 'starting': return 'text-yellow-600 dark:text-yellow-400'
      case 'stopped': return 'text-red-600 dark:text-red-400'
      case 'expired': return 'text-gray-600 dark:text-gray-400'
      case 'error': return 'text-red-600 dark:text-red-400'
      case 'unknown': return 'text-gray-500 dark:text-gray-500'
      default: return 'text-gray-500 dark:text-gray-500'
    }
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case 'started': return <Wifi className="h-4 w-4" />
      case 'starting': return <Wifi className="h-4 w-4 animate-pulse" />
      case 'stopped': return <WifiOff className="h-4 w-4" />
      case 'expired': return <WifiOff className="h-4 w-4" />
      case 'error': return <AlertCircle className="h-4 w-4" />
      default: return <WifiOff className="h-4 w-4" />
    }
  }

  const getStatusText = () => {
    // Use detailed current activity if available (and not null)
    if (accountStatus?.current_activity && accountStatus.current_activity !== null) {
      return accountStatus.current_activity
    }

    // If we have account status, prioritize it ONLY for setup/error states
    if (accountStatus?.status && accountStatus.status !== 'active') {
      switch (accountStatus.status) {
        case 'creating_profile': return 'Creating Profile...'
        case 'starting_phone': return 'Starting Phone...'
        case 'installing_tiktok': return 'Installing TikTok...'
        case 'renting_number': return 'Renting Number...'
        case 'running_geelark_task': return 'Running Login...'
        case 'pending_verification': return 'Awaiting Verification'
        case 'warming_up': return 'Warming Up...'
        case 'error': return 'Error'
        case 'banned': return 'Banned'
        case 'paused': return 'Phone Stopped'
        default: break
      }
    }

    // Fallback to phone status
    switch (status.status) {
      case 'started': return 'Online'
      case 'starting': return 'Starting...'
      case 'stopped': return 'Offline'
      case 'expired': return 'Expired'
      case 'error': return 'Error'
      case 'unknown': return 'Unknown'
      default: return 'Unknown'
    }
  }

  const isSetupInProgress = accountStatus?.is_setup_in_progress || 
                         accountStatus?.setup_phase ||
                         accountStatus?.status?.includes('creating') ||
                         accountStatus?.status?.includes('starting') ||
                         accountStatus?.status?.includes('installing') ||
                         accountStatus?.status?.includes('renting') ||
                         accountStatus?.status?.includes('running')

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
          {/* Debug: {status.status} */}
        </div>

        {status.battery !== undefined && status.status === 'started' && (
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <Battery className="h-4 w-4" />
            <span className="text-sm">{status.battery}%</span>
          </div>
        )}

        <button
          onClick={fetchStatus}
          disabled={isLoading}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          title={`Refresh status - Status: ${status.status}`}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Progress Bar (during setup) */}
      {showProgress && isSetupInProgress && accountStatus?.setup_progress !== undefined && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">
              {accountStatus.current_setup_step || 'Setup Progress'}
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {accountStatus.setup_progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${accountStatus.setup_progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Active Tasks & Additional Info */}
      {accountStatus?.active_tasks && accountStatus.active_tasks > 0 && (
        <div className="text-xs text-blue-600 dark:text-blue-400">
          ⟳ {accountStatus.active_tasks} active task{accountStatus.active_tasks !== 1 ? 's' : ''}
        </div>
      )}
      
      {/* GeeLark Task Status */}
      {accountStatus?.geelark_task_id && accountStatus?.status === 'running_geelark_task' && (
        <div className="text-xs text-purple-600 dark:text-purple-400">
          🤖 GeeLark automation running
        </div>
      )}
      
      {/* Setup timing info */}
      {accountStatus?.setup_started_at && !accountStatus?.setup_completed_at && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Started {(() => {
            const minutes = Math.floor((Date.now() - new Date(accountStatus.setup_started_at).getTime()) / 60000)
            return minutes < 1 ? 'just now' : `${minutes}m ago`
          })()}
        </div>
      )}
    </div>
  )
} 