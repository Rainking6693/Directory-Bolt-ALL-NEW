'use client'
import { useState } from 'react'
import { ErrorInfo } from './ErrorDisplay'

export interface StripeErrorInfo extends ErrorInfo {
  requestId?: string
  stripeCode?: string
  stripeType?: string
  developmentMode?: boolean
  configurationErrors?: string[]
  environmentIssues?: string[]
  retryRecommendations?: string[]
  supportContext?: {
    sessionId?: string
    customerId?: string
    plan?: string
    timestamp?: string
    userAgent?: string
  }
}

interface StripeErrorDisplayProps {
  error: StripeErrorInfo | string
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  compact?: boolean
  showDebugInfo?: boolean
  requestPayload?: any
  responseData?: any
}

export function StripeErrorDisplay({ 
  error, 
  onRetry, 
  onDismiss, 
  className = '', 
  compact = false,
  showDebugInfo = false,
  requestPayload,
  responseData
}: StripeErrorDisplayProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [debugExpanded, setDebugExpanded] = useState(false)

  // Normalize error to StripeErrorInfo object
  const errorInfo: StripeErrorInfo = typeof error === 'string' 
    ? { message: error, type: 'payment' } 
    : error

  const handleRetry = async () => {
    if (onRetry && !isRetrying) {
      setIsRetrying(true)
      try {
        await onRetry()
      } finally {
        setIsRetrying(false)
      }
    }
  }

  const getStripeErrorIcon = () => {
    switch (errorInfo.stripeCode) {
      case 'api_key_invalid':
      case 'authentication_required': return '🔐'
      case 'price_not_found':
      case 'resource_missing': return '🔧'
      case 'parameter_invalid_empty':
      case 'parameter_missing': return '⚠️'
      case 'rate_limit': return '⏳'
      case 'customer_creation_failed': return '👤'
      case 'api_connection_error': return '🌐'
      case 'card_declined': return '💳'
      default: return '💰'
    }
  }

  const getStripeErrorTitle = () => {
    switch (errorInfo.stripeCode) {
      case 'api_key_invalid':
      case 'authentication_required': return 'Authentication Error'
      case 'price_not_found':
      case 'resource_missing': return 'Configuration Error'
      case 'parameter_invalid_empty':
      case 'parameter_missing': return 'Invalid Parameters'
      case 'rate_limit': return 'Too Many Requests'
      case 'customer_creation_failed': return 'Customer Setup Failed'
      case 'api_connection_error': return 'Connection Error'
      case 'card_declined': return 'Payment Declined'
      default: return 'Payment Error'
    }
  }

  const getRecoveryInstructions = () => {
    switch (errorInfo.stripeCode) {
      case 'api_key_invalid':
      case 'authentication_required':
        return 'This is a system configuration issue. Please contact support immediately.'
      case 'price_not_found':
      case 'resource_missing':
        return 'The selected plan is not properly configured. Please try a different plan or contact support.'
      case 'parameter_invalid_empty':
      case 'parameter_missing':
        return 'Please refresh the page and try again. If the issue persists, clear your browser cache.'
      case 'rate_limit':
        return 'Please wait 30 seconds before trying again to avoid rate limiting.'
      case 'customer_creation_failed':
        return 'Please verify your email address is correct and try again.'
      case 'api_connection_error':
        return 'Check your internet connection and try again in a few moments.'
      case 'card_declined':
        return 'Please try a different payment method or contact your bank.'
      default:
        return 'Please try again. If the issue persists, contact support.'
    }
  }

  const shouldShowRetry = () => {
    const nonRetryableCodes = ['api_key_invalid', 'authentication_required', 'price_not_found', 'resource_missing']
    return !nonRetryableCodes.includes(errorInfo.stripeCode || '') && onRetry
  }

  const generateSupportEmail = () => {
    const subject = `Payment Error - ${getStripeErrorTitle()}`
    const body = `Hello DirectoryBolt Support,

I encountered a payment error while trying to subscribe:

ERROR DETAILS:
- Error Type: ${errorInfo.type || 'payment'}
- Stripe Code: ${errorInfo.stripeCode || 'N/A'}
- Stripe Type: ${errorInfo.stripeType || 'N/A'}
- Message: ${errorInfo.message}
- Request ID: ${errorInfo.requestId || 'N/A'}
- Timestamp: ${new Date().toISOString()}

${errorInfo.supportContext ? `
CONTEXT:
- Plan: ${errorInfo.supportContext.plan || 'N/A'}
- Session ID: ${errorInfo.supportContext.sessionId || 'N/A'}
- Customer ID: ${errorInfo.supportContext.customerId || 'N/A'}
- User Agent: ${errorInfo.supportContext.userAgent || navigator.userAgent}
` : ''}

${errorInfo.configurationErrors?.length ? `
CONFIGURATION ISSUES:
${errorInfo.configurationErrors.map(err => `- ${err}`).join('\n')}
` : ''}

${errorInfo.environmentIssues?.length ? `
ENVIRONMENT ISSUES:
${errorInfo.environmentIssues.map(issue => `- ${issue}`).join('\n')}
` : ''}

Please help me resolve this issue so I can complete my subscription.

Thank you!`

    return { subject, body }
  }

  if (compact) {
    return (
      <div className={`bg-gradient-to-r from-danger-900/30 to-danger-800/20 border border-danger-500/30 p-4 rounded-xl shadow-lg ${className}`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="text-xl flex-shrink-0 mt-0.5">{getStripeErrorIcon()}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-danger-300 leading-snug mb-1">
                {errorInfo.message}
              </div>
              {errorInfo.stripeCode && (
                <div className="text-xs text-danger-400 bg-danger-900/30 px-2 py-1 rounded">
                  Code: {errorInfo.stripeCode}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:ml-4 justify-end sm:justify-start flex-shrink-0">
            {shouldShowRetry() && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="text-xs px-3 py-2 bg-volt-500 hover:bg-volt-400 active:bg-volt-600 text-secondary-900 rounded-lg font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[32px] touch-manipulation"
              >
                {isRetrying ? '...' : 'Retry'}
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-secondary-400 hover:text-white active:text-danger-300 transition-colors p-2 rounded hover:bg-secondary-800/50 touch-manipulation"
                aria-label="Close error"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-br from-danger-900/30 to-danger-800/20 border border-danger-500/30 rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          <div className="text-4xl">{getStripeErrorIcon()}</div>
          <div>
            <h3 className="text-xl font-bold text-danger-400 mb-1">
              {getStripeErrorTitle()}
            </h3>
            <div className="text-danger-300 text-sm opacity-80 space-y-1">
              {errorInfo.stripeCode && <div>Stripe Code: {errorInfo.stripeCode}</div>}
              {errorInfo.requestId && <div>Request ID: {errorInfo.requestId}</div>}
              {errorInfo.developmentMode && (
                <div className="bg-warning-900/30 px-2 py-1 rounded text-warning-300">
                  Development Mode
                </div>
              )}
            </div>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-secondary-400 hover:text-white transition-colors p-1"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        )}
      </div>

      {/* Error Message */}
      <div className="mb-4">
        <p className="text-secondary-200 leading-relaxed mb-3">
          {errorInfo.message}
        </p>
        
        {/* Recovery Instructions */}
        <div className="bg-info-900/20 border border-info-500/30 p-3 rounded-lg">
          <h4 className="text-info-400 font-medium mb-2">💡 How to Fix This</h4>
          <p className="text-info-300 text-sm">{getRecoveryInstructions()}</p>
        </div>
      </div>

      {/* Configuration Issues */}
      {errorInfo.configurationErrors?.length && (
        <div className="mb-4 bg-warning-900/20 border border-warning-500/30 p-3 rounded-lg">
          <h4 className="text-warning-400 font-medium mb-2">🔧 Configuration Issues</h4>
          <ul className="text-warning-300 text-sm space-y-1">
            {errorInfo.configurationErrors.map((error, index) => (
              <li key={index} className="flex items-start gap-2">
                <span>•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Environment Issues */}
      {errorInfo.environmentIssues?.length && (
        <div className="mb-4 bg-secondary-800/50 border border-secondary-600/30 p-3 rounded-lg">
          <h4 className="text-secondary-300 font-medium mb-2">🌍 Environment Issues</h4>
          <ul className="text-secondary-400 text-sm space-y-1">
            {errorInfo.environmentIssues.map((issue, index) => (
              <li key={index} className="flex items-start gap-2">
                <span>•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Debug Information */}
      {(showDebugInfo || errorInfo.developmentMode) && (
        <div className="mb-4 bg-secondary-800/50 border border-secondary-600/30 rounded-lg">
          <button
            onClick={() => setDebugExpanded(!debugExpanded)}
            className="w-full p-3 text-left flex items-center justify-between text-secondary-300 hover:text-secondary-200"
          >
            <span className="font-medium">🔍 Debug Information</span>
            <span className={`transition-transform ${debugExpanded ? 'rotate-180' : ''}`}>▼</span>
          </button>
          
          {debugExpanded && (
            <div className="px-3 pb-3 space-y-3">
              {requestPayload && (
                <div>
                  <h5 className="text-xs font-medium text-secondary-400 mb-1">Request Payload:</h5>
                  <pre className="text-xs bg-secondary-900/50 p-2 rounded font-mono text-secondary-300 overflow-auto">
                    {JSON.stringify(requestPayload, null, 2)}
                  </pre>
                </div>
              )}
              
              {responseData && (
                <div>
                  <h5 className="text-xs font-medium text-secondary-400 mb-1">Response Data:</h5>
                  <pre className="text-xs bg-secondary-900/50 p-2 rounded font-mono text-secondary-300 overflow-auto">
                    {JSON.stringify(responseData, null, 2)}
                  </pre>
                </div>
              )}
              
              {errorInfo.supportContext && (
                <div>
                  <h5 className="text-xs font-medium text-secondary-400 mb-1">Support Context:</h5>
                  <pre className="text-xs bg-secondary-900/50 p-2 rounded font-mono text-secondary-300 overflow-auto">
                    {JSON.stringify(errorInfo.supportContext, null, 2)}
                  </pre>
                </div>
              )}
              
              <div>
                <h5 className="text-xs font-medium text-secondary-400 mb-1">Error Object:</h5>
                <pre className="text-xs bg-secondary-900/50 p-2 rounded font-mono text-secondary-300 overflow-auto">
                  {JSON.stringify(errorInfo, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Retry Recommendations */}
      {errorInfo.retryRecommendations?.length && (
        <div className="mb-4 bg-volt-900/20 border border-volt-500/30 p-3 rounded-lg">
          <h4 className="text-volt-400 font-medium mb-2">🔄 Retry Recommendations</h4>
          <ul className="text-volt-300 text-sm space-y-1">
            {errorInfo.retryRecommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start gap-2">
                <span>•</span>
                <span>{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {shouldShowRetry() && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
          >
            {isRetrying ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                Retrying Payment...
              </div>
            ) : (
              `🔄 Retry Payment`
            )}
          </button>
        )}
        
        <button
          onClick={() => {
            const { subject, body } = generateSupportEmail()
            window.open(`mailto:support@directorybolt.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
          }}
          className="px-4 py-3 border-2 border-volt-500 text-volt-500 font-bold rounded-lg hover:bg-volt-500 hover:text-secondary-900 transition-all duration-300 transform hover:scale-105"
        >
          📧 Contact Support
        </button>
      </div>

      {/* Rate Limit Special Case */}
      {errorInfo.stripeCode === 'rate_limit' && (
        <div className="mt-4 p-3 bg-warning-900/30 border border-warning-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-warning-300">
            <span>⏳</span>
            <span className="text-sm">
              Please wait 30 seconds before trying again to avoid rate limiting.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default StripeErrorDisplay