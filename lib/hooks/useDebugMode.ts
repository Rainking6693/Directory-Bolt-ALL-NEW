'use client'
import { useState, useEffect, useCallback } from 'react'
import { apiDebugger } from '../utils/api-debugger'

export interface EnvironmentValidation {
  isValid: boolean
  issues: string[]
  warnings: string[]
  environment: 'development' | 'production' | 'unknown'
  protocolCheck: boolean
  hostnameCheck: boolean
  debugModeEnabled: boolean
}

export interface DebugModeHook {
  isDebugMode: boolean
  enableDebugMode: (enabled: boolean) => void
  toggleDebugMode: () => void
  environmentValidation: EnvironmentValidation
  apiLogs: any[]
  clearApiLogs: () => void
  exportDebugData: () => void
  validatePaymentEnvironment: () => PaymentEnvironmentValidation
}

export interface PaymentEnvironmentValidation {
  isValid: boolean
  issues: string[]
  warnings: string[]
  checks: {
    httpsInProduction: boolean
    validDomain: boolean
    debugModeWarning: boolean
    browserCompatibility: boolean
  }
}

export function useDebugMode(): DebugModeHook {
  const [isDebugMode, setIsDebugMode] = useState(false)
  const [environmentValidation, setEnvironmentValidation] = useState<EnvironmentValidation>({
    isValid: true,
    issues: [],
    warnings: [],
    environment: 'unknown',
    protocolCheck: false,
    hostnameCheck: false,
    debugModeEnabled: false
  })
  const [apiLogs, setApiLogs] = useState<any[]>([])

  // Initialize debug mode and environment validation
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check debug mode
    const urlParams = new URLSearchParams(window.location.search)
    const debugParam = urlParams.get('debug')
    const debugStorage = localStorage.getItem('directorybolt_debug')
    const debugEnabled = debugParam === 'true' || debugStorage === 'true' || apiDebugger.isDebugMode()
    
    setIsDebugMode(debugEnabled)
    
    // Perform environment validation
    const validation = performEnvironmentValidation(debugEnabled)
    setEnvironmentValidation(validation)
    
    // Get initial API logs
    setApiLogs(apiDebugger.getDebugLogs().slice(0, 10))
    
    // Log debug mode status
    if (debugEnabled) {
      console.log('🔍 DirectoryBolt Debug Mode Active')
      console.log('Environment Validation:', validation)
      
      // Warn about issues
      if (validation.issues.length > 0) {
        console.warn('Environment Issues:', validation.issues)
      }
      if (validation.warnings.length > 0) {
        console.log('Environment Warnings:', validation.warnings)
      }
    }
  }, [])

  // Update API logs periodically when in debug mode
  useEffect(() => {
    if (!isDebugMode) return

    const interval = setInterval(() => {
      setApiLogs(apiDebugger.getDebugLogs().slice(0, 10))
    }, 2000)

    return () => clearInterval(interval)
  }, [isDebugMode])

  const enableDebugMode = useCallback((enabled: boolean) => {
    setIsDebugMode(enabled)
    apiDebugger.enableDebugMode(enabled)
    
    if (enabled) {
      const validation = performEnvironmentValidation(enabled)
      setEnvironmentValidation(validation)
      setApiLogs(apiDebugger.getDebugLogs().slice(0, 10))
    }
  }, [])

  const toggleDebugMode = useCallback(() => {
    enableDebugMode(!isDebugMode)
  }, [isDebugMode, enableDebugMode])

  const clearApiLogs = useCallback(() => {
    apiDebugger.clearLogs()
    setApiLogs([])
  }, [])

  const exportDebugData = useCallback(() => {
    if (typeof window === 'undefined') return

    const debugData = {
      timestamp: new Date().toISOString(),
      environmentValidation,
      apiLogs: apiDebugger.getDebugLogs(),
      debuggerSummary: apiDebugger.getSummary(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      localStorage: {
        debugMode: localStorage.getItem('directorybolt_debug'),
        apiLogs: localStorage.getItem('directorybolt_api_logs')
      }
    }

    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `directorybolt-debug-${new Date().toISOString().slice(0, 19)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [environmentValidation])

  const validatePaymentEnvironment = useCallback((): PaymentEnvironmentValidation => {
    const issues: string[] = []
    const warnings: string[] = []
    
    let httpsInProduction = true
    let validDomain = true
    let debugModeWarning = false
    let browserCompatibility = true

    if (typeof window !== 'undefined') {
      // HTTPS check
      if (window.location.protocol !== 'https:' && 
          !window.location.hostname.includes('localhost') && 
          !window.location.hostname.includes('127.0.0.1')) {
        issues.push('Payment processing requires HTTPS in production')
        httpsInProduction = false
      }

      // Domain validation
      const hostname = window.location.hostname
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        warnings.push('Running on localhost - ensure production domain is configured correctly')
        validDomain = true // localhost is valid for development
      } else if (!hostname.includes('.') || hostname === '0.0.0.0') {
        issues.push('Invalid domain for production payment processing')
        validDomain = false
      }

      // Debug mode warning in production
      if (isDebugMode && !hostname.includes('localhost')) {
        warnings.push('Debug mode is enabled in production - disable for security')
        debugModeWarning = true
      }

      // Browser compatibility checks
      if (typeof fetch === 'undefined') {
        issues.push('Browser does not support fetch API')
        browserCompatibility = false
      }
      
      if (typeof Promise === 'undefined') {
        issues.push('Browser does not support Promises')
        browserCompatibility = false
      }
      
      if (!window.localStorage) {
        warnings.push('LocalStorage is not available - some debug features may not work')
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      checks: {
        httpsInProduction,
        validDomain,
        debugModeWarning,
        browserCompatibility
      }
    }
  }, [isDebugMode])

  return {
    isDebugMode,
    enableDebugMode,
    toggleDebugMode,
    environmentValidation,
    apiLogs,
    clearApiLogs,
    exportDebugData,
    validatePaymentEnvironment
  }
}

function performEnvironmentValidation(debugEnabled: boolean): EnvironmentValidation {
  const issues: string[] = []
  const warnings: string[] = []
  let environment: 'development' | 'production' | 'unknown' = 'unknown'
  let protocolCheck = false
  let hostnameCheck = false

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const protocol = window.location.protocol

    // Determine environment
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
      environment = 'development'
    } else {
      environment = 'production'
    }

    // Protocol check
    if (protocol === 'https:') {
      protocolCheck = true
    } else if (environment === 'production') {
      issues.push('Production site must use HTTPS')
      protocolCheck = false
    } else {
      protocolCheck = true // HTTP is acceptable in development
    }

    // Hostname check
    if (environment === 'development' || (hostname.includes('.') && !hostname.includes('localhost'))) {
      hostnameCheck = true
    } else {
      issues.push('Invalid hostname detected')
      hostnameCheck = false
    }

    // Debug mode warnings
    if (debugEnabled && environment === 'production') {
      warnings.push('Debug mode should be disabled in production')
    }

    // Browser feature checks
    if (typeof fetch === 'undefined') {
      issues.push('Browser does not support fetch API (required for API calls)')
    }

    if (!window.localStorage) {
      warnings.push('LocalStorage is not available (debug features may be limited)')
    }

    // Performance API check
    if (!window.performance || !window.performance.now) {
      warnings.push('Performance API not available (timing measurements may be inaccurate)')
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    environment,
    protocolCheck,
    hostnameCheck,
    debugModeEnabled: debugEnabled
  }
}