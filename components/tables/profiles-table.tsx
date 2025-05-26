'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'
import { 
  MoreVertical, 
  Play, 
  Pause, 
  Wifi, 
  AlertCircle,
  CheckCircle,
  Clock,
  Image as ImageIcon
} from 'lucide-react'
import { VariantAssignmentModal } from '@/components/variant-assignment-modal'

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

  const getStatusIcon = (status: Profile['status'], warmupProgress: number) => {
    switch (status) {
      case 'new':
        return <Clock className="h-4 w-4 text-gray-400" />
      case 'warming_up':
        return <div className="flex items-center">
          <Play className="h-4 w-4 text-yellow-500 mr-1" />
          <span className="text-xs text-gray-500 dark:text-dark-400">{warmupProgress}%</span>
        </div>
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'paused':
        return <Pause className="h-4 w-4 text-gray-400" />
      case 'banned':
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: Profile['status']) => {
    const classes = {
      new: 'status-neutral',
      warming_up: 'status-warning',
      active: 'status-active',
      paused: 'status-neutral',
      banned: 'status-error'
    }
    
    const labels = {
      new: 'New',
      warming_up: 'Warming Up',
      active: 'Active',
      paused: 'Paused',
      banned: 'Banned'
    }

    return (
      <span className={classes[status]}>
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

  return (
    <>
      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg dark:bg-dark-850 dark:border-dark-700">
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
              <th scope="col" className="table-header">
                Profile
              </th>
              <th scope="col" className="table-header">
                Status
              </th>
              <th scope="col" className="table-header">
                Proxy
              </th>
              <th scope="col" className="table-header">
                Phone Status
              </th>
              <th scope="col" className="table-header">
                Last Active
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-dark-700 dark:bg-dark-850">
            {profiles.map((profile) => (
              <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                <td className="relative w-12 px-6 sm:w-16 sm:px-8">
                  <input
                    type="checkbox"
                    className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-dark-600 dark:text-dark-100 dark:focus:ring-dark-400 dark:bg-dark-800"
                    checked={selectedIds.includes(profile.id)}
                    onChange={() => toggleSelection(profile.id)}
                  />
                </td>
                <td className="table-cell">
                  <Link href={`/profiles/${profile.id}`} className="group">
                    <div>
                      <p className="font-medium text-gray-900 group-hover:text-gray-700 dark:text-dark-100 dark:group-hover:text-dark-200">
                        {profile.tiktok_username || 'Unnamed'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        {profile.geelark_profile_id?.slice(-8) || 'No ID'}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="table-cell">
                  <div className="flex items-center">
                    {getStatusIcon(profile.status, profile.warmup_progress)}
                    <span className="ml-2">{getStatusBadge(profile.status)}</span>
                  </div>
                </td>
                <td className="table-cell">
                  {profile.proxy ? (
                    <div className="flex items-center">
                      <Wifi className={`h-4 w-4 mr-2 ${
                        profile.proxy.health === 'good' ? 'text-green-500' : 
                        profile.proxy.health === 'slow' ? 'text-yellow-500' : 
                        'text-red-500'
                      }`} />
                      <div>
                        <p className="text-sm text-gray-900 dark:text-dark-100">{profile.proxy.label}</p>
                        <p className="text-xs text-gray-500 dark:text-dark-400">{profile.proxy.type}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">No proxy</span>
                  )}
                </td>
                <td className="table-cell">
                  {profile.phone ? (
                    <div className="flex items-center">
                      <div className={`h-2 w-2 rounded-full mr-2 ${
                        profile.phone.status === 'online' ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                      <div>
                        <p className="text-sm text-gray-900 dark:text-dark-100">
                          {profile.phone.status}
                        </p>
                        {profile.phone.battery && (
                          <p className="text-xs text-gray-500 dark:text-dark-400">
                            {profile.phone.battery}% battery
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Offline</span>
                  )}
                </td>
                <td className="table-cell text-sm text-gray-500">
                  {profile.phone?.last_heartbeat 
                    ? formatRelativeTime(profile.phone.last_heartbeat)
                    : 'Never'
                  }
                </td>
                <td className="relative whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    {profile.status === 'active' && (
                      <button
                        onClick={() => handleAssignVariant(profile)}
                        className="text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100"
                        title="Assign Carousel"
                      >
                        <ImageIcon className="h-5 w-5" />
                      </button>
                    )}
                    <button className="text-gray-400 hover:text-gray-900 dark:text-dark-500 dark:hover:text-dark-100">
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {selectedIds.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 dark:bg-dark-800 dark:border-dark-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-dark-300">
                {selectedIds.length} profile{selectedIds.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => onBulkAction('warmup', selectedIds)}
                  className="btn-secondary text-sm"
                >
                  Run Warm-Up
                </button>
                <button
                  onClick={() => onBulkAction('assign-proxy', selectedIds)}
                  className="btn-secondary text-sm"
                >
                  Assign Proxy
                </button>
                <button
                  onClick={() => onBulkAction('pause', selectedIds)}
                  className="btn-secondary text-sm"
                >
                  Pause
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
    </>
  )
}