'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ErrorDisplay, ErrorInfo } from './ErrorDisplay'
import { SuccessState } from './SuccessState'

type NotificationType = 'success' | 'error' | 'info' | 'warning'

interface Notification {
  id: string
  type: NotificationType
  title?: string
  message: string
  details?: string[]
  autoHide?: number
  actions?: Array<{
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary' | 'outline'
  }>
  sticky?: boolean
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => string
  removeNotification: (id: string) => void
  clearAll: () => void
  showSuccess: (message: string, options?: Partial<Notification>) => string
  showError: (error: ErrorInfo | string, options?: Partial<Notification>) => string
  showInfo: (message: string, options?: Partial<Notification>) => string
  showWarning: (message: string, options?: Partial<Notification>) => string
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: ReactNode
  maxNotifications?: number
  defaultAutoHide?: number
}

export function NotificationProvider({ 
  children, 
  maxNotifications = 5,
  defaultAutoHide = 5000 
}: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = (notification: Omit<Notification, 'id'>): string => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newNotification: Notification = {
      ...notification,
      id,
      autoHide: notification.autoHide ?? (notification.sticky ? undefined : defaultAutoHide)
    }

    setNotifications(prev => {
      const updated = [newNotification, ...prev]
      // Keep only the latest maxNotifications
      return updated.slice(0, maxNotifications)
    })

    return id
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  const showSuccess = (message: string, options: Partial<Notification> = {}): string => {
    return addNotification({
      type: 'success',
      message,
      autoHide: 4000,
      ...options
    })
  }

  const showError = (error: ErrorInfo | string, options: Partial<Notification> = {}): string => {
    const errorMessage = typeof error === 'string' ? error : error.message
    return addNotification({
      type: 'error',
      message: errorMessage,
      sticky: true, // Errors should be sticky by default
      ...options
    })
  }

  const showInfo = (message: string, options: Partial<Notification> = {}): string => {
    return addNotification({
      type: 'info',
      message,
      ...options
    })
  }

  const showWarning = (message: string, options: Partial<Notification> = {}): string => {
    return addNotification({
      type: 'warning',
      message,
      ...options
    })
  }

  // Auto-hide notifications
  useEffect(() => {
    const timers: Record<string, NodeJS.Timeout> = {}

    notifications.forEach(notification => {
      if (notification.autoHide && !timers[notification.id]) {
        timers[notification.id] = setTimeout(() => {
          removeNotification(notification.id)
        }, notification.autoHide)
      }
    })

    return () => {
      Object.values(timers).forEach(timer => clearTimeout(timer))
    }
  }, [notifications])

  const contextValue: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    showSuccess,
    showError,
    showInfo,
    showWarning
  }

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  )
}

function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications()

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm w-full">
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  )
}

function NotificationItem({ 
  notification, 
  onDismiss 
}: { 
  notification: Notification
  onDismiss: () => void 
}) {
  const getNotificationStyles = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-success-900/90 border-success-500/50 text-success-100'
      case 'error':
        return 'bg-danger-900/90 border-danger-500/50 text-danger-100'
      case 'warning':
        return 'bg-warning-900/90 border-warning-500/50 text-warning-100'
      case 'info':
        return 'bg-secondary-800/90 border-secondary-600/50 text-secondary-100'
      default:
        return 'bg-secondary-800/90 border-secondary-600/50 text-secondary-100'
    }
  }

  const getIcon = () => {
    switch (notification.type) {
      case 'success': return '🎉'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return '📢'
    }
  }

  // For error type notifications, use the ErrorDisplay component
  if (notification.type === 'error') {
    return (
      <div className="animate-slide-in-right">
        <ErrorDisplay
          error={{
            type: 'unknown',
            message: notification.message,
            details: notification.details ? { supportId: notification.details.join(', ') } : undefined
          }}
          onDismiss={onDismiss}
          compact={true}
          showSupportContact={false}
        />
      </div>
    )
  }

  // For success type notifications, use the SuccessState component
  if (notification.type === 'success') {
    return (
      <div className="animate-slide-in-right">
        <SuccessState
          title={notification.title}
          message={notification.message}
          details={notification.details}
          actions={notification.actions}
          onClose={onDismiss}
          compact={true}
          autoHide={notification.autoHide ? notification.autoHide / 1000 : undefined}
        />
      </div>
    )
  }

  // Default notification display
  return (
    <div className={`${getNotificationStyles()} border rounded-lg p-4 shadow-lg backdrop-blur-sm animate-slide-in-right`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-xl flex-shrink-0">{getIcon()}</span>
          <div className="flex-1">
            {notification.title && (
              <h4 className="font-bold mb-1">{notification.title}</h4>
            )}
            <p className="text-sm opacity-90">{notification.message}</p>
            {notification.details && notification.details.length > 0 && (
              <ul className="mt-2 space-y-1">
                {notification.details.map((detail, index) => (
                  <li key={index} className="text-xs opacity-75 flex items-center gap-1">
                    <span>•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-current/60 hover:text-current/90 transition-colors p-1 flex-shrink-0"
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>

      {notification.actions && notification.actions.length > 0 && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-current/20">
          {notification.actions.map((action, index) => (
            <button
              key={index}
              onClick={() => {
                action.onClick()
                onDismiss()
              }}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                action.variant === 'outline'
                  ? 'border border-current/30 hover:bg-current/10'
                  : 'bg-current/20 hover:bg-current/30'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default NotificationProvider

// Convenience hook for common notification patterns
export function useApiNotifications() {
  const { showSuccess, showError, showInfo } = useNotifications()

  const notifyApiSuccess = (operation: string, details?: string[]) => {
    showSuccess(`${operation} completed successfully`, {
      title: 'Success',
      details,
      autoHide: 4000
    })
  }

  const notifyApiError = (operation: string, error: ErrorInfo | string) => {
    const errorMessage = typeof error === 'string' ? error : error.message
    showError(`${operation} failed: ${errorMessage}`, {
      title: 'Operation Failed',
      sticky: true
    })
  }

  const notifyApiProgress = (operation: string, progress?: string) => {
    showInfo(progress || `${operation} in progress...`, {
      title: operation,
      autoHide: 2000
    })
  }

  return {
    notifyApiSuccess,
    notifyApiError,
    notifyApiProgress
  }
}