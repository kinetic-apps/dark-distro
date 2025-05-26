'use client'

import { useState } from 'react'
import { Plus, ChevronDown, Wifi, RefreshCw, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function ImportProxiesButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const router = useRouter()

  const handleImport = async (type: string) => {
    setIsLoading(true)
    setMessage(null)
    setShowDropdown(false)

    try {
      const response = await fetch('/api/soax/sync-proxies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setMessage(data.message)
      
      // Refresh the page to show new proxies
      setTimeout(() => {
        router.refresh()
        setMessage(null)
      }, 2000)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const proxyTypes = [
    { value: 'all', label: 'All Proxy Types', icon: Wifi },
    { value: 'sticky', label: 'Sticky Proxies', icon: RefreshCw },
    { value: 'rotating', label: 'Rotating Proxy', icon: RefreshCw },
    { value: 'sim', label: 'SIM Proxies', icon: Smartphone },
  ]

  return (
    <div className="relative">
      <div className="flex">
        <button
          onClick={() => handleImport('all')}
          disabled={isLoading}
          className="btn-primary rounded-r-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Importing...' : 'Import Proxies'}
        </button>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isLoading}
          className="btn-primary rounded-l-none border-l border-blue-700 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-dark-800 ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1" role="menu">
            {proxyTypes.map((type) => {
              const Icon = type.icon
              return (
                <button
                  key={type.value}
                  onClick={() => handleImport(type.value)}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-dark-200 hover:bg-gray-100 dark:hover:bg-dark-700"
                  role="menuitem"
                >
                  <Icon className="h-4 w-4 mr-3 text-gray-400" />
                  {type.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
      
      {message && (
        <div className={`absolute top-full mt-2 right-0 p-3 text-sm rounded-md whitespace-nowrap z-20 ${
          message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
} 