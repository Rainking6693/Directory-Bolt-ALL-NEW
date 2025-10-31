// PWA Configuration
export const PWA_CONFIG = {
  name: 'DirectoryBolt',
  short_name: 'DirectoryBolt',
  description: 'AI-Powered Directory Submission Platform',
  start_url: '/',
  display: 'standalone',
  orientation: 'portrait',
  theme_color: '#FFC107',
  background_color: '#0F1419',
  scope: '/',
  icons: [
    {
      src: '/pwa/icon-72.png',
      sizes: '72x72',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/pwa/icon-96.png',
      sizes: '96x96',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/pwa/icon-128.png',
      sizes: '128x128',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/pwa/icon-144.png',
      sizes: '144x144',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/pwa/icon-152.png',
      sizes: '152x152',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/pwa/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/pwa/icon-384.png',
      sizes: '384x384',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/pwa/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable'
    }
  ],
  shortcuts: [
    {
      name: 'View Dashboard',
      short_name: 'Dashboard',
      description: 'Go to your DirectoryBolt dashboard',
      url: '/dashboard',
      icons: [{ src: '/pwa/shortcut-dashboard.png', sizes: '192x192' }]
    },
    {
      name: 'Submit Directory',
      short_name: 'Submit',
      description: 'Submit to a new directory',
      url: '/submit',
      icons: [{ src: '/pwa/shortcut-submit.png', sizes: '192x192' }]
    },
    {
      name: 'Analytics',
      short_name: 'Analytics',
      description: 'View your analytics',
      url: '/analytics',
      icons: [{ src: '/pwa/shortcut-analytics.png', sizes: '192x192' }]
    }
  ],
  categories: ['business', 'marketing', 'productivity'],
  lang: 'en-US',
  dir: 'ltr'
}

// Service Worker Registration
export class PWAManager {
  private static instance: PWAManager
  private swRegistration: ServiceWorkerRegistration | null = null
  private deferredPrompt: any = null

  static getInstance(): PWAManager {
    if (!PWAManager.instance) {
      PWAManager.instance = new PWAManager()
    }
    return PWAManager.instance
  }

  async init(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })

        console.log('ServiceWorker registered successfully:', this.swRegistration)

        // Listen for updates
        this.swRegistration.addEventListener('updatefound', () => {
          const newWorker = this.swRegistration!.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.showUpdateAvailable()
              }
            })
          }
        })

        // Check for updates
        this.swRegistration.update()
      } catch (error) {
        console.error('ServiceWorker registration failed:', error)
      }
    }

    // Handle install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      this.deferredPrompt = e
      this.showInstallPrompt()
    })

    // Handle app installed
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed')
      this.hideInstallPrompt()
    })
  }

  async requestNotificationPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      return permission
    }
    return 'denied'
  }

  async showNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (this.swRegistration && 'Notification' in window && Notification.permission === 'granted') {
      // Use ServiceWorkerRegistration.showNotification which supports actions
      await this.swRegistration.showNotification(title, {
        badge: '/pwa/badge.png',
        icon: '/pwa/icon-192.png',
        ...options
      })
    }
  }

  async subscribeToNotifications(): Promise<PushSubscription | null> {
    if (this.swRegistration && 'PushManager' in window) {
      try {
        const subscription = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
          )
        })
        
        // Send subscription to server
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription)
        })

        return subscription
      } catch (error) {
        console.error('Push subscription failed:', error)
        return null
      }
    }
    return null
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  private showInstallPrompt(): void {
    // Show custom install prompt UI
    const installPrompt = document.createElement('div')
    installPrompt.id = 'pwa-install-prompt'
    installPrompt.innerHTML = `
      <div class="fixed bottom-4 left-4 right-4 bg-secondary-800 border border-volt-500 rounded-lg p-4 shadow-xl z-50 max-w-sm mx-auto">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 bg-volt-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <span class="text-secondary-900 font-bold">⚡</span>
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-white text-sm">Install DirectoryBolt</h3>
            <p class="text-secondary-400 text-xs mt-1">Add to your home screen for quick access</p>
            <div class="flex gap-2 mt-3">
              <button id="pwa-install-btn" class="bg-volt-500 text-secondary-900 px-3 py-1.5 rounded text-xs font-medium">
                Install
              </button>
              <button id="pwa-dismiss-btn" class="text-secondary-400 px-3 py-1.5 text-xs">
                Maybe Later
              </button>
            </div>
          </div>
          <button id="pwa-close-btn" class="text-secondary-400 hover:text-white">
            ✕
          </button>
        </div>
      </div>
    `

    document.body.appendChild(installPrompt)

    // Add event listeners
    document.getElementById('pwa-install-btn')?.addEventListener('click', () => {
      this.installApp()
    })

    document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
      this.hideInstallPrompt()
      localStorage.setItem('pwa-install-dismissed', Date.now().toString())
    })

    document.getElementById('pwa-close-btn')?.addEventListener('click', () => {
      this.hideInstallPrompt()
    })
  }

  private hideInstallPrompt(): void {
    const prompt = document.getElementById('pwa-install-prompt')
    if (prompt) {
      prompt.remove()
    }
  }

  private async installApp(): Promise<void> {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt()
      const { outcome } = await this.deferredPrompt.userChoice
      console.log(`User response to install prompt: ${outcome}`)
      this.deferredPrompt = null
      this.hideInstallPrompt()
    }
  }

  private showUpdateAvailable(): void {
    // Show update available notification
    const updateNotification = document.createElement('div')
    updateNotification.id = 'pwa-update-notification'
    updateNotification.innerHTML = `
      <div class="fixed top-4 left-4 right-4 bg-blue-500 rounded-lg p-4 shadow-xl z-50 max-w-sm mx-auto">
        <div class="flex items-center justify-between text-white">
          <div class="flex-1">
            <h3 class="font-semibold text-sm">Update Available</h3>
            <p class="text-blue-100 text-xs mt-1">A new version is ready to install</p>
          </div>
          <button id="pwa-update-btn" class="bg-white text-blue-500 px-3 py-1.5 rounded text-xs font-medium ml-3">
            Update
          </button>
        </div>
      </div>
    `

    document.body.appendChild(updateNotification)

    document.getElementById('pwa-update-btn')?.addEventListener('click', () => {
      this.updateApp()
    })

    // Auto-hide after 10 seconds
    setTimeout(() => {
      const notification = document.getElementById('pwa-update-notification')
      if (notification) notification.remove()
    }, 10000)
  }

  private updateApp(): void {
    if (this.swRegistration?.waiting) {
      this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }
  }

  // Offline detection and handling
  setupOfflineHandling(): void {
    const showOfflineIndicator = () => {
      const indicator = document.createElement('div')
      indicator.id = 'offline-indicator'
      indicator.innerHTML = `
        <div class="fixed top-0 left-0 right-0 bg-orange-500 text-white text-center py-2 text-sm z-50">
          📶 You're offline. Some features may be limited.
        </div>
      `
      document.body.appendChild(indicator)
    }

    const hideOfflineIndicator = () => {
      const indicator = document.getElementById('offline-indicator')
      if (indicator) indicator.remove()
    }

    window.addEventListener('online', hideOfflineIndicator)
    window.addEventListener('offline', showOfflineIndicator)

    // Check initial state
    if (!navigator.onLine) {
      showOfflineIndicator()
    }
  }

  // Cache management
  async clearCache(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames.map(name => caches.delete(name))
      )
    }
  }

  async getCacheSize(): Promise<number> {
    if ('caches' in window && 'storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      return estimate.usage || 0
    }
    return 0
  }
}

// Notification management
export class NotificationManager {
  static async scheduleNotification(
    title: string,
    body: string,
    scheduledTime: Date,
    data?: any
  ): Promise<void> {
    const pwa = PWAManager.getInstance()
    
    // Calculate delay
    const delay = scheduledTime.getTime() - Date.now()
    
    if (delay > 0) {
      setTimeout(async () => {
        await pwa.showNotification(title, {
          body,
          data,
          requireInteraction: true
        })
      }, delay)
    }
  }

  static async sendDirectoryUpdateNotification(
    directoryName: string,
    status: 'approved' | 'rejected' | 'live'
  ): Promise<void> {
    const pwa = PWAManager.getInstance()
    
    const messages = {
      approved: `Your submission to ${directoryName} has been approved! 🎉`,
      rejected: `Your submission to ${directoryName} needs attention ⚠️`,
      live: `Your listing on ${directoryName} is now live! 🚀`
    }

    await pwa.showNotification(`Directory Update`, {
      body: messages[status],
      icon: `/pwa/icon-192.png`,
      badge: `/pwa/badge.png`,
      data: { type: 'directory_update', status, directoryName }
    })
  }

  static async sendAnalyticsNotification(
    type: 'weekly_report' | 'milestone' | 'improvement',
    data: any
  ): Promise<void> {
    const pwa = PWAManager.getInstance()
    
    const messages = {
      weekly_report: `Your weekly analytics report is ready 📊`,
      milestone: `Congratulations! You've reached ${data.milestone} 🎯`,
      improvement: `Great news! Your visibility improved by ${data.improvement}% 📈`
    }

    await pwa.showNotification('Analytics Update', {
      body: messages[type],
      icon: `/pwa/icon-192.png`,
      data: { type: 'analytics', subtype: type, ...data }
    })
  }
}