// Application constants for DirectoryBolt
export const APP_CONFIG = {
  name: 'DirectoryBolt',
  version: '1.0.0',
  description: 'Enterprise-grade business directory platform',
  url: 'https://directorybolt.com',
  
  // Performance thresholds
  performance: {
    maxResponseTime: 2000, // 2 seconds
    maxBundleSize: 250, // 250kb
    targetLighthouseScore: 95,
  },
  
  // Monitoring endpoints
  monitoring: {
    healthCheck: '/api/health',
    metrics: '/api/metrics',
    status: '/api/status',
  },
} as const

export const CACHE_KEYS = {
  userSession: 'user-session',
  directoryData: 'directory-data',
  searchResults: 'search-results',
} as const

export const API_ENDPOINTS = {
  health: '/api/health',
  directory: '/api/directory',
  search: '/api/search',
} as const