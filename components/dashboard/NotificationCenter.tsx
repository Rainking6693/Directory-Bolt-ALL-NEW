'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Notification } from '../../types/dashboard'

interface NotificationCenterProps {
  notifications: Notification[]
  onMarkAsRead?: (notificationId: string) => void
  onMarkAllAsRead?: () => void
  className?: string
  showUnreadOnly?: boolean
  maxItems?: number
  compact?: boolean
}

export function NotificationCenter({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  className = '',
  showUnreadOnly = false,
  maxItems = 10,
  compact = false
}: NotificationCenterProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'success' | 'warning' | 'error'>('all')

  const filteredNotifications = useMemo(() => {
    let filtered = notifications

    if (showUnreadOnly || filter === 'unread') {
      filtered = filtered.filter(notification => !notification.read)
    } else if (filter !== 'all') {
      filtered = filtered.filter(notification => notification.type === filter)
    }

    return filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxItems)
  }, [notifications, filter, showUnreadOnly, maxItems])

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length
  }, [notifications])

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return '✅'
      case 'warning': return '⚠️'
      case 'error': return '❌'
      case 'info': return 'ℹ️'
      default: return '📢'
    }
  }

  const getTypeStyles = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-success-500/10',
          border: 'border-success-500/30',
          icon: 'text-success-400'
        }
      case 'warning':
        return {
          bg: 'bg-volt-500/10',
          border: 'border-volt-500/30',
          icon: 'text-volt-400'
        }
      case 'error':
        return {
          bg: 'bg-danger-500/10',
          border: 'border-danger-500/30',
          icon: 'text-danger-400'
        }
      case 'info':
        return {
          bg: 'bg-volt-500/10',
          border: 'border-volt-500/30',
          icon: 'text-volt-400'
        }
      default:
        return {
          bg: 'bg-secondary-700/50',
          border: 'border-secondary-600',
          icon: 'text-secondary-400'
        }
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  const handleMarkAsRead = (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onMarkAsRead?.(notificationId)
  }

  if (compact) {
    return (
      <div className={`bg-secondary-800 rounded-xl border border-secondary-700 p-4 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2">
            🔔 Notifications
            {unreadCount > 0 && (
              <span className="bg-danger-500 text-white text-xs px-2 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </h3>
          <Link
            href="/dashboard/notifications"
            className="text-volt-400 hover:text-volt-300 text-sm transition-colors"
          >
            View all →
          </Link>
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="text-center py-6">
            <span className="text-2xl mb-2 block">📭</span>
            <p className="text-secondary-400 text-sm">No new notifications</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.slice(0, 5).map((notification) => {
              const typeStyles = getTypeStyles(notification.type)
              
              return (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-300 ${
                    notification.read 
                      ? 'bg-secondary-700/30 border-secondary-600/50 opacity-75' 
                      : `${typeStyles.bg} ${typeStyles.border}`
                  }`}
                >
                  <span className={`text-lg ${typeStyles.icon}`}>
                    {getTypeIcon(notification.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium leading-tight">
                      {notification.title}
                    </p>
                    <p className="text-secondary-300 text-xs mt-1 leading-relaxed">
                      {notification.message}
                    </p>
                    <p className="text-secondary-500 text-xs mt-1">
                      {formatTimestamp(notification.timestamp)}
                    </p>
                  </div>
                  {!notification.read && (
                    <button
                      onClick={(e) => handleMarkAsRead(notification.id, e)}
                      className="w-2 h-2 bg-volt-500 rounded-full hover:bg-volt-400 transition-colors"
                      title="Mark as read"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-secondary-800 rounded-xl border border-secondary-700 ${className}`}>
      <div className="p-6 border-b border-secondary-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            🔔 Notifications
            {unreadCount > 0 && (
              <span className="bg-danger-500 text-white text-sm px-3 py-1 rounded-full">
                {unreadCount} new
              </span>
            )}
          </h3>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-volt-500 focus:border-volt-500"
            >
              <option value="all">All</option>
              <option value="unread">Unread Only</option>
              <option value="success">Success</option>
              <option value="warning">Warnings</option>
              <option value="error">Errors</option>
            </select>

            {unreadCount > 0 && onMarkAllAsRead && (
              <button
                onClick={onMarkAllAsRead}
                className="px-4 py-2 bg-volt-500 hover:bg-volt-400 text-secondary-900 font-bold text-sm rounded-lg transition-colors"
              >
                Mark All Read
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">📭</span>
            <h4 className="text-lg font-bold text-white mb-2">No notifications</h4>
            <p className="text-secondary-400">
              {filter === 'unread' || showUnreadOnly 
                ? "You're all caught up! No unread notifications."
                : "No notifications match the current filter."
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotifications.map((notification) => {
              const typeStyles = getTypeStyles(notification.type)
              
              return (
                <div
                  key={notification.id}
                  className={`rounded-lg border p-4 transition-all duration-300 ${
                    notification.read 
                      ? 'bg-secondary-700/30 border-secondary-600/50 opacity-75' 
                      : `${typeStyles.bg} ${typeStyles.border} hover:scale-[1.01]`
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className={`text-2xl ${typeStyles.icon}`}>
                      {getTypeIcon(notification.type)}
                    </span>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="font-semibold text-white leading-tight">
                          {notification.title}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-secondary-400 text-sm whitespace-nowrap">
                            {formatTimestamp(notification.timestamp)}
                          </span>
                          {!notification.read && (
                            <button
                              onClick={(e) => handleMarkAsRead(notification.id, e)}
                              className="w-3 h-3 bg-volt-500 rounded-full hover:bg-volt-400 transition-colors"
                              title="Mark as read"
                            />
                          )}
                        </div>
                      </div>
                      
                      <p className="text-secondary-300 text-sm mb-3 leading-relaxed">
                        {notification.message}
                      </p>
                      
                      {notification.actionUrl && notification.actionText && (
                        <Link
                          href={notification.actionUrl}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-volt-500 hover:bg-volt-400 text-secondary-900 font-bold text-sm rounded-lg transition-all duration-300 hover:scale-105"
                        >
                          {notification.actionText} →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {notifications.length > maxItems && (
          <div className="mt-6 pt-4 border-t border-secondary-700 text-center">
            <Link
              href="/dashboard/notifications"
              className="text-volt-400 hover:text-volt-300 font-medium transition-colors"
            >
              View all {notifications.length} notifications →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationCenter