'use client'

interface ProfileDetailWrapperProps {
  profile: any
  children: React.ReactNode
  showTikTokActions?: boolean
}

export function ProfileDetailWrapper({ profile, children }: ProfileDetailWrapperProps) {
  return (
    <>
      {children}
    </>
  )
}

 