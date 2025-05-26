'use client'

import { useState } from 'react'
import { ProfilesTable } from '@/components/tables/profiles-table'
import { ProfileBulkActions } from '@/components/profile-bulk-actions'
import { AssignProxyModal } from '@/components/assign-proxy-modal'

interface ProfilesPageWrapperProps {
  profiles: any[]
}

export function ProfilesPageWrapper({ profiles }: ProfilesPageWrapperProps) {
  const [bulkAction, setBulkAction] = useState<{ action: string; ids: string[] } | null>(null)
  const [showProxyModal, setShowProxyModal] = useState(false)
  const [pendingProxyAssignment, setPendingProxyAssignment] = useState<string[]>([])

  const handleBulkAction = (action: string, ids: string[]) => {
    console.log('Bulk action triggered:', action, ids)
    
    if (action === 'assign-proxy') {
      setPendingProxyAssignment(ids)
      setShowProxyModal(true)
    } else {
      setBulkAction({ action, ids })
    }
  }

  const handleProxyAssignment = async (proxyType: string) => {
    setShowProxyModal(false)
    
    // Make the API call
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

      // Show success message
      setBulkAction({ 
        action: 'proxy-assigned', 
        ids: pendingProxyAssignment 
      })

      // Refresh the page after a delay
      setTimeout(() => {
        window.location.reload()
      }, 2000)

    } catch (error) {
      console.error('Proxy assignment error:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    
    setPendingProxyAssignment([])
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
          onComplete={() => setBulkAction(null)}
        />
      )}

      {bulkAction?.action === 'proxy-assigned' && (
        <div className="fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
          Proxy assignment completed successfully!
        </div>
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
    </>
  )
} 