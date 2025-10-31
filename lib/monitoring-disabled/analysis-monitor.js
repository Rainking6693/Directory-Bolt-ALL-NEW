/**
 * Production Monitoring System for Website Analysis API
 * Tracks performance, errors, and usage metrics
 */

class AnalysisMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      successfulAnalyses: 0,
      rateLimitHits: 0,
      averageResponseTime: 0,
      dailyUsage: new Map()
    }
    
    this.errors = []
    this.maxErrorHistory = 100
    this.resetDailyUsage()
  }

  // Track request metrics
  trackRequest(requestData) {
    this.metrics.requests++
    
    const today = new Date().toISOString().split('T')[0]
    const currentDailyUsage = this.metrics.dailyUsage.get(today) || 0
    this.metrics.dailyUsage.set(today, currentDailyUsage + 1)
    
    if (process.env.NODE_ENV === 'production') {
      console.log(`[MONITOR] Request tracked: ${JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId: requestData.requestId,
        url: requestData.url?.substring(0, 50),
        userAgent: requestData.userAgent?.substring(0, 50),
        ipAddress: requestData.ipAddress
      })}`)
    }
  }

  // Track successful analysis
  trackSuccess(analysisData) {
    this.metrics.successfulAnalyses++
    
    if (analysisData.processingTime) {
      this.updateAverageResponseTime(analysisData.processingTime)
    }
    
    if (process.env.NODE_ENV === 'production') {
      console.log(`[MONITOR] Successful analysis: ${JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId: analysisData.requestId,
        processingTime: analysisData.processingTime,
        seoScore: analysisData.seoScore,
        directoryOpportunities: analysisData.opportunities?.length || 0
      })}`)
    }
  }

  // Track errors
  trackError(errorData) {
    this.metrics.errors++
    
    const errorRecord = {
      timestamp: new Date().toISOString(),
      requestId: errorData.requestId,
      error: errorData.error,
      url: errorData.url?.substring(0, 100),
      userAgent: errorData.userAgent?.substring(0, 100),
      ipAddress: errorData.ipAddress,
      stack: errorData.stack?.substring(0, 500)
    }
    
    this.errors.unshift(errorRecord)
    if (this.errors.length > this.maxErrorHistory) {
      this.errors = this.errors.slice(0, this.maxErrorHistory)
    }
    
    // Log to console in production
    console.error(`[MONITOR] Error tracked: ${JSON.stringify(errorRecord)}`)
    
    // Send critical errors to external monitoring if configured
    if (process.env.SENTRY_DSN && errorData.critical) {
      this.sendToSentry(errorRecord)
    }
  }

  // Track rate limit hits
  trackRateLimit(rateLimitData) {
    this.metrics.rateLimitHits++
    
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[MONITOR] Rate limit hit: ${JSON.stringify({
        timestamp: new Date().toISOString(),
        ipAddress: rateLimitData.ipAddress,
        userAgent: rateLimitData.userAgent?.substring(0, 50),
        retryAfter: rateLimitData.retryAfter
      })}`)
    }
  }

  // Update average response time
  updateAverageResponseTime(newTime) {
    if (this.metrics.successfulAnalyses === 1) {
      this.metrics.averageResponseTime = newTime
    } else {
      // Rolling average
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.successfulAnalyses - 1) + newTime) / 
        this.metrics.successfulAnalyses
    }
  }

  // Get current metrics
  getMetrics() {
    const today = new Date().toISOString().split('T')[0]
    const todayUsage = this.metrics.dailyUsage.get(today) || 0
    
    return {
      ...this.metrics,
      todayUsage,
      errorRate: this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests) * 100 : 0,
      successRate: this.metrics.requests > 0 ? (this.metrics.successfulAnalyses / this.metrics.requests) * 100 : 0,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }
  }

  // Get recent errors
  getRecentErrors(limit = 10) {
    return this.errors.slice(0, limit)
  }

  // Health check
  getHealthStatus() {
    const metrics = this.getMetrics()
    
    return {
      status: this.determineHealthStatus(metrics),
      metrics: {
        requests: metrics.requests,
        errorRate: metrics.errorRate,
        successRate: metrics.successRate,
        averageResponseTime: Math.round(metrics.averageResponseTime),
        rateLimitHits: metrics.rateLimitHits,
        uptime: Math.round(metrics.uptime)
      },
      lastUpdated: metrics.timestamp
    }
  }

  // Determine overall health status
  determineHealthStatus(metrics) {
    if (metrics.errorRate > 10) return 'unhealthy'
    if (metrics.averageResponseTime > 10000) return 'degraded'
    if (metrics.rateLimitHits > metrics.requests * 0.5) return 'degraded'
    return 'healthy'
  }

  // Reset daily usage tracking
  resetDailyUsage() {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    
    // Clean up old daily usage data
    for (const [date] of this.metrics.dailyUsage) {
      if (new Date(date) < threeDaysAgo) {
        this.metrics.dailyUsage.delete(date)
      }
    }
  }

  // Send error to Sentry if configured
  sendToSentry(errorRecord) {
    try {
      if (typeof window === 'undefined' && process.env.SENTRY_DSN) {
        // Server-side Sentry integration would go here
        console.log(`[MONITOR] Would send to Sentry: ${errorRecord.error}`)
      }
    } catch (error) {
      console.error('[MONITOR] Failed to send to Sentry:', error)
    }
  }

  // Generate performance report
  generateReport() {
    const metrics = this.getMetrics()
    const recentErrors = this.getRecentErrors(5)
    
    return {
      summary: {
        totalRequests: metrics.requests,
        successfulAnalyses: metrics.successfulAnalyses,
        errorCount: metrics.errors,
        errorRate: `${metrics.errorRate.toFixed(2)}%`,
        successRate: `${metrics.successRate.toFixed(2)}%`,
        averageResponseTime: `${Math.round(metrics.averageResponseTime)}ms`,
        rateLimitHits: metrics.rateLimitHits,
        todayUsage: metrics.todayUsage
      },
      health: this.getHealthStatus(),
      recentErrors: recentErrors.map(error => ({
        timestamp: error.timestamp,
        error: error.error,
        url: error.url
      })),
      systemInfo: {
        uptime: `${Math.round(metrics.uptime / 3600)}h ${Math.round((metrics.uptime % 3600) / 60)}m`,
        memoryUsage: `${Math.round(metrics.memoryUsage.used / 1024 / 1024)}MB`,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV
      }
    }
  }
}

// Singleton instance
const monitor = new AnalysisMonitor()

// Export the monitor instance
module.exports = monitor