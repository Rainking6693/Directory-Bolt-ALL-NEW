// PRODUCTION LOGGING SYSTEM
// Structured logging with different levels and transport options

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: any
  context?: {
    userId?: string
    sessionId?: string
    requestId?: string
    component?: string
    action?: string
    url?: string
    userAgent?: string
  }
  error?: {
    name: string
    message: string
    stack?: string
  }
}

export interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableRemote: boolean
  remoteEndpoint?: string
  bufferSize: number
  flushInterval: number
  context?: Partial<LogEntry['context']>
}

class ProductionLogger {
  private config: LoggerConfig
  private buffer: LogEntry[] = []
  private flushTimer: NodeJS.Timeout | null = null

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
      enableConsole: process.env.NODE_ENV !== 'production',
      enableRemote: process.env.NODE_ENV === 'production',
      remoteEndpoint: '/api/analytics/logs',
      bufferSize: 50,
      flushInterval: 10000, // 10 seconds
      ...config
    }

    // Auto-flush buffer periodically
    if (this.config.enableRemote) {
      this.startFlushTimer()
    }

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush())
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.config.flushInterval)
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level
  }

  private createLogEntry(level: LogLevel, message: string, data?: any, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context: {
        ...this.config.context,
        ...(typeof window !== 'undefined' && {
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      }
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack })
      }
    }

    return entry
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString()
    const level = LogLevel[entry.level]
    const context = entry.context ? ` [${Object.entries(entry.context).map(([k, v]) => `${k}:${v}`).join(', ')}]` : ''
    
    return `[${timestamp}] ${level}${context}: ${entry.message}`
  }

  private logToConsole(entry: LogEntry) {
    if (!this.config.enableConsole) return

    const formattedMessage = this.formatConsoleMessage(entry)

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, entry.data)
        break
      case LogLevel.INFO:
        console.info(formattedMessage, entry.data)
        break
      case LogLevel.WARN:
        console.warn(formattedMessage, entry.data)
        break
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(formattedMessage, entry.data, entry.error)
        break
    }
  }

  private addToBuffer(entry: LogEntry) {
    if (!this.config.enableRemote) return

    this.buffer.push(entry)

    // Flush immediately for critical errors
    if (entry.level === LogLevel.CRITICAL) {
      this.flush()
    }
    // Flush when buffer is full
    else if (this.buffer.length >= this.config.bufferSize) {
      this.flush()
    }
  }

  public async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.enableRemote) return

    const entries = [...this.buffer]
    this.buffer = []

    try {
      const response = await fetch(this.config.remoteEndpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ entries })
      })

      if (!response.ok) {
        console.error('Failed to send logs to remote endpoint:', response.statusText)
        // Re-add entries to buffer if failed (up to buffer size)
        this.buffer.unshift(...entries.slice(0, this.config.bufferSize - this.buffer.length))
      }
    } catch (error) {
      console.error('Error sending logs:', error)
      // Re-add entries to buffer if failed
      this.buffer.unshift(...entries.slice(0, this.config.bufferSize - this.buffer.length))
    }
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error) {
    if (!this.shouldLog(level)) return

    const entry = this.createLogEntry(level, message, data, error)
    
    this.logToConsole(entry)
    this.addToBuffer(entry)
  }

  // Public logging methods
  public debug(message: string, data?: any) {
    this.log(LogLevel.DEBUG, message, data)
  }

  public info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data)
  }

  public warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data)
  }

  public error(message: string, error?: Error, data?: any) {
    this.log(LogLevel.ERROR, message, data, error)
  }

  public critical(message: string, error?: Error, data?: any) {
    this.log(LogLevel.CRITICAL, message, data, error)
  }

  // Specialized logging methods
  public apiCall(method: string, url: string, status: number, duration: number, data?: any) {
    this.info(`API ${method} ${url}`, {
      method,
      url,
      status,
      duration,
      ...data
    })
  }

  public userAction(action: string, component: string, data?: any) {
    this.info(`User action: ${action}`, {
      action,
      component,
      ...data
    })
  }

  public performance(metric: string, value: number, context?: any) {
    this.info(`Performance: ${metric}`, {
      metric,
      value,
      ...context
    })
  }

  public securityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', data?: any) {
    const level = severity === 'critical' ? LogLevel.CRITICAL : 
                  severity === 'high' ? LogLevel.ERROR :
                  severity === 'medium' ? LogLevel.WARN : LogLevel.INFO

    this.log(level, `Security: ${event}`, {
      securityEvent: event,
      severity,
      ...data
    })
  }

  // Context management
  public setContext(context: Partial<LogEntry['context']>) {
    this.config.context = { ...this.config.context, ...context }
  }

  public clearContext() {
    this.config.context = {}
  }

  // Create child logger with additional context
  public child(context: Partial<LogEntry['context']>): ProductionLogger {
    return new ProductionLogger({
      ...this.config,
      context: { ...this.config.context, ...context }
    })
  }

  // Cleanup
  public destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    this.flush()
  }
}

// Create singleton logger instance
const logger = new ProductionLogger()

// Enhanced logging utilities
export const createTimer = (name: string) => {
  const start = performance.now()
  return {
    end: (data?: any) => {
      const duration = performance.now() - start
      logger.performance(name, duration, data)
      return duration
    }
  }
}

export const withLogging = <T extends (...args: any[]) => any>(
  fn: T,
  options: {
    name: string
    logArgs?: boolean
    logResult?: boolean
    logErrors?: boolean
  }
): T => {
  return ((...args: any[]) => {
    const timer = createTimer(`${options.name} execution`)
    
    if (options.logArgs) {
      logger.debug(`${options.name} called`, { args })
    }

    try {
      const result = fn(...args)
      
      // Handle async functions
      if (result instanceof Promise) {
        return result
          .then((resolvedResult) => {
            timer.end()
            if (options.logResult) {
              logger.debug(`${options.name} completed`, { result: resolvedResult })
            }
            return resolvedResult
          })
          .catch((error) => {
            timer.end()
            if (options.logErrors) {
              logger.error(`${options.name} failed`, error)
            }
            throw error
          })
      }

      // Handle sync functions
      timer.end()
      if (options.logResult) {
        logger.debug(`${options.name} completed`, { result })
      }
      return result

    } catch (error) {
      timer.end()
      if (options.logErrors) {
        logger.error(`${options.name} failed`, error instanceof Error ? error : new Error(String(error)))
      }
      throw error
    }
  }) as T
}

// React hook for component logging
export const useLogger = (componentName: string) => {
  const componentLogger = logger.child({ component: componentName })
  
  return {
    debug: (message: string, data?: any) => componentLogger.debug(message, data),
    info: (message: string, data?: any) => componentLogger.info(message, data),
    warn: (message: string, data?: any) => componentLogger.warn(message, data),
    error: (message: string, error?: Error, data?: any) => componentLogger.error(message, error, data),
    userAction: (action: string, data?: any) => componentLogger.userAction(action, componentName, data),
    performance: (metric: string, value: number, context?: any) => componentLogger.performance(metric, value, context)
  }
}

// API request logging utility
export const logApiRequest = async <T>(
  request: Promise<T>,
  method: string,
  url: string,
  data?: any
): Promise<T> => {
  const timer = createTimer(`API ${method} ${url}`)
  
  try {
    const result = await request
    const duration = timer.end()
    logger.apiCall(method, url, 200, duration, data)
    return result
  } catch (error) {
    const duration = timer.end()
    const status = error instanceof Error && 'status' in error ? (error as any).status : 500
    logger.apiCall(method, url, status, duration, { error: error instanceof Error ? error.message : String(error), ...data })
    throw error
  }
}

export { logger, ProductionLogger }