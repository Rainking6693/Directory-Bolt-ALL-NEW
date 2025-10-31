// @ts-nocheck
// Infrastructure Scaling Strategy for DirectoryBolt
import { dbManager } from '../database/optimized-queries'
import { queueManager } from '../queue/advanced-queue-manager'

interface ScalingMetrics {
  concurrent_users: number
  queue_size: number
  processing_rate: number
  error_rate: number
  response_time: number
  memory_usage: number
  cpu_usage: number
}

interface ScalingThresholds {
  queue_size_warning: number
  queue_size_critical: number
  error_rate_threshold: number
  response_time_threshold: number
  memory_threshold: number
  cpu_threshold: number
}

class InfrastructureScalingManager {
  private static instance: InfrastructureScalingManager
  private scalingThresholds: ScalingThresholds = {
    queue_size_warning: 100,
    queue_size_critical: 500,
    error_rate_threshold: 5, // 5%
    response_time_threshold: 2000, // 2 seconds
    memory_threshold: 85, // 85%
    cpu_threshold: 80 // 80%
  }

  private currentMetrics: ScalingMetrics = {
    concurrent_users: 0,
    queue_size: 0,
    processing_rate: 0,
    error_rate: 0,
    response_time: 0,
    memory_usage: 0,
    cpu_usage: 0
  }

  private constructor() {
    this.startMetricsCollection()
    this.startAutoScaling()
  }

  static getInstance(): InfrastructureScalingManager {
    if (!InfrastructureScalingManager.instance) {
      InfrastructureScalingManager.instance = new InfrastructureScalingManager()
    }
    return InfrastructureScalingManager.instance
  }

  // Database Connection Scaling
  async optimizeDatabaseConnections() {
    const currentConnections = await this.getCurrentDBConnections()
    const recommendedConnections = this.calculateOptimalConnections()

    if (currentConnections < recommendedConnections) {
      console.log(`📈 Scaling up database connections: ${currentConnections} → ${recommendedConnections}`)
      await this.scaleUpDBConnections(recommendedConnections)
    } else if (currentConnections > recommendedConnections * 1.5) {
      console.log(`📉 Scaling down database connections: ${currentConnections} → ${recommendedConnections}`)
      await this.scaleDownDBConnections(recommendedConnections)
    }
  }

  // Queue Processing Scaling
  async optimizeQueueProcessing() {
    const queueSize = queueManager.getQueueSize()
    const activeWorkers = queueManager.getActiveWorkers()
    
    if (queueSize > this.scalingThresholds.queue_size_warning) {
      const newWorkerCount = this.calculateOptimalWorkers(queueSize)
      queueManager.adjustCapacity(newWorkerCount)
      
      console.log(`🔄 Queue scaling: ${activeWorkers} → ${newWorkerCount} workers (Queue size: ${queueSize})`)
      
      // Alert if queue size is critical
      if (queueSize > this.scalingThresholds.queue_size_critical) {
        await this.sendCriticalAlert('Queue size critical', {
          queue_size: queueSize,
          active_workers: activeWorkers,
          recommended_workers: newWorkerCount
        })
      }
    }
  }

  // Auto-scaling based on metrics
  private startAutoScaling() {
    setInterval(async () => {
      await this.collectCurrentMetrics()
      await this.evaluateScalingNeed()
    }, 60000) // Every minute
  }

  // Metrics collection
  private startMetricsCollection() {
    setInterval(async () => {
      this.currentMetrics = await this.collectSystemMetrics()
    }, 30000) // Every 30 seconds
  }

  private async collectSystemMetrics(): Promise<ScalingMetrics> {
    const memoryUsage = process.memoryUsage()
    const queueSize = queueManager.getQueueSize()
    
    // Get error rate from analytics
    const errorRate = await this.calculateErrorRate()
    
    return {
      concurrent_users: await this.getConcurrentUsers(),
      queue_size: queueSize,
      processing_rate: await this.getProcessingRate(),
      error_rate: errorRate,
      response_time: await this.getAverageResponseTime(),
      memory_usage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      cpu_usage: await this.getCPUUsage()
    }
  }

  private async evaluateScalingNeed() {
    const metrics = this.currentMetrics
    let scalingActions = []

    // Memory scaling
    if (metrics.memory_usage > this.scalingThresholds.memory_threshold) {
      scalingActions.push('scale_memory')
    }

    // CPU scaling
    if (metrics.cpu_usage > this.scalingThresholds.cpu_threshold) {
      scalingActions.push('scale_cpu')
    }

    // Response time scaling
    if (metrics.response_time > this.scalingThresholds.response_time_threshold) {
      scalingActions.push('scale_response_time')
    }

    // Queue scaling
    if (metrics.queue_size > this.scalingThresholds.queue_size_warning) {
      scalingActions.push('scale_queue')
    }

    // Execute scaling actions
    for (const action of scalingActions) {
      await this.executeScalingAction(action, metrics)
    }
  }

  private async executeScalingAction(action: string, metrics: ScalingMetrics) {
    switch (action) {
      case 'scale_memory':
        await this.optimizeMemoryUsage()
        break
      case 'scale_cpu':
        await this.optimizeCPUUsage()
        break
      case 'scale_response_time':
        await this.optimizeResponseTime()
        break
      case 'scale_queue':
        await this.optimizeQueueProcessing()
        break
    }
  }

  // Optimization methods
  private async optimizeMemoryUsage() {
    // Clear caches
    dbManager.clearCache()
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
    
    console.log('🧹 Memory optimization completed')
  }

  private async optimizeCPUUsage() {
    // Reduce concurrent operations
    const currentWorkers = queueManager.getActiveWorkers()
    const reducedWorkers = Math.max(1, Math.floor(currentWorkers * 0.8))
    queueManager.adjustCapacity(reducedWorkers)
    
    console.log(`⚡ CPU optimization: Reduced workers to ${reducedWorkers}`)
  }

  private async optimizeResponseTime() {
    // Implement response time optimizations
    console.log('🚀 Response time optimization triggered')
  }

  // Utility methods
  private calculateOptimalConnections(): number {
    const baseConnections = 10
    const userMultiplier = Math.ceil(this.currentMetrics.concurrent_users / 100)
    return Math.min(50, baseConnections + userMultiplier)
  }

  private calculateOptimalWorkers(queueSize: number): number {
    const baseWorkers = 5
    const queueMultiplier = Math.ceil(queueSize / 50)
    return Math.min(20, baseWorkers + queueMultiplier)
  }

  private async getCurrentDBConnections(): Promise<number> {
    // Implementation would depend on your database monitoring
    return 10 // Placeholder
  }

  private async scaleUpDBConnections(target: number) {
    // Implementation for scaling up database connections
    console.log(`📈 Scaling up to ${target} DB connections`)
  }

  private async scaleDownDBConnections(target: number) {
    // Implementation for scaling down database connections
    console.log(`📉 Scaling down to ${target} DB connections`)
  }

  private async getConcurrentUsers(): Promise<number> {
    // Get active sessions from analytics
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const { data } = await dbManager.getClient()
      .from('analytics_events')
      .select('session_id')
      .gte('created_at', oneHourAgo)
      .not('session_id', 'is', null)

    return new Set(data?.map(d => d.session_id) || []).size
  }

  private async getProcessingRate(): Promise<number> {
    // Calculate processing rate (customers per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const { data } = await dbManager.getClient()
      .from('customers')
      .select('id')
      .gte('created_at', oneHourAgo)

    return data?.length || 0
  }

  private async calculateErrorRate(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const [totalEvents, errorEvents] = await Promise.all([
      dbManager.getClient()
        .from('analytics_events')
        .select('id', { count: 'exact' })
        .gte('created_at', oneHourAgo),
      dbManager.getClient()
        .from('analytics_events')
        .select('id', { count: 'exact' })
        .eq('event_type', 'error')
        .gte('created_at', oneHourAgo)
    ])

    const total = totalEvents.count || 0
    const errors = errorEvents.count || 0
    
    return total > 0 ? (errors / total) * 100 : 0
  }

  private async getAverageResponseTime(): Promise<number> {
    // Implementation would depend on your response time tracking
    return 500 // Placeholder
  }

  private async getCPUUsage(): Promise<number> {
    // Implementation would depend on your system monitoring
    return 30 // Placeholder
  }

  private async sendCriticalAlert(message: string, data: any) {
    console.error(`🚨 CRITICAL ALERT: ${message}`, data)
    
    // Implementation for sending alerts (email, Slack, etc.)
    // This could integrate with services like PagerDuty, Slack webhooks, etc.
  }

  // Public methods for monitoring
  getCurrentMetrics(): ScalingMetrics {
    return { ...this.currentMetrics }
  }

  getScalingThresholds(): ScalingThresholds {
    return { ...this.scalingThresholds }
  }

  updateScalingThresholds(newThresholds: Partial<ScalingThresholds>) {
    this.scalingThresholds = { ...this.scalingThresholds, ...newThresholds }
    console.log('⚙️ Scaling thresholds updated:', this.scalingThresholds)
  }

  // Health check endpoint data
  async getHealthStatus() {
    const metrics = this.currentMetrics
    const thresholds = this.scalingThresholds
    
    return {
      status: this.determineOverallHealth(metrics, thresholds),
      metrics,
      thresholds,
      recommendations: this.generateRecommendations(metrics, thresholds)
    }
  }

  private determineOverallHealth(metrics: ScalingMetrics, thresholds: ScalingThresholds): 'healthy' | 'warning' | 'critical' {
    if (
      metrics.queue_size > thresholds.queue_size_critical ||
      metrics.error_rate > thresholds.error_rate_threshold * 2 ||
      metrics.memory_usage > 95 ||
      metrics.cpu_usage > 90
    ) {
      return 'critical'
    }
    
    if (
      metrics.queue_size > thresholds.queue_size_warning ||
      metrics.error_rate > thresholds.error_rate_threshold ||
      metrics.memory_usage > thresholds.memory_threshold ||
      metrics.cpu_usage > thresholds.cpu_threshold ||
      metrics.response_time > thresholds.response_time_threshold
    ) {
      return 'warning'
    }
    
    return 'healthy'
  }

  private generateRecommendations(metrics: ScalingMetrics, thresholds: ScalingThresholds): string[] {
    const recommendations = []
    
    if (metrics.queue_size > thresholds.queue_size_warning) {
      recommendations.push(`Consider increasing worker capacity (current queue: ${metrics.queue_size})`)
    }
    
    if (metrics.error_rate > thresholds.error_rate_threshold) {
      recommendations.push(`Investigate error rate spike (current: ${metrics.error_rate.toFixed(2)}%)`)
    }
    
    if (metrics.memory_usage > thresholds.memory_threshold) {
      recommendations.push(`Optimize memory usage (current: ${metrics.memory_usage.toFixed(1)}%)`)
    }
    
    if (metrics.response_time > thresholds.response_time_threshold) {
      recommendations.push(`Optimize response times (current: ${metrics.response_time}ms)`)
    }
    
    return recommendations
  }
}

// Caching Strategy for improved performance
export class CacheManager {
  private static cache = new Map()
  private static cacheTTL = new Map()
  
  static set(key: string, value: any, ttlSeconds: number = 300) {
    this.cache.set(key, value)
    this.cacheTTL.set(key, Date.now() + (ttlSeconds * 1000))
  }
  
  static get(key: string): any | null {
    const ttl = this.cacheTTL.get(key)
    if (!ttl || Date.now() > ttl) {
      this.cache.delete(key)
      this.cacheTTL.delete(key)
      return null
    }
    return this.cache.get(key)
  }
  
  static clear(pattern?: string) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key)
          this.cacheTTL.delete(key)
        }
      }
    } else {
      this.cache.clear()
      this.cacheTTL.clear()
    }
  }
  
  static getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

export const scalingManager = InfrastructureScalingManager.getInstance()
export default InfrastructureScalingManager