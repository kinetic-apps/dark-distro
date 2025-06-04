'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'

interface ImportProxiesButtonProps {
  onImportComplete?: () => void
}

export function ImportProxiesButton({ onImportComplete }: ImportProxiesButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [proxyInput, setProxyInput] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const parseProxyUrl = (url: string) => {
    try {
      // Example: socks5h://user-splv8gl1yh-session-1-country-us:_Cgvtyy0d0dy2jWG0R@gate.decodo.com:7000
      const match = url.match(/^(socks5h?|https?):\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/)
      
      if (!match) {
        throw new Error('Invalid proxy URL format')
      }

      const [_, scheme, username, password, server, port] = match
      
      return {
        scheme: scheme.replace('socks5h', 'socks5') as 'socks5' | 'http' | 'https',
        username,
        password,
        server,
        port: parseInt(port)
      }
    } catch (error) {
      console.error('Error parsing proxy URL:', url, error)
      return null
    }
  }

  const handleImport = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      // Parse proxy URLs from input
      const lines = proxyInput.trim().split('\n').filter(line => line.trim())
      const proxies = lines.map(parseProxyUrl).filter(Boolean)

      if (proxies.length === 0) {
        throw new Error('No valid proxy URLs found')
      }

      // Send to Geelark API
      const response = await fetch('/api/geelark/add-proxies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proxies })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setMessage({
        type: 'success',
        text: `Successfully imported ${data.successCount} of ${data.totalCount} proxies`
      })
      
      // Clear input and refresh list
      setProxyInput('')
      setTimeout(() => {
        setIsOpen(false)
        setMessage(null)
        onImportComplete?.()
      }, 2000)
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Import failed'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-primary"
      >
        <Plus className="h-4 w-4 mr-2" />
        Import Proxies
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
                Import Proxies to GeeLark
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-dark-300"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  Paste proxy URLs (one per line)
                </label>
                <textarea
                  value={proxyInput}
                  onChange={(e) => setProxyInput(e.target.value)}
                  placeholder="socks5h://user-splv8gl1yh-session-1-country-us:_Cgvtyy0d0dy2jWG0R@gate.decodo.com:7000
socks5h://user-splv8gl1yh-session-2-country-us:_Cgvtyy0d0dy2jWG0R@gate.decodo.com:7000
..."
                  className="w-full h-64 px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-900 dark:border-dark-600 dark:text-dark-100 font-mono"
                />
              </div>

              <div className="mb-4 text-sm text-gray-600 dark:text-dark-400">
                <p>Supported formats:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>socks5://username:password@host:port</li>
                  <li>socks5h://username:password@host:port</li>
                  <li>http://username:password@host:port</li>
                  <li>https://username:password@host:port</li>
                </ul>
              </div>

              {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${
                  message.type === 'error' 
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' 
                    : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                }`}>
                  {message.text}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={isLoading || !proxyInput.trim()}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Importing...' : 'Import to GeeLark'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
} 