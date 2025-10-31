/**
 * Simple Logger Utility
 * Provides basic logging functionality for DirectoryBolt
 */

export interface LogMetadata {
  [key: string]: any
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp: string
  metadata?: LogMetadata
  error?: Error
}

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 1000

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    metadata?: LogMetadata,
    error?: Error
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata,
      error
    }
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry)
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Console output
    const logMessage = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`
    
    switch (entry.level) {
      case 'error':
        console.error(logMessage, entry.metadata, entry.error)
        break
      case 'warn':
        console.warn(logMessage, entry.metadata)
        break
      case 'debug':
        console.debug(logMessage, entry.metadata)
        break
      default:
        console.log(logMessage, entry.metadata)
    }
  }

  // Accept flexible metadata shapes to match call-sites across the codebase.
  // Accept any metadata shape (including top-level requestId, error, etc.) and normalize to { metadata }
  info(message: string, data?: any): void {
    const normalized = data && data.metadata ? data.metadata : data
    this.addLog(this.createLogEntry('info', message, normalized as LogMetadata))
  }

  warn(message: string, data?: any): void {
    const normalized = data && data.metadata ? data.metadata : data
    this.addLog(this.createLogEntry('warn', message, normalized as LogMetadata))
  }

  error(message: string, data?: any, error?: any): void {
    const normalized = data && data.metadata ? data.metadata : data
    const err = error instanceof Error ? error : (error ? new Error(String(error)) : undefined)
    this.addLog(this.createLogEntry('error', message, normalized as LogMetadata, err))
  }

  debug(message: string, data?: any): void {
    const normalized = data && data.metadata ? data.metadata : data
    this.addLog(this.createLogEntry('debug', message, normalized as LogMetadata))
  }

  apiResponse(logData: {
    requestId: string
    method: string
    url: string
    status: number
    duration: number
  }): void {
    this.info('API Response', { metadata: logData })
  }

  getLogs(level?: LogEntry['level']): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level)
    }
    return [...this.logs]
  }

  clearLogs(): void {
    this.logs = []
  }
}

// Export logger as `any` to accept flexible call-sites during incremental typing cleanup
// Export a typed logger interface that accepts flexible call-sites used across the repo
export interface LoggerLike {
  info(message: string, data?: any): void
  warn(message: string, data?: any): void
  error(message: string, data?: any, error?: any): void
  debug(message: string, data?: any): void
  apiResponse?(logData: any): void
  getLogs?(level?: LogEntry['level']): LogEntry[]
  clearLogs?(): void
}

export const logger: LoggerLike = new Logger() as unknown as LoggerLike
export const log: LoggerLike = logger