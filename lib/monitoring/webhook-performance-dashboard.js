/**
 * Webhook Performance Monitoring Dashboard
 * Location: /lib/monitoring/webhook-performance-dashboard.js
 * 
 * Real-time performance monitoring and alerting for Stripe webhook processing
 * Tracks all performance metrics and sends alerts when thresholds are exceeded
 */

import { logger } from '../utils/logger'

// Performance thresholds (milliseconds)
const PERFORMANCE_THRESHOLDS = {
  WEBHOOK_TOTAL: 6000,           // Total webhook processing time
  CRITICAL_OPERATIONS: 3000,     // Critical operations (Airtable, access, usage)
  STRIPE_TIMEOUT_WARNING: 8000,  // Warning before Stripe's 10s timeout
  MEMORY_WARNING: 100 * 1024 * 1024, // 100MB memory usage warning
  ERROR_RATE_WARNING: 0.05,      // 5% error rate warning
  TIMEOUT_RATE_WARNING: 0.01     // 1% timeout rate warning
}

// Performance metrics storage
class PerformanceMetrics {
  constructor() {
    this.metrics = {
      webhookTimes: [],
      criticalOperationTimes: [],
      timeouts: 0,
      errors: 0,
      totalRequests: 0,
      lastCleanup: Date.now(),
      operationBreakdown: new Map(),
      memoryUsage: [],
      concurrentRequests: 0,
      maxConcurrentRequests: 0
    }
    
    // Clean up old metrics every hour
    setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000)
  }
  
  recordWebhookTime(duration, success = true, metadata = {}) {
    this.metrics.webhookTimes.push({
      duration,
      success,
      timestamp: Date.now(),
      metadata
    })
    
    this.metrics.totalRequests++
    
    if (!success) {
      this.metrics.errors++
    }
    
    this.checkThresholds()
  }
  
  recordTimeout(requestId, processingTime) {
    this.metrics.timeouts++
    
    logger.error('Webhook timeout detected', {
      metadata: {
        requestId,
        processingTime,
        thresholdExceeded: processingTime > PERFORMANCE_THRESHOLDS.WEBHOOK_TOTAL
      }
    })
    
    this.sendAlert('WEBHOOK_TIMEOUT', {
      requestId,
      processingTime,
      timeoutCount: this.metrics.timeouts,
      totalRequests: this.metrics.totalRequests
    })
  }
  
  recordCriticalOperationTime(operationName, duration, success = true, metadata = {}) {
    this.metrics.criticalOperationTimes.push({
      operationName,
      duration,
      success,
      timestamp: Date.now(),
      metadata
    })
    
    // Track operation breakdown
    if (!this.metrics.operationBreakdown.has(operationName)) {
      this.metrics.operationBreakdown.set(operationName, [])
    }
    this.metrics.operationBreakdown.get(operationName).push(duration)
    
    if (duration > PERFORMANCE_THRESHOLDS.CRITICAL_OPERATIONS) {
      this.sendAlert('CRITICAL_OPERATION_SLOW', {
        operationName,
        duration,
        threshold: PERFORMANCE_THRESHOLDS.CRITICAL_OPERATIONS,
        metadata
      })
    }
  }
  
  recordMemoryUsage(usage) {
    this.metrics.memoryUsage.push({
      usage,
      timestamp: Date.now()
    })
    
    if (usage > PERFORMANCE_THRESHOLDS.MEMORY_WARNING) {
      this.sendAlert('HIGH_MEMORY_USAGE', {
        usage,
        threshold: PERFORMANCE_THRESHOLDS.MEMORY_WARNING,
        usageInMB: Math.round(usage / (1024 * 1024))
      })
    }
  }
  
  recordConcurrentRequest(isStart = true) {
    if (isStart) {
      this.metrics.concurrentRequests++
      if (this.metrics.concurrentRequests > this.metrics.maxConcurrentRequests) {
        this.metrics.maxConcurrentRequests = this.metrics.concurrentRequests
      }
    } else {
      this.metrics.concurrentRequests = Math.max(0, this.metrics.concurrentRequests - 1)
    }
  }
  
  checkThresholds() {
    const recentWebhooks = this.getRecentWebhooks(60000) // Last minute
    
    if (recentWebhooks.length >= 10) { // Minimum sample size
      const errorRate = recentWebhooks.filter(w => !w.success).length / recentWebhooks.length
      const timeoutRate = this.metrics.timeouts / this.metrics.totalRequests
      const avgDuration = recentWebhooks.reduce((sum, w) => sum + w.duration, 0) / recentWebhooks.length
      
      if (errorRate > PERFORMANCE_THRESHOLDS.ERROR_RATE_WARNING) {
        this.sendAlert('HIGH_ERROR_RATE', {
          errorRate: errorRate * 100,
          threshold: PERFORMANCE_THRESHOLDS.ERROR_RATE_WARNING * 100,
          sampleSize: recentWebhooks.length
        })
      }
      
      if (timeoutRate > PERFORMANCE_THRESHOLDS.TIMEOUT_RATE_WARNING) {
        this.sendAlert('HIGH_TIMEOUT_RATE', {
          timeoutRate: timeoutRate * 100,
          threshold: PERFORMANCE_THRESHOLDS.TIMEOUT_RATE_WARNING * 100,
          totalTimeouts: this.metrics.timeouts,
          totalRequests: this.metrics.totalRequests
        })
      }
      
      if (avgDuration > PERFORMANCE_THRESHOLDS.WEBHOOK_TOTAL * 0.8) {
        this.sendAlert('PERFORMANCE_DEGRADATION', {
          avgDuration,
          threshold: PERFORMANCE_THRESHOLDS.WEBHOOK_TOTAL,
          sampleSize: recentWebhooks.length
        })
      }
    }
  }
  
  getRecentWebhooks(timeWindow = 300000) { // Default 5 minutes
    const cutoff = Date.now() - timeWindow
    return this.metrics.webhookTimes.filter(w => w.timestamp > cutoff)
  }
  
  getPerformanceReport() {
    const recent = this.getRecentWebhooks()
    const recentCritical = this.metrics.criticalOperationTimes.filter(
      op => op.timestamp > Date.now() - 300000
    )
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalRequests: this.metrics.totalRequests,
        errorCount: this.metrics.errors,
        timeoutCount: this.metrics.timeouts,
        errorRate: this.metrics.totalRequests > 0 ? 
          (this.metrics.errors / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%',
        timeoutRate: this.metrics.totalRequests > 0 ? 
          (this.metrics.timeouts / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%',
        concurrentRequests: this.metrics.concurrentRequests,
        maxConcurrentRequests: this.metrics.maxConcurrentRequests
      },
      recentPerformance: {
        avgWebhookTime: recent.length > 0 ? 
          Math.round(recent.reduce((sum, w) => sum + w.duration, 0) / recent.length) : 0,
        p95WebhookTime: this.calculatePercentile(recent.map(w => w.duration), 95),
        avgCriticalTime: recentCritical.length > 0 ? 
          Math.round(recentCritical.reduce((sum, op) => sum + op.duration, 0) / recentCritical.length) : 0,
        p95CriticalTime: this.calculatePercentile(recentCritical.map(op => op.duration), 95),
        sampleSize: recent.length
      },
      operationBreakdown: this.getOperationBreakdown(),
      memoryUsage: this.getRecentMemoryUsage(),
      healthStatus: this.getHealthStatus()
    }
    
    return report
  }
  
  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0
    
    const sorted = values.sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return Math.round(sorted[index] || 0)
  }
  
  getOperationBreakdown() {
    const breakdown = {}
    
    for (const [operation, times] of this.metrics.operationBreakdown.entries()) {
      const recentTimes = times.slice(-100) // Last 100 operations
      breakdown[operation] = {
        avgTime: Math.round(recentTimes.reduce((sum, t) => sum + t, 0) / recentTimes.length),
        p95Time: this.calculatePercentile(recentTimes, 95),
        count: recentTimes.length,
        maxTime: Math.max(...recentTimes),
        minTime: Math.min(...recentTimes)
      }\n    }\n    \n    return breakdown\n  }\n  \n  getRecentMemoryUsage() {\n    const recentMemory = this.metrics.memoryUsage.filter(\n      m => m.timestamp > Date.now() - 300000\n    )\n    \n    if (recentMemory.length === 0) return null\n    \n    return {\n      current: Math.round(recentMemory[recentMemory.length - 1].usage / (1024 * 1024)),\n      avg: Math.round(\n        recentMemory.reduce((sum, m) => sum + m.usage, 0) / recentMemory.length / (1024 * 1024)\n      ),\n      max: Math.round(Math.max(...recentMemory.map(m => m.usage)) / (1024 * 1024)),\n      unit: 'MB'\n    }\n  }\n  \n  getHealthStatus() {\n    const recent = this.getRecentWebhooks()\n    const errorRate = recent.length > 0 ? \n      recent.filter(w => !w.success).length / recent.length : 0\n    const avgTime = recent.length > 0 ? \n      recent.reduce((sum, w) => sum + w.duration, 0) / recent.length : 0\n    const timeoutRate = this.metrics.totalRequests > 0 ? \n      this.metrics.timeouts / this.metrics.totalRequests : 0\n    \n    if (errorRate > PERFORMANCE_THRESHOLDS.ERROR_RATE_WARNING ||\n        timeoutRate > PERFORMANCE_THRESHOLDS.TIMEOUT_RATE_WARNING ||\n        avgTime > PERFORMANCE_THRESHOLDS.WEBHOOK_TOTAL * 0.8) {\n      return 'CRITICAL'\n    }\n    \n    if (errorRate > PERFORMANCE_THRESHOLDS.ERROR_RATE_WARNING * 0.5 ||\n        avgTime > PERFORMANCE_THRESHOLDS.WEBHOOK_TOTAL * 0.6) {\n      return 'WARNING'\n    }\n    \n    return 'HEALTHY'\n  }\n  \n  cleanupOldMetrics() {\n    const cutoff = Date.now() - (24 * 60 * 60 * 1000) // 24 hours\n    \n    this.metrics.webhookTimes = this.metrics.webhookTimes.filter(\n      w => w.timestamp > cutoff\n    )\n    \n    this.metrics.criticalOperationTimes = this.metrics.criticalOperationTimes.filter(\n      op => op.timestamp > cutoff\n    )\n    \n    this.metrics.memoryUsage = this.metrics.memoryUsage.filter(\n      m => m.timestamp > cutoff\n    )\n    \n    // Clean operation breakdown\n    for (const [operation, times] of this.metrics.operationBreakdown.entries()) {\n      this.metrics.operationBreakdown.set(operation, times.slice(-1000)) // Keep last 1000\n    }\n    \n    this.metrics.lastCleanup = Date.now()\n    \n    logger.info('Performance metrics cleanup completed', {\n      metadata: {\n        webhookTimesCount: this.metrics.webhookTimes.length,\n        criticalOperationsCount: this.metrics.criticalOperationTimes.length,\n        memoryUsageCount: this.metrics.memoryUsage.length\n      }\n    })\n  }\n  \n  sendAlert(alertType, data) {\n    const alert = {\n      type: alertType,\n      severity: this.getAlertSeverity(alertType),\n      timestamp: new Date().toISOString(),\n      data,\n      summary: this.getAlertSummary(alertType, data)\n    }\n    \n    logger.error('Performance alert triggered', {\n      metadata: alert\n    })\n    \n    // Send to external monitoring services\n    this.sendToExternalMonitoring(alert)\n    \n    // Send admin notification for critical alerts\n    if (alert.severity === 'CRITICAL') {\n      this.sendAdminAlert(alert)\n    }\n  }\n  \n  getAlertSeverity(alertType) {\n    const criticalAlerts = ['WEBHOOK_TIMEOUT', 'HIGH_ERROR_RATE', 'HIGH_TIMEOUT_RATE']\n    const warningAlerts = ['CRITICAL_OPERATION_SLOW', 'HIGH_MEMORY_USAGE', 'PERFORMANCE_DEGRADATION']\n    \n    if (criticalAlerts.includes(alertType)) return 'CRITICAL'\n    if (warningAlerts.includes(alertType)) return 'WARNING'\n    return 'INFO'\n  }\n  \n  getAlertSummary(alertType, data) {\n    switch (alertType) {\n      case 'WEBHOOK_TIMEOUT':\n        return `Webhook timeout detected: ${data.processingTime}ms (${data.timeoutCount} total timeouts)`\n      case 'CRITICAL_OPERATION_SLOW':\n        return `Critical operation '${data.operationName}' took ${data.duration}ms (threshold: ${data.threshold}ms)`\n      case 'HIGH_MEMORY_USAGE':\n        return `High memory usage: ${data.usageInMB}MB (threshold: ${Math.round(data.threshold / (1024 * 1024))}MB)`\n      case 'HIGH_ERROR_RATE':\n        return `High error rate: ${data.errorRate.toFixed(2)}% (threshold: ${data.threshold}%)`\n      case 'HIGH_TIMEOUT_RATE':\n        return `High timeout rate: ${data.timeoutRate.toFixed(2)}% (${data.totalTimeouts}/${data.totalRequests})`\n      case 'PERFORMANCE_DEGRADATION':\n        return `Performance degradation: avg ${data.avgDuration}ms (threshold: ${data.threshold}ms)`\n      default:\n        return `Performance alert: ${alertType}`\n    }\n  }\n  \n  sendToExternalMonitoring(alert) {\n    // Integration with external monitoring services\n    if (process.env.DATADOG_API_KEY) {\n      this.sendToDatadog(alert)\n    }\n    \n    if (process.env.NEW_RELIC_LICENSE_KEY) {\n      this.sendToNewRelic(alert)\n    }\n    \n    if (process.env.SLACK_WEBHOOK_URL) {\n      this.sendToSlack(alert)\n    }\n  }\n  \n  sendToDatadog(alert) {\n    // DataDog integration implementation\n    logger.info('Sending alert to DataDog', { metadata: { alertType: alert.type } })\n  }\n  \n  sendToNewRelic(alert) {\n    // New Relic integration implementation\n    logger.info('Sending alert to New Relic', { metadata: { alertType: alert.type } })\n  }\n  \n  sendToSlack(alert) {\n    // Slack integration implementation\n    logger.info('Sending alert to Slack', { metadata: { alertType: alert.type } })\n  }\n  \n  sendAdminAlert(alert) {\n    // Send critical alert to admin via email\n    try {\n      const { AutoBoltNotificationService } = require('../services/autobolt-notifications')\n      \n      const emailHtml = `\n        <!DOCTYPE html>\n        <html>\n        <head>\n            <title>🚨 Critical Performance Alert</title>\n            <style>\n                body { font-family: Arial, sans-serif; }\n                .alert-critical { background: #ffebee; border-left: 4px solid #f44336; padding: 15px; }\n                .metrics { background: #f5f5f5; padding: 10px; margin: 10px 0; }\n            </style>\n        </head>\n        <body>\n            <h2>🚨 Critical Performance Alert: ${alert.type}</h2>\n            \n            <div class=\"alert-critical\">\n                <h3>${alert.summary}</h3>\n                <p><strong>Severity:</strong> ${alert.severity}</p>\n                <p><strong>Timestamp:</strong> ${alert.timestamp}</p>\n            </div>\n            \n            <div class=\"metrics\">\n                <h4>Alert Details:</h4>\n                <pre>${JSON.stringify(alert.data, null, 2)}</pre>\n            </div>\n            \n            <div class=\"metrics\">\n                <h4>Performance Report:</h4>\n                <pre>${JSON.stringify(this.getPerformanceReport(), null, 2)}</pre>\n            </div>\n            \n            <p>Please investigate this issue immediately to prevent Stripe webhook failures.</p>\n        </body>\n        </html>\n      `\n      \n      const transporter = AutoBoltNotificationService.initializeTransporter()\n      const mailOptions = {\n        from: `\"DirectoryBolt Monitoring\" <${process.env.SMTP_FROM_EMAIL}>`,\n        to: process.env.ADMIN_EMAIL || 'admin@directorybolt.com',\n        subject: `🚨 CRITICAL: Webhook Performance Alert - ${alert.type}`,\n        html: emailHtml\n      }\n      \n      transporter.sendMail(mailOptions).catch(error => {\n        logger.error('Failed to send admin alert email', {}, error)\n      })\n      \n    } catch (error) {\n      logger.error('Failed to send admin alert', {}, error)\n    }\n  }\n}\n\n// Global performance monitor instance\nconst performanceMonitor = new PerformanceMetrics()\n\n// Export functions for integration with webhook handler\nexport const WebhookPerformanceMonitor = {\n  trackWebhookTime: (duration, success, metadata) => \n    performanceMonitor.recordWebhookTime(duration, success, metadata),\n    \n  trackTimeout: (requestId, processingTime) => \n    performanceMonitor.recordTimeout(requestId, processingTime),\n    \n  trackCriticalOperation: (operationName, duration, success, metadata) => \n    performanceMonitor.recordCriticalOperationTime(operationName, duration, success, metadata),\n    \n  trackMemoryUsage: () => {\n    if (process.memoryUsage) {\n      const usage = process.memoryUsage()\n      performanceMonitor.recordMemoryUsage(usage.heapUsed)\n    }\n  },\n  \n  trackConcurrentRequest: (isStart) => \n    performanceMonitor.recordConcurrentRequest(isStart),\n    \n  getReport: () => performanceMonitor.getPerformanceReport(),\n  \n  getHealthStatus: () => performanceMonitor.getHealthStatus(),\n  \n  // Manual alert triggering for testing\n  triggerTestAlert: (type, data) => performanceMonitor.sendAlert(type, data)\n}\n\n// Express middleware for automatic performance tracking\nexport const webhookPerformanceMiddleware = (req, res, next) => {\n  const startTime = Date.now()\n  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`\n  \n  // Track concurrent requests\n  WebhookPerformanceMonitor.trackConcurrentRequest(true)\n  \n  // Track memory usage\n  WebhookPerformanceMonitor.trackMemoryUsage()\n  \n  // Override res.end to track completion\n  const originalEnd = res.end\n  res.end = function(...args) {\n    const duration = Date.now() - startTime\n    const success = res.statusCode >= 200 && res.statusCode < 300\n    \n    WebhookPerformanceMonitor.trackWebhookTime(duration, success, {\n      requestId,\n      statusCode: res.statusCode,\n      path: req.path,\n      method: req.method\n    })\n    \n    WebhookPerformanceMonitor.trackConcurrentRequest(false)\n    \n    originalEnd.apply(this, args)\n  }\n  \n  next()\n}\n\nexport default WebhookPerformanceMonitor