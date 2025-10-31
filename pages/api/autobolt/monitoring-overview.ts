/**
 * AutoBolt Monitoring Overview API
 * 
 * GET /api/autobolt/monitoring-overview - Get high-level system overview
 * Provides summary metrics for the monitoring dashboard
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'

// Initialize Supabase client with service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface MonitoringOverview {
  system_status: 'operational' | 'degraded' | 'outage'
  active_extensions: number
  total_customers_processing: number
  queue_depth: number
  success_rate_24h: number
  average_processing_time: number
  critical_alerts: number
  last_updated: string
  detailed_metrics: {
    extensions: {
      healthy: number
      warning: number
      error: number
      offline: number
    }
    queue: {
      pending: number
      processing: number
      completed_today: number
      failed_today: number
    }
    performance: {
      total_directories_processed_24h: number
      average_directories_per_hour: number
      peak_processing_time: string
      system_uptime_percent: number
    }
  }
}

interface OverviewResponse {
  success: boolean
  overview?: MonitoringOverview
  error?: string
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OverviewResponse>
) {
  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET.'
    })
  }

  try {
    // Authenticate using API key
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '')
    
    if (!apiKey || apiKey !== process.env.AUTOBOLT_API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Valid AUTOBOLT_API_KEY required.'
      })
    }

    // Get current queue status
    const { data: queueData, error: queueError } = await supabase
      .from('autobolt_processing_queue')
      .select('status, created_at, started_at, completed_at')
      .order('created_at', { ascending: false })

    if (queueError) {
      console.error('❌ Failed to fetch queue data:', queueError)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch queue data'
      })
    }

    // Get extension status
    const { data: extensionData, error: extensionError } = await supabase
      .from('autobolt_extension_status')
      .select('status, last_heartbeat')

    if (extensionError) {
      console.error('❌ Failed to fetch extension data:', extensionError)
    }

    // Get system alerts
    const { data: alertsData, error: alertsError } = await supabase
      .from('autobolt_system_alerts')
      .select('severity, resolved')
      .eq('resolved', false)

    if (alertsError) {
      console.error('❌ Failed to fetch alerts:', alertsError)
    }

    // Calculate metrics
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    // Queue metrics
    const queuePending = queueData?.filter(q => q.status === 'queued').length || 0
    const queueProcessing = queueData?.filter(q => q.status === 'processing').length || 0
    const queueCompletedToday = queueData?.filter(q => 
      q.status === 'completed' && 
      q.completed_at && 
      new Date(q.completed_at) > yesterday
    ).length || 0
    const queueFailedToday = queueData?.filter(q => 
      q.status === 'failed' && 
      q.created_at && 
      new Date(q.created_at) > yesterday
    ).length || 0

    // Extension metrics
    const extensionHealthy = extensionData?.filter(ext => {
      const lastHeartbeat = new Date(ext.last_heartbeat)
      const isActive = (now.getTime() - lastHeartbeat.getTime()) < 5 * 60 * 1000 // Active within 5 minutes
      return isActive && ext.status === 'processing'
    }).length || 0

    const extensionWarning = extensionData?.filter(ext => {
      const lastHeartbeat = new Date(ext.last_heartbeat)
      const isActive = (now.getTime() - lastHeartbeat.getTime()) < 5 * 60 * 1000
      return isActive && ext.status === 'idle'
    }).length || 0

    const extensionErrorCount = extensionData?.filter(ext => {
      const lastHeartbeat = new Date(ext.last_heartbeat)
      const isActive = (now.getTime() - lastHeartbeat.getTime()) < 5 * 60 * 1000
      return isActive && ext.status === 'error'
    }).length || 0

    const extensionOffline = extensionData?.filter(ext => {
      const lastHeartbeat = new Date(ext.last_heartbeat)
      return (now.getTime() - lastHeartbeat.getTime()) >= 5 * 60 * 1000
    }).length || 0

    const totalActiveExtensions = extensionHealthy + extensionWarning + extensionErrorCount

    // Success rate calculation
    const totalProcessedToday = queueCompletedToday + queueFailedToday
    const successRate24h = totalProcessedToday > 0 ? (queueCompletedToday / totalProcessedToday) * 100 : 0

    // Average processing time
    const completedJobs = queueData?.filter(q => 
      q.status === 'completed' && 
      q.started_at && 
      q.completed_at &&
      new Date(q.completed_at) > yesterday
    ) || []

    const averageProcessingTime = completedJobs.length > 0 ? 
      completedJobs.reduce((sum, job) => {
        const start = new Date(job.started_at!).getTime()
        const end = new Date(job.completed_at!).getTime()
        return sum + ((end - start) / (1000 * 60)) // Convert to minutes
      }, 0) / completedJobs.length : 0

    // Critical alerts
    const criticalAlerts = alertsData?.filter(alert => alert.severity === 'critical').length || 0

    // Determine system status
    let systemStatus: 'operational' | 'degraded' | 'outage' = 'operational'
    if (criticalAlerts > 0 || totalActiveExtensions === 0) {
      systemStatus = 'outage'
    } else if (extensionErrorCount > 0 || successRate24h < 80) {
      systemStatus = 'degraded'
    }

    // Calculate additional metrics
    const totalDirectoriesProcessed24h = queueCompletedToday + queueFailedToday
    const averageDirectoriesPerHour = Math.round(totalDirectoriesProcessed24h / 24)
    
    // Find peak processing time (simplified - would need more detailed analytics)
    const peakProcessingTime = completedJobs.length > 0 ? 
      new Date(Math.max(...completedJobs.map(j => new Date(j.completed_at!).getTime()))).toLocaleTimeString() : 
      'N/A'

    // System uptime (simplified calculation)
    const systemUptimePercent = totalActiveExtensions > 0 ? 
      Math.min(100, ((24 - (extensionOffline * 2)) / 24) * 100) : 0

    const overview: MonitoringOverview = {
      system_status: systemStatus,
      active_extensions: totalActiveExtensions,
      total_customers_processing: queueProcessing,
      queue_depth: queuePending,
      success_rate_24h: successRate24h,
      average_processing_time: averageProcessingTime,
      critical_alerts: criticalAlerts,
      last_updated: now.toISOString(),
      detailed_metrics: {
        extensions: {
          healthy: extensionHealthy,
          warning: extensionWarning,
          error: extensionErrorCount,
          offline: extensionOffline
        },
        queue: {
          pending: queuePending,
          processing: queueProcessing,
          completed_today: queueCompletedToday,
          failed_today: queueFailedToday
        },
        performance: {
          total_directories_processed_24h: totalDirectoriesProcessed24h,
          average_directories_per_hour: averageDirectoriesPerHour,
          peak_processing_time: peakProcessingTime,
          system_uptime_percent: Math.round(systemUptimePercent)
        }
      }
    }

    console.log(`✅ Generated monitoring overview: ${overview.system_status} status, ${overview.active_extensions} extensions`)

    return res.status(200).json({
      success: true,
      overview
    })

  } catch (error) {
    console.error('AutoBolt Monitoring Overview API Error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    })
  }
}

export default withRateLimit(handler, rateLimiters.general)