// PRODUCTION ERROR BOUNDARY SYSTEM
// Enhanced error boundaries with logging and fallback UI

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  isolate?: boolean // Isolate errors to prevent app crash
  level?: 'page' | 'section' | 'component'
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
}

export class ProductionErrorBoundary extends Component<Props, State> {
  private retryAttempts = 0
  private maxRetries = 3

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state to trigger error UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component' } = this.props
    
    console.error('🚨 Production Error Boundary caught error:', {
      error: error.message,
      stack: error.stack,
      errorInfo,
      level,
      errorId: this.state.errorId,
      props: this.props,
      retryAttempts: this.retryAttempts
    })

    // Update state with error info
    this.setState({
      errorInfo
    })

    // Call custom error handler
    onError?.(error, errorInfo)

    // Send error to monitoring service
    this.reportError(error, errorInfo, level)

    // Track error metrics
    this.trackErrorMetrics(error, level)
  }

  private async reportError(error: Error, errorInfo: ErrorInfo, level: string) {
    try {
      // Send to error tracking API
      await fetch('/api/analytics/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          errorInfo: {
            componentStack: errorInfo.componentStack
          },
          level,
          errorId: this.state.errorId,
          context: {
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            retryAttempts: this.retryAttempts
          }
        })
      })
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError)
    }
  }

  private trackErrorMetrics(error: Error, level: string) {
    // Track error for analytics
    if (typeof window !== 'undefined' && (window as any).trackFeatureUsage) {
      const errorType = this.categorizeError(error)
      
      // This would integrate with your analytics system
      console.log('📊 Error metrics:', {
        errorType,
        level,
        errorId: this.state.errorId,
        component: this.getComponentName(),
        timestamp: new Date().toISOString()
      })
    }
  }

  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase()
    
    if (message.includes('network') || message.includes('fetch')) return 'network'
    if (message.includes('timeout')) return 'timeout'
    if (message.includes('permission') || message.includes('unauthorized')) return 'permission'
    if (message.includes('not found') || message.includes('404')) return 'not_found'
    if (message.includes('validation') || message.includes('invalid')) return 'validation'
    
    return 'unknown'
  }

  private getComponentName(): string {
    // Try to extract component name from error stack
    const stack = this.state.error?.stack
    if (stack) {
      const match = stack.match(/at (\w+)/)
      return match?.[1] || 'Unknown'
    }
    return 'Unknown'
  }

  private handleRetry = () => {
    if (this.retryAttempts < this.maxRetries) {
      this.retryAttempts++
      console.log(`🔄 Retrying component render (attempt ${this.retryAttempts}/${this.maxRetries})`)
      
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null
      })
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const { fallback, level = 'component', isolate = true } = this.props
      
      // Use custom fallback if provided
      if (fallback) {
        return fallback
      }

      // Default error UI based on level
      return (
        <div className={`error-boundary ${level}-error`}>
          {level === 'page' ? (
            <PageErrorFallback
              error={this.state.error}
              errorId={this.state.errorId}
              retryAttempts={this.retryAttempts}
              maxRetries={this.maxRetries}
              onRetry={this.handleRetry}
              onReload={this.handleReload}
            />
          ) : level === 'section' ? (
            <SectionErrorFallback
              error={this.state.error}
              errorId={this.state.errorId}
              onRetry={this.handleRetry}
              canRetry={this.retryAttempts < this.maxRetries}
            />
          ) : (
            <ComponentErrorFallback
              error={this.state.error}
              errorId={this.state.errorId}
              onRetry={this.handleRetry}
              canRetry={this.retryAttempts < this.maxRetries}
            />
          )}
        </div>
      )
    }

    return this.props.children
  }
}

// Page-level error fallback
function PageErrorFallback({ 
  error, 
  errorId, 
  retryAttempts, 
  maxRetries, 
  onRetry, 
  onReload 
}: {
  error: Error | null
  errorId: string | null
  retryAttempts: number
  maxRetries: number
  onRetry: () => void
  onReload: () => void
}) {
  return (
    <div className="min-h-screen bg-secondary-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-secondary-800 rounded-xl border border-danger-500/30 p-8 text-center">
          <div className="text-6xl mb-4">🚨</div>
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-secondary-300 mb-6">
            We encountered an unexpected error. Our team has been notified and is working on a fix.
          </p>
          
          {process.env.NODE_ENV === 'development' && error && (
            <div className="bg-danger-500/10 border border-danger-500/20 rounded-lg p-4 mb-6 text-left">
              <h3 className="text-danger-400 font-semibold mb-2">Error Details:</h3>
              <p className="text-danger-300 text-sm font-mono">{error.message}</p>
              {errorId && (
                <p className="text-danger-400 text-xs mt-2">Error ID: {errorId}</p>
              )}
            </div>
          )}

          <div className="space-y-3">
            {retryAttempts < maxRetries ? (
              <button
                onClick={onRetry}
                className="w-full bg-volt-500 hover:bg-volt-600 text-secondary-900 font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Try Again ({maxRetries - retryAttempts} attempts remaining)
              </button>
            ) : (
              <button
                onClick={onReload}
                className="w-full bg-volt-500 hover:bg-volt-600 text-secondary-900 font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Reload Page
              </button>
            )}
            
            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-secondary-700 hover:bg-secondary-600 text-white py-3 px-4 rounded-lg transition-colors"
            >
              Go to Homepage
            </button>
          </div>

          {errorId && (
            <p className="text-secondary-500 text-xs mt-6">
              Reference ID: {errorId}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Section-level error fallback
function SectionErrorFallback({ 
  error, 
  errorId, 
  onRetry, 
  canRetry 
}: {
  error: Error | null
  errorId: string | null
  onRetry: () => void
  canRetry: boolean
}) {
  return (
    <div className="bg-secondary-800 border border-danger-500/30 rounded-xl p-6 m-4">
      <div className="text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <h3 className="text-lg font-semibold text-white mb-2">Section Unavailable</h3>
        <p className="text-secondary-300 text-sm mb-4">
          This section encountered an error and couldn't load properly.
        </p>
        
        {canRetry && (
          <button
            onClick={onRetry}
            className="bg-volt-500 hover:bg-volt-600 text-secondary-900 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            Retry Loading
          </button>
        )}

        {process.env.NODE_ENV === 'development' && errorId && (
          <p className="text-secondary-500 text-xs mt-3">ID: {errorId}</p>
        )}
      </div>
    </div>
  )
}

// Component-level error fallback
function ComponentErrorFallback({ 
  error, 
  errorId, 
  onRetry, 
  canRetry 
}: {
  error: Error | null
  errorId: string | null
  onRetry: () => void
  canRetry: boolean
}) {
  return (
    <div className="bg-danger-500/10 border border-danger-500/20 rounded-lg p-4 m-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-danger-400">⚠️</span>
          <span className="text-danger-300 text-sm font-medium">Component Error</span>
        </div>
        
        {canRetry && (
          <button
            onClick={onRetry}
            className="text-danger-400 hover:text-danger-300 text-xs underline"
          >
            Retry
          </button>
        )}
      </div>

      {process.env.NODE_ENV === 'development' && error && (
        <p className="text-danger-400 text-xs mt-2 font-mono">{error.message}</p>
      )}
    </div>
  )
}

// Convenience wrapper components
export const PageErrorBoundary = (props: Omit<Props, 'level'>) => (
  <ProductionErrorBoundary {...props} level="page" />
)

export const SectionErrorBoundary = (props: Omit<Props, 'level'>) => (
  <ProductionErrorBoundary {...props} level="section" />
)

export const ComponentErrorBoundary = (props: Omit<Props, 'level'>) => (
  <ProductionErrorBoundary {...props} level="component" />
)

export default ProductionErrorBoundary