// 🔌 CIRCUIT BREAKER PATTERN
// Automatic failure detection and fallback for external directory submissions

import { logger } from '../utils/logger'

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation - requests allowed
  OPEN = 'OPEN',         // Circuit is open - requests blocked
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number      // Number of failures before opening circuit
  recoveryTimeout: number       // Time to wait before attempting recovery (ms)
  monitoringWindow: number      // Time window for failure counting (ms)
  successThreshold: number      // Successes needed in HALF_OPEN to close circuit
  timeoutMs: number            // Request timeout
  fallbackEnabled: boolean     // Whether to use fallback strategies
}

export interface CircuitBreakerStats {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureTime: number | null
  lastSuccessTime: number | null
  totalRequests: number
  totalFailures: number
  totalSuccesses: number
  windowStart: number
}

export interface SubmissionRequest {
  directoryId: string
  directoryName: string
  customerData: any
  priority: 'high' | 'medium' | 'low'
  retryCount?: number
}

export interface SubmissionResult {
  success: boolean
  directoryId: string
  directoryName: string
  error?: string
  fallbackUsed?: boolean
  responseTime: number
  timestamp: number
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime: number | null = null
  private lastSuccessTime: number | null = null
  private windowStart: number = Date.now()
  private totalRequests: number = 0
  private totalFailures: number = 0
  private totalSuccesses: number = 0
  private recoveryTimer: NodeJS.Timeout | null = null

  constructor(
    private name: string,
    private config: CircuitBreakerConfig,
    private submitFunction: (request: SubmissionRequest) => Promise<SubmissionResult>,
    private fallbackFunction?: (request: SubmissionRequest) => Promise<SubmissionResult>
  ) {
    logger.info(`Circuit breaker initialized: ${name}`, { config })
  }

  async execute(request: SubmissionRequest): Promise<SubmissionResult> {
    this.totalRequests++
    
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      logger.warn(`Circuit breaker OPEN for ${this.name}, using fallback`, {
        directoryId: request.directoryId,
        failureCount: this.failureCount
      })
      
      return this.executeFallback(request)
    }

    // Execute request
    try {
      const startTime = Date.now()
      const result = await this.executeWithTimeout(request)
      const responseTime = Date.now() - startTime

      // Record success
      this.recordSuccess()
      
      return {
        ...result,
        responseTime,
        timestamp: Date.now()
      }

    } catch (error) {
      // Record failure
      this.recordFailure()
      
      logger.error(`Circuit breaker failure for ${this.name}`, {
        directoryId: request.directoryId,
        error: error instanceof Error ? error.message : String(error)
      })

      // Use fallback if available
      if (this.config.fallbackEnabled && this.fallbackFunction) {
        return this.executeFallback(request)
      }

      // Return failure result
      return {
        success: false,
        directoryId: request.directoryId,
        directoryName: request.directoryName,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - Date.now(),
        timestamp: Date.now()
      }
    }
  }

  private async executeWithTimeout(request: SubmissionRequest): Promise<SubmissionResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request timeout after ${this.config.timeoutMs}ms`))
      }, this.config.timeoutMs)

      this.submitFunction(request)
        .then(result => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }

  private async executeFallback(request: SubmissionRequest): Promise<SubmissionResult> {
    if (!this.fallbackFunction) {
      return {
        success: false,
        directoryId: request.directoryId,
        directoryName: request.directoryName,
        error: 'Service unavailable and no fallback configured',
        responseTime: 0,
        timestamp: Date.now()
      }
    }

    try {
      const result = await this.fallbackFunction(request)
      return {
        ...result,
        fallbackUsed: true,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        directoryId: request.directoryId,
        directoryName: request.directoryName,
        error: `Fallback failed: ${error instanceof Error ? error.message : String(error)}`,
        fallbackUsed: true,
        responseTime: 0,
        timestamp: Date.now()
      }
    }
  }

  private recordSuccess(): void {
    this.totalSuccesses++
    this.lastSuccessTime = Date.now()
    
    // Reset window if needed
    this.resetWindowIfNeeded()

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++
      
      // Close circuit if enough successes
      if (this.successCount >= this.config.successThreshold) {
        this.closeCircuit()
      }
    }
  }

  private recordFailure(): void {
    this.totalFailures++
    this.lastFailureTime = Date.now()
    
    // Reset window if needed
    this.resetWindowIfNeeded()
    
    this.failureCount++

    // Open circuit if failure threshold reached
    if (this.failureCount >= this.config.failureThreshold) {
      this.openCircuit()
    }
  }

  private resetWindowIfNeeded(): void {
    const now = Date.now()
    if (now - this.windowStart > this.config.monitoringWindow) {
      this.windowStart = now
      this.failureCount = 0
      this.successCount = 0
    }
  }

  private openCircuit(): void {
    if (this.state === CircuitState.OPEN) return

    this.state = CircuitState.OPEN
    this.scheduleRecoveryAttempt()
    
    logger.warn(`Circuit breaker OPENED for ${this.name}`, {
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold
    })
  }

  private closeCircuit(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer)
      this.recoveryTimer = null
    }
    
    logger.info(`Circuit breaker CLOSED for ${this.name}`)
  }

  private scheduleRecoveryAttempt(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer)
    }

    this.recoveryTimer = setTimeout(() => {
      this.state = CircuitState.HALF_OPEN
      this.successCount = 0
      
      logger.info(`Circuit breaker HALF_OPEN for ${this.name} - testing recovery`)
    }, this.config.recoveryTimeout)
  }

  public getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      windowStart: this.windowStart
    }
  }

  public getHealthScore(): number {
    if (this.totalRequests === 0) return 100
    
    const successRate = (this.totalSuccesses / this.totalRequests) * 100
    const stateMultiplier = this.state === CircuitState.CLOSED ? 1 : 0.5
    
    return Math.round(successRate * stateMultiplier)
  }

  public reset(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = null
    this.lastSuccessTime = null
    this.windowStart = Date.now()
    
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer)
      this.recoveryTimer = null
    }
    
    logger.info(`Circuit breaker RESET for ${this.name}`)
  }

  public forceOpen(): void {
    this.openCircuit()
    logger.warn(`Circuit breaker FORCE OPENED for ${this.name}`)
  }

  public forceClose(): void {
    this.closeCircuit()
    logger.info(`Circuit breaker FORCE CLOSED for ${this.name}`)
  }
}

// Directory-specific circuit breaker manager
export class DirectoryCircuitBreakerManager {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()
  private globalStats = {
    totalDirectories: 0,
    activeDirectories: 0,
    failedDirectories: 0,
    fallbackDirectories: 0
  }

  constructor() {
    // Start periodic health monitoring
    setInterval(() => {
      this.performHealthCheck()
    }, 60000) // Every minute
  }

  public getOrCreateCircuitBreaker(
    directoryId: string,
    directoryName: string,
    submitFunction: (request: SubmissionRequest) => Promise<SubmissionResult>,
    fallbackFunction?: (request: SubmissionRequest) => Promise<SubmissionResult>
  ): CircuitBreaker {
    
    if (!this.circuitBreakers.has(directoryId)) {
      const config: CircuitBreakerConfig = {
        failureThreshold: 5,        // Open after 5 failures
        recoveryTimeout: 60000,     // 1 minute recovery timeout
        monitoringWindow: 300000,   // 5 minute monitoring window
        successThreshold: 3,        // Need 3 successes to close
        timeoutMs: 30000,          // 30 second request timeout
        fallbackEnabled: true
      }

      const circuitBreaker = new CircuitBreaker(
        `${directoryName}-${directoryId}`,
        config,
        submitFunction,
        fallbackFunction
      )

      this.circuitBreakers.set(directoryId, circuitBreaker)
      this.globalStats.totalDirectories++
    }

    return this.circuitBreakers.get(directoryId)!
  }

  public async submitToDirectory(
    directoryId: string,
    request: SubmissionRequest
  ): Promise<SubmissionResult> {
    const circuitBreaker = this.circuitBreakers.get(directoryId)
    
    if (!circuitBreaker) {
      throw new Error(`No circuit breaker found for directory: ${directoryId}`)
    }

    const result = await circuitBreaker.execute(request)
    
    // Update global stats
    if (result.success) {
      this.globalStats.activeDirectories++
    } else {
      this.globalStats.failedDirectories++
    }
    
    if (result.fallbackUsed) {
      this.globalStats.fallbackDirectories++
    }

    return result
  }

  public getDirectoryHealth(directoryId: string): {
    isHealthy: boolean
    healthScore: number
    stats: CircuitBreakerStats
    state: CircuitState
  } {
    const circuitBreaker = this.circuitBreakers.get(directoryId)
    
    if (!circuitBreaker) {
      return {
        isHealthy: false,
        healthScore: 0,
        stats: {} as CircuitBreakerStats,
        state: CircuitState.OPEN
      }
    }

    const stats = circuitBreaker.getStats()
    const healthScore = circuitBreaker.getHealthScore()
    
    return {
      isHealthy: stats.state === CircuitState.CLOSED && healthScore > 70,
      healthScore,
      stats,
      state: stats.state
    }
  }

  public getAllDirectoryHealth(): Array<{
    directoryId: string
    isHealthy: boolean
    healthScore: number
    state: CircuitState
    lastFailure: number | null
  }> {
    const results: Array<any> = []
    
    for (const [directoryId, circuitBreaker] of this.circuitBreakers.entries()) {
      const stats = circuitBreaker.getStats()
      const healthScore = circuitBreaker.getHealthScore()
      
      results.push({
        directoryId,
        isHealthy: stats.state === CircuitState.CLOSED && healthScore > 70,
        healthScore,
        state: stats.state,
        lastFailure: stats.lastFailureTime
      })
    }
    
    return results.sort((a, b) => b.healthScore - a.healthScore)
  }

  public getGlobalStats() {
    const healthyDirectories = Array.from(this.circuitBreakers.values())
      .filter(cb => cb.getStats().state === CircuitState.CLOSED).length

    return {
      ...this.globalStats,
      healthyDirectories,
      unhealthyDirectories: this.globalStats.totalDirectories - healthyDirectories,
      overallHealthScore: this.globalStats.totalDirectories > 0 
        ? Math.round((healthyDirectories / this.globalStats.totalDirectories) * 100)
        : 100
    }
  }

  private performHealthCheck(): void {
    const unhealthyDirectories = Array.from(this.circuitBreakers.entries())
      .filter(([_, cb]) => cb.getStats().state === CircuitState.OPEN)

    if (unhealthyDirectories.length > 0) {
      logger.warn('Circuit breaker health check - unhealthy directories detected', {
        unhealthyCount: unhealthyDirectories.length,
        totalCount: this.circuitBreakers.size,
        unhealthyDirectories: unhealthyDirectories.map(([id, cb]) => ({
          directoryId: id,
          stats: cb.getStats()
        }))
      })
    }
  }

  public resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset()
    }
    
    logger.info('All circuit breakers reset')
  }

  public getMetrics() {
    const allStats = Array.from(this.circuitBreakers.values()).map(cb => cb.getStats())
    
    return {
      totalCircuitBreakers: this.circuitBreakers.size,
      closedCircuits: allStats.filter(s => s.state === CircuitState.CLOSED).length,
      openCircuits: allStats.filter(s => s.state === CircuitState.OPEN).length,
      halfOpenCircuits: allStats.filter(s => s.state === CircuitState.HALF_OPEN).length,
      totalRequests: allStats.reduce((sum, s) => sum + s.totalRequests, 0),
      totalSuccesses: allStats.reduce((sum, s) => sum + s.totalSuccesses, 0),
      totalFailures: allStats.reduce((sum, s) => sum + s.totalFailures, 0),
      averageHealthScore: allStats.length > 0 
        ? Array.from(this.circuitBreakers.values()).reduce((sum, cb) => sum + cb.getHealthScore(), 0) / allStats.length
        : 100
    }
  }
}

// Global instance
export const directoryCircuitBreaker = new DirectoryCircuitBreakerManager()
