// Comprehensive Monitoring and Alerting System
import { dbManager } from '../database/optimized-queries'
import { analytics } from '../analytics/comprehensive-tracking'

interface Alert {
  id: string
  type: 'error' | 'performance' | 'security' | 'business'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  data: Record<string, any>
  timestamp: string
  resolved: boolean
  resolution_time?: string
}

interface MonitoringConfig {
  error_rate_threshold: number
  response_time_threshold: number
  queue_size_threshold: number
  memory_threshold: number
  disk_threshold: number
  failed_payments_threshold: number
  failed_registrations_threshold: number
}

class ComprehensiveMonitoring {
  private static instance: ComprehensiveMonitoring
  private alerts: Map<string, Alert> = new Map()
  private monitoringConfig: MonitoringConfig = {
    error_rate_threshold: 5, // 5%
    response_time_threshold: 2000, // 2 seconds
    queue_size_threshold: 100,
    memory_threshold: 85, // 85%
    disk_threshold: 90, // 90%
    failed_payments_threshold: 3, // 3 failures per hour
    failed_registrations_threshold: 5 // 5 failures per hour
  }

  private constructor() {
    this.startSystemMonitoring()
    this.startBusinessMetricsMonitoring()
    this.startSecurityMonitoring()
  }

  static getInstance(): ComprehensiveMonitoring {
    if (!ComprehensiveMonitoring.instance) {
      ComprehensiveMonitoring.instance = new ComprehensiveMonitoring()
    }
    return ComprehensiveMonitoring.instance
  }

  // System Health Monitoring
  private startSystemMonitoring() {
    setInterval(async () => {
      await this.checkSystemHealth()
    }, 60000) // Every minute
  }

  private async checkSystemHealth() {
    try {
      // Database health check
      const dbHealthy = await dbManager.healthCheck()
      if (!dbHealthy) {
        await this.createAlert({
          type: 'error',
          severity: 'critical',
          title: 'Database Connection Failed',
          message: 'Unable to connect to Supabase database',
          data: { timestamp: new Date().toISOString() }
        })
      }

      // Memory usage check
      const memoryUsage = process.memoryUsage()
      const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      if (memoryPercentage > this.monitoringConfig.memory_threshold) {
        await this.createAlert({
          type: 'performance',
          severity: 'high',
          title: 'High Memory Usage',
          message: `Memory usage at ${memoryPercentage.toFixed(1)}%`,
          data: { 
            memoryUsage: memoryUsage,
            threshold: this.monitoringConfig.memory_threshold
          }
        })
      }

      // API endpoint health checks
      await this.checkAPIEndpoints()

    } catch (error) {
      await this.createAlert({
        type: 'error',
        severity: 'critical',
        title: 'System Monitoring Error',
        message: 'Failed to perform system health check',
        data: { error: (error as Error).message }
      })
    }
  }

  private async checkAPIEndpoints() {
    const endpoints = [
      '/api/customer/register-complete',
      '/api/stripe/create-checkout-session',
      '/api/analyze',
      '/api/queue/status',
      '/api/autobolt/queue'
    ]

    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now()
        // Here you would make actual health check requests
        const responseTime = Date.now() - startTime

        if (responseTime > this.monitoringConfig.response_time_threshold) {
          await this.createAlert({
            type: 'performance',
            severity: 'medium',
            title: 'Slow API Response',
            message: `${endpoint} responded in ${responseTime}ms`,
            data: { 
              endpoint,
              responseTime,
              threshold: this.monitoringConfig.response_time_threshold
            }
          })
        }
      } catch (error) {
        await this.createAlert({
          type: 'error',
          severity: 'high',
          title: 'API Endpoint Down',
          message: `${endpoint} is not responding`,
          data: { 
            endpoint,
            error: (error as Error).message
          }
        })
      }
    }
  }

  // Business Metrics Monitoring
  private startBusinessMetricsMonitoring() {
    setInterval(async () => {
      await this.checkBusinessMetrics()
    }, 300000) // Every 5 minutes
  }

  private async checkBusinessMetrics() {
    try {
      // Check conversion rates
      const conversionRate = await this.getConversionRate()
      if (conversionRate < 1) { // Less than 1% conversion rate
        await this.createAlert({
          type: 'business',
          severity: 'medium',
          title: 'Low Conversion Rate',
          message: `Conversion rate dropped to ${conversionRate.toFixed(2)}%`,
          data: { conversionRate }
        })
      }

      // Check failed payments
      const failedPayments = await this.getRecentFailedPayments()
      if (failedPayments > this.monitoringConfig.failed_payments_threshold) {
        await this.createAlert({
          type: 'business',
          severity: 'high',
          title: 'High Payment Failure Rate',
          message: `${failedPayments} payment failures in the last hour`,
          data: { 
            failedPayments,
            threshold: this.monitoringConfig.failed_payments_threshold
          }
        })
      }

      // Check queue processing
      await this.checkQueueHealth()

    } catch (error) {
      console.error('Business metrics monitoring error:', error)
    }
  }

  private async checkQueueHealth() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    // Check stuck customers
    const { data: stuckCustomers } = await dbManager.getClient()
      .from('queue_history')
      .select('customer_id, status, created_at')
      .eq('status', 'processing')
      .lt('created_at', oneHourAgo)

    if (stuckCustomers && stuckCustomers.length > 0) {
      await this.createAlert({
        type: 'performance',
        severity: 'high',
        title: 'Queue Processing Stuck',
        message: `${stuckCustomers.length} customers stuck in processing`,
        data: { 
          stuckCustomers: stuckCustomers.map(c => c.customer_id),
          count: stuckCustomers.length
        }
      })
    }

    // Check queue backlog
    const client = dbManager.getClient()
    const { count: backlogCount, error: backlogError } = await client
      .from('queue_history')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (backlogError) {
      console.error('Failed to fetch backlog count:', backlogError)
      return
    }

    const backlogSize = backlogCount ?? 0
    if (backlogSize > this.monitoringConfig.queue_size_threshold) {
      await this.createAlert({
        type: 'performance',
        severity: 'medium',
        title: 'Large Queue Backlog',
        message: `${backlogSize} customers waiting in queue`,
        data: {
          backlogSize,
          threshold: this.monitoringConfig.queue_size_threshold
        }
      })
    }
  }

  // Security Monitoring
  private startSecurityMonitoring() {
    setInterval(async () => {
      await this.checkSecurityMetrics()
    }, 300000) // Every 5 minutes
  }

  private async checkSecurityMetrics() {
    try {
      // Check for suspicious activity patterns
      await this.checkRateLimitViolations()
      await this.checkFailedLogins()
      await this.checkUnusualTrafficPatterns()

    } catch (error) {
      console.error('Security monitoring error:', error)
    }
  }

  private async checkRateLimitViolations() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    // This would check your rate limiting logs
    // Implementation depends on your rate limiting system
    const violationCount = 0 // Placeholder
    
    if (violationCount > 10) {
      await this.createAlert({
        type: 'security',
        severity: 'medium',
        title: 'High Rate Limit Violations',
        message: `${violationCount} rate limit violations in the last hour`,
        data: { violationCount }
      })
    }
  }

  private async checkFailedLogins() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const client = dbManager.getClient()
    const { count: failedCountRaw, error: failedCountError } = await client
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_name', 'login_failed')
      .gte('created_at', oneHourAgo)

    if (failedCountError) {
      console.error('Failed to fetch failed login count:', failedCountError)
      return
    }

    const failedCount = failedCountRaw ?? 0
    if (failedCount > 20) {
      await this.createAlert({
        type: 'security',
        severity: 'high',
        title: 'High Failed Login Attempts',
        message: `${failedCount} failed login attempts in the last hour`,
        data: { failedCount }
      })
    }
  }

  private async checkUnusualTrafficPatterns() {
    // Check for unusual spikes in traffic
    const currentHourTraffic = await this.getCurrentHourTraffic()
    const averageTraffic = await this.getAverageHourlyTraffic()
    
    if (currentHourTraffic > averageTraffic * 3) {
      await this.createAlert({
        type: 'security',
        severity: 'medium',
        title: 'Unusual Traffic Spike',
        message: `Traffic is ${Math.round(currentHourTraffic / averageTraffic)}x normal levels`,
        data: { 
          currentTraffic: currentHourTraffic,
          averageTraffic,
          multiplier: currentHourTraffic / averageTraffic
        }
      })
    }
  }

  // Alert Management
  private async createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved'>) {
    const alert: Alert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      resolved: false
    }

    this.alerts.set(alert.id, alert)

    // Store in database for persistence
    await dbManager.getClient()
      .from('system_alerts')
      .insert([{
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        data: alert.data,
        resolved: alert.resolved,
        created_at: alert.timestamp
      }])

    // Send notifications based on severity
    await this.sendAlertNotification(alert)

    console.log(`🚨 Alert created: ${alert.title} (${alert.severity})`)
  }

  private async sendAlertNotification(alert: Alert) {
    // Send notifications based on severity
    switch (alert.severity) {
      case 'critical':
        await this.sendSlackAlert(alert)
        await this.sendEmailAlert(alert)
        await this.sendSMSAlert(alert)
        break
      case 'high':
        await this.sendSlackAlert(alert)
        await this.sendEmailAlert(alert)
        break
      case 'medium':
        await this.sendSlackAlert(alert)
        break
      case 'low':
        // Just log to console
        break
    }
  }

  private async sendSlackAlert(alert: Alert) {
    // Implement Slack webhook integration
    console.log(`📱 Slack alert: ${alert.title}`)
  }

  private async sendEmailAlert(alert: Alert) {
    // Implement email notification
    console.log(`📧 Email alert: ${alert.title}`)
  }

  private async sendSMSAlert(alert: Alert) {
    // Implement SMS notification for critical alerts
    console.log(`📱 SMS alert: ${alert.title}`)
  }

  // Utility methods for metrics calculation
  private async getConversionRate(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const [visitors, conversions] = await Promise.all([
      dbManager.getClient()
        .from('analytics_events')
        .select('session_id')
        .eq('event_name', 'page_viewed')
        .gte('created_at', oneHourAgo),
      dbManager.getClient()
        .from('analytics_events')
        .select('session_id')
        .eq('event_name', 'registration_completed')
        .gte('created_at', oneHourAgo)
    ])

    const uniqueVisitors = new Set(visitors.data?.map(v => v.session_id) || []).size
    const conversionCount = conversions.data?.length || 0

    return uniqueVisitors > 0 ? (conversionCount / uniqueVisitors) * 100 : 0
  }

  private async getRecentFailedPayments(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { count, error } = await dbManager.getClient()
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_name', 'payment_failed')
      .gte('created_at', oneHourAgo)

    if (error) {
      console.error('Failed to fetch failed payments count:', error)
      return 0
    }

    return count ?? 0
  }

  private async getCurrentHourTraffic(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { count, error } = await dbManager.getClient()
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'pageview')
      .gte('created_at', oneHourAgo)

    if (error) {
      console.error('Failed to fetch current hour traffic:', error)
      return 0
    }

    return count ?? 0
  }

  private async getAverageHourlyTraffic(): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { count, error } = await dbManager.getClient()
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'pageview')
      .gte('created_at', oneDayAgo)

    if (error) {
      console.error('Failed to fetch average hourly traffic:', error)
      return 0
    }

    return (count ?? 0) / 24
  }

  // Public methods
  async resolveAlert(alertId: string, resolution: string) {
    const alert = this.alerts.get(alertId)
    if (alert) {
      alert.resolved = true
      alert.resolution_time = new Date().toISOString()
      
      await dbManager.getClient()
        .from('system_alerts')
        .update({
          resolved: true,
          resolution_time: alert.resolution_time,
          resolution: resolution
        })
        .eq('id', alertId)

      console.log(`✅ Alert resolved: ${alert.title}`)
    }
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved)
  }

  getAlertHistory(limit: number = 50): Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  async getSystemHealth() {
    const activeAlerts = this.getActiveAlerts()
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical')
    const highAlerts = activeAlerts.filter(a => a.severity === 'high')
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (criticalAlerts.length > 0) status = 'critical'
    else if (highAlerts.length > 0 || activeAlerts.length > 5) status = 'warning'

    return {
      status,
      active_alerts: activeAlerts.length,
      critical_alerts: criticalAlerts.length,
      high_alerts: highAlerts.length,
      recent_alerts: this.getAlertHistory(10),
      system_metrics: {
        memory_usage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    }
  }

  updateMonitoringConfig(newConfig: Partial<MonitoringConfig>) {
    this.monitoringConfig = { ...this.monitoringConfig, ...newConfig }
    console.log('⚙️ Monitoring configuration updated')
  }
}

export const monitoring = ComprehensiveMonitoring.getInstance()
export default ComprehensiveMonitoring