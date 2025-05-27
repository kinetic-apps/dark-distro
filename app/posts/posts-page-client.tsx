'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'
import Link from 'next/link'
import BulkPostLauncher from '@/components/bulk-post-launcher'

interface PostsPageClientProps {
  children: React.ReactNode
}

export default function PostsPageClient({ children }: PostsPageClientProps) {
  const [showBulkLauncher, setShowBulkLauncher] = useState(false)

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Posts</h1>
            <p className="page-description">
              Manage content distribution campaigns
            </p>
          </div>
          
          <div className="flex gap-3">
            <Link href="/assets" className="btn-secondary">
              Browse Assets
            </Link>
            <button 
              onClick={() => setShowBulkLauncher(true)}
              className="btn-primary"
            >
              <Play className="h-4 w-4 mr-2" />
              Launch Daily Campaign
            </button>
          </div>
        </div>

        {showBulkLauncher && (
          <BulkPostLauncher onClose={() => setShowBulkLauncher(false)} />
        )}

        {children}
      </div>
    </>
  )
} 