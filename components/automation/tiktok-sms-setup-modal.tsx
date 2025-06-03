'use client'

import { useState } from 'react'
import { X, Smartphone, Loader2, Phone } from 'lucide-react'
import { useNotification } from '@/lib/context/notification-context'

interface TikTokSMSSetupModalProps {
  onClose: () => void
  onSuccess?: (accountId: string, profileId: string) => void
}



export function TikTokSMSSetupModal({ onClose, onSuccess }: TikTokSMSSetupModalProps) {
  const { notify } = useNotification()
  const [isLoading, setIsLoading] = useState(false)
  const [quantity, setQuantity] = useState(1)


  const handleSetup = async () => {
    setIsLoading(true)

    try {

      // Start the simplified setup with hard-coded values
      const requestBody = {
        // Hard-coded simplified settings
        use_existing_profile: false,
        device_model: 'Pixel 6',
        android_version: 3, // Android 12
        group_name: 'SPECTRE SMS',
        long_term_rental: true,
        assign_proxy: true,
        proxy_type: 'auto', // Will randomly select from GeeLark
        // No warmup settings - warmup is disabled
        warmup_duration_minutes: 0,
        // Quantity for batch creation
        quantity: quantity
      }

      // Add AbortController with 30 minute timeout for long-running operations
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1800000) // 30 minutes
      
      const response = await fetch('/api/automation/setup-tiktok-with-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Setup failed')
      }



      if (data.success) {
        if (data.batch_results) {
          // Handle batch results
          const { successful_setups, failed_setups, total_requested } = data.batch_results
          notify('success', `Batch setup completed! ${successful_setups}/${total_requested} phones created successfully.`)
          
          if (failed_setups > 0) {
            notify('error', `${failed_setups} phones failed to create.`)
          }
          
          // Navigate to profiles page to see all created phones
          if (onSuccess && data.batch_results.account_ids.length > 0) {
            // For batch, just close modal and let user see the profiles table
            onClose()
          }
        } else {
          // Handle single setup
          notify('success', 'SMS Setup completed successfully!')
          if (data.phone_number) {
            notify('info', `Phone number rented: ${data.phone_number}`)
          }
          if (onSuccess && data.account_id && data.profile_id) {
            onSuccess(data.account_id, data.profile_id)
          }
        }
      } else {
        const failedSteps = data.tasks?.filter((t: any) => t.status === 'failed') || []
        notify('info', `Setup completed with ${failedSteps.length} issues`)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        notify('error', 'Setup timed out after 30 minutes. This usually indicates a server issue.')
      } else {
        notify('error', `Setup failed: ${error}`)
      }
    } finally {
      setIsLoading(false)
    }
  }



  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-850 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                SMS Setup
              </h2>
              <p className="text-sm text-gray-500 dark:text-dark-400">
                Automated TikTok setup with phone verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-dark-500 dark:hover:text-dark-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Configuration Summary */}
          {!isLoading && (
            <div className="mb-6 space-y-4">
              {/* Quantity Input */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Number of Phones to Create
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    phones (max 100)
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Each phone will be created with identical settings and tracked separately
                </p>
              </div>

              {/* Configuration Summary */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">Setup Configuration</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">Device:</span>
                    <span className="ml-2 font-medium">Google Pixel 6</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">Android:</span>
                    <span className="ml-2 font-medium">Version 12</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">Proxy:</span>
                    <span className="ml-2 font-medium">Auto-selected</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">SMS:</span>
                    <span className="ml-2 font-medium">Long-term rental</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">Quantity:</span>
                    <span className="ml-2 font-medium">{quantity} phone{quantity !== 1 ? 's' : ''}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">Auto-stop:</span>
                    <span className="ml-2 font-medium">After tasks complete</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Setting up {quantity} phone{quantity !== 1 ? 's' : ''}...
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    This may take a few minutes
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-dark-700">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary"
          >
            {isLoading ? 'Close' : 'Cancel'}
          </button>
          {!isLoading && (
            <button
              onClick={handleSetup}
              className="btn-primary"
            >
              <Smartphone className="h-4 w-4 mr-2" />
              Start SMS Setup
            </button>
          )}
        </div>
      </div>
    </div>
  )
} 