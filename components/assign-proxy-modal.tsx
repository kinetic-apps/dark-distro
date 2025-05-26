'use client'

import { useState } from 'react'
import { X, Wifi, RefreshCw, Smartphone } from 'lucide-react'

interface AssignProxyModalProps {
  profileIds: string[]
  onConfirm: (proxyType: string) => void
  onCancel: () => void
}

export function AssignProxyModal({ profileIds, onConfirm, onCancel }: AssignProxyModalProps) {
  const [selectedType, setSelectedType] = useState('auto')

  const proxyTypes = [
    { value: 'auto', label: 'Auto-select', icon: Wifi, description: 'Automatically select any available proxy' },
    { value: 'sticky', label: 'Sticky Proxy', icon: RefreshCw, description: 'Maintains same IP for session' },
    { value: 'sim', label: 'SIM Proxy', icon: Smartphone, description: 'Mobile network proxy' },
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
            Assign Proxy to {profileIds.length} Profile{profileIds.length > 1 ? 's' : ''}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-dark-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {proxyTypes.map((type) => {
            const Icon = type.icon
            return (
              <label
                key={type.value}
                className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedType === type.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                }`}
              >
                <input
                  type="radio"
                  name="proxyType"
                  value={type.value}
                  checked={selectedType === type.value}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="sr-only"
                />
                <Icon className={`h-5 w-5 mt-0.5 mr-3 ${
                  selectedType === type.value ? 'text-blue-500' : 'text-gray-400'
                }`} />
                <div className="flex-1">
                  <div className={`font-medium ${
                    selectedType === type.value 
                      ? 'text-blue-900 dark:text-blue-100' 
                      : 'text-gray-900 dark:text-dark-100'
                  }`}>
                    {type.label}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-dark-400 mt-0.5">
                    {type.description}
                  </div>
                </div>
              </label>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedType)}
            className="flex-1 btn-primary"
          >
            Assign Proxy
          </button>
        </div>
      </div>
    </div>
  )
} 