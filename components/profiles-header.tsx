'use client'

import { useState, useEffect, useRef } from 'react'
import { Phone, Mail, RefreshCw } from 'lucide-react'
import { TikTokCredentialsSetupModal } from '@/components/automation/tiktok-credentials-setup-modal'
import { useRouter } from 'next/navigation'
import { useNotification } from '@/lib/context/notification-context'

export function ProfilesHeader() {
  const [showTikTokCredentialsModal, setShowTikTokCredentialsModal] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [smsQuantity, setSmsQuantity] = useState(1)
  const [isCreatingPhones, setIsCreatingPhones] = useState(false)
  const router = useRouter()
  const { notify } = useNotification()
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const handleSetupSuccess = (accountId: string, profileId: string) => {
    // Navigate to the new profile page
    router.push(`/profiles/${accountId}`)
  }

  const handleSMSSetup = async () => {
    if (smsQuantity < 1 || smsQuantity > 10) {
      notify('error', 'Quantity must be between 1 and 10')
      return
    }

    setIsCreatingPhones(true)
    try {
      const response = await fetch('/api/automation/setup-tiktok-with-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          quantity: smsQuantity,
          // Hard-coded simplified settings from the modal
          use_existing_profile: false,
          device_model: 'Pixel 6',
          android_version: 3, // Android 12
          group_name: 'SPECTRE SMS',
          long_term_rental: true,
          assign_proxy: true,
          proxy_type: 'auto', // Will randomly select from GeeLark
          warmup_duration_minutes: 0 // No warmup
        })
      })

      const data = await response.json()

      if (response.ok) {
        notify('success', `Creating ${smsQuantity} new phone${smsQuantity > 1 ? 's' : ''}`)
        
        // Trigger sync after 5 seconds
        setTimeout(() => {
          handleSync()
        }, 5000)
      } else {
        notify('error', data.error || 'Failed to create phones')
      }
    } catch (error) {
      notify('error', 'Failed to create phones')
    } finally {
      setIsCreatingPhones(false)
    }
  }

  const handleSync = async (isAutoSync = false) => {
    // Don't show notifications for auto-sync unless there are changes
    if (!isAutoSync) {
      setIsSyncing(true)
    }
    
    try {
      // First sync profiles from GeeLark
      const profileResponse = await fetch('/api/geelark/sync-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const profileData = await profileResponse.json()
      
      if (!profileResponse.ok) {
        throw new Error(profileData.error || 'Profile sync failed')
      }

      // Then sync phone status
      const statusResponse = await fetch('/api/geelark/sync-phone-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const statusData = await statusResponse.json()
      
      if (statusResponse.ok) {
        // Only show notifications for manual sync or if there were changes
        if (!isAutoSync) {
          notify('success', 'Sync complete')
        }
        
        // Show detailed results if available
        if (profileData.stats && !isAutoSync) {
          const { imported, updated, deleted } = profileData.stats
          if (imported > 0) notify('info', `${imported} new profiles imported`)
          if (updated > 0) notify('info', `${updated} profiles updated`)
          if (deleted > 0) notify('info', `${deleted} profiles removed`)
        }
        
        if (statusData.synced && !isAutoSync) {
          notify('info', `${statusData.synced} phone statuses updated`)
        }
        
        // Refresh the page to show updated data
        router.refresh()
      } else {
        if (!isAutoSync) {
          notify('error', statusData.error || 'Status sync failed')
        }
      }
    } catch (error) {
      if (!isAutoSync) {
        notify('error', error instanceof Error ? error.message : 'Sync failed')
      }
    } finally {
      if (!isAutoSync) {
        setIsSyncing(false)
      }
    }
  }

  // Set up automatic sync every 10 seconds
  useEffect(() => {
    // Initial sync
    handleSync(true)
    
    // Set up interval
    syncIntervalRef.current = setInterval(() => {
      handleSync(true)
    }, 10000)
    
    // Cleanup on unmount
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [])

  return (
    <>
      <div className="flex gap-2 items-center">
        <div className="flex items-center">
          <input
            type="number"
            min="1"
            max="10"
            value={smsQuantity}
            onChange={(e) => setSmsQuantity(parseInt(e.target.value) || 1)}
            className="w-16 px-3 py-2 text-sm border border-gray-300 rounded-l-md border-r-0 dark:border-dark-600 dark:bg-dark-800 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:z-10"
            disabled={isCreatingPhones}
          />
          <button
            onClick={handleSMSSetup}
            disabled={isCreatingPhones}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 dark:bg-dark-800 dark:text-dark-100 dark:border-dark-600 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
          >
            <Phone className="h-4 w-4 mr-2" />
            +SMS Setup
          </button>
        </div>
        
        <button
          onClick={() => setShowTikTokCredentialsModal(true)}
          className="btn-secondary"
        >
          <Mail className="h-4 w-4 mr-2" />
          +Email Setup
        </button>
        
        <button
          onClick={() => handleSync(false)}
          disabled={isSyncing}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          title="Sync profiles and status with GeeLark"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>
      
      {showTikTokCredentialsModal && (
        <TikTokCredentialsSetupModal
          onClose={() => setShowTikTokCredentialsModal(false)}
          onSuccess={handleSetupSuccess}
        />
      )}
    </>
  )
} 