// Unified profile status system that shows what the phone is actually doing

export type ProfileOperationalStatus = 
  | 'queued'           // Waiting in batch queue
  | 'initializing'     // Creating profile/account
  | 'starting'         // Phone is starting up
  | 'installing'       // Installing TikTok
  | 'logging_in'       // Setting up TikTok account
  | 'verifying'        // Waiting for SMS/OTP
  | 'warming_up'       // Warming up account
  | 'ready'            // Ready to post content
  | 'posting'          // Currently posting
  | 'paused'           // Phone is stopped
  | 'error'            // Something went wrong
  | 'banned'           // Account is banned

export interface ProfileStatusInfo {
  status: ProfileOperationalStatus
  message: string
  progress?: number
  queuePosition?: { current: number; total: number }
  isOnline: boolean
  canPerformActions: boolean
}

export function getProfileStatus(profile: any): ProfileStatusInfo {
  // Check phone status FIRST - if phone is off, nothing else matters
  const phoneMetaStatus = profile.phone?.[0]?.meta?.phone_status || profile.phone?.meta?.phone_status
  const phoneStatus = phoneMetaStatus || profile.phone?.[0]?.status || profile.phone?.status
  const isPhoneOnline = phoneStatus === 'started' || phoneStatus === 'online' || phoneStatus === 'running'
  const isPhoneStarting = phoneStatus === 'starting'
  
  // If we have a phone status and it's not online/starting, phone is off
  if (phoneStatus && phoneStatus !== 'started' && phoneStatus !== 'online' && 
      phoneStatus !== 'running' && phoneStatus !== 'starting') {
    return {
      status: 'paused',
      message: phoneStatus === 'expired' ? 'Phone expired' : 'Phone stopped',
      isOnline: false,
      canPerformActions: true
    }
  }

  // Check if banned (terminal state)
  if (profile.status === 'banned') {
    return {
      status: 'banned',
      message: 'Account banned',
      isOnline: false,
      canPerformActions: false
    }
  }

  // Check if there's an error
  if (profile.error_count > 0 && profile.last_error) {
    return {
      status: 'error',
      message: `Error: ${profile.last_error}`,
      isOnline: false,
      canPerformActions: true // Can retry
    }
  }

  // Check if in queue (look for queue metadata)
  if (profile.meta?.queue_position) {
    return {
      status: 'queued',
      message: `Waiting in queue`,
      queuePosition: {
        current: profile.meta.queue_position,
        total: profile.meta.queue_total || profile.meta.queue_position
      },
      isOnline: false,
      canPerformActions: false
    }
  }

  // Check active tasks
  const activeTasks = profile.tasks?.filter((t: any) => t.status === 'running') || []
  const activeTaskTypes = activeTasks.map((t: any) => t.type)

  // Check setup progress
  if (profile.status === 'creating_profile' || profile.current_setup_step === 'Create Profile') {
    return {
      status: 'initializing',
      message: 'Creating profile...',
      progress: profile.setup_progress || 20,
      isOnline: false,
      canPerformActions: false
    }
  }

  if (profile.status === 'starting_phone' || profile.current_setup_step === 'Start Phone' || isPhoneStarting) {
    return {
      status: 'starting',
      message: 'Starting phone...',
      progress: profile.setup_progress || 40,
      isOnline: false,
      canPerformActions: false
    }
  }

  if (profile.status === 'installing_tiktok' || profile.current_setup_step === 'Install TikTok') {
    return {
      status: 'installing',
      message: 'Installing TikTok...',
      progress: profile.setup_progress || 60,
      isOnline: true,
      canPerformActions: false
    }
  }

  if (profile.status === 'running_geelark_task' || profile.current_setup_step === 'Start TikTok Login' || activeTaskTypes.includes('login')) {
    return {
      status: 'logging_in',
      message: 'Setting up TikTok account...',
      progress: profile.setup_progress || 80,
      isOnline: true,
      canPerformActions: false
    }
  }

  if (profile.status === 'pending_verification' || profile.status === 'renting_number' || profile.status === 'otp_received') {
    return {
      status: 'verifying',
      message: profile.status === 'otp_received' ? 'Entering verification code...' : 'Waiting for SMS verification...',
      progress: profile.setup_progress || 90,
      isOnline: true,
      canPerformActions: false
    }
  }

  // Check warmup status
  if (profile.status === 'warming_up' || activeTaskTypes.includes('warmup')) {
    return {
      status: 'warming_up',
      message: `Warming up account...`,
      progress: profile.warmup_progress || 0,
      isOnline: true,
      canPerformActions: false
    }
  }

  // Check if posting
  if (activeTaskTypes.includes('post_video') || activeTaskTypes.includes('post_carousel') || activeTaskTypes.includes('post')) {
    return {
      status: 'posting',
      message: 'Posting content...',
      isOnline: true,
      canPerformActions: false
    }
  }

  // Check if phone is paused/offline
  if (!isPhoneOnline && profile.status !== 'new') {
    return {
      status: 'paused',
      message: 'Phone stopped',
      isOnline: false,
      canPerformActions: true
    }
  }

  // If active and online
  if (profile.status === 'active' && isPhoneOnline) {
    return {
      status: 'ready',
      message: 'Ready to post',
      isOnline: true,
      canPerformActions: true
    }
  }

  // Default states
  if (profile.status === 'new') {
    return {
      status: 'paused',
      message: 'Not started',
      isOnline: false,
      canPerformActions: true
    }
  }

  return {
    status: 'paused',
    message: 'Unknown state',
    isOnline: false,
    canPerformActions: true
  }
}

export function getStatusColor(status: ProfileOperationalStatus): string {
  switch (status) {
    case 'queued':
      return 'text-purple-600 dark:text-purple-400'
    case 'initializing':
    case 'starting':
    case 'installing':
    case 'logging_in':
    case 'verifying':
      return 'text-blue-600 dark:text-blue-400'
    case 'warming_up':
      return 'text-yellow-600 dark:text-yellow-400'
    case 'ready':
      return 'text-green-600 dark:text-green-400'
    case 'posting':
      return 'text-indigo-600 dark:text-indigo-400'
    case 'paused':
      return 'text-gray-600 dark:text-gray-400'
    case 'error':
      return 'text-red-600 dark:text-red-400'
    case 'banned':
      return 'text-red-800 dark:text-red-600'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

export function getStatusIcon(status: ProfileOperationalStatus): string {
  switch (status) {
    case 'queued':
      return 'Clock' // Waiting in queue
    case 'initializing':
      return 'Loader' // Creating
    case 'starting':
      return 'Power' // Starting up
    case 'installing':
      return 'Download' // Installing
    case 'logging_in':
      return 'LogIn' // Login
    case 'verifying':
      return 'ShieldCheck' // Verification
    case 'warming_up':
      return 'Activity' // Warming up
    case 'ready':
      return 'CheckCircle' // Ready
    case 'posting':
      return 'Upload' // Posting
    case 'paused':
      return 'Pause' // Paused
    case 'error':
      return 'AlertCircle' // Error
    case 'banned':
      return 'Ban' // Banned
    default:
      return 'Circle'
  }
} 