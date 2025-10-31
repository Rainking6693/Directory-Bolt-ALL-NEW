'use client'
import { StripeErrorInfo } from '../../components/ui/StripeErrorDisplay'
import { ErrorInfo } from '../../components/ui/ErrorDisplay'

export interface EnhancedApiError {
  success: false
  error: {
    message: string
    code: string
    type: 'validation' | 'authentication' | 'configuration' | 'stripe' | 'network' | 'server' | 'unknown'
    statusCode: number
    details?: {
      field?: string
      supportId?: string
      requestId?: string
      timestamp?: string
      environment?: string
      stripeErrorCode?: string
      stripeErrorType?: string
      configurationIssues?: string[]
      environmentValidation?: Record<string, boolean>
    }
  }
  requestId: string
  timestamp: string
}

export class EnhancedErrorParser {
  /**
   * Parse enhanced API error responses from Shane's backend debugging system
   */
  static parseApiError(
    error: any, 
    requestId?: string,
    requestPayload?: any,
    responseData?: any
  ): StripeErrorInfo | ErrorInfo {
    // If this is already a parsed error, return it
    if (error.type && (error.stripeCode || error.code)) {
      return error
    }

    // Try to extract enhanced error information from response
    let enhancedError: EnhancedApiError | null = null
    
    if (responseData && responseData.error) {
      enhancedError = responseData as EnhancedApiError
    } else if (error.responseData?.error) {
      enhancedError = error.responseData as EnhancedApiError
    }

    // Parse Stripe-specific errors
    if (enhancedError?.error.type === 'stripe' || error.message?.includes('stripe') || error.message?.includes('payment')) {
      return this.parseStripeError(error, enhancedError, requestId, requestPayload)
    }

    // Parse other API errors
    return this.parseGenericApiError(error, enhancedError, requestId)
  }

  /**
   * Parse Stripe-specific errors with enhanced debugging information
   */
  private static parseStripeError(
    originalError: any,
    enhancedError: EnhancedApiError | null,
    requestId?: string,
    requestPayload?: any
  ): StripeErrorInfo {
    const stripeError: StripeErrorInfo = {
      type: 'payment',
      message: enhancedError?.error.message || originalError.message || 'Payment processing failed',
      requestId: enhancedError?.requestId || requestId,
      retryable: false,
      recoverable: true,
      details: {
        statusCode: enhancedError?.error.statusCode || originalError.statusCode,
        supportId: enhancedError?.error.details?.supportId || `${Date.now()}`
      },
      supportContext: {
        timestamp: enhancedError?.timestamp || new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
      }
    }

    // Extract Stripe-specific error codes and types
    if (enhancedError?.error.details) {
      const details = enhancedError.error.details
      stripeError.stripeCode = details.stripeErrorCode
      stripeError.stripeType = details.stripeErrorType
      
      if (requestPayload?.plan) {
        stripeError.supportContext!.plan = requestPayload.plan
      }
    }

    // Handle configuration errors
    if (enhancedError?.error.code?.includes('CONFIG') || enhancedError?.error.code?.includes('ENVIRONMENT')) {
      stripeError.configurationErrors = enhancedError.error.details?.configurationIssues || []
      
      // Add specific configuration error messages
      switch (enhancedError.error.code) {
        case 'STRIPE_CONFIG_MISSING':
          stripeError.configurationErrors.push('Stripe price configuration is missing for the selected plan')
          break
        case 'STRIPE_PRODUCTION_CONFIG_ERROR':
          stripeError.configurationErrors.push('Production environment detected with test configuration')
          break
        case 'STRIPE_AUTH_ERROR':
          stripeError.configurationErrors.push('Stripe API authentication is not properly configured')
          break
      }
    }

    // Handle environment issues
    if (enhancedError?.error.details?.environment === 'development') {
      stripeError.developmentMode = true
      stripeError.environmentIssues = stripeError.environmentIssues || []
      stripeError.environmentIssues.push('Running in development mode with mock responses')
    }

    // Environment validation issues
    if (enhancedError?.error.details?.environmentValidation) {
      const validation = enhancedError.error.details.environmentValidation
      stripeError.environmentIssues = stripeError.environmentIssues || []
      
      if (!validation.has_stripe_key) {
        stripeError.environmentIssues.push('Stripe secret key is not configured')
      }
      if (!validation.all_price_ids_set) {
        stripeError.environmentIssues.push('Not all Stripe price IDs are configured')
      }
      if (!validation.nextauth_url) {
        stripeError.environmentIssues.push('NEXTAUTH_URL environment variable is not set')
      }
    }

    // Add retry recommendations based on error type
    stripeError.retryRecommendations = this.getStripeRetryRecommendations(
      enhancedError?.error.code || originalError.code,
      stripeError.stripeCode
    )

    // Determine if error is retryable
    stripeError.retryable = this.isStripeErrorRetryable(
      enhancedError?.error.code || originalError.code,
      stripeError.stripeCode
    )

    return stripeError
  }

  /**
   * Parse generic API errors
   */
  private static parseGenericApiError(
    originalError: any,
    enhancedError: EnhancedApiError | null,
    requestId?: string
  ): ErrorInfo {
    const apiError: ErrorInfo = {
      type: this.mapErrorType(enhancedError?.error.type || 'unknown'),
      message: enhancedError?.error.message || originalError.message || 'An error occurred',
      code: enhancedError?.error.code,
      retryable: this.isGenericErrorRetryable(enhancedError?.error.code || originalError.code),
      recoverable: true,
      details: {
        statusCode: enhancedError?.error.statusCode || originalError.statusCode,
        supportId: enhancedError?.error.details?.supportId || requestId || `${Date.now()}`
      }
    }

    return apiError
  }

  /**
   * Map backend error types to frontend error types
   */
  private static mapErrorType(backendType: string): ErrorInfo['type'] {
    switch (backendType) {
      case 'validation': return 'validation'
      case 'authentication': return 'network'
      case 'configuration': return 'server'
      case 'stripe': return 'payment'
      case 'network': return 'network'
      case 'server': return 'server'
      default: return 'unknown'
    }
  }

  /**
   * Get retry recommendations for Stripe errors
   */
  private static getStripeRetryRecommendations(errorCode?: string, stripeCode?: string): string[] {
    if (stripeCode) {
      switch (stripeCode) {
        case 'rate_limit':
          return ['Wait 30 seconds before retrying', 'Avoid rapid successive requests']
        case 'api_connection_error':
        case 'api_error':
          return ['Check internet connection', 'Try again in a few minutes', 'Contact support if issue persists']
        case 'parameter_invalid_empty':
        case 'parameter_missing':
          return ['Refresh the page and try again', 'Clear browser cache', 'Verify all required fields are filled']
        case 'card_declined':
          return ['Try a different payment method', 'Contact your bank', 'Verify card details are correct']
        case 'api_key_invalid':
        case 'authentication_required':
          return ['Contact support immediately', 'This is a system configuration issue']
        case 'price_not_found':
        case 'resource_missing':
          return ['Try a different plan', 'Contact support if issue persists', 'This may be a configuration issue']
      }
    }

    if (errorCode) {
      switch (errorCode) {
        case 'STRIPE_RATE_LIMIT':
          return ['Wait 30 seconds before retrying', 'Avoid rapid successive requests']
        case 'STRIPE_CONFIG_ERROR':
        case 'STRIPE_AUTH_ERROR':
          return ['Contact support immediately', 'This is a system configuration issue']
        case 'STRIPE_VALIDATION_ERROR':
          return ['Refresh the page and try again', 'Verify all required information is correct']
        case 'STRIPE_CONNECTION_ERROR':
        case 'STRIPE_API_ERROR':
          return ['Check internet connection', 'Try again in a few minutes']
      }
    }

    return ['Try again', 'Contact support if issue persists']
  }

  /**
   * Determine if Stripe error is retryable
   */
  private static isStripeErrorRetryable(errorCode?: string, stripeCode?: string): boolean {
    const nonRetryableStripeCodes = [
      'api_key_invalid',
      'authentication_required', 
      'price_not_found',
      'resource_missing',
      'parameter_invalid_empty',
      'parameter_missing',
      'card_declined'
    ]

    const nonRetryableErrorCodes = [
      'STRIPE_AUTH_ERROR',
      'STRIPE_CONFIG_ERROR',
      'STRIPE_VALIDATION_ERROR',
      'STRIPE_CONFIG_MISSING'
    ]

    if (stripeCode && nonRetryableStripeCodes.includes(stripeCode)) {
      return false
    }

    if (errorCode && nonRetryableErrorCodes.includes(errorCode)) {
      return false
    }

    // Rate limited errors are retryable after a delay
    if (stripeCode === 'rate_limit' || errorCode === 'STRIPE_RATE_LIMIT') {
      return true
    }

    // API and connection errors are retryable
    if (stripeCode?.includes('api_') || errorCode?.includes('API') || errorCode?.includes('CONNECTION')) {
      return true
    }

    return false
  }

  /**
   * Determine if generic error is retryable
   */
  private static isGenericErrorRetryable(errorCode?: string): boolean {
    const retryableCodes = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'SERVER_ERROR',
      'API_ERROR',
      'CONNECTION_ERROR'
    ]

    const nonRetryableCodes = [
      'VALIDATION_ERROR',
      'AUTH_ERROR',
      'CONFIG_ERROR',
      'NOT_FOUND_ERROR'
    ]

    if (errorCode && nonRetryableCodes.includes(errorCode)) {
      return false
    }

    if (errorCode && retryableCodes.includes(errorCode)) {
      return true
    }

    // Default to retryable for server errors (5xx)
    return true
  }

  /**
   * Generate support email content with enhanced debugging information
   */
  static generateSupportEmail(error: StripeErrorInfo | ErrorInfo, context?: {
    plan?: string
    requestPayload?: any
    responseData?: any
    userAgent?: string
  }) {
    const subject = `Payment Error - ${error.type === 'payment' ? 'Checkout Failed' : 'API Error'}`
    
    let body = `Hello DirectoryBolt Support,

I encountered an error while using your service:

ERROR DETAILS:
- Error Type: ${error.type}
- Message: ${error.message}
- Request ID: ${(error as any).requestId || 'N/A'}
- Timestamp: ${new Date().toISOString()}`

    if (error.type === 'payment' && 'stripeCode' in error) {
      body += `
- Stripe Code: ${error.stripeCode || 'N/A'}
- Stripe Type: ${error.stripeType || 'N/A'}`
    }

    if (context?.plan) {
      body += `
- Plan: ${context.plan}`
    }

    if (error.details?.statusCode) {
      body += `
- Status Code: ${error.details.statusCode}`
    }

    if ('configurationErrors' in error && error.configurationErrors?.length) {
      body += `

CONFIGURATION ISSUES:
${error.configurationErrors.map(err => `- ${err}`).join('\n')}`
    }

    if ('environmentIssues' in error && error.environmentIssues?.length) {
      body += `

ENVIRONMENT ISSUES:
${error.environmentIssues.map(issue => `- ${issue}`).join('\n')}`
    }

    if (context?.requestPayload) {
      body += `

REQUEST DATA:
${JSON.stringify(context.requestPayload, null, 2)}`
    }

    body += `

USER ENVIRONMENT:
- User Agent: ${context?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown')}
- URL: ${typeof window !== 'undefined' ? window.location.href : 'Unknown'}
- Timestamp: ${new Date().toISOString()}

Please help me resolve this issue.

Thank you!`

    return { subject, body }
  }
}

// Export convenience functions
export const parseApiError = EnhancedErrorParser.parseApiError.bind(EnhancedErrorParser)
export const generateSupportEmail = EnhancedErrorParser.generateSupportEmail.bind(EnhancedErrorParser)