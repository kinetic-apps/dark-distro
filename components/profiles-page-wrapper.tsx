'use client'

import { useState } from 'react'
import { ProfilesTableV2 } from '@/components/tables/profiles-table-v2'
import { ProfileBulkActions } from '@/components/profile-bulk-actions'
import { AssignProxyModal } from '@/components/assign-proxy-modal'
import { BulkProxyAssignmentModal } from '@/components/bulk-proxy-assignment-modal'
import { BulkDeleteModal } from '@/components/bulk-delete-modal'
import { EngagementModal, EngagementConfig } from '@/components/engagement-modal'
import { FixStuckStatusModal } from '@/components/fix-stuck-status-modal'
import { BulkProfileEditModal, ProfileEditParams } from '@/components/bulk-profile-edit-modal'
import { useNotification } from '@/lib/context/notification-context'

interface ProfilesPageWrapperProps {
  profiles: any[]
}

export function ProfilesPageWrapper({ profiles }: ProfilesPageWrapperProps) {
  const [bulkAction, setBulkAction] = useState<{ action: string; ids: string[] } | null>(null)
  const [showProxyModal, setShowProxyModal] = useState(false)
  const [showBulkProxyModal, setShowBulkProxyModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEngagementModal, setShowEngagementModal] = useState(false)
  const [showFixStatusModal, setShowFixStatusModal] = useState(false)
  const [showProfileEditModal, setShowProfileEditModal] = useState(false)
  const [pendingProxyAssignment, setPendingProxyAssignment] = useState<string[]>([])
  const [pendingBulkProxyAssignment, setPendingBulkProxyAssignment] = useState<{ ids: string[], names: string[] }>({ ids: [], names: [] })
  const [pendingDeletion, setPendingDeletion] = useState<{ ids: string[], names: string[] }>({ ids: [], names: [] })
  const [pendingEngagement, setPendingEngagement] = useState<string[]>([])
  const [pendingFixStatus, setPendingFixStatus] = useState<string[]>([])
  const [pendingProfileEdit, setPendingProfileEdit] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const { notify } = useNotification()

  const handleBulkAction = (action: string, ids: string[]) => {
    console.log('Bulk action triggered:', action, ids)
    
    if (action === 'assign-proxy') {
      setPendingProxyAssignment(ids)
      setShowProxyModal(true)
    } else if (action === 'change-proxy') {
      // Get profile names for the bulk proxy assignment modal
      const selectedProfiles = profiles.filter(p => ids.includes(p.id))
      const profileNames = selectedProfiles.map(p => p.tiktok_username || 'Unnamed Profile')
      
      setPendingBulkProxyAssignment({ ids, names: profileNames })
      setShowBulkProxyModal(true)
    } else if (action === 'delete' || action === 'delete-from-geelark') {
      // Get profile names for the confirmation modal
      const selectedProfiles = profiles.filter(p => ids.includes(p.id))
      const profileNames = selectedProfiles.map(p => p.tiktok_username || 'Unnamed Profile')
      
      setPendingDeletion({ ids, names: profileNames })
      setShowDeleteModal(true)
    } else if (action === 'engage') {
      setPendingEngagement(ids)
      setShowEngagementModal(true)
    } else if (action === 'fix-status') {
      handleFixStatus(ids)
    } else if (action === 'edit-profile') {
      setPendingProfileEdit(ids)
      setShowProfileEditModal(true)
    } else {
      setBulkAction({ action, ids })
    }
  }

  const handleProxyAssignment = async (proxyType: string) => {
    setShowProxyModal(false)
    setIsProcessing(true)
    
    try {
      const response = await fetch('/api/profiles/assign-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          profileIds: pendingProxyAssignment,
          proxyType 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Assignment failed')
      }

      notify('success', `Successfully assigned ${proxyType} proxy to ${pendingProxyAssignment.length} profile${pendingProxyAssignment.length > 1 ? 's' : ''}`)

      // Refresh the page after a delay
      setTimeout(() => {
        window.location.reload()
      }, 2000)

    } catch (error) {
      console.error('Proxy assignment error:', error)
      notify('error', error instanceof Error ? error.message : 'Failed to assign proxy')
    } finally {
      setIsProcessing(false)
      setPendingProxyAssignment([])
    }
  }

  const handleBulkProxyAssignment = async (selectedGroups: string[]) => {
    setShowBulkProxyModal(false)
    setIsProcessing(true)
    
    try {
      const response = await fetch('/api/profiles/assign-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          profileIds: pendingBulkProxyAssignment.ids,
          selectedGroups 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Assignment failed')
      }

      // Show summary
      notify('success', `Proxy assignment completed: ${data.summary.successful} successful, ${data.summary.failed} failed`)

      // Show individual errors if any
      if (data.errors && data.errors.length > 0) {
        data.errors.slice(0, 3).forEach((error: any) => {
          notify('error', `${error.profileName}: ${error.error}`)
        })
      }

      // Refresh the page after a delay
      setTimeout(() => {
        window.location.reload()
      }, 2000)

    } catch (error) {
      console.error('Bulk proxy assignment error:', error)
      notify('error', error instanceof Error ? error.message : 'Failed to assign proxies')
    } finally {
      setIsProcessing(false)
      setPendingBulkProxyAssignment({ ids: [], names: [] })
    }
  }

  const handleBulkDelete = async (deleteFromGeelark: boolean) => {
    setShowDeleteModal(false)
    setIsProcessing(true)
    
    try {
      const response = await fetch('/api/profiles/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          profileIds: pendingDeletion.ids,
          deleteFromGeelark 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Delete failed')
      }

      notify('success', data.message)

      // Show errors if any
      if (data.errors && data.errors.length > 0) {
        data.errors.slice(0, 3).forEach((error: string) => {
          notify('error', error)
        })
      }

      // Refresh the page after a delay
      setTimeout(() => {
        window.location.reload()
      }, 2000)

    } catch (error) {
      console.error('Bulk delete error:', error)
      notify('error', error instanceof Error ? error.message : 'Failed to delete profiles')
    } finally {
      setIsProcessing(false)
      setPendingDeletion({ ids: [], names: [] })
    }
  }

  const handleEngagement = async (config: EngagementConfig) => {
    setShowEngagementModal(false)
    setIsProcessing(true)
    
    try {
      // Get GeeLark profile IDs from accounts
      const selectedProfiles = profiles
        .filter(p => pendingEngagement.includes(p.id))
        .filter(p => p.geelark_profile_id) // Only profiles with GeeLark IDs
        .map(p => p.geelark_profile_id)
      
      if (selectedProfiles.length === 0) {
        throw new Error('No valid profiles selected. Ensure profiles have GeeLark IDs.')
      }
      
      const response = await fetch('/api/automation/tiktok-engage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_ids: selectedProfiles,
          target_usernames: config.target_usernames,
          posts_per_user: config.posts_per_user,
          like_only: config.like_only
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Engagement failed')
      }

      // Show summary
      notify('success', `Engagement started: ${data.summary.successful_tasks} successful, ${data.summary.failed_tasks} failed`)

      // Show individual errors if any
      data.results
        .filter((r: any) => r.status === 'failed')
        .slice(0, 3)
        .forEach((result: any) => {
          notify('error', `${result.profile_id}: ${result.error || result.message}`)
        })

      // Don't refresh immediately - let user see the results
      
    } catch (error) {
      console.error('Engagement error:', error)
      notify('error', error instanceof Error ? error.message : 'Failed to start engagement')
    } finally {
      setIsProcessing(false)
      setPendingEngagement([])
    }
  }

  const handleFixStatus = async (profileIds: string[]) => {
    setShowFixStatusModal(true)
    setPendingFixStatus(profileIds)
  }

  const handleFixStatusConfirm = async (action: string) => {
    setShowFixStatusModal(false)
    setIsProcessing(true)
    
    try {
      const response = await fetch('/api/profiles/fix-stuck-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          profileIds: pendingFixStatus,
          action: action // Use the selected action
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fix status failed')
      }

      notify('success', data.message)

      // Show errors if any
      if (data.errors && data.errors.length > 0) {
        data.errors.slice(0, 3).forEach((error: string) => {
          notify('error', error)
        })
      }

      // Refresh the page after a delay
      setTimeout(() => {
        window.location.reload()
      }, 1000)

    } catch (error) {
      console.error('Fix status error:', error)
      notify('error', error instanceof Error ? error.message : 'Failed to fix status')
    } finally {
      setIsProcessing(false)
      setPendingFixStatus([])
    }
  }

  const handleProfileEdit = async (params: ProfileEditParams) => {
    setShowProfileEditModal(false)
    setIsProcessing(true)
    
    try {
      // Get GeeLark profile IDs from accounts
      const selectedProfiles = profiles
        .filter(p => pendingProfileEdit.includes(p.id))
        .filter(p => p.geelark_profile_id) // Only profiles with GeeLark IDs
      
      if (selectedProfiles.length === 0) {
        throw new Error('No valid profiles selected. Ensure profiles have GeeLark IDs.')
      }
      
      const response = await fetch('/api/profiles/bulk-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileIds: pendingProfileEdit,
          params
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Profile edit failed')
      }

      // Show summary
      notify('success', `Profile edit started: ${data.summary.successful_tasks} successful, ${data.summary.failed_tasks} failed`)

      // Show individual errors if any
      data.results
        .filter((r: any) => r.status === 'failed')
        .slice(0, 3)
        .forEach((result: any) => {
          notify('error', `${result.profile_id}: ${result.error || result.message}`)
        })

      // Refresh after a delay to show results
      setTimeout(() => {
        window.location.reload()
      }, 2000)
      
    } catch (error) {
      console.error('Profile edit error:', error)
      notify('error', error instanceof Error ? error.message : 'Failed to edit profiles')
    } finally {
      setIsProcessing(false)
      setPendingProfileEdit([])
    }
  }

  return (
    <>
      <ProfilesTableV2
        profiles={profiles}
        onBulkAction={handleBulkAction}
      />
      
      {bulkAction && bulkAction.action !== 'proxy-assigned' && (
        <ProfileBulkActions
          action={bulkAction.action}
          profileIds={bulkAction.ids}
          onComplete={() => {
            setBulkAction(null)
            notify('success', 'Bulk action completed successfully')
          }}
        />
      )}

      {showProxyModal && (
        <AssignProxyModal
          profileIds={pendingProxyAssignment}
          onConfirm={handleProxyAssignment}
          onCancel={() => {
            setShowProxyModal(false)
            setPendingProxyAssignment([])
          }}
        />
      )}

      {showBulkProxyModal && (
        <BulkProxyAssignmentModal
          profileIds={pendingBulkProxyAssignment.ids}
          profileNames={pendingBulkProxyAssignment.names}
          onConfirm={handleBulkProxyAssignment}
          onCancel={() => {
            setShowBulkProxyModal(false)
            setPendingBulkProxyAssignment({ ids: [], names: [] })
          }}
        />
      )}

      {showDeleteModal && (
        <BulkDeleteModal
          profileIds={pendingDeletion.ids}
          profileNames={pendingDeletion.names}
          onConfirm={handleBulkDelete}
          onCancel={() => {
            setShowDeleteModal(false)
            setPendingDeletion({ ids: [], names: [] })
          }}
        />
      )}

      {showEngagementModal && (
        <EngagementModal
          profileIds={pendingEngagement}
          profileCount={pendingEngagement.length}
          onConfirm={handleEngagement}
          onCancel={() => {
            setShowEngagementModal(false)
            setPendingEngagement([])
          }}
        />
      )}

      {showFixStatusModal && (
        <FixStuckStatusModal
          profileIds={pendingFixStatus}
          profileCount={pendingFixStatus.length}
          onConfirm={handleFixStatusConfirm}
          onCancel={() => {
            setShowFixStatusModal(false)
            setPendingFixStatus([])
          }}
        />
      )}

      {showProfileEditModal && (
        <BulkProfileEditModal
          profileIds={pendingProfileEdit}
          profileCount={pendingProfileEdit.length}
          onConfirm={handleProfileEdit}
          onCancel={() => {
            setShowProfileEditModal(false)
            setPendingProfileEdit([])
          }}
        />
      )}
    </>
  )
} 