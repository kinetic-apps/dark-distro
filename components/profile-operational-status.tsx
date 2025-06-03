'use client'

import { 
  Clock, 
  Loader, 
  Power, 
  Download, 
  LogIn, 
  ShieldCheck, 
  Activity, 
  CheckCircle, 
  Upload, 
  Pause, 
  AlertCircle, 
  Ban,
  Circle
} from 'lucide-react'
import { getProfileStatus, getStatusColor, type ProfileOperationalStatus } from '@/lib/utils/profile-status'

const StatusIcons: Record<ProfileOperationalStatus, any> = {
  queued: Clock,
  initializing: Loader,
  starting: Power,
  installing: Download,
  logging_in: LogIn,
  verifying: ShieldCheck,
  warming_up: Activity,
  ready: CheckCircle,
  posting: Upload,
  paused: Pause,
  error: AlertCircle,
  banned: Ban
}

interface ProfileOperationalStatusProps {
  profile: any
  showProgress?: boolean
  showMessage?: boolean
  className?: string
}

export function ProfileOperationalStatus({ 
  profile, 
  showProgress = true,
  showMessage = true,
  className = '' 
}: ProfileOperationalStatusProps) {
  const statusInfo = getProfileStatus(profile)
  const Icon = StatusIcons[statusInfo.status] || Circle
  const colorClass = getStatusColor(statusInfo.status)
  
  // Animation classes for active states
  const animationClass = ['initializing', 'starting', 'installing', 'logging_in', 'verifying', 'posting'].includes(statusInfo.status)
    ? 'animate-pulse'
    : statusInfo.status === 'warming_up'
    ? 'animate-pulse'
    : ''

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Icon className={`h-4 w-4 ${colorClass} ${animationClass}`} />
      
      <div className="flex flex-col">
        {showMessage && (
          <span className={`text-sm font-medium ${colorClass}`}>
            {statusInfo.message}
          </span>
        )}
        
        {showProgress && statusInfo.progress !== undefined && (
          <div className="flex items-center gap-2 mt-1">
            <div className="w-24 bg-gray-200 dark:bg-dark-700 rounded-full h-1.5">
              <div 
                className="bg-current h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${statusInfo.progress}%`, color: 'currentColor' }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {statusInfo.progress}%
            </span>
          </div>
        )}
        
        {statusInfo.queuePosition && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Position {statusInfo.queuePosition.current} of {statusInfo.queuePosition.total}
          </span>
        )}
      </div>
      
      {/* Online indicator */}
      <div className={`ml-auto h-2 w-2 rounded-full ${
        statusInfo.isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
      }`} title={statusInfo.isOnline ? 'Phone online' : 'Phone offline'} />
    </div>
  )
} 