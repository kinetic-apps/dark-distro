'use client'

import { useState } from 'react'
import { Plus, Smartphone } from 'lucide-react'
import Link from 'next/link'
import { SyncProfilesButton } from '@/components/sync-profiles-button'
import { SetupPhoneModal } from '@/components/automation/setup-phone-modal'
import { useRouter } from 'next/navigation'

export function ProfilesHeader() {
  const [showSetupModal, setShowSetupModal] = useState(false)
  const router = useRouter()

  const handleSetupSuccess = (accountId: string, profileId: string) => {
    // Navigate to the new profile page
    router.push(`/profiles/${accountId}`)
  }

  return (
    <>
      <div className="flex gap-2">
        <SyncProfilesButton />
        
        <button
          onClick={() => setShowSetupModal(true)}
          className="btn-secondary"
        >
          <Smartphone className="h-4 w-4 mr-2" />
          Setup Phone
        </button>
        
        <Link href="/profiles/new" className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          New Profile
        </Link>
      </div>

      {showSetupModal && (
        <SetupPhoneModal
          onClose={() => setShowSetupModal(false)}
          onSuccess={handleSetupSuccess}
        />
      )}
    </>
  )
} 