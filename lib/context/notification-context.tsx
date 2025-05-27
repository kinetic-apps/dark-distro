'use client'

import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

interface Notification {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface NotificationContextType {
  notify: (type: Notification['type'], message: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  
  const notify = useCallback((type: Notification['type'], message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    setNotifications(prev => {
      // Ensure prev is always an array
      const currentNotifications = Array.isArray(prev) ? prev : []
      return [...currentNotifications, { id, type, message }]
    })
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => {
        // Ensure prev is always an array
        const currentNotifications = Array.isArray(prev) ? prev : []
        return currentNotifications.filter(n => n.id !== id)
      })
    }, 5000)
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => {
      // Ensure prev is always an array
      const currentNotifications = Array.isArray(prev) ? prev : []
      return currentNotifications.filter(n => n.id !== id)
    })
  }, [])

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const getNotificationStyles = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30'
      case 'error':
        return 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30'
      case 'info':
        return 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30'
    }
  }

  // Ensure notifications is always an array before rendering
  const safeNotifications = Array.isArray(notifications) ? notifications.filter(n => n && n.id && n.type && n.message) : []

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      
      {/* Notification Stack */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {safeNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`flex items-center gap-3 p-4 rounded-lg shadow-lg border animate-slide-in max-w-sm ${getNotificationStyles(notification.type)}`}
          >
            {getNotificationIcon(notification.type)}
            <p className="text-sm font-medium flex-1">{notification.message}</p>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-gray-400 hover:text-gray-600 dark:text-dark-500 dark:hover:text-dark-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
} 