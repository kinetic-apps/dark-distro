'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'
import { 
  MoreVertical,
  User,
  ChevronDown,
  Plus,
  Power,
  Camera,
  Play,
  Image as ImageIcon,
  Activity,
  Heart,
  Crown,
  Edit,
  Tag
} from 'lucide-react'
import { ProfileOperationalStatus } from '@/components/profile-operational-status'
import { ScreenshotViewer } from '@/components/screenshot-viewer'
import { getProfileStatus } from '@/lib/utils/profile-status'
import { ReadyStatusModal } from '@/components/ready-status-modal'
import { useNotification } from '@/lib/context/notification-context'
import TagEditorModal from '@/components/tag-editor-modal'
import { useRouter } from 'next/navigation'

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
  ready_for_actions?: boolean
  meta?: {
    geelark_serial_no?: string
    [key: string]: any
  }
  current_setup_step?: string
  setup_progress?: number
  phone?: {
    battery: number | null
    last_heartbeat: string | null
    tags?: string[]
    remark?: string | null
  }
  tasks?: Array<{
    id: string
    type: string
    status: string
    created_at: string
    completed_at: string | null
    started_at: string | null
  }>
  tags?: string[]
  remark?: string | null
}

interface ProfilesTableV2Props {
  profiles: Profile[]
  onBulkAction: (action: string, ids: string[]) => void
}

function RemarkCell({ remark, accountId }: { remark: string | null; accountId: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(remark || '')
  const { notify } = useNotification()

  const save = async () => {
    if (value === remark) {
      setEditing(false)
      return
    }
    try {
      const resp = await fetch('/api/phones/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, remark: value })
      })
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error || 'Failed')
      }
      notify('success', 'Remark updated')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to update')
      setValue(remark || '')
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        className="input w-full max-w-xs text-sm"
        value={value}
        autoFocus
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            save()
          }
        }}
      />
    )
  }
  return (
    <div
      className="text-sm text-gray-600 dark:text-dark-400 cursor-pointer max-w-xs truncate"
      title={remark || ''}
      onClick={() => setEditing(true)}
    >
      {remark || <span className="text-gray-400 italic">Add remark</span>}
    </div>
  )
}

export function ProfilesTableV2({ profiles, onBulkAction }: ProfilesTableV2Props) {
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])
  const [expandedRows, setExpandedRows] = useState<string[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [bulkAction, setBulkAction] = useState<'delete' | 'edit' | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({
    proxy_id: '',
    ready_for_actions: ''
  })
  const [readyStatusModal, setReadyStatusModal] = useState<{
    profileId: string
    profileName: string
    currentStatus: boolean
  } | null>(null)
  const [tagEditorState, setTagEditorState] = useState<{
    isOpen: boolean
    accountId: string
    currentTags: string[]
  }>({ isOpen: false, accountId: '', currentTags: [] })
  const { notify } = useNotification()

  const router = useRouter()

  const toggleSelection = (id: string) => {
    setSelectedProfiles(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const toggleAll = () => {
    setSelectedProfiles(prev => 
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

  const handleReadyStatusClick = (profile: Profile) => {
    setReadyStatusModal({
      profileId: profile.id,
      profileName: profile.tiktok_username || 'Unnamed Profile',
      currentStatus: profile.ready_for_actions || false
    })
  }

  const handleReadyStatusConfirm = async () => {
    if (!readyStatusModal) return

    try {
      const response = await fetch('/api/profiles/toggle-ready', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId: readyStatusModal.profileId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update ready status')
      }

      notify('success', `Profile ${data.ready_for_actions ? 'marked as ready' : 'ready status removed'}`)
      
      // Refresh the page to show updated status
      window.location.reload()

    } catch (error) {
      console.error('Ready status update error:', error)
      notify('error', error instanceof Error ? error.message : 'Failed to update ready status')
    } finally {
      setReadyStatusModal(null)
    }
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
    <>
      {/* Bulk actions - moved to top */}
      {selectedProfiles.length > 0 && (
        <div className="bg-gray-50 dark:bg-dark-800 px-6 py-3 border border-gray-200 dark:border-dark-700 rounded-t-lg mb-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {selectedProfiles.length} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onBulkAction('start-phone', selectedProfiles)}
                className="btn-sm px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                Start Phones
              </button>
              <button
                onClick={() => onBulkAction('stop-phone', selectedProfiles)}
                className="btn-sm px-3 py-1.5 text-sm font-medium rounded-md bg-yellow-600 text-white hover:bg-yellow-700 transition-colors"
              >
                Stop Phones
              </button>
              <button
                onClick={() => onBulkAction('engage', selectedProfiles)}
                className="btn-primary btn-sm flex items-center gap-1"
              >
                <Heart className="h-3 w-3" />
                Engage
              </button>
              <button
                onClick={() => onBulkAction('warmup', selectedProfiles)}
                className="btn-secondary btn-sm flex items-center gap-1"
              >
                <Activity className="h-3 w-3" />
                Warmup
              </button>
              <button
                onClick={() => onBulkAction('edit-profile', selectedProfiles)}
                className="btn-secondary btn-sm flex items-center gap-1"
              >
                <Edit className="h-3 w-3" />
                Edit
              </button>
              <button
                onClick={() => onBulkAction('fix-status', selectedProfiles)}
                className="btn-secondary btn-sm"
              >
                Fix Status
              </button>
              <button
                onClick={() => onBulkAction('delete', selectedProfiles)}
                className="btn-sm px-3 py-1.5 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`overflow-hidden bg-white border border-gray-200 shadow-sm dark:bg-dark-850 dark:border-dark-700 ${selectedProfiles.length > 0 ? 'rounded-b-lg border-t-0' : 'rounded-lg'}`}>
        <table className="w-full divide-y divide-gray-200 dark:divide-dark-700 table-fixed">
          <thead className="bg-gray-50 dark:bg-dark-800">
            <tr>
              <th scope="col" className="relative w-12 px-4">
                <input
                  type="checkbox"
                  className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-dark-600 dark:text-dark-100 dark:focus:ring-dark-400 dark:bg-dark-800"
                  checked={selectedProfiles.length === profiles.length && profiles.length > 0}
                  onChange={toggleAll}
                />
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400 w-[220px]">
                Profile
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400 w-[180px]">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400 w-[180px]">
                Tags
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400 w-[180px]">
                Remark
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400 w-[160px]">
                Last Activity
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-dark-400 w-[280px]">
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
                    <td className="relative w-12 px-4">
                      <input
                        type="checkbox"
                        className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-dark-600 dark:text-dark-100 dark:focus:ring-dark-400 dark:bg-dark-800"
                        checked={selectedProfiles.includes(profile.id)}
                        onChange={() => toggleSelection(profile.id)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {/* Online indicator */}
                        <div className={`mr-2 h-2 w-2 rounded-full flex-shrink-0 ${
                          statusInfo.isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`} title={statusInfo.isOnline ? 'Phone online' : 'Phone offline'} />
                        
                        <button
                          onClick={() => handleReadyStatusClick(profile)}
                          className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-200 dark:bg-dark-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors cursor-pointer mr-3"
                          title={profile.ready_for_actions ? "Remove ready status" : "Mark as ready for actions"}
                        >
                          {profile.ready_for_actions ? (
                            <Crown className="h-5 w-5 text-yellow-500" />
                          ) : (
                            <User className="h-5 w-5 text-gray-500 dark:text-dark-400" />
                          )}
                        </button>
                        <Link href={`/profiles/${profile.id}`} className="group">
                          <div>
                            <div className="text-sm font-medium text-gray-900 group-hover:text-gray-700 dark:text-dark-100 dark:group-hover:text-dark-200">
                              {profile.tiktok_username || 'Unnamed Profile'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-dark-400 font-mono">
                              {profile.meta?.geelark_serial_no ? `ID: ${profile.meta.geelark_serial_no}` : 'No Serial'}
                            </div>
                          </div>
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ProfileOperationalStatus 
                        profile={profile} 
                        showProgress={true}
                        showMessage={true}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap max-w-xs">
                      <div 
                        onClick={() => setTagEditorState({
                          isOpen: true,
                          accountId: profile.id,
                          currentTags: profile.phone?.tags || []
                        })}
                        className="cursor-pointer group"
                      >
                        {profile.phone?.tags && profile.phone.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {profile.phone.tags.slice(0,4).map((tag: string) => (
                              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-dark-300 group-hover:bg-gray-200 dark:group-hover:bg-dark-600 transition-colors">
                                <Tag className="h-3 w-3" /> {tag}
                              </span>
                            ))}
                            {profile.phone.tags.length > 4 && (
                              <span className="text-xs text-gray-500">+{profile.phone.tags.length - 4}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic group-hover:text-gray-600 dark:group-hover:text-dark-300 transition-colors">Click to add tags</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap max-w-xs">
                      <RemarkCell remark={profile.phone?.remark || null} accountId={profile.id} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-dark-400">
                      {getLastActivity(profile)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center gap-1 justify-end">
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
                        <div className="text-sm space-y-4">
                          {/* Profile Details */}
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</div>
                              <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatRelativeTime(profile.created_at)}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Warmup Progress</div>
                              <div className="mt-1">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-200 dark:bg-dark-700 rounded-full h-2">
                                    <div 
                                      className="bg-green-500 h-2 rounded-full transition-all"
                                      style={{ width: `${profile.warmup_progress}%` }}
                                    />
                                  </div>
                                  <span className="text-sm text-gray-900 dark:text-gray-100">{profile.warmup_progress}%</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Error Count</div>
                              <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">{profile.error_count || 0}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">GeeLark ID</div>
                              <div className="mt-1 text-sm font-mono text-gray-900 dark:text-gray-100">
                                {profile.geelark_profile_id || 'Not assigned'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Account Status</div>
                              <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">{profile.status}</div>
                            </div>
                          </div>

                          {/* Recent Tasks */}
                          {profile.tasks && profile.tasks.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Recent Tasks</h4>
                              <div className="space-y-1">
                                {profile.tasks.slice(0, 3).map(task => (
                                  <div key={task.id} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">
                                      {task.type.replace(/_/g, ' ')}
                                    </span>
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                                      task.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                                      task.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                                      task.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                                      'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                                    }`}>
                                      {task.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Error Details */}
                          {profile.last_error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                              <h4 className="text-xs font-medium text-red-800 dark:text-red-400 uppercase tracking-wider mb-1">Last Error</h4>
                              <p className="text-sm text-red-700 dark:text-red-300">{profile.last_error}</p>
                            </div>
                          )}

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-dark-700">
                            <Link 
                              href={`/profiles/${profile.id}`}
                              className="btn-secondary btn-sm"
                            >
                              View Details
                            </Link>
                            {profile.geelark_profile_id && (
                              <button
                                onClick={() => router.push(`/screenshots?profileId=${profile.geelark_profile_id}`)}
                                className="btn-secondary btn-sm"
                              >
                                View Screenshots
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>

        {/* Ready Status Modal */}
        {readyStatusModal && (
          <ReadyStatusModal
            profileName={readyStatusModal.profileName}
            currentStatus={readyStatusModal.currentStatus}
            onConfirm={handleReadyStatusConfirm}
            onCancel={() => setReadyStatusModal(null)}
          />
        )}
      </div>

      {/* Tag Editor Modal */}
      <TagEditorModal
        isOpen={tagEditorState.isOpen}
        onClose={() => setTagEditorState({ isOpen: false, accountId: '', currentTags: [] })}
        accountId={tagEditorState.accountId}
        currentTags={tagEditorState.currentTags}
        onUpdate={(newTags) => {
          // Update the local state to reflect the change immediately
          const profileIndex = profiles.findIndex(p => p.id === tagEditorState.accountId)
          if (profileIndex !== -1 && profiles[profileIndex].phone) {
            profiles[profileIndex].phone.tags = newTags
          }
        }}
      />
    </>
  )
} 