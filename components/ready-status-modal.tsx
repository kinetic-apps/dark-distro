'use client'

import { X } from 'lucide-react'

interface ReadyStatusModalProps {
  profileName: string
  currentStatus: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ReadyStatusModal({ 
  profileName, 
  currentStatus, 
  onConfirm, 
  onCancel 
}: ReadyStatusModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-850 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
            {currentStatus ? 'Remove Ready Status' : 'Mark as Ready'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-500 dark:text-dark-500 dark:hover:text-dark-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <p className="text-gray-600 dark:text-dark-400 mb-6">
          {currentStatus 
            ? `Are you sure you want to remove the ready status from "${profileName}"? This profile will no longer be prioritized for automated actions.`
            : `Are you sure you want to mark "${profileName}" as ready for actions? This profile will be prioritized for automated tasks.`
          }
        </p>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={currentStatus ? "btn-secondary" : "btn-primary"}
          >
            {currentStatus ? 'Remove Ready Status' : 'Mark as Ready'}
          </button>
        </div>
      </div>
    </div>
  )
} 