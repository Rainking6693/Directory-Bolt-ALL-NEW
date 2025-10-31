'use client'

export interface ApiDebugInfo {
  requestId: string
  url: string
  method: string
  timestamp: string
  requestHeaders: Record<string, string>
  requestBody: any
  responseStatus?: number
  responseHeaders?: Record<string, string>
  responseBody?: any
  timing: {
    startTime: number
    endTime?: number
    duration?: number
  }
  error?: any
}

export interface DebugOptions {
  logToConsole?: boolean
  logLevel?: 'info' | 'warn' | 'error'
  includeHeaders?: boolean
  includeBody?: boolean
  maxBodySize?: number
  persistLogs?: boolean
}

class ApiDebugger {
  private logs: ApiDebugInfo[] = []
  private maxLogs = 100
  private debugMode = false

  constructor() {
    // Check for debug mode in URL parameters or localStorage
    this.initializeDebugMode()
  }

  private initializeDebugMode() {
    if (typeof window === 'undefined') return

    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const debugParam = urlParams.get('debug')
    
    // Check localStorage
    const debugStorage = localStorage.getItem('directorybolt_debug')
    
    this.debugMode = debugParam === 'true' || debugStorage === 'true'
    
    if (this.debugMode) {
      console.log('🔍 DirectoryBolt Debug Mode Enabled')
      console.log('💡 Use apiDebugger.getDebugLogs() to view all API calls')
      console.log('💡 Use apiDebugger.clearLogs() to clear debug logs')
      console.log('💡 Use apiDebugger.exportLogs() to export logs for support')
    }
  }

  enableDebugMode(enable: boolean = true) {
    this.debugMode = enable
    if (typeof window !== 'undefined') {
      localStorage.setItem('directorybolt_debug', enable.toString())
    }
    
    if (enable) {
      console.log('🔍 API Debug Mode Enabled')
    } else {
      console.log('🔍 API Debug Mode Disabled')
    }
  }

  isDebugMode(): boolean {
    return this.debugMode
  }

  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  startRequest(
    url: string, 
    method: string, 
    requestBody: any = null,
    headers: Record<string, string> = {},
    options: DebugOptions = {}
  ): string {
    const requestId = this.generateRequestId()
    const timestamp = new Date().toISOString()
    
    const debugInfo: ApiDebugInfo = {
      requestId,
      url,
      method: method.toUpperCase(),
      timestamp,
      requestHeaders: headers,
      requestBody: this.sanitizeBody(requestBody, options.maxBodySize),
      timing: {
        startTime: performance.now()
      }
    }

    this.logs.push(debugInfo)
    this.trimLogs()

    if (this.debugMode && options.logToConsole !== false) {
      console.group(`🚀 API Request [${requestId}]`)
      console.log('URL:', url)
      console.log('Method:', method.toUpperCase())
      console.log('Timestamp:', timestamp)
      
      if (options.includeHeaders !== false && Object.keys(headers).length > 0) {
        console.log('Headers:', headers)
      }
      
      if (options.includeBody !== false && requestBody) {
        console.log('Request Body:', debugInfo.requestBody)
      }
      
      console.groupEnd()
    }

    return requestId
  }

  endRequest(
    requestId: string,
    response: Response,
    responseBody: any = null,
    options: DebugOptions = {}
  ) {
    const debugInfo = this.logs.find(log => log.requestId === requestId)
    if (!debugInfo) return

    debugInfo.timing.endTime = performance.now()
    debugInfo.timing.duration = debugInfo.timing.endTime - debugInfo.timing.startTime
    debugInfo.responseStatus = response.status
    debugInfo.responseHeaders = this.extractHeaders(response)
    debugInfo.responseBody = this.sanitizeBody(responseBody, options.maxBodySize)

    if (this.debugMode && options.logToConsole !== false) {
      const logLevel = response.ok ? 'info' : 'error'
      const icon = response.ok ? '✅' : '❌'
      
      console.group(`${icon} API Response [${requestId}] - ${debugInfo.timing.duration?.toFixed(2)}ms`)
      console.log('Status:', response.status, response.statusText)
      console.log('Duration:', `${debugInfo.timing.duration?.toFixed(2)}ms`)
      
      if (options.includeHeaders !== false && debugInfo.responseHeaders) {
        console.log('Response Headers:', debugInfo.responseHeaders)
      }
      
      if (options.includeBody !== false && responseBody) {
        if (response.ok) {
          console.log('Response Body:', debugInfo.responseBody)
        } else {
          console.error('Error Response:', debugInfo.responseBody)
        }
      }
      
      console.groupEnd()
    }

    if (options.persistLogs) {
      this.persistLog(debugInfo)
    }
  }

  logError(
    requestId: string,
    error: any,
    options: DebugOptions = {}
  ) {
    const debugInfo = this.logs.find(log => log.requestId === requestId)
    if (!debugInfo) return

    debugInfo.timing.endTime = performance.now()
    debugInfo.timing.duration = debugInfo.timing.endTime - debugInfo.timing.startTime
    debugInfo.error = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: error.code,
      type: error.type
    }

    if (this.debugMode && options.logToConsole !== false) {
      console.group(`❌ API Error [${requestId}] - ${debugInfo.timing.duration?.toFixed(2)}ms`)
      console.error('Error:', error)
      console.log('URL:', debugInfo.url)
      console.log('Method:', debugInfo.method)
      console.log('Duration:', `${debugInfo.timing.duration?.toFixed(2)}ms`)
      
      if (error.code || error.type) {
        console.log('Error Code:', error.code)
        console.log('Error Type:', error.type)
      }
      
      console.groupEnd()
    }

    if (options.persistLogs) {
      this.persistLog(debugInfo)
    }
  }

  private sanitizeBody(body: any, maxSize: number = 10000): any {
    if (!body) return body

    try {
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body)
      
      if (bodyString.length > maxSize) {
        return {
          _truncated: true,
          _originalSize: bodyString.length,
          _maxSize: maxSize,
          data: bodyString.substring(0, maxSize) + '...'
        }
      }
      
      return typeof body === 'string' ? body : body
    } catch (error) {
      return { _error: 'Could not serialize body', _type: typeof body }
    }
  }

  private extractHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })
    return headers
  }

  private trimLogs() {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
  }

  private persistLog(debugInfo: ApiDebugInfo) {
    if (typeof window === 'undefined') return
    
    try {
      const existingLogs = JSON.parse(localStorage.getItem('directorybolt_api_logs') || '[]')
      existingLogs.push(debugInfo)
      
      // Keep only the last 50 logs in localStorage
      const logsToKeep = existingLogs.slice(-50)
      localStorage.setItem('directorybolt_api_logs', JSON.stringify(logsToKeep))
    } catch (error) {
      console.warn('Could not persist debug log:', error)
    }
  }

  getDebugLogs(filter?: {
    url?: string
    method?: string
    status?: number
    hasError?: boolean
    since?: Date
  }): ApiDebugInfo[] {
    let filteredLogs = [...this.logs]

    if (filter) {
      if (filter.url) {
        filteredLogs = filteredLogs.filter(log => 
          log.url.includes(filter.url!)
        )
      }
      
      if (filter.method) {
        filteredLogs = filteredLogs.filter(log => 
          log.method === filter.method!.toUpperCase()
        )
      }
      
      if (filter.status) {
        filteredLogs = filteredLogs.filter(log => 
          log.responseStatus === filter.status
        )
      }
      
      if (filter.hasError !== undefined) {
        filteredLogs = filteredLogs.filter(log => 
          !!log.error === filter.hasError
        )
      }
      
      if (filter.since) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) >= filter.since!
        )
      }
    }

    return filteredLogs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }

  clearLogs() {
    this.logs = []
    if (typeof window !== 'undefined') {
      localStorage.removeItem('directorybolt_api_logs')
    }
    console.log('🧹 Debug logs cleared')
  }

  exportLogs(): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
      logs: this.logs
    }

    return JSON.stringify(exportData, null, 2)
  }

  getSummary() {
    const totalRequests = this.logs.length
    const errorRequests = this.logs.filter(log => log.error).length
    const averageResponseTime = this.logs
      .filter(log => log.timing.duration)
      .reduce((sum, log) => sum + (log.timing.duration || 0), 0) / totalRequests

    const statusCodes = this.logs.reduce((acc, log) => {
      if (log.responseStatus) {
        acc[log.responseStatus] = (acc[log.responseStatus] || 0) + 1
      }
      return acc
    }, {} as Record<number, number>)

    return {
      totalRequests,
      errorRequests,
      successRate: totalRequests > 0 ? ((totalRequests - errorRequests) / totalRequests) * 100 : 0,
      averageResponseTime: averageResponseTime || 0,
      statusCodes,
      recentErrors: this.logs
        .filter(log => log.error)
        .slice(-5)
        .map(log => ({
          requestId: log.requestId,
          url: log.url,
          error: log.error?.message,
          timestamp: log.timestamp
        }))
    }
  }

  // Convenience method to validate environment
  validateEnvironment(): {
    isValid: boolean
    issues: string[]
    warnings: string[]
  } {
    const issues: string[] = []
    const warnings: string[] = []

    if (typeof window !== 'undefined') {
      // Check if running in development
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        warnings.push('Running in development mode')
      }

      // Check for required environment indicators
      if (!window.location.protocol.startsWith('https') && !window.location.hostname.includes('localhost')) {
        issues.push('Not running over HTTPS in production')
      }

      // Check for debug mode
      if (this.debugMode) {
        warnings.push('Debug mode is enabled')
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings
    }
  }
}

// Create singleton instance
export const apiDebugger = new ApiDebugger()

// Make it available globally in debug mode
if (typeof window !== 'undefined' && apiDebugger.isDebugMode()) {
  (window as any).apiDebugger = apiDebugger
}