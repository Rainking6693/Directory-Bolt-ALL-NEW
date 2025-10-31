import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console and analytics
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Track error in analytics if available
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false,
        error_boundary: true
      })
    }
    
    this.setState({
      error,
      errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-secondary-800 rounded-xl border border-volt-500/20 p-8 text-center">
            <div className="text-6xl mb-6">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-4">
              Oops! Something went wrong
            </h1>
            <p className="text-secondary-300 mb-6">
              We're sorry, but something unexpected happened. Our team has been notified and is working to fix this issue.
            </p>
            
            <div className="space-y-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-volt-500 text-secondary-900 font-bold py-3 px-6 rounded-lg hover:bg-volt-400 transition-colors"
              >
                Reload Page
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full border-2 border-volt-500 text-volt-500 font-bold py-3 px-6 rounded-lg hover:bg-volt-500 hover:text-secondary-900 transition-colors"
              >
                Go to Homepage
              </button>
            </div>
            
            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-volt-400 cursor-pointer mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="bg-secondary-900 rounded p-4 text-xs text-secondary-300 overflow-auto">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.toString()}
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
            
            <div className="mt-6 text-sm text-secondary-400">
              Need help? Contact us at{' '}
              <a 
                href="mailto:support@directorybolt.com" 
                className="text-volt-400 hover:text-volt-300"
              >
                support@directorybolt.com
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}