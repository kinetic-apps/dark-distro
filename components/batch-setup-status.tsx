'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Circle, Loader2, XCircle, Phone } from 'lucide-react'

interface BatchSetupStatusProps {
  accountIds: string[]
  onComplete?: () => void
}

interface AccountStatus {
  id: string
  status: string
  profile_name?: string
  batch_status?: string
  batch_error?: string
  setup_progress?: number
  current_setup_step?: string
}

export function BatchSetupStatus({ accountIds, onComplete }: BatchSetupStatusProps) {
  const [accounts, setAccounts] = useState<AccountStatus[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (accountIds.length === 0) return

    // Initial fetch
    fetchAccountStatuses()

    // Set up realtime subscription
    const subscription = supabase
      .channel('batch-setup-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'accounts',
          filter: `id=in.(${accountIds.join(',')})`
        },
        (payload) => {
          // Update the specific account status
          setAccounts(prev => 
            prev.map(acc => 
              acc.id === payload.new.id 
                ? { 
                    ...acc, 
                    status: payload.new.status,
                    batch_status: payload.new.meta?.batch_status,
                    batch_error: payload.new.meta?.batch_error,
                    setup_progress: payload.new.setup_progress,
                    current_setup_step: payload.new.current_setup_step
                  }
                : acc
            )
          )
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [accountIds])

  useEffect(() => {
    // Check if all accounts are complete
    if (accounts.length > 0) {
      const allComplete = accounts.every(acc => 
        acc.batch_status === 'completed' || 
        acc.batch_status === 'failed' ||
        acc.status === 'active' ||
        acc.status === 'error'
      )
      
      if (allComplete && !isComplete) {
        setIsComplete(true)
        onComplete?.()
      }
    }
  }, [accounts, isComplete, onComplete])

  async function fetchAccountStatuses() {
    const { data, error } = await supabase
      .from('accounts')
      .select('id, status, meta, setup_progress, current_setup_step')
      .in('id', accountIds)

    if (data) {
      setAccounts(data.map(acc => ({
        id: acc.id,
        status: acc.status,
        batch_status: acc.meta?.batch_status,
        batch_error: acc.meta?.batch_error,
        setup_progress: acc.setup_progress,
        current_setup_step: acc.current_setup_step
      })))
    }
  }

  const getStatusIcon = (account: AccountStatus) => {
    if (account.batch_status === 'completed' || account.status === 'active') {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    } else if (account.batch_status === 'failed' || account.status === 'error') {
      return <XCircle className="h-5 w-5 text-red-500" />
    } else if (account.batch_status === 'processing' || account.batch_status === 'running') {
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
    } else {
      return <Circle className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusText = (account: AccountStatus) => {
    if (account.batch_error) {
      return `Failed: ${account.batch_error}`
    }
    
    if (account.current_setup_step) {
      return `${account.current_setup_step} (${account.setup_progress || 0}%)`
    }
    
    return account.batch_status || account.status || 'Queued'
  }

  if (accountIds.length === 0) {
    return null
  }

  const completed = accounts.filter(acc => 
    acc.batch_status === 'completed' || acc.status === 'active'
  ).length
  const failed = accounts.filter(acc => 
    acc.batch_status === 'failed' || acc.status === 'error'
  ).length
  const processing = accounts.filter(acc => 
    acc.batch_status === 'processing' || acc.batch_status === 'running'
  ).length

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          Progress: {completed + failed}/{accountIds.length} phones
        </span>
        <div className="flex gap-4 text-xs">
          <span className="text-green-600 dark:text-green-400">✓ {completed}</span>
          <span className="text-blue-600 dark:text-blue-400">↻ {processing}</span>
          <span className="text-red-600 dark:text-red-400">✗ {failed}</span>
        </div>
      </div>
      
      <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        {accounts.map((account, index) => (
          <div
            key={account.id}
            className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded"
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(account)}
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  Phone {index + 1}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {getStatusText(account)}
                </div>
              </div>
            </div>
            {account.setup_progress !== undefined && account.setup_progress < 100 && (
              <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${account.setup_progress}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {isComplete && (
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          Batch setup complete! {completed} successful, {failed} failed.
        </div>
      )}
    </div>
  )
}