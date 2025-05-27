'use client'

import { useState } from 'react'
import { ProfilesTable } from '@/components/tables/profiles-table'
import { ProfileBulkActions } from '@/components/profile-bulk-actions'
import { AssignProxyModal } from '@/components/assign-proxy-modal'
import { BulkDeleteModal } from '@/components/bulk-delete-modal'
import { useNotification } from '@/lib/context/notification-context'

interface ProfilesPageWrapperProps {
  profiles: any[]
}

export function ProfilesPageWrapper({ profiles }: ProfilesPageWrapperProps) {
  const [bulkAction, setBulkAction] = useState<{ action: string; ids: string[] } | null>(null)
  const [showProxyModal, setShowProxyModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [pendingProxyAssignment, setPendingProxyAssignment] = useState<string[]>([])
  const [pendingDeletion, setPendingDeletion] = useState<{ ids: string[], names: string[] }>({ ids: [], names: [] })
  const [isProcessing, setIsProcessing] = useState(false)
  const { notify } = useNotification()

  const handleBulkAction = (action: string, ids: string[]) => {
    console.log('Bulk action triggered:', action, ids)
    
    if (action === 'assign-proxy') {
      setPendingProxyAssignment(ids)
      setShowProxyModal(true)
    } else if (action === 'delete' || action === 'delete-from-geelark') {
      // Get profile names for the confirmation modal
      const selectedProfiles = profiles.filter(p => ids.includes(p.id))
      const profileNames = selectedProfiles.map(p => p.tiktok_username || 'Unnamed Profile')
      
      setPendingDeletion({ ids, names: profileNames })
      setShowDeleteModal(true)
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

  return (
    <>
      <ProfilesTable
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
    </>
  )
} 