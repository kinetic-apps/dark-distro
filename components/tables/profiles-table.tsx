'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'
import { 
  MoreVertical, 
  Play, 
  Wifi, 
  AlertCircle,
  CheckCircle,
  Clock,
  Image as ImageIcon,
  Camera,
  ChevronDown,
  User,
  Shield,
  Smartphone,
  Battery,
  WifiOff,
  Activity,
  Plus,
  Power,
  LogIn,
  Edit,
  Upload,
  Trash2
} from 'lucide-react'
import { VariantAssignmentModal } from '@/components/variant-assignment-modal'
import { ProfileStatus } from '@/components/profile-status'
import { ScreenshotViewer } from '@/components/screenshot-viewer'
import { TikTokLoginModal } from '@/components/tiktok-login-modal'

interface Profile {
  id: string
  tiktok_username: string | null
  geelark_profile_id: string | null
  status: 'new' | 'warming_up' | 'active' | 'paused' | 'banned'
  warmup_done: boolean
  warmup_progress: number
  error_count: number
  last_error: string | null
  created_at: string
  updated_at: string
  proxy_id?: string | null
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
}

interface ProfilesTableProps {
  profiles: Profile[]
  onBulkAction: (action: string, ids: string[]) => void
}

export function ProfilesTable({ profiles, onBulkAction }: ProfilesTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [assigningProfile, setAssigningProfile] = useState<{id: string, name: string} | null>(null)
  const [phoneStatuses, setPhoneStatuses] = useState<Record<string, 'started' | 'starting' | 'stopped' | 'expired' | 'unknown'>>({})
  const [expandedRows, setExpandedRows] = useState<string[]>([])
  const [loginProfile, setLoginProfile] = useState<{id: string, name: string, accountId: string} | null>(null)

  // Fetch phone statuses on mount
  useEffect(() => {
    const fetchStatuses = async () => {
      const profileIds = profiles
        .filter(p => p.geelark_profile_id)
        .map(p => p.geelark_profile_id!)

      if (profileIds.length === 0) return

      try {
        const response = await fetch('/api/geelark/phone-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile_ids: profileIds })
        })

        const data = await response.json()
        if (response.ok && data.statuses) {
          const statusMap: Record<string, any> = {}
          data.statuses.forEach((status: any) => {
            statusMap[status.profile_id] = status.status
          })
          setPhoneStatuses(statusMap)
        }
      } catch (error) {
        console.error('Failed to fetch phone statuses:', error)
      }
    }

    fetchStatuses()
  }, [profiles])

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

  const getStatusIcon = (status: Profile['status'], warmupProgress: number) => {
    switch (status) {
      case 'new':
        return <Clock className="h-4 w-4 text-gray-400" />
      case 'warming_up':
        return <div className="flex items-center">
          <Activity className="h-4 w-4 text-yellow-500 mr-1 animate-pulse" />
          <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">{warmupProgress}%</span>
        </div>
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'paused':
        return <Power className="h-4 w-4 text-gray-400" />
      case 'banned':
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: Profile['status']) => {
    const classes = {
      new: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      warming_up: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      paused: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      banned: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }
    
    const labels = {
      new: 'New',
      warming_up: 'Warming Up',
      active: 'Active',
      paused: 'Paused',
      banned: 'Banned'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const handleAssignVariant = (profile: Profile) => {
    if (profile.status !== 'active') {
      alert('Profile must be active to assign carousel variants')
      return
    }
    
    setAssigningProfile({
      id: profile.geelark_profile_id || profile.id,
      name: profile.tiktok_username || 'Unnamed Profile'
    })
  }

  const getProxyHealthColor = (health: string) => {
    switch (health) {
      case 'good':
        return 'text-green-500'
      case 'slow':
        return 'text-yellow-500'
      case 'blocked':
        return 'text-red-500'
      default:
        return 'text-gray-400'
    }
  }

  const getBatteryIcon = (battery: number | null) => {
    if (!battery) return null
    
    const color = battery > 50 ? 'text-green-500' : battery > 20 ? 'text-yellow-500' : 'text-red-500'
    return (
      <div className={`flex items-center gap-1 ${color}`}>
        <Battery className="h-3 w-3" />
        <span className="text-xs font-medium">{battery}%</span>
      </div>
    )
  }

  const hasAvailableActions = (profile: Profile) => {
    const phoneStatus = profile.geelark_profile_id ? phoneStatuses[profile.geelark_profile_id] : null
    
    // Check if any actions are available
    if (profile.status === 'new') return true // Can start warmup
    if (profile.status === 'active') return true // Can post content
    if (!profile.proxy_id) return true // Can assign proxy
    if (profile.geelark_profile_id && phoneStatus !== 'started' && phoneStatus !== 'starting') return true // Can start phone
    if (phoneStatus === 'started' || phoneStatus === 'starting') return true // Can stop phone or do other actions
    
    return false
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
    <>
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
                Connection
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400">
                Device
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400">
                Activity
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-dark-700 dark:bg-dark-850">
            {profiles.map((profile) => (
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
                    <div className="flex items-center gap-2">
                    {getStatusIcon(profile.status, profile.warmup_progress)}
                      {getStatusBadge(profile.status)}
                    </div>
                    {profile.error_count > 0 && (
                      <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {profile.error_count} error{profile.error_count > 1 ? 's' : ''}
                  </div>
                    )}
                </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                  {profile.proxy ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Wifi className={`h-4 w-4 ${getProxyHealthColor(profile.proxy.health)}`} />
                          <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                            {profile.proxy.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-400">
                          <Shield className="h-3 w-3" />
                          <span>{profile.proxy.type}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <WifiOff className="h-4 w-4" />
                        <span>No proxy</span>
                    </div>
                  )}
                </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                  {profile.geelark_profile_id ? (
                      <div className="space-y-1">
                    <ProfileStatus profileId={profile.geelark_profile_id} />
                        {profile.phone?.battery && getBatteryIcon(profile.phone.battery)}
                      </div>
                  ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Smartphone className="h-4 w-4" />
                        <span>No device</span>
                      </div>
                  )}
                </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-dark-400">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{profile.phone?.last_heartbeat 
                    ? formatRelativeTime(profile.phone.last_heartbeat)
                    : 'Never'
                        }</span>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-dark-500">
                        Created {formatRelativeTime(profile.created_at)}
                      </div>
                    </div>
                </td>
                <td className="relative whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    {profile.geelark_profile_id && (
                      <ScreenshotViewer
                        profileId={profile.geelark_profile_id}
                        profileName={profile.tiktok_username || 'Unnamed'}
                        phoneStatus={phoneStatuses[profile.geelark_profile_id] || 'unknown'}
                      />
                    )}
                    {profile.status === 'active' && (
                      <button
                        onClick={() => handleAssignVariant(profile)}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors dark:text-dark-400 dark:hover:text-dark-100 dark:hover:bg-dark-700"
                        title="Assign Carousel"
                      >
                          <ImageIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => toggleRowExpansion(profile.id)}
                        className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors dark:text-dark-500 dark:hover:text-dark-100 dark:hover:bg-dark-700"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedRows.includes(profile.id) ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedRows.includes(profile.id) && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 bg-gray-50 dark:bg-dark-800">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-dark-100 mb-2">Profile Details</h4>
                          <dl className="space-y-1">
                            <div className="flex justify-between">
                              <dt className="text-gray-500 dark:text-dark-400">Warmup Progress:</dt>
                              <dd className="text-gray-900 dark:text-dark-100">{profile.warmup_progress}%</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500 dark:text-dark-400">Error Count:</dt>
                              <dd className="text-gray-900 dark:text-dark-100">{profile.error_count}</dd>
                            </div>
                          </dl>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-dark-100 mb-2">Quick Actions</h4>
                          {!hasAvailableActions(profile) ? (
                            <p className="text-sm text-gray-500 dark:text-dark-400 italic">
                              No actions available for this profile status
                            </p>
                          ) : (
                          <div className="flex flex-wrap gap-2">
                            {/* Phone Control Actions */}
                            {profile.geelark_profile_id && (
                              <>
                                {phoneStatuses[profile.geelark_profile_id] !== 'started' && phoneStatuses[profile.geelark_profile_id] !== 'starting' && (
                                  <button
                                    onClick={() => onBulkAction('start-phone', [profile.id])}
                                    className="btn-secondary btn-sm flex items-center gap-1"
                                    title="Start GeeLark phone"
                                  >
                                    <Power className="h-3 w-3" />
                                    Start Phone
                                  </button>
                                )}
                                {(phoneStatuses[profile.geelark_profile_id] === 'started' || phoneStatuses[profile.geelark_profile_id] === 'starting') && (
                                  <button
                                    onClick={() => onBulkAction('stop-phone', [profile.id])}
                                    className="btn-secondary btn-sm flex items-center gap-1"
                                    title="Stop GeeLark phone"
                                  >
                                    <Power className="h-3 w-3 text-red-500" />
                                    Stop Phone
                                  </button>
                                )}
                                {phoneStatuses[profile.geelark_profile_id] === 'started' && (
                                  <button
                                    onClick={() => onBulkAction('screenshot', [profile.id])}
                                    className="btn-secondary btn-sm flex items-center gap-1"
                                    title="Take screenshot"
                                  >
                                    <Camera className="h-3 w-3" />
                                    Screenshot
                                  </button>
                                )}
                              </>
                            )}
                            
                            {/* Task Actions */}
                            {(profile.status === 'new' || profile.status === 'active') && profile.geelark_profile_id && phoneStatuses[profile.geelark_profile_id] === 'started' && (
                              <button
                                onClick={() => onBulkAction('warmup', [profile.id])}
                                className="btn-secondary btn-sm flex items-center gap-1"
                                title="Start TikTok warmup"
                              >
                                <Activity className="h-3 w-3" />
                                Start Warmup
                              </button>
                            )}
                            
                            {profile.status === 'active' && (
                              <>
                                <button
                                  onClick={() => onBulkAction('post-video', [profile.id])}
                                  className="btn-secondary btn-sm flex items-center gap-1"
                                  title="Post TikTok video"
                                >
                                  <Play className="h-3 w-3" />
                                  Post Video
                                </button>
                                <button
                                  onClick={() => onBulkAction('post-carousel', [profile.id])}
                                  className="btn-secondary btn-sm flex items-center gap-1"
                                  title="Post TikTok carousel"
                                >
                                  <ImageIcon className="h-3 w-3" />
                                  Post Carousel
                                </button>
                              </>
                            )}
                            
                            {/* TikTok Actions */}
                            {profile.geelark_profile_id && phoneStatuses[profile.geelark_profile_id] === 'started' && (
                              <>
                                <button
                                  onClick={() => setLoginProfile({
                                    id: profile.geelark_profile_id!,
                                    name: profile.tiktok_username || 'Unnamed Profile',
                                    accountId: profile.id
                                  })}
                                  className="btn-secondary btn-sm flex items-center gap-1"
                                  title="Login to TikTok"
                                >
                                  <LogIn className="h-3 w-3" />
                                  TikTok Login
                                </button>
                                <button
                                  onClick={() => onBulkAction('edit-profile', [profile.id])}
                                  className="btn-secondary btn-sm flex items-center gap-1"
                                  title="Edit TikTok profile"
                                >
                                  <Edit className="h-3 w-3" />
                                  Edit Profile
                                </button>
                              </>
                            )}
                            
                            {/* Proxy Actions */}
                            {!profile.proxy_id && (
                              <button
                                onClick={() => onBulkAction('assign-proxy', [profile.id])}
                                className="btn-secondary btn-sm flex items-center gap-1"
                                title="Assign proxy to profile"
                              >
                                <Wifi className="h-3 w-3" />
                                Assign Proxy
                    </button>
                            )}
                            
                            {/* File Management */}
                            {profile.geelark_profile_id && phoneStatuses[profile.geelark_profile_id] === 'started' && (
                              <button
                                onClick={() => onBulkAction('upload-files', [profile.id])}
                                className="btn-secondary btn-sm flex items-center gap-1"
                                title="Upload files to phone"
                              >
                                <Upload className="h-3 w-3" />
                                Upload Files
                              </button>
                            )}
                          </div>
                          )}
                        </div>
                        {profile.last_error && (
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-dark-100 mb-2">Last Error</h4>
                            <p className="text-red-600 dark:text-red-400 text-xs">
                              {profile.last_error}
                            </p>
                          </div>
                        )}
                  </div>
                </td>
              </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        
        {selectedIds.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 dark:bg-dark-800 dark:border-dark-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-dark-300">
                {selectedIds.length} profile{selectedIds.length !== 1 ? 's' : ''} selected
              </span>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-dark-400 dark:hover:text-dark-200"
                >
                  Clear selection
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onBulkAction('warmup', selectedIds)}
                  className="btn-secondary text-sm"
                  title="Start warmup for selected profiles"
                >
                  <Play className="h-3 w-3 mr-1.5" />
                  Run Warm-Up
                </button>
                <button
                  onClick={() => onBulkAction('start-phone', selectedIds)}
                  className="btn-secondary text-sm"
                  title="Start phones for selected profiles"
                >
                  <Smartphone className="h-3 w-3 mr-1.5" />
                  Start Phones
                </button>
                <button
                  onClick={() => onBulkAction('stop-phone', selectedIds)}
                  className="btn-secondary text-sm"
                  title="Stop phones for selected profiles"
                >
                  <Smartphone className="h-3 w-3 mr-1.5" />
                  Stop Phones
                </button>
                <button
                  onClick={() => onBulkAction('assign-proxy', selectedIds)}
                  className="btn-secondary text-sm"
                  title="Assign proxy to selected profiles"
                >
                  <Wifi className="h-3 w-3 mr-1.5" />
                  Assign Proxy
                </button>
                <button
                  onClick={() => onBulkAction('sync-profiles', selectedIds)}
                  className="btn-secondary text-sm"
                  title="Sync selected profiles with GeeLark"
                >
                  <Activity className="h-3 w-3 mr-1.5" />
                  Sync Status
                </button>
                <button
                  onClick={() => onBulkAction('delete', selectedIds)}
                  className="btn-danger text-sm"
                  title="Delete selected profiles from database only"
                >
                  <Trash2 className="h-3 w-3 mr-1.5" />
                  Delete from DB
                </button>
                <button
                  onClick={() => onBulkAction('delete-from-geelark', selectedIds)}
                  className="btn-danger text-sm"
                  title="Delete selected profiles from both database and GeeLark"
                >
                  <Trash2 className="h-3 w-3 mr-1.5" />
                  Delete from GeeLark
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {assigningProfile && (
        <VariantAssignmentModal
          profileId={assigningProfile.id}
          profileName={assigningProfile.name}
          onClose={() => setAssigningProfile(null)}
          onAssign={(variantId) => {
            console.log(`Assigned variant ${variantId} to profile ${assigningProfile.id}`)
            // Optionally refresh the table or show a success message
          }}
        />
      )}

      {loginProfile && (
        <TikTokLoginModal
          profileId={loginProfile.id}
          profileName={loginProfile.name}
          accountId={loginProfile.accountId}
          onClose={() => setLoginProfile(null)}
        />
      )}
    </>
  )
}