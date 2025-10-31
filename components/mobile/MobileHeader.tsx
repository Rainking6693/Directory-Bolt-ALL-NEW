import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { PWAManager, NotificationManager } from '@/lib/pwa/pwa-manager'

interface MobileHeaderProps {
  title?: string
  subtitle?: string
  onMenuClick?: () => void
  showNotifications?: boolean
  showPWAPrompt?: boolean
}

export default function MobileHeader({ 
  title = 'DirectoryBolt',
  subtitle,
  onMenuClick,
  showNotifications = true,
  showPWAPrompt = true
}: MobileHeaderProps) {
  const [notifications, setNotifications] = useState<Array<any>>([])
  const [isOnline, setIsOnline] = useState(true)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    // Initialize PWA manager
    const pwa = PWAManager.getInstance()
    pwa.init()

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }

    // Monitor online status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    setIsOnline(navigator.onLine)

    // Check for install prompt
    const checkInstallPrompt = () => {
      const lastDismissed = localStorage.getItem('pwa-install-dismissed')
      const daysSinceDismissed = lastDismissed ? 
        (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24) : 999
      
      // Show install prompt if:
      // - PWA is not installed
      // - User hasn't dismissed in last 7 days
      // - Device supports PWA
      if (daysSinceDismissed > 7 && 'serviceWorker' in navigator) {
        setShowInstallPrompt(true)
      }
    }

    checkInstallPrompt()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Request notification permission
  const handleNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
      
      if (permission === 'granted') {
        // Subscribe to push notifications
        const pwa = PWAManager.getInstance()
        await pwa.subscribeToNotifications()
        
        // Show welcome notification
        await NotificationManager.sendAnalyticsNotification('milestone', {
          milestone: 'Notifications Enabled!'
        })
      }
    }
  }

  // Install PWA
  const handleInstallPWA = async () => {
    const pwa = PWAManager.getInstance()
    setShowInstallPrompt(false)
  }

  // Dismiss install prompt
  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  return (
    <>
      {/* Main Header */}
      <header className="sticky top-0 z-30 bg-secondary-900/95 backdrop-blur-sm border-b border-secondary-700 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Menu & Title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {onMenuClick && (
              <button
                onClick={onMenuClick}
                className="p-2 text-secondary-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            
            <div className="flex-1 min-w-0">
              <h1 className="text-white font-semibold text-lg truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-secondary-400 text-sm truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-orange-500'}`} />
            
            {/* Notification Permission */}
            {showNotifications && notificationPermission !== 'granted' && (
              <button
                onClick={handleNotificationPermission}
                className="p-2 text-secondary-400 hover:text-volt-500 transition-colors"
                title="Enable notifications"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
            )}

            {/* Settings */}
            <button className="p-2 text-secondary-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Connection Status Bar */}
        {!isOnline && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="bg-orange-500 text-white text-center py-1 text-sm"
          >
            📶 You're offline - Some features may be limited
          </motion.div>
        )}
      </header>

      {/* PWA Install Prompt */}
      {showInstallPrompt && showPWAPrompt && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-16 left-4 right-4 bg-volt-500 text-secondary-900 rounded-lg p-4 shadow-xl z-40 lg:hidden"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-secondary-900 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-volt-500 font-bold text-sm">⚡</span>
            </div>
            
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Install DirectoryBolt</h3>
              <p className="text-secondary-800 text-xs mt-1">
                Add to your home screen for faster access and offline features
              </p>
              
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleInstallPWA}
                  className="bg-secondary-900 text-volt-500 px-3 py-1.5 rounded text-xs font-medium"
                >
                  Install
                </button>
                <button
                  onClick={dismissInstallPrompt}
                  className="text-secondary-800 px-3 py-1.5 text-xs"
                >
                  Maybe Later
                </button>
              </div>
            </div>
            
            <button
              onClick={dismissInstallPrompt}
              className="text-secondary-800 hover:text-secondary-900 p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}

      {/* Notification Status */}
      {notificationPermission === 'granted' && (
        <div className="fixed top-20 right-4 bg-green-500 text-white text-xs px-2 py-1 rounded z-30 lg:hidden">
          🔔 Notifications enabled
        </div>
      )}
    </>
  )
}