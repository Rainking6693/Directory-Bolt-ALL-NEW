/**
 * Production-Ready Error Handling and Retry Mechanisms - 2025 Best Practices
 * Features: Circuit breaker, exponential backoff, dead letter queues, comprehensive logging
 */

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: string[];
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow: number;
}

interface ErrorContext {
  operation: string;
  customerId?: string;
  endpoint?: string;
  timestamp: number;
  attemptNumber?: number;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error('Circuit breaker is OPEN - operation not allowed');
      }
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.resetTimeout;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }
}

class ErrorHandler {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private errorLog: ErrorContext[] = [];
  private deadLetterQueue: Array<{ operation: string; data: any; error: Error }> = [];
  private retryQueues = new Map<string, Array<() => Promise<any>>>();

  constructor(
    private defaultRetryConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'PGRST301', 'PGRST116']
    },
    private defaultCircuitConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringWindow: 300000
    }
  ) {
    // Clean up old errors every hour
    setInterval(() => this.cleanupErrorLog(), 3600000);
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...retryConfig };
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await this.executeWithCircuitBreaker(operation, context.operation);
        
        if (attempt > 1) {
          console.log(`✅ Operation succeeded on attempt ${attempt}: ${context.operation}`);
        }
        
        return result;
      // TODO: Review resilience logging and unify error handling strategy in Stage 7.x cleanup
      } catch (error: unknown) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        lastError = normalizedError;
        
        const errorContext: ErrorContext = {
          ...context,
          attemptNumber: attempt,
          timestamp: Date.now(),
          stackTrace: normalizedError.stack
        };

        this.logError(errorContext, normalizedError);

        if (!(normalizedError instanceof Error)) {
          console.error('Unknown error thrown during executeWithRetry:', error);
        }

        // Check if error is retryable
        if (!this.isRetryableError(normalizedError, config.retryableErrors) || attempt === config.maxAttempts) {
          if (attempt === config.maxAttempts) {
            this.addToDeadLetterQueue(context.operation, context, normalizedError);
          }
          throw normalizedError;
        }

        const delay = this.calculateDelay(attempt, config);
        console.warn(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms: ${normalizedError.message}`);
        
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const circuitBreaker = this.getOrCreateCircuitBreaker(operationName);
    return circuitBreaker.execute(operation);
  }

  private getOrCreateCircuitBreaker(operationName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operationName)) {
      this.circuitBreakers.set(operationName, new CircuitBreaker(this.defaultCircuitConfig));
    }
    return this.circuitBreakers.get(operationName)!;
  }

  private isRetryableError(error: Error, retryableErrors: string[]): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code;

    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase()) ||
      errorCode === retryableError
    );
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private logError(context: ErrorContext, error: Error): void {
    const errorEntry: ErrorContext = {
      ...context,
      timestamp: Date.now()
    };

    this.errorLog.push(errorEntry);

    // Enhanced logging for production
    const logLevel = context.attemptNumber === 1 ? 'warn' : 'error';
    console[logLevel](`🚨 [${context.operation}] Error on attempt ${context.attemptNumber}:`, {
      message: error.message,
      customerId: context.customerId,
      endpoint: context.endpoint,
      timestamp: new Date(context.timestamp).toISOString(),
      metadata: context.metadata
    });

    // Send to external monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoringService(errorEntry, error);
    }
  }

  private addToDeadLetterQueue(operation: string, data: any, error: Error): void {
    this.deadLetterQueue.push({ operation, data, error });
    
    console.error(`💀 Added to dead letter queue: ${operation}`, {
      error: error.message,
      data,
      queueSize: this.deadLetterQueue.length
    });

    // Process dead letter queue if it gets too large
    if (this.deadLetterQueue.length > 100) {
      this.processDeadLetterQueue();
    }
  }

  private processDeadLetterQueue(): void {
    // In production, this would send to external dead letter processing service
    console.warn(`🔄 Processing ${this.deadLetterQueue.length} items from dead letter queue`);
    
    // For now, just log and clear old items
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    const initialSize = this.deadLetterQueue.length;
    
    this.deadLetterQueue = this.deadLetterQueue.filter(item => {
      // Keep recent items for potential reprocessing
      return Date.now() - cutoff < 24 * 60 * 60 * 1000;
    });

    console.log(`🧹 Dead letter queue cleanup: ${initialSize} -> ${this.deadLetterQueue.length} items`);
  }

  private cleanupErrorLog(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // Keep last 24 hours
    const initialSize = this.errorLog.length;
    
    this.errorLog = this.errorLog.filter(entry => entry.timestamp > cutoff);
    
    console.log(`🧹 Error log cleanup: ${initialSize} -> ${this.errorLog.length} entries`);
  }

  private sendToMonitoringService(context: ErrorContext, error: Error): void {
    // In production, integrate with services like DataDog, New Relic, or Sentry
    // For now, just enhanced console logging
    console.error('[MONITORING]', {
      service: 'DirectoryBolt-Backend',
      operation: context.operation,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
  }

  // Database-specific error handling
  async executeSupabaseOperation<T>(
    operation: () => Promise<T>,
    context: Omit<ErrorContext, 'timestamp'>
  ): Promise<T> {
    return this.executeWithRetry(
      operation,
      { ...context, timestamp: Date.now() },
      {
        maxAttempts: 3,
        baseDelay: 1000,
        retryableErrors: ['PGRST301', 'PGRST116', 'ECONNRESET', 'ETIMEDOUT']
      }
    );
  }

  // API-specific error handling
  async executeAPIOperation<T>(
    operation: () => Promise<T>,
    context: Omit<ErrorContext, 'timestamp'>
  ): Promise<T> {
    return this.executeWithRetry(
      operation,
      { ...context, timestamp: Date.now() },
      {
        maxAttempts: 2,
        baseDelay: 500,
        retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
      }
    );
  }

  // Get system health metrics
  getSystemHealth() {
    const now = Date.now();
    const last5Minutes = now - 5 * 60 * 1000;
    const recentErrors = this.errorLog.filter(entry => entry.timestamp > last5Minutes);
    
    const circuitBreakerStatus = Array.from(this.circuitBreakers.entries()).map(([name, cb]) => ({
      name,
      ...cb.getMetrics()
    }));

    return {
      timestamp: new Date().toISOString(),
      errorCounts: {
        last5Minutes: recentErrors.length,
        total: this.errorLog.length,
        deadLetterQueue: this.deadLetterQueue.length
      },
      circuitBreakers: circuitBreakerStatus,
      healthScore: this.calculateHealthScore(recentErrors.length, circuitBreakerStatus)
    };
  }

  private calculateHealthScore(recentErrors: number, circuitBreakers: any[]): number {
    let score = 100;
    
    // Deduct points for recent errors
    score -= Math.min(recentErrors * 5, 50);
    
    // Deduct points for open circuit breakers
    const openCircuits = circuitBreakers.filter(cb => cb.state === CircuitState.OPEN).length;
    score -= openCircuits * 20;
    
    return Math.max(score, 0);
  }

  // Manual recovery operations
  resetCircuitBreaker(operationName: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(operationName);
    if (circuitBreaker) {
      // Force reset to closed state
      (circuitBreaker as any).state = CircuitState.CLOSED;
      (circuitBreaker as any).failureCount = 0;
      console.log(`🔄 Circuit breaker reset for operation: ${operationName}`);
      return true;
    }
    return false;
  }

  clearDeadLetterQueue(): number {
    const cleared = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    console.log(`🗑️ Cleared ${cleared} items from dead letter queue`);
    return cleared;
  }
}

// Export singleton instance for DirectoryBolt
const errorHandler = new ErrorHandler();

export default errorHandler;
export { ErrorHandler, CircuitBreaker, CircuitState, type ErrorContext, type RetryConfig, type CircuitBreakerConfig };