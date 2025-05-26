'use client'

import { TikTokActions } from '@/components/tiktok-actions'
import { useRouter } from 'next/navigation'

interface ProfileDetailWrapperProps {
  profile: any
  children: React.ReactNode
}

export function ProfileDetailWrapper({ profile, children }: ProfileDetailWrapperProps) {
  const router = useRouter()
  
  const handleActionComplete = () => {
    // Refresh the page to show updated data
    router.refresh()
  }

  return (
    <>
      {children}
      
      {/* TikTok Actions Section */}
      <div className="mt-6">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">TikTok Actions</h3>
          <TikTokActions
            accountId={profile.id}
            profileId={profile.geelark_profile_id}
            onActionComplete={handleActionComplete}
          />
        </div>
      </div>
    </>
  )
} 