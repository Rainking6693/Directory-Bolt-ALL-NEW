// 🔒 SECURITY MONITORING SYSTEM
// Real-time security event monitoring and alerting

import { NextApiRequest } from 'next'

export interface SecurityEvent {
  type: SecurityEventType
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: string
  ip: string
  userAgent: string
  details: Record<string, any>
  endpoint?: string
  userId?: string
}

export type SecurityEventType = 
  | 'csrf_violation'
  | 'rate_limit_exceeded'
  | 'invalid_webhook'
  | 'suspicious_request'
  | 'authentication_failure'
  | 'api_key_usage'
  | 'payment_anomaly'
  | 'xss_attempt'
  | 'sql_injection_attempt'
  | 'file_upload_violation'

/**
 * Security Event Logger
 */
export class SecurityMonitor {
  private events: SecurityEvent[] = []
  private readonly maxEvents: number
  private readonly alertThresholds: Record<SecurityEventType, number>

  constructor(maxEvents = 1000) {
    this.maxEvents = maxEvents
    this.alertThresholds = {
      csrf_violation: 5,
      rate_limit_exceeded: 10,
      invalid_webhook: 3,
      suspicious_request: 5,
      authentication_failure: 5,
      api_key_usage: 100,
      payment_anomaly: 1,
      xss_attempt: 1,
      sql_injection_attempt: 1,
      file_upload_violation: 3
    }
  }

  /**
   * Log a security event
   */
  logEvent(
    type: SecurityEventType,
    severity: SecurityEvent['severity'],
    req: NextApiRequest,
    details: Record<string, any> = {}
  ): void {
    const event: SecurityEvent = {
      type,
      severity,
      timestamp: new Date().toISOString(),
      ip: this.getClientIP(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      endpoint: req.url || 'unknown',
      details
    }

    // Add to local storage
    this.events.push(event)
    
    // Maintain max events limit
    if (this.events.length > this.maxEvents) {
      this.events.shift()
    }

    // Log to console
    this.logToConsole(event)

    // Send to external monitoring if configured
    this.sendToExternalMonitoring(event)

    // Check for alert conditions
    this.checkAlertThresholds(type)
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: NextApiRequest): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection?.remoteAddress ||
      'unknown'
    )
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(event: SecurityEvent): void {
    const emoji = this.getSeverityEmoji(event.severity)
    const message = `${emoji} Security Event: ${event.type}`
    
    const logData = {
      ...event,
      details: JSON.stringify(event.details)
    }

    switch (event.severity) {
      case 'critical':
        console.error(message, logData)
        break
      case 'high':
        console.warn(message, logData)
        break
      case 'medium':
        console.warn(message, logData)
        break
      case 'low':
        console.info(message, logData)
        break
    }
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity: SecurityEvent['severity']): string {
    switch (severity) {
      case 'critical': return '🚨'
      case 'high': return '⚠️'
      case 'medium': return '⚡'
      case 'low': return 'ℹ️'
      default: return '📊'
    }
  }

  /**
   * Send to external monitoring service
   */
  private async sendToExternalMonitoring(event: SecurityEvent): Promise<void> {
    if (!process.env.SECURITY_WEBHOOK_URL) {
      return
    }

    try {
      await fetch(process.env.SECURITY_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DirectoryBolt-Security-Monitor/1.0'
        },
        body: JSON.stringify({
          service: 'DirectoryBolt',
          environment: process.env.NODE_ENV,
          event
        })
      })
    } catch (error) {
      console.error('Failed to send security event to external monitoring:', error)
    }
  }

  /**
   * Check if alert thresholds are exceeded
   */
  private checkAlertThresholds(type: SecurityEventType): void {
    const threshold = this.alertThresholds[type]
    const recentEvents = this.getRecentEvents(type, 300000) // 5 minutes

    if (recentEvents.length >= threshold) {
      this.triggerAlert(type, recentEvents.length, threshold)
    }
  }

  /**
   * Get recent events of a specific type
   */
  private getRecentEvents(type: SecurityEventType, timeWindowMs: number): SecurityEvent[] {
    const cutoff = Date.now() - timeWindowMs
    return this.events.filter(event => 
      event.type === type && 
      new Date(event.timestamp).getTime() > cutoff
    )
  }

  /**
   * Trigger security alert
   */
  private triggerAlert(type: SecurityEventType, count: number, threshold: number): void {
    const alertEvent: SecurityEvent = {
      type: 'suspicious_request',
      severity: 'critical',
      timestamp: new Date().toISOString(),
      ip: 'system',
      userAgent: 'security-monitor',
      details: {
        alertType: 'threshold_exceeded',
        eventType: type,
        count,
        threshold,
        timeWindow: '5 minutes'
      }
    }

    this.logToConsole(alertEvent)
    this.sendToExternalMonitoring(alertEvent)

    // In production, could also send email/SMS alerts
    if (process.env.NODE_ENV === 'production') {
      console.error(`🚨 SECURITY ALERT: ${type} threshold exceeded (${count}/${threshold})`)
    }
  }

  /**
   * Get security dashboard data
   */
  getDashboardData(timeWindowMs = 3600000): {
    totalEvents: number
    eventsByType: Record<SecurityEventType, number>
    eventsBySeverity: Record<string, number>
    recentEvents: SecurityEvent[]
    topIPs: Array<{ ip: string; count: number }>
  } {
    const cutoff = Date.now() - timeWindowMs
    const recentEvents = this.events.filter(event => 
      new Date(event.timestamp).getTime() > cutoff
    )

    const eventsByType = {} as Record<SecurityEventType, number>
    const eventsBySeverity = { low: 0, medium: 0, high: 0, critical: 0 }
    const ipCounts = new Map<string, number>()

    recentEvents.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1
      eventsBySeverity[event.severity]++
      ipCounts.set(event.ip, (ipCounts.get(event.ip) || 0) + 1)
    })

    const topIPs = Array.from(ipCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalEvents: recentEvents.length,
      eventsByType,
      eventsBySeverity,
      recentEvents: recentEvents.slice(-50), // Last 50 events
      topIPs
    }
  }
}

// Global security monitor instance
export const securityMonitor = new SecurityMonitor()

/**
 * Security middleware for API routes
 */
export function withSecurityMonitoring(
  handler: (req: NextApiRequest, res: any) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: any) => {
    const startTime = Date.now()

    try {
      // Monitor suspicious patterns
      monitorSuspiciousPatterns(req)

      // Call original handler
      await handler(req, res)

      // Log successful request if it took too long
      const duration = Date.now() - startTime
      if (duration > 10000) { // 10 seconds
        securityMonitor.logEvent(
          'suspicious_request',
          'medium',
          req,
          { reason: 'slow_response', duration }
        )
      }

    } catch (error) {
      // Log error
      securityMonitor.logEvent(
        'suspicious_request',
        'high',
        req,
        { 
          reason: 'handler_error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      )
      throw error
    }
  }
}

/**
 * Monitor for suspicious request patterns
 */
function monitorSuspiciousPatterns(req: NextApiRequest): void {
  const url = req.url || ''
  const userAgent = req.headers['user-agent'] || ''
  const body = req.body

  // Check for XSS attempts
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /eval\(/i
  ]

  const checkXSS = (value: string) => {
    return xssPatterns.some(pattern => pattern.test(value))
  }

  // Check URL for XSS
  if (checkXSS(url)) {
    securityMonitor.logEvent(
      'xss_attempt',
      'high',
      req,
      { location: 'url', pattern: url }
    )
  }

  // Check body for XSS
  if (body && typeof body === 'object') {
    const bodyString = JSON.stringify(body)
    if (checkXSS(bodyString)) {
      securityMonitor.logEvent(
        'xss_attempt',
        'high',
        req,
        { location: 'body', pattern: bodyString.substring(0, 200) }
      )
    }
  }

  // Check for SQL injection attempts
  const sqlPatterns = [
    /union\s+select/i,
    /drop\s+table/i,
    /insert\s+into/i,
    /delete\s+from/i,
    /update\s+set/i,
    /'\s*or\s*'1'\s*=\s*'1/i
  ]

  const checkSQL = (value: string) => {
    return sqlPatterns.some(pattern => pattern.test(value))
  }

  if (checkSQL(url) || (body && checkSQL(JSON.stringify(body)))) {
    securityMonitor.logEvent(
      'sql_injection_attempt',
      'critical',
      req,
      { pattern: url }
    )
  }

  // Check for suspicious user agents
  const suspiciousUAPatterns = [
    /bot/i,
    /crawler/i,
    /scanner/i,
    /hack/i,
    /exploit/i
  ]

  if (suspiciousUAPatterns.some(pattern => pattern.test(userAgent))) {
    securityMonitor.logEvent(
      'suspicious_request',
      'low',
      req,
      { reason: 'suspicious_user_agent', userAgent }
    )
  }
}

/**
 * API key usage monitoring
 */
export function monitorAPIKeyUsage(
  keyType: 'stripe' | 'openai' | 'anthropic',
  operation: string,
  cost?: number
): void {
  // This would typically be called from API integrations
  console.log(`🔑 API Key Usage: ${keyType} - ${operation}`, { cost })

  // In production, send to monitoring service
  if (process.env.SECURITY_WEBHOOK_URL) {
    fetch(process.env.SECURITY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'api_key_usage',
        keyType,
        operation,
        cost,
        timestamp: new Date().toISOString()
      })
    }).catch(console.error)
  }
}

/**
 * Payment anomaly detection
 */
export function monitorPaymentAnomaly(
  type: 'unusual_amount' | 'rapid_attempts' | 'failed_payment',
  details: Record<string, any>
): void {
  securityMonitor.logEvent(
    'payment_anomaly',
    'high',
    { headers: {}, url: '/payment' } as NextApiRequest,
    { anomalyType: type, ...details }
  )
}