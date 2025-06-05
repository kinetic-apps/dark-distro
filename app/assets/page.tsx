import { Suspense } from 'react'
import AssetsPageClient from './assets-page-client'

export default function AssetsPage() {
  return (
    <Suspense fallback={<div>Loading assets...</div>}>
      <AssetsPageClient />
    </Suspense>
  )
}