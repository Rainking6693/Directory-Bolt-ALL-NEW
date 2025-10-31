// DirectoryBolt Service Worker
const CACHE_NAME = 'directorybolt-v1.0.0'
const STATIC_CACHE = 'directorybolt-static-v1.0.0'
const DYNAMIC_CACHE = 'directorybolt-dynamic-v1.0.0'

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/favicon.ico',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/_next/static/css/',
  '/_next/static/js/'
]

// Routes that should always be cached
const CACHE_ROUTES = [
  '/dashboard',
  '/analytics',
  '/submit',
  '/directories',
  '/pricing'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker')
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .catch((err) => {
        console.error('[SW] Failed to cache static assets:', err)
      })
  )
  
  // Force activation of new service worker
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        // Take control of all clients
        return self.clients.claim()
      })
  )
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return
  }
  
  // Handle API requests differently
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request))
    return
  }
  
  // Handle page requests
  if (request.mode === 'navigate') {
    event.respondWith(handlePageRequest(request))
    return
  }
  
  // Handle static assets
  event.respondWith(handleStaticRequest(request))
})

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  try {
    // Always try network first for API requests
    const networkResponse = await fetch(request)
    
    // Cache successful responses for offline fallback
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[SW] API request failed, trying cache:', request.url)
    
    // Try to serve from cache if available
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline response for critical endpoints
    if (request.url.includes('/api/user') || request.url.includes('/api/dashboard')) {
      return new Response(
        JSON.stringify({ 
          error: 'Offline', 
          message: 'This feature requires an internet connection' 
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    
    throw error
  }
}

// Handle page requests with cache-first strategy for key pages
async function handlePageRequest(request) {
  const url = new URL(request.url)
  
  // Check if this is a key route that should be cached
  const isKeyRoute = CACHE_ROUTES.some(route => url.pathname.startsWith(route))
  
  if (isKeyRoute) {
    try {
      // Try cache first for key routes
      const cachedResponse = await caches.match(request)
      if (cachedResponse) {
        // Serve from cache and update in background
        updateCacheInBackground(request)
        return cachedResponse
      }
    } catch (error) {
      console.log('[SW] Cache match failed:', error)
    }
  }
  
  try {
    // Try network
    const networkResponse = await fetch(request)
    
    // Cache successful page responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[SW] Page request failed:', request.url)
    
    // Try to serve from cache
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Serve offline page
    return caches.match('/offline')
  }
}

// Handle static asset requests
async function handleStaticRequest(request) {
  try {
    // Try cache first for static assets
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Try network
    const networkResponse = await fetch(request)
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[SW] Static request failed:', request.url)
    
    // Try cache again as fallback
    return caches.match(request)
  }
}

// Update cache in background
async function updateCacheInBackground(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response)
    }
  } catch (error) {
    console.log('[SW] Background update failed:', error)
  }
}

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }
  
  try {
    const data = event.data.json()
    const { title, body, icon, badge, actions, data: notificationData } = data
    
    const options = {
      body,
      icon: icon || '/pwa/icon-192.png',
      badge: badge || '/pwa/badge.png',
      data: notificationData,
      requireInteraction: true,
      actions: actions || [
        {
          action: 'view',
          title: 'View Details'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    }
    
    event.waitUntil(
      self.registration.showNotification(title || 'DirectoryBolt Update', options)
    )
  } catch (error) {
    console.error('[SW] Failed to show notification:', error)
    
    // Fallback notification
    event.waitUntil(
      self.registration.showNotification('DirectoryBolt Update', {
        body: 'You have a new update',
        icon: '/pwa/icon-192.png',
        badge: '/pwa/badge.png'
      })
    )
  }
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event
  const data = notification.data || {}
  
  notification.close()
  
  let targetUrl = '/'
  
  // Determine target URL based on action and data
  switch (action) {
    case 'view':
    case 'view_directory':
      if (data.type === 'directory_update') {
        targetUrl = '/directories'
      } else {
        targetUrl = '/dashboard'
      }
      break
    case 'view_dashboard':
      targetUrl = '/dashboard'
      break
    case 'view_analytics':
      targetUrl = '/analytics'
      break
    case 'take_action':
      targetUrl = data.actionUrl || '/dashboard'
      break
    default:
      if (data.type === 'directory_update') {
        targetUrl = '/directories'
      } else if (data.type === 'analytics') {
        targetUrl = '/analytics'
      } else {
        targetUrl = '/dashboard'
      }
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus()
          }
        }
        
        // Open new window if none found
        if (clients.openWindow) {
          return clients.openWindow(targetUrl)
        }
      })
      .catch((error) => {
        console.error('[SW] Failed to handle notification click:', error)
      })
  )
})

// Handle background sync
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag)
  
  switch (event.tag) {
    case 'sync-analytics':
      event.waitUntil(syncAnalytics())
      break
    case 'sync-submissions':
      event.waitUntil(syncSubmissions())
      break
    case 'sync-preferences':
      event.waitUntil(syncPreferences())
      break
    default:
      console.log('[SW] Unknown sync tag:', event.tag)
  }
})

// Sync analytics data
async function syncAnalytics() {
  try {
    // Get pending analytics data from IndexedDB or localStorage
    const pendingData = await getPendingAnalytics()
    
    if (pendingData.length > 0) {
      const response = await fetch('/api/analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: pendingData })
      })
      
      if (response.ok) {
        await clearPendingAnalytics()
        console.log('[SW] Analytics synced successfully')
      }
    }
  } catch (error) {
    console.error('[SW] Analytics sync failed:', error)
  }
}

// Sync form submissions
async function syncSubmissions() {
  try {
    const pendingSubmissions = await getPendingSubmissions()
    
    for (const submission of pendingSubmissions) {
      try {
        const response = await fetch('/api/directories/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submission)
        })
        
        if (response.ok) {
          await removePendingSubmission(submission.id)
        }
      } catch (error) {
        console.error('[SW] Submission sync failed:', error)
      }
    }
  } catch (error) {
    console.error('[SW] Submissions sync failed:', error)
  }
}

// Sync user preferences
async function syncPreferences() {
  try {
    const pendingPreferences = await getPendingPreferences()
    
    if (pendingPreferences) {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingPreferences)
      })
      
      if (response.ok) {
        await clearPendingPreferences()
        console.log('[SW] Preferences synced successfully')
      }
    }
  } catch (error) {
    console.error('[SW] Preferences sync failed:', error)
  }
}

// Helper functions for offline data management
async function getPendingAnalytics() {
  // Implementation would depend on your offline storage strategy
  return []
}

async function clearPendingAnalytics() {
  // Clear pending analytics data
}

async function getPendingSubmissions() {
  // Get pending submissions from offline storage
  return []
}

async function removePendingSubmission(id) {
  // Remove specific submission from offline storage
}

async function getPendingPreferences() {
  // Get pending preferences from offline storage
  return null
}

async function clearPendingPreferences() {
  // Clear pending preferences
}

// Handle skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

console.log('[SW] Service Worker loaded successfully')