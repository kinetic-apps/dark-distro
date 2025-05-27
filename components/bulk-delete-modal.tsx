'use client'

import { useState } from 'react'
import { X, AlertTriangle, Trash2 } from 'lucide-react'

interface BulkDeleteModalProps {
  profileIds: string[]
  profileNames: string[]
  onConfirm: (deleteFromGeelark: boolean) => void
  onCancel: () => void
}

export function BulkDeleteModal({ 
  profileIds, 
  profileNames, 
  onConfirm, 
  onCancel 
}: BulkDeleteModalProps) {
  const [deleteFromGeelark, setDeleteFromGeelark] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  
  const expectedText = 'DELETE'
  const canConfirm = confirmText === expectedText

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm(deleteFromGeelark)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-850 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Delete Profiles
              </h3>
              <p className="text-sm text-gray-600 dark:text-dark-400">
                This action cannot be undone
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-dark-500 dark:hover:text-dark-300 dark:hover:bg-dark-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-300 font-medium mb-2">
              You are about to delete {profileIds.length} profile{profileIds.length !== 1 ? 's' : ''}:
            </p>
            <div className="max-h-32 overflow-y-auto">
              <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                {profileNames.slice(0, 10).map((name, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Trash2 className="h-3 w-3 flex-shrink-0" />
                    {name || 'Unnamed Profile'}
                  </li>
                ))}
                {profileNames.length > 10 && (
                  <li className="text-xs italic">
                    ... and {profileNames.length - 10} more
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="deleteFromGeelark"
                checked={deleteFromGeelark}
                onChange={(e) => setDeleteFromGeelark(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 dark:border-dark-600 dark:bg-dark-800"
              />
              <label htmlFor="deleteFromGeelark" className="text-sm text-gray-700 dark:text-dark-300">
                Also delete from GeeLark (cloud phones will be destroyed)
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                Type <span className="font-mono bg-gray-100 dark:bg-dark-700 px-1 rounded">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-dark-800 dark:border-dark-600 dark:text-dark-100"
                placeholder="Type DELETE here"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-dark-700">
          <button
            onClick={onCancel}
            className="flex-1 btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 btn-danger disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete {profileIds.length} Profile{profileIds.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
} 