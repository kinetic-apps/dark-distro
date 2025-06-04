'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'
import { 
  MoreVertical,
  User,
  Wifi,
  WifiOff,
  Battery,
  ChevronDown,
  Plus,
  Power,
  Camera,
  Play,
  Image as ImageIcon,
  Activity,
  Shield,
  Heart
} from 'lucide-react'
import { ProfileOperationalStatus } from '@/components/profile-operational-status'
import { ScreenshotViewer } from '@/components/screenshot-viewer'
import { getProfileStatus } from '@/lib/utils/profile-status'

interface Profile {
  id: string
  tiktok_username: string | null
  geelark_profile_id: string | null
  status: string
  warmup_progress: number
  error_count: number
  last_error: string | null
  created_at: string
  updated_at: string
  meta?: any
  current_setup_step?: string
  setup_progress?: number
  proxy?: {
    label: string
    type: string
    health: string
  }
  phone?: {
    status: string
    battery: number | null
    last_heartbeat: string | null
  }
  tasks?: Array<{
    id: string
    type: string
    status: string
    created_at: string
    completed_at: string | null
    started_at: string | null
  }>
}

interface ProfilesTableV2Props {
  profiles: Profile[]
  onBulkAction: (action: string, ids: string[]) => void
}

export function ProfilesTableV2({ profiles, onBulkAction }: ProfilesTableV2Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedRows, setExpandedRows] = useState<string[]>([])

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const toggleAll = () => {
    setSelectedIds(prev => 
      prev.length === profiles.length 
        ? []
        : profiles.map(p => p.id)
    )
  }

  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const getLastActivity = (profile: Profile) => {
    // Get the most recent activity from tasks
    const recentTask = profile.tasks
      ?.filter(t => t.completed_at || t.started_at)
      .sort((a, b) => {
        const aTime = new Date(a.completed_at || a.started_at || a.created_at).getTime()
        const bTime = new Date(b.completed_at || b.started_at || b.created_at).getTime()
        return bTime - aTime
      })[0]

    if (recentTask) {
      const timeStr = formatRelativeTime(recentTask.completed_at || recentTask.started_at || recentTask.created_at)
      const action = recentTask.type === 'warmup' ? 'Warmed up' :
                     recentTask.type === 'post_video' ? 'Posted video' :
                     recentTask.type === 'post_carousel' ? 'Posted carousel' :
                     recentTask.type === 'login' ? 'Logged in' :
                     recentTask.type.replace('_', ' ')
      return `${action} ${timeStr}`
    }

    return `Created ${formatRelativeTime(profile.created_at)}`
  }

  const getQuickActions = (profile: Profile) => {
    const statusInfo = getProfileStatus(profile)
    const actions: React.ReactElement[] = []

    if (!statusInfo.canPerformActions) {
      return actions
    }

    // Start/Stop phone
    if (profile.geelark_profile_id) {
      if (statusInfo.isOnline) {
        actions.push(
          <button
            key="stop"
            onClick={() => onBulkAction('stop-phone', [profile.id])}
            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded transition-colors dark:text-dark-400 dark:hover:text-red-400 dark:hover:bg-dark-700"
            title="Stop phone"
          >
            <Power className="h-4 w-4" />
          </button>
        )
        actions.push(
          <button
            key="screenshot"
            onClick={() => onBulkAction('screenshot', [profile.id])}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors dark:text-dark-400 dark:hover:text-dark-100 dark:hover:bg-dark-700"
            title="Take screenshot"
          >
            <Camera className="h-4 w-4" />
          </button>
        )
      } else {
        actions.push(
          <button
            key="start"
            onClick={() => onBulkAction('start-phone', [profile.id])}
            className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-gray-100 rounded transition-colors dark:text-dark-400 dark:hover:text-green-400 dark:hover:bg-dark-700"
            title="Start phone"
          >
            <Power className="h-4 w-4" />
          </button>
        )
      }
    }

    // Content actions
    if (statusInfo.status === 'ready') {
      actions.push(
        <button
          key="warmup"
          onClick={() => onBulkAction('warmup', [profile.id])}
          className="p-1.5 text-gray-600 hover:text-yellow-600 hover:bg-gray-100 rounded transition-colors dark:text-dark-400 dark:hover:text-yellow-400 dark:hover:bg-dark-700"
          title="Start warmup"
        >
          <Activity className="h-4 w-4" />
        </button>
      )
      actions.push(
        <button
          key="video"
          onClick={() => onBulkAction('post-video', [profile.id])}
          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors dark:text-dark-400 dark:hover:text-blue-400 dark:hover:bg-dark-700"
          title="Post video"
        >
          <Play className="h-4 w-4" />
        </button>
      )
      actions.push(
        <button
          key="carousel"
          onClick={() => onBulkAction('post-carousel', [profile.id])}
          className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-gray-100 rounded transition-colors dark:text-dark-400 dark:hover:text-purple-400 dark:hover:bg-dark-700"
          title="Post carousel"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
      )
    }

    return actions
  }

  if (profiles.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg dark:bg-dark-850 dark:border-dark-700">
        <div className="text-center py-12">
          <User className="mx-auto h-12 w-12 text-gray-400 dark:text-dark-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-dark-100">No profiles</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-400">Get started by creating a new profile.</p>
          <div className="mt-6">
            <Link href="/profiles/new" className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              New Profile
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-dark-850 dark:border-dark-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
        <thead className="bg-gray-50 dark:bg-dark-800">
          <tr>
            <th scope="col" className="relative w-12 px-6 sm:w-16 sm:px-8">
              <input
                type="checkbox"
                className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-dark-600 dark:text-dark-100 dark:focus:ring-dark-400 dark:bg-dark-800"
                checked={selectedIds.length === profiles.length && profiles.length > 0}
                onChange={toggleAll}
              />
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400">
              Profile
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400">
              Status
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400">
              Phone
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400">
              Network
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400">
              Last Activity
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-dark-700 dark:bg-dark-850">
          {profiles.map((profile) => {
            const statusInfo = getProfileStatus(profile)
            
            return (
              <React.Fragment key={profile.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                  <td className="relative w-12 px-6 sm:w-16 sm:px-8">
                    <input
                      type="checkbox"
                      className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-dark-600 dark:text-dark-100 dark:focus:ring-dark-400 dark:bg-dark-800"
                      checked={selectedIds.includes(profile.id)}
                      onChange={() => toggleSelection(profile.id)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/profiles/${profile.id}`} className="group">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-dark-700 flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-500 dark:text-dark-400" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 group-hover:text-gray-700 dark:text-dark-100 dark:group-hover:text-dark-200">
                            {profile.tiktok_username || 'Unnamed Profile'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-dark-400 font-mono">
                            {profile.geelark_profile_id ? `ID: ${profile.geelark_profile_id.slice(-8)}` : 'No GeeLark ID'}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ProfileOperationalStatus 
                      profile={profile} 
                      showProgress={true}
                      showMessage={true}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        statusInfo.isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`} />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {statusInfo.isOnline ? 'Online' : 'Offline'}
                      </span>
                      {profile.phone?.battery && statusInfo.isOnline && (
                        <div className="flex items-center gap-1 text-gray-500">
                          <Battery className="h-3 w-3" />
                          <span className="text-xs">{profile.phone.battery}%</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {profile.proxy ? (
                      <div className="flex items-center gap-2">
                        <Shield className={`h-4 w-4 ${
                          profile.proxy.health === 'good' ? 'text-green-500' :
                          profile.proxy.health === 'slow' ? 'text-yellow-500' :
                          profile.proxy.health === 'blocked' ? 'text-red-500' :
                          'text-gray-400'
                        }`} />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {profile.proxy.type.toUpperCase()}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <WifiOff className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-400">No proxy</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-dark-400">
                    {getLastActivity(profile)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {getQuickActions(profile)}
                      {profile.geelark_profile_id && (
                        <ScreenshotViewer
                          profileId={profile.geelark_profile_id}
                          profileName={profile.tiktok_username || 'Unnamed'}
                          phoneStatus={statusInfo.isOnline ? 'started' : 'stopped'}
                        />
                      )}
                      <button 
                        onClick={() => toggleRowExpansion(profile.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors dark:text-dark-500 dark:hover:text-dark-100 dark:hover:bg-dark-700"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedRows.includes(profile.id) ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedRows.includes(profile.id) && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 bg-gray-50 dark:bg-dark-800">
                      <div className="text-sm space-y-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Created:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">{formatRelativeTime(profile.created_at)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Warmup:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">{profile.warmup_progress}%</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Errors:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">{profile.error_count}</span>
                          </div>
                          {profile.proxy && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Proxy:</span>
                              <span className="ml-2 text-gray-900 dark:text-gray-100">{profile.proxy.label}</span>
                            </div>
                          )}
                        </div>
                        {profile.last_error && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                            <span className="text-red-800 dark:text-red-300 text-xs">Last error: {profile.last_error}</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="bg-gray-50 dark:bg-dark-800 px-6 py-3 border-t border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {selectedIds.length} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onBulkAction('engage', selectedIds)}
                className="btn-primary btn-sm flex items-center gap-1"
              >
                <Heart className="h-3 w-3" />
                Engage
              </button>
              <button
                onClick={() => onBulkAction('start-phone', selectedIds)}
                className="btn-secondary btn-sm"
              >
                Start Phones
              </button>
              <button
                onClick={() => onBulkAction('stop-phone', selectedIds)}
                className="btn-secondary btn-sm"
              >
                Stop Phones
              </button>
              <button
                onClick={() => onBulkAction('assign-proxy', selectedIds)}
                className="btn-secondary btn-sm"
              >
                Assign Proxy
              </button>
              <button
                onClick={() => onBulkAction('delete', selectedIds)}
                className="btn-secondary btn-sm text-red-600 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 