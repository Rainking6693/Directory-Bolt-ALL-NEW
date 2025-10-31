'use client'
import { ReactNode } from 'react'
import { LoadingState } from './LoadingState'
import { ErrorDisplay, ErrorInfo } from './ErrorDisplay'
import { SuccessState } from './SuccessState'

type StatusType = 'loading' | 'error' | 'success' | 'empty' | 'maintenance'

interface StatusPageProps {
  status: StatusType
  title?: string
  message?: string
  submessage?: string
  icon?: string
  loading?: {
    progress?: number
    steps?: string[]
    currentStep?: number
    estimatedTime?: number
    variant?: 'spinner' | 'dots' | 'bars' | 'pulse'
  }
  error?: {
    error: ErrorInfo | string
    onRetry?: () => void
    onDismiss?: () => void
    showSupportContact?: boolean
  }
  success?: {
    details?: string[]
    actions?: Array<{
      label: string
      onClick: () => void
      variant?: 'primary' | 'secondary' | 'outline'
      icon?: string
    }>
    showConfetti?: boolean
  }
  empty?: {
    actions?: Array<{
      label: string
      onClick: () => void
      variant?: 'primary' | 'secondary' | 'outline'
      icon?: string
    }>
    illustration?: ReactNode
  }
  maintenance?: {
    estimatedDowntime?: string
    lastUpdate?: string
    statusPageUrl?: string
  }
  children?: ReactNode
  className?: string
  fullScreen?: boolean
}

export function StatusPage({
  status,
  title,
  message,
  submessage,
  icon,
  loading,
  error,
  success,
  empty,
  maintenance,
  children,
  className = '',
  fullScreen = true
}: StatusPageProps) {
  const containerClasses = fullScreen 
    ? 'min-h-screen flex items-center justify-center px-4 py-8' 
    : 'flex items-center justify-center px-4 py-8'

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <LoadingState
            message={title || 'Loading...'}
            submessage={message || submessage}
            progress={loading?.progress}
            steps={loading?.steps}
            currentStep={loading?.currentStep}
            showProgress={loading?.progress !== undefined}
            variant={loading?.variant}
            estimatedTime={loading?.estimatedTime}
            size="lg"
          />
        )

      case 'error':
        if (!error) return null
        return (
          <div className="max-w-md mx-auto">
            <ErrorDisplay
              error={error.error}
              onRetry={error.onRetry}
              onDismiss={error.onDismiss}
              showSupportContact={error.showSupportContact}
            />
          </div>
        )

      case 'success':
        return (
          <div className="max-w-md mx-auto">
            <SuccessState
              title={title || 'Success!'}
              message={message || 'Operation completed successfully'}
              icon={icon || '🎉'}
              details={success?.details}
              actions={success?.actions}
              showConfetti={success?.showConfetti}
            />
          </div>
        )

      case 'empty':
        return (
          <div className="text-center max-w-md mx-auto">
            <div className="mb-6">
              {empty?.illustration || (
                <div className="text-6xl mb-4">{icon || '📭'}</div>
              )}
              <h2 className="text-2xl font-bold text-secondary-300 mb-3">
                {title || 'Nothing Here Yet'}
              </h2>
              <p className="text-secondary-400 mb-6">
                {message || 'It looks like there\'s no content to display right now.'}
              </p>
              {submessage && (
                <p className="text-sm text-secondary-500 mb-6">
                  {submessage}
                </p>
              )}
            </div>

            {empty?.actions && empty.actions.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {empty.actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 ${
                      action.variant === 'primary'
                        ? 'bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 hover:from-volt-400 hover:to-volt-500'
                        : action.variant === 'outline'
                        ? 'border-2 border-volt-500 text-volt-500 hover:bg-volt-500 hover:text-secondary-900'
                        : 'bg-secondary-700 text-white hover:bg-secondary-600'
                    }`}
                  >
                    {action.icon && <span className="mr-2">{action.icon}</span>}
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )

      case 'maintenance':
        return (
          <div className="text-center max-w-md mx-auto">
            <div className="text-6xl mb-6">🔧</div>
            <h2 className="text-2xl font-bold text-secondary-300 mb-3">
              {title || 'Under Maintenance'}
            </h2>
            <p className="text-secondary-400 mb-6">
              {message || 'We\'re currently performing scheduled maintenance to improve our service.'}
            </p>
            
            {maintenance?.estimatedDowntime && (
              <div className="bg-secondary-800 border border-secondary-600 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary-400">Estimated downtime:</span>
                  <span className="text-volt-400 font-bold">{maintenance.estimatedDowntime}</span>
                </div>
                {maintenance.lastUpdate && (
                  <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-secondary-700">
                    <span className="text-secondary-400">Last update:</span>
                    <span className="text-secondary-300">{maintenance.lastUpdate}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-secondary-700 text-white font-bold rounded-xl hover:bg-secondary-600 transition-all duration-300"
              >
                🔄 Check Again
              </button>
              {maintenance?.statusPageUrl && (
                <button
                  onClick={() => window.open(maintenance.statusPageUrl, '_blank')}
                  className="px-6 py-3 border-2 border-volt-500 text-volt-500 font-bold rounded-xl hover:bg-volt-500 hover:text-secondary-900 transition-all duration-300"
                >
                  📊 Status Page
                </button>
              )}
            </div>

            {submessage && (
              <p className="text-xs text-secondary-500 mt-6">
                {submessage}
              </p>
            )}
          </div>
        )

      default:
        return children
    }
  }

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="w-full max-w-4xl mx-auto">
        {renderContent()}
      </div>
    </div>
  )
}

// Convenience components for common status pages
export function LoadingPage(props: Omit<StatusPageProps, 'status'>) {
  return <StatusPage status="loading" {...props} />
}

export function ErrorPage(props: Omit<StatusPageProps, 'status'> & { error: ErrorInfo | string }) {
  const { error, ...otherProps } = props;
  return (
    <StatusPage 
      status="error" 
      error={error}
      {...otherProps} 
    />
  )
}

export function SuccessPage(props: Omit<StatusPageProps, 'status'>) {
  return <StatusPage status="success" {...props} />
}

export function EmptyPage(props: Omit<StatusPageProps, 'status'>) {
  return <StatusPage status="empty" {...props} />
}

export function MaintenancePage(props: Omit<StatusPageProps, 'status'>) {
  return <StatusPage status="maintenance" {...props} />
}

export default StatusPage