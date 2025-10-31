'use client'
import { useState } from 'react'

export interface ErrorInfo {
  type?: 'timeout' | 'network' | 'ssl' | 'dns' | 'server' | 'validation' | 'payment' | 'rate_limit' | 'unknown'
  code?: string
  message: string
  details?: {
    statusCode?: number
    retryAfter?: number
    supportId?: string
    url?: string
    timeout?: number
  }
  recoverable?: boolean
  retryable?: boolean
}

interface ErrorDisplayProps {
  error: ErrorInfo | string
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  compact?: boolean
  showSupportContact?: boolean
}

export function ErrorDisplay({ 
  error, 
  onRetry, 
  onDismiss, 
  className = '', 
  compact = false,
  showSupportContact = true 
}: ErrorDisplayProps) {
  const [isRetrying, setIsRetrying] = useState(false)

  // Normalize error to ErrorInfo object
  const errorInfo: ErrorInfo = typeof error === 'string' 
    ? { message: error, type: 'unknown' } 
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

  const getErrorIcon = () => {
    switch (errorInfo.type) {
      case 'timeout': return '⏰'
      case 'network': return '🌐'
      case 'ssl': return '🔒'
      case 'dns': return '🌐'
      case 'server': return '🚨'
      case 'validation': return '⚠️'
      case 'payment': return '💳'
      case 'rate_limit': return '⏳'
      default: return '❌'
    }
  }

  const getErrorTitle = () => {
    switch (errorInfo.type) {
      case 'timeout': return 'Request Timeout'
      case 'network': return 'Network Error'
      case 'ssl': return 'Security Certificate Issue'
      case 'dns': return 'Website Not Found'
      case 'server': return 'Server Error'
      case 'validation': return 'Invalid Input'
      case 'payment': return 'Payment Error'
      case 'rate_limit': return 'Rate Limit Exceeded'
      default: return 'Error'
    }
  }

  const getUserFriendlyMessage = () => {
    const baseMessage = errorInfo.message
    
    // Add helpful context based on error type
    switch (errorInfo.type) {
      case 'timeout':
        return `${baseMessage} The website may be slow or temporarily unavailable. Please try again in a few moments.`
      case 'network':
        return `${baseMessage} Please check your internet connection and try again.`
      case 'ssl':
        return `${baseMessage} The website may have security configuration issues.`
      case 'dns':
        return `${baseMessage} Please verify the website URL is correct.`
      case 'server':
        return `${baseMessage} This is usually temporary. Please try again in a few minutes.`
      case 'payment':
        return `${baseMessage} Please verify your payment information or try a different payment method.`
      case 'rate_limit':
        const retryAfter = errorInfo.details?.retryAfter
        return `${baseMessage}${retryAfter ? ` Please wait ${Math.ceil(retryAfter / 60000)} minutes before trying again.` : ''}`
      default:
        return baseMessage
    }
  }

  const shouldShowRetry = () => {
    return errorInfo.retryable !== false && onRetry && ['timeout', 'network', 'server'].includes(errorInfo.type || '')
  }

  const getRetryText = () => {
    switch (errorInfo.type) {
      case 'timeout': return 'Try Again'
      case 'network': return 'Retry Connection'
      case 'server': return 'Retry Request'
      default: return 'Retry'
    }
  }

  if (compact) {
    return (
      <div className={`bg-danger-900/20 border border-danger-500/30 p-3 rounded-lg flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{getErrorIcon()}</span>
          <span className="text-sm text-danger-300">{errorInfo.message}</span>
        </div>
        <div className="flex items-center gap-2">
          {shouldShowRetry() && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="text-xs px-3 py-1 bg-volt-500 hover:bg-volt-400 text-secondary-900 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRetrying ? 'Retrying...' : 'Retry'}
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-secondary-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-br from-danger-900/30 to-danger-800/20 border border-danger-500/30 rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          <div className="text-4xl">{getErrorIcon()}</div>
          <div>
            <h3 className="text-xl font-bold text-danger-400 mb-1">
              {getErrorTitle()}
            </h3>
            <p className="text-danger-300 text-sm opacity-80">
              {errorInfo.code && `Error Code: ${errorInfo.code}`}
            </p>
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

      {/* Message */}
      <div className="mb-6">
        <p className="text-secondary-200 leading-relaxed">
          {getUserFriendlyMessage()}
        </p>
        
        {/* Additional Details */}
        {errorInfo.details && (
          <div className="mt-3 p-3 bg-secondary-800/50 rounded border border-secondary-600/30">
            <details className="text-sm text-secondary-400">
              <summary className="cursor-pointer font-medium mb-2 hover:text-secondary-300">
                Technical Details
              </summary>
              <div className="space-y-1 font-mono text-xs">
                {errorInfo.details.statusCode && (
                  <div>Status Code: {errorInfo.details.statusCode}</div>
                )}
                {errorInfo.details.timeout && (
                  <div>Timeout: {errorInfo.details.timeout}ms</div>
                )}
                {errorInfo.details.url && (
                  <div>URL: {errorInfo.details.url}</div>
                )}
                {errorInfo.details.supportId && (
                  <div>Support ID: {errorInfo.details.supportId}</div>
                )}
              </div>
            </details>
          </div>
        )}
      </div>

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
                Retrying...
              </div>
            ) : (
              `🔄 ${getRetryText()}`
            )}
          </button>
        )}
        
        {showSupportContact && (
          <button
            onClick={() => {
              const subject = `Support Request - ${getErrorTitle()}`
              const body = `Hi DirectoryBolt Support,

I encountered an error while using your service:

Error Type: ${errorInfo.type || 'Unknown'}
Error Message: ${errorInfo.message}
${errorInfo.code ? `Error Code: ${errorInfo.code}` : ''}
${errorInfo.details?.supportId ? `Support ID: ${errorInfo.details.supportId}` : ''}

Please help me resolve this issue.

Thanks!`
              
              window.open(`mailto:support@directorybolt.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
            }}
            className="px-4 py-3 border-2 border-volt-500 text-volt-500 font-bold rounded-lg hover:bg-volt-500 hover:text-secondary-900 transition-all duration-300 transform hover:scale-105"
          >
            📧 Contact Support
          </button>
        )}
      </div>

      {/* Rate Limit Special Case */}
      {errorInfo.type === 'rate_limit' && errorInfo.details?.retryAfter && (
        <div className="mt-4 p-3 bg-warning-900/30 border border-warning-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-warning-300">
            <span>⏳</span>
            <span className="text-sm">
              You can try again in {Math.ceil(errorInfo.details.retryAfter / 60000)} minutes.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ErrorDisplay