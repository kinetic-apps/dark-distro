'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

interface DeleteProxyButtonProps {
  proxyId: string
  proxyLabel: string
  isAssigned: boolean
}

export function DeleteProxyButton({ proxyId, proxyLabel, isAssigned }: DeleteProxyButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)
    
    try {
      const response = await fetch(`/api/proxies/delete/${proxyId}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete proxy')
      }
      
      alert(`Successfully deleted proxy ${proxyLabel}`)
      router.refresh()
    } catch (error) {
      console.error('Error deleting proxy:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete proxy'}`)
    } finally {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  const handleClick = () => {
    if (isAssigned) {
      alert('Cannot delete proxy that is assigned to an account. Please unassign it first.')
      return
    }
    
    if (confirm(`Are you sure you want to delete the proxy "${proxyLabel}"? This action cannot be undone.`)) {
      handleDelete()
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isDeleting || isAssigned}
      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed ml-2"
      title={isAssigned ? 'Cannot delete assigned proxy' : 'Delete proxy'}
    >
      <Trash2 className={`h-4 w-4 ${isDeleting ? 'animate-pulse' : ''}`} />
    </button>
  )
} 