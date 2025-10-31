// 🔒 JORDAN'S SYSTEM STATUS API - Comprehensive monitoring dashboard
// GET /api/status - System health, metrics, and monitoring endpoint

import type { NextApiRequest, NextApiResponse } from 'next'
import { handleApiError } from '../../../lib/utils/errors'
import { logger } from '../../../lib/utils/logger'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'

interface SystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  environment: string
  services: ServiceStatus[]
  metrics: SystemMetrics
  alerts: Alert[]
  lastChecked: string
}

interface ServiceStatus {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  lastCheck: string
  details?: Record<string, any>
}

interface SystemMetrics {
  api: {
    requestsPerMinute: number
    averageResponseTime: number
    errorRate: number
    uptime: number
  }
  database: {
    connectionPool: {
      active: number
      idle: number
      total: number
    }
    queryPerformance: {
      avgExecutionTime: number
      slowQueries: number
    }
  }
  scraping: {
    jobsQueued: number
    jobsProcessing: number
    jobsCompleted: number
    jobsFailed: number
    averageJobTime: number
  }
  payments: {
    transactionsToday: number
    successRate: number
    totalRevenue: number
  }
  users: {
    activeUsers: number
    registrationsToday: number
    creditsConsumed: number
  }
}

interface Alert {
  id: string
  type: 'warning' | 'critical'
  service: string
  message: string
  timestamp: string
  acknowledged: boolean
}

// Mock data store (use Redis/Database in production)
const systemMetrics = {
  requests: 0,
  errors: 0,
  totalResponseTime: 0,
  startTime: Date.now()
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SystemStatus | any>
) {
  const requestId = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET'])
      res.status(405).json(handleApiError(
        new Error('Method not allowed'),
        requestId
      ))
      return
    }
    
    // ⚠️ SECURITY: Check for admin authentication
    const isAuthenticated = await checkAdminAuth(req)
    
    const startTime = Date.now()
    
    if (!isAuthenticated) {
      // Return minimal public status only
      const publicStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
      }
      
      res.setHeader('Cache-Control', 'public, max-age=30')
      res.status(200).json(publicStatus)
      return
    }
    
    // Full system status only for authenticated admin users
    const services = await checkAllServices()
    const metrics = await collectSystemMetrics()
    const alerts = await getActiveAlerts()
    
    // Determine overall system status
    const overallStatus = determineOverallStatus(services, alerts)
    
    const status: SystemStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: Date.now() - systemMetrics.startTime,
      environment: process.env.NODE_ENV || 'development',
      services,
      metrics,
      alerts,
      lastChecked: new Date().toISOString()
    }
    
    // Log status check
    const duration = Date.now() - startTime
    logger.apiResponse?.({
      requestId,
      method: 'GET',
      url: '/api/status',
      status: 200,
      duration,
      authenticated: true
    })
    
    // Private cache headers for admin dashboards
    res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30')
    res.setHeader('X-Response-Time', `${duration}ms`)
    
    res.status(200).json(status)
    return
  } catch (error) {
    const errorResponse = handleApiError(error as Error, requestId)
    res.status(errorResponse.error.statusCode).json(errorResponse)
    return
  }
}

// Admin authentication check
async function checkAdminAuth(req: NextApiRequest): Promise<boolean> {
  try {
    // Check for admin API key
    const apiKey = req.headers['x-admin-key'] || req.headers['authorization']?.replace('Bearer ', '')
    
    if (!apiKey) {
      return false
    }
    
    // Verify admin API key
    const validAdminKey = process.env.ADMIN_API_KEY
    if (!validAdminKey || apiKey !== validAdminKey) {
      return false
    }
    
    return true
  } catch (error) {
    logger.error('Admin auth check failed', {}, error as Error)
    return false
  }
}

async function checkAllServices(): Promise<ServiceStatus[]> {
  const services: ServiceStatus[] = []
  
  // Database health check
  const dbStatus = await checkDatabaseHealth()
  services.push({
    name: 'Database',
    status: dbStatus.healthy ? 'healthy' : 'unhealthy',
    responseTime: dbStatus.responseTime,
    lastCheck: new Date().toISOString(),
    details: {
      connectionCount: dbStatus.connections,
      lastQuery: dbStatus.lastQueryTime
    }
  })
  
  // Redis/Cache health check
  const cacheStatus = await checkCacheHealth()
  services.push({
    name: 'Cache',
    status: cacheStatus.healthy ? 'healthy' : 'unhealthy',
    responseTime: cacheStatus.responseTime,
    lastCheck: new Date().toISOString(),
    details: {
      memoryUsage: cacheStatus.memoryUsage,
      hitRate: cacheStatus.hitRate
    }
  })
  
  // External services health check
  const stripeStatus = await checkStripeHealth()
  services.push({
    name: 'Stripe',
    status: stripeStatus.healthy ? 'healthy' : 'degraded',
    responseTime: stripeStatus.responseTime,
    lastCheck: new Date().toISOString(),
    details: {
      apiVersion: stripeStatus.version,
      rateLimitRemaining: stripeStatus.rateLimitRemaining
    }
  })
  
  // Scraping service health
  const scrapingStatus = await checkScrapingHealth()
  services.push({
    name: 'Scraping Service',
    status: scrapingStatus.healthy ? 'healthy' : 'degraded',
    lastCheck: new Date().toISOString(),
    details: {
      queueSize: scrapingStatus.queueSize,
      activeJobs: scrapingStatus.activeJobs,
      workerCount: scrapingStatus.workers
    }
  })
  
  return services
}

async function collectSystemMetrics(): Promise<SystemMetrics> {
  const now = Date.now()
  const uptime = now - systemMetrics.startTime
  const minutesSinceStart = uptime / (1000 * 60)
  
  return {
    api: {
      requestsPerMinute: systemMetrics.requests / Math.max(minutesSinceStart, 1),
      averageResponseTime: systemMetrics.totalResponseTime / Math.max(systemMetrics.requests, 1),
      errorRate: (systemMetrics.errors / Math.max(systemMetrics.requests, 1)) * 100,
      uptime: uptime / 1000 // seconds
    },
    database: {
      connectionPool: {
        active: Math.floor(Math.random() * 10) + 5, // Mock data
        idle: Math.floor(Math.random() * 5) + 2,
        total: 20
      },
      queryPerformance: {
        avgExecutionTime: Math.floor(Math.random() * 50) + 10, // ms
        slowQueries: Math.floor(Math.random() * 3) // count
      }
    },
    scraping: {
      jobsQueued: Math.floor(Math.random() * 20) + 5,
      jobsProcessing: Math.floor(Math.random() * 5) + 1,
      jobsCompleted: Math.floor(Math.random() * 1000) + 500,
      jobsFailed: Math.floor(Math.random() * 50) + 10,
      averageJobTime: Math.floor(Math.random() * 5000) + 2000 // ms
    },
    payments: {
      transactionsToday: Math.floor(Math.random() * 100) + 50,
      successRate: 98.5,
      totalRevenue: Math.floor(Math.random() * 10000) + 5000 // cents
    },
    users: {
      activeUsers: Math.floor(Math.random() * 500) + 200,
      registrationsToday: Math.floor(Math.random() * 20) + 5,
      creditsConsumed: Math.floor(Math.random() * 2000) + 1000
    }
  }
}

async function getActiveAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = []
  
  // Generate some mock alerts based on system conditions
  const metrics = await collectSystemMetrics()
  
  if (metrics.api.errorRate > 5) {
    alerts.push({
      id: `alert_${Date.now()}_1`,
      type: 'warning',
      service: 'API',
      message: `High error rate detected: ${metrics.api.errorRate.toFixed(2)}%`,
      timestamp: new Date().toISOString(),
      acknowledged: false
    })
  }
  
  if (metrics.api.averageResponseTime > 2000) {
    alerts.push({
      id: `alert_${Date.now()}_2`,
      type: 'critical',
      service: 'API',
      message: `Slow response times: ${metrics.api.averageResponseTime.toFixed(0)}ms average`,
      timestamp: new Date().toISOString(),
      acknowledged: false
    })
  }
  
  if (metrics.database.queryPerformance.slowQueries > 10) {
    alerts.push({
      id: `alert_${Date.now()}_3`,
      type: 'warning',
      service: 'Database',
      message: `${metrics.database.queryPerformance.slowQueries} slow queries detected`,
      timestamp: new Date().toISOString(),
      acknowledged: false
    })
  }
  
  return alerts
}

function determineOverallStatus(services: ServiceStatus[], alerts: Alert[]): 'healthy' | 'degraded' | 'unhealthy' {
  const unhealthyServices = services.filter(s => s.status === 'unhealthy').length
  const degradedServices = services.filter(s => s.status === 'degraded').length
  const criticalAlerts = alerts.filter(a => a.type === 'critical' && !a.acknowledged).length
  
  if (unhealthyServices > 0 || criticalAlerts > 0) {
    return 'unhealthy'
  }
  
  if (degradedServices > 0 || alerts.length > 0) {
    return 'degraded'
  }
  
  return 'healthy'
}

// Service health check functions
async function checkDatabaseHealth(): Promise<{
  healthy: boolean
  responseTime: number
  connections: number
  lastQueryTime: number
}> {
  const startTime = Date.now()
  
  try {
    // TODO: Implement actual database health check
    // const result = await db.raw('SELECT 1')
    
    // Mock database check
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10))
    
    return {
      healthy: true,
      responseTime: Date.now() - startTime,
      connections: Math.floor(Math.random() * 20) + 10,
      lastQueryTime: Date.now() - Math.floor(Math.random() * 1000)
    }
  } catch (error) {
    logger.error('Database health check failed', {}, error as Error)
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      connections: 0,
      lastQueryTime: 0
    }
  }
}

async function checkCacheHealth(): Promise<{
  healthy: boolean
  responseTime: number
  memoryUsage: string
  hitRate: number
}> {
  const startTime = Date.now()
  
  try {
    // TODO: Implement actual cache health check
    // const info = await redis.info('memory')
    
    // Mock cache check
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 5))
    
    return {
      healthy: true,
      responseTime: Date.now() - startTime,
      memoryUsage: '256MB',
      hitRate: 95.5
    }
  } catch (error) {
    logger.error('Cache health check failed', {}, error as Error)
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      memoryUsage: 'Unknown',
      hitRate: 0
    }
  }
}

async function checkStripeHealth(): Promise<{
  healthy: boolean
  responseTime: number
  version: string
  rateLimitRemaining: number
}> {
  const startTime = Date.now()
  
  try {
    // TODO: Implement actual Stripe API health check
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    // const account = await stripe.account.retrieve()
    
    // Mock Stripe check
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50))
    
    return {
      healthy: true,
      responseTime: Date.now() - startTime,
      version: '2023-10-16',
      rateLimitRemaining: 95
    }
  } catch (error) {
    logger.error('Stripe health check failed', {}, error as Error)
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      version: 'Unknown',
      rateLimitRemaining: 0
    }
  }
}

async function checkScrapingHealth(): Promise<{
  healthy: boolean
  queueSize: number
  activeJobs: number
  workers: number
}> {
  try {
    // TODO: Check actual scraping service status
    // const queueStats = await scrapingService.getStats()
    
    return {
      healthy: true,
      queueSize: Math.floor(Math.random() * 50) + 10,
      activeJobs: Math.floor(Math.random() * 5) + 1,
      workers: 3
    }
  } catch (error) {
    logger.error('Scraping service health check failed', {}, error as Error)
    return {
      healthy: false,
      queueSize: 0,
      activeJobs: 0,
      workers: 0
    }
  }
}

// Utility function to update metrics (called by other API routes)
export function updateMetrics(responseTime: number, isError: boolean = false): void {
  systemMetrics.requests++
  systemMetrics.totalResponseTime += responseTime
  
  if (isError) {
    systemMetrics.errors++
  }
}

// Export with rate limiting applied
export default withRateLimit(handler, rateLimiters.status)
