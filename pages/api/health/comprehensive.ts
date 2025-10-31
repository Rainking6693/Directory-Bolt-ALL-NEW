// @ts-nocheck
// Comprehensive Health Check API Endpoint
import { NextApiRequest, NextApiResponse } from 'next'
import { dbManager } from '../../../lib/database/optimized-queries'
import { queueManager } from '../../../lib/queue/advanced-queue-manager'
import { monitoring } from '../../../lib/monitoring/comprehensive-monitoring'
import { scalingManager } from '../../../lib/infrastructure/scaling-strategy'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-08-16',
})

interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical'
  timestamp: string
  uptime: number
  version: string
  services: {
    database: ServiceHealth
    stripe: ServiceHealth
    queue: ServiceHealth
    analytics: ServiceHealth
    memory: ServiceHealth
    disk: ServiceHealth
  }
  metrics: {
    response_time: number
    queue_size: number
    active_workers: number
    error_rate: number
    memory_usage: number
    concurrent_users: number
  }
  alerts: any[]
  recommendations: string[]
}

interface ServiceHealth {
  status: 'healthy' | 'warning' | 'critical'
  latency?: number
  details?: any
  error?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<HealthCheckResult>) {
  const startTime = Date.now()
  
  try {
    // Set health check headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    // Perform all health checks in parallel
    const [
      databaseHealth,
      stripeHealth,
      queueHealth,
      analyticsHealth,
      memoryHealth,
      diskHealth,
      systemHealth,
      scalingMetrics
    ] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkStripeHealth(),
      checkQueueHealth(),
      checkAnalyticsHealth(),
      checkMemoryHealth(),
      checkDiskHealth(),
      monitoring.getSystemHealth(),
      scalingManager.getCurrentMetrics()
    ])

    const responseTime = Date.now() - startTime

    // Determine overall status
    const services = {
      database: getResultValue(databaseHealth, { status: 'critical' as const, error: 'Health check failed' }),
      stripe: getResultValue(stripeHealth, { status: 'critical' as const, error: 'Health check failed' }),
      queue: getResultValue(queueHealth, { status: 'critical' as const, error: 'Health check failed' }),
      analytics: getResultValue(analyticsHealth, { status: 'critical' as const, error: 'Health check failed' }),
      memory: getResultValue(memoryHealth, { status: 'critical' as const, error: 'Health check failed' }),
      disk: getResultValue(diskHealth, { status: 'critical' as const, error: 'Health check failed' })
    }

    const overallStatus = determineOverallStatus(services)
    const systemHealthData = getResultValue(systemHealth, { status: 'critical', active_alerts: 0, recent_alerts: [] })
    const metrics = getResultValue(scalingMetrics, {
      queue_size: 0,
      concurrent_users: 0,
      error_rate: 0,
      memory_usage: 0
    })

    const healthResult: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services,
      metrics: {
        response_time: responseTime,
        queue_size: metrics.queue_size,
        active_workers: queueManager.getActiveWorkers(),
        error_rate: metrics.error_rate,
        memory_usage: metrics.memory_usage,
        concurrent_users: metrics.concurrent_users
      },
      alerts: systemHealthData.recent_alerts || [],
      recommendations: generateHealthRecommendations(services, metrics)
    }

    // Set appropriate HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                     overallStatus === 'warning' ? 200 : 503

    res.status(statusCode).json(healthResult)

  } catch (error) {
    console.error('Health check error:', error)
    
    res.status(503).json({
      status: 'critical',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: 'unknown',
      services: {
        database: { status: 'critical', error: 'Health check failed' },
        stripe: { status: 'critical', error: 'Health check failed' },
        queue: { status: 'critical', error: 'Health check failed' },
        analytics: { status: 'critical', error: 'Health check failed' },
        memory: { status: 'critical', error: 'Health check failed' },
        disk: { status: 'critical', error: 'Health check failed' }
      },
      metrics: {
        response_time: Date.now() - startTime,
        queue_size: 0,
        active_workers: 0,
        error_rate: 100,
        memory_usage: 0,
        concurrent_users: 0
      },
      alerts: [],
      recommendations: ['System is experiencing critical issues', 'Contact system administrator immediately']
    })
  }
}

// Individual health check functions
async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const startTime = Date.now()
  
  try {
    const isHealthy = await dbManager.healthCheck()
    const latency = Date.now() - startTime
    
    if (!isHealthy) {
      return { status: 'critical', latency, error: 'Database connection failed' }
    }
    
    // Additional database performance checks
    const { data: recentData, error } = await dbManager.getClient()
      .from('customers')
      .select('id')
      .limit(1)
    
    if (error) {
      return { status: 'warning', latency, error: error.message }
    }
    
    // Check latency thresholds
    if (latency > 1000) {
      return { status: 'warning', latency, details: 'High database latency' }
    }
    
    return { status: 'healthy', latency }
    
  } catch (error) {
    return { 
      status: 'critical', 
      latency: Date.now() - startTime, 
      error: (error as Error).message 
    }
  }
}

async function checkStripeHealth(): Promise<ServiceHealth> {
  const startTime = Date.now()
  
  try {
    // Test Stripe API connectivity
    await stripe.paymentMethods.list({ limit: 1 })
    const latency = Date.now() - startTime
    
    if (latency > 2000) {
      return { status: 'warning', latency, details: 'High Stripe API latency' }
    }
    
    return { status: 'healthy', latency }
    
  } catch (error) {
    return { 
      status: 'critical', 
      latency: Date.now() - startTime, 
      error: (error as Error).message 
    }
  }
}

async function checkQueueHealth(): Promise<ServiceHealth> {
  try {
    const queueSize = queueManager.getQueueSize()
    const activeWorkers = queueManager.getActiveWorkers()
    const metrics = queueManager.getMetrics()
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    
    if (queueSize > 500) {
      status = 'critical'
    } else if (queueSize > 100 || metrics.successRate < 0.8) {
      status = 'warning'
    }
    
    return {
      status,
      details: {
        queue_size: queueSize,
        active_workers: activeWorkers,
        success_rate: metrics.successRate,
        average_processing_time: metrics.averageProcessingTime
      }
    }
    
  } catch (error) {
    return { status: 'critical', error: (error as Error).message }
  }
}

async function checkAnalyticsHealth(): Promise<ServiceHealth> {
  try {
    // Check if analytics events are being recorded
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const { data, error } = await dbManager.getClient()
      .from('analytics_events')
      .select('id', { count: 'exact' })
      .gte('created_at', oneHourAgo)
    
    if (error) {
      return { status: 'warning', error: error.message }
    }
    
    const eventsCount = data?.count || 0
    
    if (eventsCount === 0) {
      return { status: 'warning', details: 'No analytics events in the last hour' }
    }
    
    return { status: 'healthy', details: { events_last_hour: eventsCount } }
    
  } catch (error) {
    return { status: 'critical', error: (error as Error).message }
  }
}

async function checkMemoryHealth(): Promise<ServiceHealth> {
  try {
    const memoryUsage = process.memoryUsage()
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    
    if (memoryPercentage > 90) {
      status = 'critical'
    } else if (memoryPercentage > 75) {
      status = 'warning'
    }
    
    return {
      status,
      details: {
        heap_used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heap_total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round(memoryPercentage),
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024) // MB
      }
    }
    
  } catch (error) {
    return { status: 'critical', error: (error as Error).message }
  }
}

async function checkDiskHealth(): Promise<ServiceHealth> {
  try {
    // In a real implementation, you would check actual disk usage
    // This is a placeholder that always returns healthy
    return {
      status: 'healthy',
      details: {
        message: 'Disk health monitoring not implemented',
        recommendation: 'Implement actual disk space monitoring'
      }
    }
    
  } catch (error) {
    return { status: 'critical', error: (error as Error).message }
  }
}

// Utility functions
function getResultValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback
}

function determineOverallStatus(services: Record<string, ServiceHealth>): 'healthy' | 'warning' | 'critical' {
  const statuses = Object.values(services).map(service => service.status)
  
  if (statuses.includes('critical')) {
    return 'critical'
  }
  
  if (statuses.includes('warning')) {
    return 'warning'
  }
  
  return 'healthy'
}

function generateHealthRecommendations(services: Record<string, ServiceHealth>, metrics: any): string[] {
  const recommendations = []
  
  // Service-specific recommendations
  Object.entries(services).forEach(([serviceName, health]) => {
    if (health.status === 'critical') {
      recommendations.push(`Immediate attention required for ${serviceName} service`)
    } else if (health.status === 'warning') {
      recommendations.push(`Monitor ${serviceName} service closely`)
    }
  })
  
  // Metric-based recommendations
  if (metrics.queue_size > 100) {
    recommendations.push('Consider scaling up queue processing capacity')
  }
  
  if (metrics.error_rate > 5) {
    recommendations.push('Investigate high error rate')
  }
  
  if (metrics.memory_usage > 80) {
    recommendations.push('Monitor memory usage - consider optimization')
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System is operating normally')
  }
  
  return recommendations
}