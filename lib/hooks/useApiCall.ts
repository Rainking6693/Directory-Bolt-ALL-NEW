'use client'
import { useState, useCallback } from 'react'
import { ErrorInfo } from '../../components/ui/ErrorDisplay'
import { StripeErrorInfo } from '../../components/ui/StripeErrorDisplay'
import { apiDebugger } from '../utils/api-debugger'
import { parseApiError } from '../utils/enhanced-error-parser'

interface ApiCallState<T> {
  data: T | null
  loading: boolean
  error: ErrorInfo | null
  progress?: number
  progressMessage?: string
}

interface ApiCallOptions {
  onSuccess?: (data: any) => void
  onError?: (error: ErrorInfo) => void
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
}

export function useApiCall<T = any>() {
  const [state, setState] = useState<ApiCallState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const call = useCallback(async (
    apiFunction: () => Promise<T>,
    options: ApiCallOptions = {}
  ) => {
    const {
      onSuccess,
      onError,
      timeout = 30000,
      retryAttempts = 1,
      retryDelay = 1000
    } = options

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      progress: 0
    }))

    let lastError: ErrorInfo | null = null

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        // Add timeout wrapper
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Request timeout after ${timeout}ms`))
          }, timeout)
        })

        const result = await Promise.race([
          apiFunction(),
          timeoutPromise
        ]) as T

        setState(prev => ({
          ...prev,
          data: result,
          loading: false,
          error: null,
          progress: 100
        }))

        onSuccess?.(result)
        return result

      } catch (error) {
        // Use enhanced error parser first, fallback to legacy parser
        let errorInfo: ErrorInfo | StripeErrorInfo
        try {
          errorInfo = parseApiError(error, undefined, undefined, undefined)
        } catch (parseErr) {
          console.warn('Enhanced error parser failed, using legacy parser:', parseErr)
          errorInfo = {
            message: error instanceof Error ? error.message : 'Unknown error',
            type: 'unknown',
            statusCode: 500,
            isRetriable: false,
            priority: 'high'
          } as ErrorInfo
        }
        
        lastError = errorInfo

        setState(prev => ({
          ...prev,
          error: errorInfo,
          loading: attempt >= retryAttempts - 1 ? false : true,
          progress: undefined
        }))

        // If this is not the last attempt and error is retryable, wait and retry
        if (attempt < retryAttempts - 1 && errorInfo.retryable !== false) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
          continue
        }

        onError?.(errorInfo)
        break
      }
    }

    return null
  }, [])

  const retry = useCallback(() => {
    if (state.error && state.error.retryable !== false) {
      setState(prev => ({
        ...prev,
        error: null,
        loading: true,
        progress: 0
      }))
      // The actual retry logic would need to be handled by storing the last call
      // For now, we just reset the state
    }
  }, [state.error])

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      progress: undefined,
      progressMessage: undefined
    })
  }, [])

  const updateProgress = useCallback((progress: number, message?: string) => {
    setState(prev => ({
      ...prev,
      progress,
      progressMessage: message
    }))
  }, [])

  return {
    ...state,
    call,
    retry,
    reset,
    updateProgress
  }
}

// Specialized hook for website analysis
export function useWebsiteAnalysis() {
  const { call, ...state } = useApiCall()

  const analyzeWebsite = useCallback(async (url: string, options: any = {}) => {
    return call(async () => {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, options }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Analysis failed')
      }

      return data.data
    }, {
      timeout: 120000, // 2 minutes for analysis
      retryAttempts: 2,
      retryDelay: 2000
    })
  }, [call])

  return {
    ...state,
    analyzeWebsite
  }
}

// Specialized hook for checkout operations
export function useCheckout() {
  const { call, ...state } = useApiCall()

  const createCheckoutSession = useCallback(async (plan: string, options: any = {}) => {
    return call(async () => {
      const requestBody = {
        plan,
        ...options
      }
      
      const headers = {
        'Content-Type': 'application/json',
      }
      
      // Start debugging
      const requestId = apiDebugger.startRequest(
        '/api/create-checkout-session',
        'POST',
        requestBody,
        headers,
        {
          logToConsole: true,
          includeHeaders: true,
          includeBody: true,
          persistLogs: true
        }
      )
      
      let response: Response
      let responseData: any = null
      
      try {
        response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        })
        
        // Try to parse response data
        try {
          responseData = await response.json()
        } catch (parseError) {
          console.error('Failed to parse response JSON:', parseError)
          responseData = { error: { message: 'Invalid JSON response from server' } }
        }
        
        // Log successful response
        apiDebugger.endRequest(requestId, response, responseData, {
          logToConsole: true,
          includeHeaders: true,
          includeBody: true,
          persistLogs: true
        })
        
        if (!response.ok) {
          // Create enhanced error with Stripe-specific information
          const enhancedError = new Error(responseData?.error?.message || `HTTP ${response.status}: ${response.statusText}`)
          ;(enhancedError as any).requestId = requestId
          ;(enhancedError as any).responseData = responseData
          ;(enhancedError as any).statusCode = response.status
          throw enhancedError
        }

        if (!responseData.success) {
          const enhancedError = new Error(responseData.error?.message || 'Checkout session creation failed')
          ;(enhancedError as any).requestId = requestId
          ;(enhancedError as any).responseData = responseData
          throw enhancedError
        }

        return {
          ...responseData.data,
          _debug: {
            requestId,
            responseData: apiDebugger.isDebugMode() ? responseData : null
          }
        }
        
      } catch (error) {
        // Log error
        apiDebugger.logError(requestId, error, {
          logToConsole: true,
          persistLogs: true
        })
        
        // Enhance error with debug information
        ;(error as any).requestId = requestId
        ;(error as any).requestBody = requestBody
        ;(error as any).responseData = responseData
        
        throw error
      }
    }, {
      timeout: 15000, // 15 seconds for checkout
      retryAttempts: 2,
      retryDelay: 1000
    })
  }, [call])

  return {
    ...state,
    createCheckoutSession
  }
}

function parseError(error: any, attempt: number, maxAttempts: number): ErrorInfo | StripeErrorInfo {
  // Handle timeout errors
  if (error.message?.includes('timeout')) {
    return {
      type: 'timeout',
      message: error.message,
      retryable: true,
      recoverable: true,
      details: {
        supportId: `Attempt ${attempt}/${maxAttempts}`
      }
    }
  }

  // Handle network errors
  if (error.name === 'TypeError' && error.message?.includes('fetch')) {
    return {
      type: 'network',
      message: 'Network connection failed. Please check your internet connection.',
      retryable: true,
      recoverable: true,
      details: {
        supportId: `Attempt ${attempt}/${maxAttempts}`
      }
    }
  }

  // Handle HTTP errors based on status codes
  if (error.message?.includes('HTTP ')) {
    const statusMatch = error.message.match(/HTTP (\d+)/)
    const statusCode = statusMatch ? parseInt(statusMatch[1]) : null

    if (statusCode) {
      switch (statusCode) {
        case 400:
          return {
            type: 'validation',
            message: 'Invalid request. Please check your input and try again.',
            retryable: false,
            recoverable: true,
            details: { statusCode, supportId: `Attempt ${attempt}/${maxAttempts}` }
          }

        case 401:
          return {
            type: 'network',
            message: 'Authentication failed. Please refresh the page and try again.',
            retryable: false,
            recoverable: true,
            details: { statusCode, supportId: `Attempt ${attempt}/${maxAttempts}` }
          }

        case 403:
          return {
            type: 'network',
            message: 'Access denied. You may have reached your usage limit.',
            retryable: false,
            recoverable: true,
            details: { statusCode, supportId: `Attempt ${attempt}/${maxAttempts}` }
          }

        case 404:
          return {
            type: 'dns',
            message: 'The requested resource was not found.',
            retryable: false,
            recoverable: true,
            details: { statusCode, supportId: `Attempt ${attempt}/${maxAttempts}` }
          }

        case 429:
          return {
            type: 'rate_limit',
            message: 'Too many requests. Please wait a moment before trying again.',
            retryable: true,
            recoverable: true,
            details: { statusCode, supportId: `Attempt ${attempt}/${maxAttempts}`, retryAfter: 60000 }
          }

        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: 'server',
            message: 'Server error. Please try again in a few moments.',
            retryable: true,
            recoverable: true,
            details: { statusCode, supportId: `Attempt ${attempt}/${maxAttempts}` }
          }

        default:
          return {
            type: 'unknown',
            message: error.message || 'An unexpected error occurred.',
            retryable: statusCode >= 500,
            recoverable: true,
            details: { statusCode, supportId: `Attempt ${attempt}/${maxAttempts}` }
          }
      }
    }
  }

  // Handle Stripe-specific errors with enhanced debugging info
  if (error.requestId && (error.message?.includes('payment') || error.message?.includes('stripe') || error.message?.includes('checkout'))) {
    const stripeError: StripeErrorInfo = {
      type: 'payment',
      message: error.message,
      requestId: error.requestId,
      retryable: false,
      recoverable: true,
      details: { 
        supportId: `Attempt ${attempt}/${maxAttempts}`,
        statusCode: error.statusCode
      },
      supportContext: {
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
      }
    }
    
    // Extract Stripe-specific error information from response data
    if (error.responseData?.error) {
      const errorData = error.responseData.error
      stripeError.stripeCode = errorData.code
      stripeError.stripeType = errorData.type
      stripeError.message = errorData.message || error.message
      
      // Check if running in development mode
      if (error.responseData.data?.development_mode) {
        stripeError.developmentMode = true
        stripeError.configurationErrors = ['Running in development mode with mock responses']
      }
      
      // Extract configuration issues
      if (errorData.code === 'STRIPE_CONFIG_MISSING' || errorData.code === 'STRIPE_PRODUCTION_CONFIG_ERROR') {
        stripeError.configurationErrors = stripeError.configurationErrors || []
        stripeError.configurationErrors.push(errorData.message)
      }
      
      // Extract environment issues
      if (errorData.code?.includes('ENVIRONMENT') || errorData.code?.includes('CONFIG')) {
        stripeError.environmentIssues = stripeError.environmentIssues || []
        stripeError.environmentIssues.push(errorData.message)
      }
      
      // Add retry recommendations
      switch (errorData.code) {
        case 'STRIPE_RATE_LIMIT':
          stripeError.retryRecommendations = ['Wait 30 seconds before retrying', 'Avoid rapid successive requests']
          stripeError.retryable = true
          break
        case 'STRIPE_API_ERROR':
        case 'STRIPE_CONNECTION_ERROR':
          stripeError.retryRecommendations = ['Check internet connection', 'Try again in a few minutes', 'Contact support if issue persists']
          stripeError.retryable = true
          break
        case 'STRIPE_VALIDATION_ERROR':
          stripeError.retryRecommendations = ['Refresh the page and try again', 'Clear browser cache', 'Verify all required fields are filled']
          break
        case 'STRIPE_AUTH_ERROR':
        case 'STRIPE_CONFIG_ERROR':
          stripeError.retryRecommendations = ['Contact support immediately', 'This is a system configuration issue']
          break
      }
      
      // Store plan information if available
      if (error.requestBody?.plan) {
        stripeError.supportContext!.plan = error.requestBody.plan
      }
    }
    
    return stripeError
  }

  // Handle specific error messages from the backend
  if (typeof error.message === 'string') {
    const message = error.message.toLowerCase()

    if (message.includes('website took too long')) {
      return {
        type: 'timeout',
        message: error.message,
        retryable: true,
        recoverable: true,
        details: { supportId: `Attempt ${attempt}/${maxAttempts}` }
      }
    }

    if (message.includes('ssl') || message.includes('certificate')) {
      return {
        type: 'ssl',
        message: error.message,
        retryable: false,
        recoverable: true,
        details: { supportId: `Attempt ${attempt}/${maxAttempts}` }
      }
    }

    if (message.includes('dns') || message.includes('could not find')) {
      return {
        type: 'dns',
        message: error.message,
        retryable: false,
        recoverable: true,
        details: { supportId: `Attempt ${attempt}/${maxAttempts}` }
      }
    }

    if (message.includes('payment') || message.includes('stripe')) {
      return {
        type: 'payment',
        message: error.message,
        retryable: false,
        recoverable: true,
        details: { supportId: `Attempt ${attempt}/${maxAttempts}` }
      }
    }
  }

  // Default error
  return {
    type: 'unknown',
    message: error.message || 'An unexpected error occurred. Please try again.',
    retryable: true,
    recoverable: true,
    details: { supportId: `Attempt ${attempt}/${maxAttempts}` }
  }
}