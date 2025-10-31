/**
 * Advanced Workbox Configuration for DirectoryBolt
 * Implements cutting-edge PWA capabilities with intelligent caching
 */

const { GenerateSW } = require('workbox-webpack-plugin')
const { StaleWhileRevalidate, CacheFirst, NetworkFirst } = require('workbox-strategies')

class AdvancedWorkboxConfig {
  static getWebpackPlugin() {
    return new GenerateSW({
      // Advanced service worker configuration
      swDest: 'sw-advanced.js',
      clientsClaim: true,
      skipWaiting: true,
      cleanupOutdatedCaches: true,
      
      // Intelligent runtime caching strategies
      runtimeCaching: [
        // API responses with network-first strategy
        {
          urlPattern: /^https:\/\/.*\.(?:api|json)/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            networkTimeoutSeconds: 3,
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 5 * 60, // 5 minutes
            },
            cacheKeyWillBeUsed: async ({ request }) => {
              // Create cache key that includes user context
              const url = new URL(request.url)
              const userId = await getUserId()
              return `${url.pathname}${url.search}-user-${userId}`
            }
          },
        },
        
        // Customer data with stale-while-revalidate
        {
          urlPattern: /\/api\/customer\/.*/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'customer-data-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60, // 1 hour
            },
            plugins: [
              {
                cacheKeyWillBeUsed: async ({ request }) => {
                  // Include authentication in cache key
                  const authToken = await getAuthToken()
                  return `${request.url}-auth-${authToken?.substring(0, 10)}`
                }
              }
            ]
          },
        },
        
        // Directory data with cache-first strategy
        {
          urlPattern: /\/api\/directories\/.*/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'directory-data-cache',
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 24 * 60 * 60, // 24 hours
            },
            plugins: [
              {
                cacheWillUpdate: async ({ request, response }) => {
                  // Only cache successful responses
                  return response.status === 200
                }
              }
            ]
          },
        },
        
        // Static assets with cache-first strategy
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'images-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            },
          },
        },
        
        // Fonts with cache-first strategy
        {
          urlPattern: /\.(?:woff|woff2|ttf|otf)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
            },
          },
        },
        
        // CSS and JS with stale-while-revalidate
        {
          urlPattern: /\.(?:css|js)$/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'static-resources-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 24 * 60 * 60, // 24 hours
            },
          },
        },
      ],
      
      // Offline fallbacks
      offlineFallback: {
        pageFallback: '/offline',
        imageFallback: '/offline-image.png',
        fontFallback: false,
      },
      
      // Navigation fallback for SPA routing
      navigateFallback: '/offline',
      navigateFallbackAllowlist: [/^(?!\/__).*/],
      navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
      
      // Advanced features
      include: [/\.html$/, /\.js$/, /\.css$/],
      exclude: [
        /\.map$/,
        /manifest\.json$/,
        /sw\.js$/,
        /workbox-.*\.js$/,
        /^_next\/static\/chunks\/pages\/api\//,
      ],
      
      // Custom mode and configuration
      mode: 'production',
      maximumFileSizeToCacheInBytes: 5000000, // 5MB
      
      // Advanced import scripts for additional functionality
      importScripts: ['/sw-custom-handlers.js'],
      
      // Manifest modifications
      manifestTransforms: [
        (manifestEntries) => {
          // Filter out unnecessary files from precache
          const filteredEntries = manifestEntries.filter(entry => {
            return !entry.url.includes('hot-update') && 
                   !entry.url.includes('.map') &&
                   !entry.url.includes('_buildManifest')
          })
          
          return { manifest: filteredEntries }
        }
      ],
    })
  }
  
  static getClientConfig() {
    return {
      // Configuration for workbox-window on the client side
      scope: '/',
      type: 'module',
      updateViaCache: 'none',
      
      // Custom update detection
      onUpdate: (registration) => {
        console.log('📦 New service worker available, updating...')
        
        // Show update notification to user
        showUpdateNotification()
        
        // Skip waiting and claim clients
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      },
      
      onInstalled: (registration) => {
        console.log('✅ Service worker installed successfully')
        
        // Initialize background sync
        initializeBackgroundSync(registration)
        
        // Set up periodic sync
        setupPeriodicSync(registration)
      },
      
      onError: (error) => {
        console.error('❌ Service worker error:', error)
        
        // Report error to monitoring service
        reportServiceWorkerError(error)
      }
    }
  }
  
  static getAdvancedStrategies() {
    return {
      // Custom strategy for AI-powered content
      aiContentStrategy: new NetworkFirst({
        cacheName: 'ai-content-cache',
        networkTimeoutSeconds: 10,
        plugins: [
          {
            cacheKeyWillBeUsed: async ({ request }) => {
              // Create intelligent cache keys for AI content
              const url = new URL(request.url)
              const businessContext = await getBusinessContext()
              return `${url.pathname}-context-${hashBusinessContext(businessContext)}`
            },
            
            cacheWillUpdate: async ({ request, response }) => {
              // Only cache successful AI responses
              if (response.status !== 200) return false
              
              // Check if response contains valid AI data
              const contentType = response.headers.get('content-type')
              return contentType && contentType.includes('application/json')
            },
            
            cachedResponseWillBeUsed: async ({ cachedResponse, event }) => {
              // Add cache metadata headers
              if (cachedResponse) {
                const modifiedResponse = cachedResponse.clone()
                modifiedResponse.headers.set('X-Cache-Status', 'HIT')
                modifiedResponse.headers.set('X-Cache-Date', new Date().toISOString())
                return modifiedResponse
              }
              return cachedResponse
            }
          }
        ]
      }),
      
      // Strategy for real-time data
      realTimeDataStrategy: new StaleWhileRevalidate({
        cacheName: 'realtime-cache',
        plugins: [
          {
            cacheKeyWillBeUsed: async ({ request }) => {
              // Include timestamp for real-time data freshness
              const url = new URL(request.url)
              const timestamp = Math.floor(Date.now() / (5 * 60 * 1000)) // 5-minute buckets
              return `${url.pathname}${url.search}-time-${timestamp}`
            }
          }
        ]
      }),
      
      // Strategy for large files with progressive enhancement
      largeFileStrategy: new CacheFirst({
        cacheName: 'large-files-cache',
        plugins: [
          {
            requestWillFetch: async ({ request }) => {
              // Add range headers for partial content support
              const modifiedRequest = new Request(request.url, {
                headers: {
                  ...request.headers,
                  'Range': 'bytes=0-1048576' // 1MB chunks
                }
              })
              return modifiedRequest
            },
            
            fetchDidFail: async ({ originalRequest, error }) => {
              console.log('Large file fetch failed:', error)
              
              // Attempt to fetch smaller chunks
              return fetchInChunks(originalRequest)
            }
          }
        ]
      })
    }
  }
}

// Helper functions for advanced features
async function getUserId() {
  // Get user ID from localStorage or session
  return localStorage.getItem('userId') || 'anonymous'
}

async function getAuthToken() {
  // Get authentication token
  return localStorage.getItem('authToken')
}

async function getBusinessContext() {
  // Get current business context for cache optimization
  const businessData = localStorage.getItem('businessData')
  return businessData ? JSON.parse(businessData) : {}
}

function hashBusinessContext(context) {
  // Create a hash of business context for cache keys
  return btoa(JSON.stringify(context)).substring(0, 10)
}

function showUpdateNotification() {
  // Show user-friendly update notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('DirectoryBolt Update Available', {
      body: 'A new version is available. Refresh to update.',
      icon: '/icon-192x192.png',
      tag: 'app-update'
    })
  }
}

function initializeBackgroundSync(registration) {
  // Initialize background sync for offline actions
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    registration.sync.register('background-sync-queue')
  }
}

function setupPeriodicSync(registration) {
  // Set up periodic background sync
  if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
    registration.periodicSync.register('periodic-data-sync', {
      minInterval: 24 * 60 * 60 * 1000 // 24 hours
    })
  }
}

function reportServiceWorkerError(error) {
  // Report service worker errors to monitoring
  console.error('Service Worker Error:', error)
  
  // Send to error tracking service
  if (window.gtag) {
    window.gtag('event', 'exception', {
      description: error.message,
      fatal: false
    })
  }
}

async function fetchInChunks(request) {
  // Implement chunked fetching for large files
  const response = await fetch(request.url, {
    headers: { 'Range': 'bytes=0-262144' } // 256KB chunks
  })
  
  if (response.status === 206) {
    // Handle partial content
    return response
  }
  
  throw new Error('Chunk fetching not supported')
}

module.exports = AdvancedWorkboxConfig