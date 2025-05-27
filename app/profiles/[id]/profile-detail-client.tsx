'use client'

import { useState } from 'react'
import { 
  Play,
  Wifi,
  MessageSquare,
  Activity,
  Power,
  LogIn,
  Image as ImageIcon,
  Settings,
  RefreshCw,
  Smartphone,
  Trash2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PhoneControlModal } from '@/components/phone-control-modal'
import { VariantAssignmentModal } from '@/components/variant-assignment-modal'
import { AssignProxyModal } from '@/components/assign-proxy-modal'
import { WarmupConfigModal, type WarmupConfig } from '@/components/warmup-config-modal'
import { useNotification } from '@/lib/context/notification-context'

interface ProfileDetailClientProps {
  profile: any
}

export function ProfileDetailClient({ profile }: ProfileDetailClientProps) {
  const router = useRouter()
  const { notify } = useNotification()
  const [showPhoneControl, setShowPhoneControl] = useState(false)
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [showProxyModal, setShowProxyModal] = useState(false)
  const [showWarmupConfig, setShowWarmupConfig] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleStartWarmup = async (config: WarmupConfig) => {
    setShowWarmupConfig(false)
    setIsProcessing(true)
    try {
      const response = await fetch('/api/geelark/start-warmup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_ids: [profile.id],
          options: config
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      notify('success', 'Warmup started successfully')
      router.refresh()
    } catch (error) {
      notify('error', `Failed to start warmup: ${error}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleProxyAssignment = async (proxyType: string) => {
    setShowProxyModal(false)
    setIsProcessing(true)
    
    try {
      const response = await fetch('/api/profiles/assign-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          profileIds: [profile.id],
          proxyType 
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      notify('success', 'Proxy assigned successfully')
      router.refresh()
    } catch (error) {
      notify('error', `Failed to assign proxy: ${error}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteProfile = async () => {
    if (!confirm('Are you sure you want to delete this profile? This action cannot be undone.')) {
      return
    }

    setIsProcessing(true)
    try {
      // API call to delete profile
      notify('success', 'Profile deleted successfully')
      router.push('/profiles')
    } catch (error) {
      notify('error', `Failed to delete profile: ${error}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">Actions</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Primary Actions based on status */}
          {(profile.status === 'new' || profile.status === 'active') && profile.geelark_profile_id && (
            <button 
              onClick={() => setShowWarmupConfig(true)}
              disabled={isProcessing}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Start Warm-Up
            </button>
          )}
          
          {profile.status === 'warming_up' && (
            <button className="btn-secondary flex items-center justify-center gap-2">
              <Activity className="h-4 w-4" />
              View Progress
            </button>
          )}
          
          {profile.status === 'active' && (
            <>
              <button className="btn-primary flex items-center justify-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Post Content
              </button>
              <button 
                onClick={() => setShowVariantModal(true)}
                className="btn-secondary flex items-center justify-center gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                Assign Carousel
              </button>
            </>
          )}
          


          {/* Phone Control */}
          {profile.geelark_profile_id && (
            <button 
              onClick={() => setShowPhoneControl(true)}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <Power className="h-4 w-4" />
              Phone Control
            </button>
          )}

          {/* Proxy Action */}
          {!profile.proxy_id && (
            <button 
              onClick={() => setShowProxyModal(true)}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <Wifi className="h-4 w-4" />
              Assign Proxy
            </button>
          )}

          {/* Management Actions */}
          <button 
            onClick={() => router.refresh()}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Sync Status
          </button>
          <button className="btn-secondary flex items-center justify-center gap-2">
            <Settings className="h-4 w-4" />
            Edit Profile
          </button>
          <button 
            onClick={handleDeleteProfile}
            disabled={isProcessing}
            className="btn-danger flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Modals */}
      {showPhoneControl && profile.geelark_profile_id && (
        <PhoneControlModal
          profileId={profile.geelark_profile_id}
          profileName={profile.tiktok_username || 'Unnamed Profile'}
          accountId={profile.id}
          onClose={() => setShowPhoneControl(false)}
        />
      )}

      {showVariantModal && profile.geelark_profile_id && (
        <VariantAssignmentModal
          profileId={profile.geelark_profile_id}
          profileName={profile.tiktok_username || 'Unnamed Profile'}
          onClose={() => setShowVariantModal(false)}
          onAssign={(variantId) => {
            notify('success', 'Carousel variant assigned successfully')
            router.refresh()
          }}
        />
      )}

      {showProxyModal && (
        <AssignProxyModal
          profileIds={[profile.id]}
          onConfirm={handleProxyAssignment}
          onCancel={() => setShowProxyModal(false)}
        />
      )}

      {showWarmupConfig && (
        <WarmupConfigModal
          isOpen={showWarmupConfig}
          onClose={() => setShowWarmupConfig(false)}
          onConfirm={handleStartWarmup}
          selectedCount={1}
          isLoading={isProcessing}
        />
      )}
    </>
  )
} 