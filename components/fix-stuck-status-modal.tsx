'use client'

import { X } from 'lucide-react'
import { useState } from 'react'

interface FixStuckStatusModalProps {
  profileIds: string[]
  profileCount: number
  onConfirm: (action: string) => void
  onCancel: () => void
}

export function FixStuckStatusModal({ 
  profileIds, 
  profileCount,
  onConfirm, 
  onCancel 
}: FixStuckStatusModalProps) {
  const [selectedAction, setSelectedAction] = useState('mark-active')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-850 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
            Fix Stuck Status
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-500 dark:text-dark-500 dark:hover:text-dark-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <p className="text-gray-600 dark:text-dark-400 mb-4">
          Fix stuck status for {profileCount} profile{profileCount !== 1 ? 's' : ''}. This will clear any stuck setup states and task IDs.
        </p>

        <div className="space-y-3 mb-6">
          <label className="flex items-start">
            <input
              type="radio"
              name="action"
              value="mark-active"
              checked={selectedAction === 'mark-active'}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="mt-1 mr-3"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-dark-100">Mark as Active</div>
              <div className="text-sm text-gray-500 dark:text-dark-400">
                Clear stuck status and mark profiles as active and ready to use
              </div>
            </div>
          </label>

          <label className="flex items-start">
            <input
              type="radio"
              name="action"
              value="reset-to-new"
              checked={selectedAction === 'reset-to-new'}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="mt-1 mr-3"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-dark-100">Reset to New</div>
              <div className="text-sm text-gray-500 dark:text-dark-400">
                Reset profiles to "new" status and clear all progress
              </div>
            </div>
          </label>
        </div>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedAction)}
            className="btn-primary"
          >
            Fix Status
          </button>
        </div>
      </div>
    </div>
  )
} 