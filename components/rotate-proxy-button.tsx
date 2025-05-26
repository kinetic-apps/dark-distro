'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface RotateProxyButtonProps {
  proxyId: string
  proxyType: string
}

export function RotateProxyButton({ proxyId, proxyType }: RotateProxyButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleRotate = async () => {
    if (proxyType === 'sim') {
      alert('SIM proxies cannot be rotated')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/proxies/rotate/${proxyId}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Rotation failed')
      }

      // Refresh the page to show updated proxy info
      router.refresh()
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleRotate}
      disabled={isLoading || proxyType === 'sim'}
      className="text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100 disabled:opacity-50 disabled:cursor-not-allowed"
      title={proxyType === 'sim' ? 'SIM proxies cannot be rotated' : 'Rotate IP'}
    >
      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
    </button>
  )
} 