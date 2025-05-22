'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import { 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Copy,
  Plus
} from 'lucide-react'

interface SMSRental {
  id: string
  rental_id: string | null
  phone_number: string
  otp: string | null
  status: 'waiting' | 'received' | 'cancelled' | 'expired'
  expires_at: string
  account_id: string | null
  created_at: string
  account?: {
    tiktok_username: string | null
  }
}

export default function SMSPage() {
  const [rentals, setRentals] = useState<SMSRental[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeCount, setActiveCount] = useState(0)
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set())
  const [pollingIntervals, setPollingIntervals] = useState<Map<string, NodeJS.Timeout>>(new Map())
  const [mounted, setMounted] = useState(true)

  const supabase = createClient()

  const fetchRentals = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_rentals')
        .select(`
          *,
          account:accounts!sms_rentals_account_id_fkey(
            tiktok_username
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching rentals:', error)
        if (mounted) {
          setError('Failed to fetch rentals')
        }
        return
      }

      if (mounted) {
        setRentals(data || [])
        setActiveCount(
          data?.filter(r => ['waiting', 'received'].includes(r.status)).length || 0
        )
      }
    } catch (err) {
      console.error('Unexpected error fetching rentals:', err)
      if (mounted) {
        setError('Failed to fetch rentals')
      }
    }
  }

  useEffect(() => {
    setMounted(true)
    fetchRentals()
    
    const subscription = supabase
      .channel('sms_rentals')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sms_rentals'
      }, () => {
        if (mounted) {
          fetchRentals()
        }
      })
      .subscribe()

    return () => {
      setMounted(false)
      subscription.unsubscribe()
      // Clear any active polling intervals
      pollingIntervals.forEach(interval => {
        clearInterval(interval)
      })
      setPollingIntervals(new Map())
      setPollingIds(new Set())
    }
  }, []) // fetchRentals is now stable

  const rentNewNumber = async () => {
    if (activeCount >= 20) {
      setError('Maximum concurrent rentals (20) reached')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/daisysms/rent-number', {
        method: 'POST'
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to rent number: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      
      if (!data.id) {
        throw new Error('Invalid response: missing rental ID')
      }
      
      // Start polling for OTP
      startPolling(data.id)
      
      await fetchRentals()
    } catch (error) {
      console.error('Error renting number:', error)
      if (mounted) {
        setError(error instanceof Error ? error.message : 'An error occurred')
      }
    } finally {
      if (mounted) {
        setLoading(false)
      }
    }
  }

  const startPolling = (rentalId: string) => {
    if (pollingIds.has(rentalId)) return
    
    setPollingIds(prev => new Set(prev).add(rentalId))
    
    const pollInterval = setInterval(async () => {
      if (!mounted) {
        clearInterval(pollInterval)
        return
      }

      try {
        const response = await fetch(`/api/daisysms/check-otp/${rentalId}`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data.status !== 'waiting') {
          clearInterval(pollInterval)
          
          if (mounted) {
            setPollingIds(prev => {
              const next = new Set(prev)
              next.delete(rentalId)
              return next
            })
            
            setPollingIntervals(prev => {
              const next = new Map(prev)
              next.delete(rentalId)
              return next
            })
            
            if (data.status === 'received') {
              await fetchRentals()
            }
          }
        }
      } catch (error) {
        console.error('Error polling OTP status:', error)
        clearInterval(pollInterval)
        
        if (mounted) {
          setPollingIds(prev => {
            const next = new Set(prev)
            next.delete(rentalId)
            return next
          })
          
          setPollingIntervals(prev => {
            const next = new Map(prev)
            next.delete(rentalId)
            return next
          })
        }
      }
    }, 3000)

    setPollingIntervals(prev => new Map(prev).set(rentalId, pollInterval))
  }

  const completeRental = async (rentalId: string) => {
    try {
      const response = await fetch('/api/daisysms/set-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rental_id: rentalId, status: '6' })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to complete rental: ${response.status}`)
      }
      
      if (mounted) {
        await fetchRentals()
      }
    } catch (error) {
      console.error('Error completing rental:', error)
      if (mounted) {
        setError('Failed to complete rental')
      }
    }
  }

  const cancelRental = async (rentalId: string) => {
    try {
      const response = await fetch('/api/daisysms/set-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rental_id: rentalId, status: '8' })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to cancel rental: ${response.status}`)
      }
      
      if (mounted) {
        await fetchRentals()
      }
    } catch (error) {
      console.error('Error cancelling rental:', error)
      if (mounted) {
        setError('Failed to cancel rental')
      }
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea')
        textArea.value = text
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError)
      }
    }
  }

  const getStatusIcon = (status: SMSRental['status']) => {
    switch (status) {
      case 'waiting':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'received':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-400" />
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: SMSRental['status']) => {
    const classes = {
      waiting: 'status-warning',
      received: 'status-active',
      cancelled: 'status-neutral',
      expired: 'status-error'
    }
    
    return (
      <span className={classes[status]}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">SMS Rentals</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage DaisySMS phone number rentals for OTP verification
          </p>
        </div>
        
        <button
          onClick={rentNewNumber}
          disabled={loading || activeCount >= 20}
          className="btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Rent Number
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Active Rentals</h2>
          <div className="flex items-center text-sm text-gray-600">
            <MessageSquare className="h-4 w-4 mr-1" />
            {activeCount} / 20 active
          </div>
        </div>
        
        <div className="text-xs text-gray-500 mb-4">
          Numbers are rented for 72 hours. OTP codes are polled automatically every 3 seconds.
        </div>
      </div>

      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="table-header">
                Phone Number
              </th>
              <th scope="col" className="table-header">
                OTP Code
              </th>
              <th scope="col" className="table-header">
                Status
              </th>
              <th scope="col" className="table-header">
                Linked Account
              </th>
              <th scope="col" className="table-header">
                Expires
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {rentals.map((rental) => (
              <tr key={rental.id} className="hover:bg-gray-50">
                <td className="table-cell">
                  <div className="flex items-center">
                    <span className="font-mono">{rental.phone_number}</span>
                    <button
                      onClick={() => copyToClipboard(rental.phone_number)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </td>
                <td className="table-cell">
                  {rental.otp ? (
                    <div className="flex items-center">
                      <span className="font-mono font-semibold text-green-600">
                        {rental.otp}
                      </span>
                      <button
                        onClick={() => copyToClipboard(rental.otp!)}
                        className="ml-2 text-gray-400 hover:text-gray-600"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  ) : rental.status === 'waiting' ? (
                    <div className="flex items-center text-gray-400">
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      <span className="text-sm">Waiting...</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="table-cell">
                  <div className="flex items-center">
                    {getStatusIcon(rental.status)}
                    <span className="ml-2">{getStatusBadge(rental.status)}</span>
                  </div>
                </td>
                <td className="table-cell">
                  {rental.account ? (
                    <span className="text-sm text-gray-900">
                      {rental.account.tiktok_username || 'Unnamed'}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">Unlinked</span>
                  )}
                </td>
                <td className="table-cell text-sm text-gray-500">
                  {formatRelativeTime(rental.expires_at)}
                </td>
                <td className="relative whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  {rental.status === 'received' && (
                    <button
                      onClick={() => completeRental(rental.rental_id!)}
                      className="text-green-600 hover:text-green-900 mr-3"
                    >
                      Complete
                    </button>
                  )}
                  {['waiting', 'received'].includes(rental.status) && (
                    <button
                      onClick={() => cancelRental(rental.rental_id!)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}