'use client'

import { useState } from 'react'
import { X, Smartphone, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useNotification } from '@/lib/context/notification-context'

interface SetupPhoneModalProps {
  onClose: () => void
  onSuccess?: (accountId: string, profileId: string) => void
}

interface SetupTask {
  step: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  message: string
  task_id?: string
  error?: string
}

export function SetupPhoneModal({ onClose, onSuccess }: SetupPhoneModalProps) {
  const { notify } = useNotification()
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<string>('')
  const [tasks, setTasks] = useState<SetupTask[]>([
    { step: 'Create Profile', status: 'pending', message: 'Waiting to start...' },
    { step: 'Start Phone', status: 'pending', message: 'Waiting to start...' },
    { step: 'Install TikTok', status: 'pending', message: 'Waiting to start...' },
    { step: 'TikTok Login', status: 'pending', message: 'Waiting to start...' },
    { step: 'Start Warmup', status: 'pending', message: 'Waiting to start...' }
  ])
  
  // Form state
  const [proxyId, setProxyId] = useState('')
  const [authMethod, setAuthMethod] = useState<'tiktok' | 'custom'>('tiktok')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [warmupDuration, setWarmupDuration] = useState(30)
  const [groupName, setGroupName] = useState('automated-setup')

  const updateTaskStatus = (step: string, status: SetupTask['status'], message: string, error?: string) => {
    setTasks(prev => prev.map(task => 
      task.step === step 
        ? { ...task, status, message, error }
        : task
    ))
  }

  const handleSetup = async () => {
    setIsLoading(true)
    setCurrentStep('Initializing...')

    try {
      // Reset all tasks to pending
      setTasks(prev => prev.map(task => ({ ...task, status: 'pending', message: 'Waiting to start...', error: undefined })))

      const requestBody: any = {
        proxy_id: proxyId || undefined,
        group_name: groupName,
        auth_method: authMethod === 'custom' ? 'custom' : 'tiktok',
        warmup_duration_minutes: warmupDuration
      }

      if (authMethod === 'custom' && email && password) {
        requestBody.email = email
        requestBody.password = password
      }

      // Start the setup process
      const response = await fetch('/api/automation/setup-new-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Setup failed')
      }

      // Update task statuses based on response
      data.tasks.forEach((task: any) => {
        updateTaskStatus(task.step, task.status, task.message, task.error)
      })

      if (data.success) {
        notify('success', 'Phone setup completed successfully!')
        if (onSuccess && data.account_id && data.profile_id) {
          onSuccess(data.account_id, data.profile_id)
        }
        // Close modal after a short delay to show completion
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        const failedSteps = data.tasks.filter((t: any) => t.status === 'failed')
        notify('info', `Setup completed with ${failedSteps.length} failed steps`)
      }
    } catch (error) {
      notify('error', `Setup failed: ${error}`)
      setCurrentStep('Setup failed')
    } finally {
      setIsLoading(false)
      setCurrentStep('')
    }
  }

  const getStepIcon = (status: SetupTask['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'skipped':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold">Setup New Phone</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Configuration Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Configuration</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., campaign-1"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GeeLark Proxy ID (Optional)
              </label>
              <input
                type="text"
                value={proxyId}
                onChange={(e) => setProxyId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Leave empty to auto-assign"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a GeeLark saved proxy ID or leave empty for automatic assignment
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                TikTok Login Method
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="tiktok"
                    checked={authMethod === 'tiktok'}
                    onChange={(e) => setAuthMethod('tiktok')}
                    className="mr-2"
                    disabled={isLoading}
                  />
                  <span>Use available TikTok credentials</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="custom"
                    checked={authMethod === 'custom'}
                    onChange={(e) => setAuthMethod('custom')}
                    className="mr-2"
                    disabled={isLoading}
                  />
                  <span>Use custom email/password</span>
                </label>
              </div>
            </div>

            {authMethod === 'custom' && (
              <div className="space-y-3 pl-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="user@example.com"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warmup Duration
              </label>
              <select
                value={warmupDuration}
                onChange={(e) => setWarmupDuration(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          {/* Progress Section */}
          {(isLoading || tasks.some(t => t.status !== 'pending')) && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Setup Progress</h3>
              <div className="space-y-3">
                {tasks.map((task, index) => (
                  <div key={index} className="flex items-start gap-3">
                    {getStepIcon(task.status)}
                    <div className="flex-1">
                      <div className="font-medium text-sm">{task.step}</div>
                      <div className="text-sm text-gray-600">{task.message}</div>
                      {task.error && (
                        <div className="text-sm text-red-600 mt-1">{task.error}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {currentStep && (
                <div className="text-sm text-gray-500 italic">{currentStep}</div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSetup}
            disabled={isLoading || (authMethod === 'custom' && (!email || !password))}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4" />
                Start Setup
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
} 