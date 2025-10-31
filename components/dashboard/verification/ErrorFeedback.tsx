'use client'
import { useState, useEffect } from 'react'

export interface ErrorState {
  type: 'error' | 'warning' | 'success' | 'info'
  title: string
  message: string
  details?: string[]
  action?: {
    label: string
    onClick: () => void
  }
  autoHide?: number // milliseconds
}

interface ErrorFeedbackProps {
  error: ErrorState
  onDismiss: () => void
  className?: string
}

export function ErrorFeedback({ error, onDismiss, className = '' }: ErrorFeedbackProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (error.autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onDismiss, 300) // Wait for animation
      }, error.autoHide)
      return () => clearTimeout(timer)
    }

    return () => {}
  }, [error.autoHide, onDismiss])

  const getStyles = (type: ErrorState['type']) => {
    switch (type) {
      case 'error':
        return {
          icon: '❌',
          background: 'bg-danger-500/10',
          border: 'border-danger-500/30',
          text: 'text-danger-400',
          titleText: 'text-danger-300'
        }
      case 'warning':
        return {
          icon: '⚠️',
          background: 'bg-volt-500/10',
          border: 'border-volt-500/30',
          text: 'text-volt-400',
          titleText: 'text-volt-300'
        }
      case 'success':
        return {
          icon: '✅',
          background: 'bg-success-500/10',
          border: 'border-success-500/30',
          text: 'text-success-400',
          titleText: 'text-success-300'
        }
      case 'info':
        return {
          icon: 'ℹ️',
          background: 'bg-volt-500/10',
          border: 'border-volt-500/30',
          text: 'text-volt-400',
          titleText: 'text-volt-300'
        }
      default:
        return {
          icon: 'ℹ️',
          background: 'bg-secondary-700/30',
          border: 'border-secondary-600',
          text: 'text-secondary-300',
          titleText: 'text-secondary-200'
        }
    }
  }

  const styles = getStyles(error.type)

  if (!isVisible) return null

  return (
    <div
      className={`animate-scale-in ${styles.background} border ${styles.border} rounded-lg p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 mt-0.5">{styles.icon}</span>
        
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold text-sm ${styles.titleText} mb-1`}>
            {error.title}
          </h4>
          <p className={`text-sm ${styles.text} leading-relaxed`}>
            {error.message}
          </p>
          
          {error.details && error.details.length > 0 && (
            <ul className={`mt-2 text-xs ${styles.text} space-y-1`}>
              {error.details.map((detail, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-xs">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          )}
          
          {error.action && (
            <button
              onClick={error.action.onClick}
              className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                error.type === 'error'
                  ? 'bg-danger-500/20 hover:bg-danger-500/30 text-danger-300 border-danger-500/40'
                  : error.type === 'warning'
                  ? 'bg-volt-500/20 hover:bg-volt-500/30 text-volt-300 border-volt-500/40'
                  : error.type === 'success'
                  ? 'bg-success-500/20 hover:bg-success-500/30 text-success-300 border-success-500/40'
                  : 'bg-volt-500/20 hover:bg-volt-500/30 text-volt-300 border-volt-500/40'
              }`}
            >
              {error.action.label}
            </button>
          )}
        </div>
        
        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(onDismiss, 300)
          }}
          className={`flex-shrink-0 p-1 rounded hover:bg-secondary-600/50 transition-colors ${styles.text}`}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// Success feedback component for completed actions
interface SuccessFeedbackProps {
  title: string
  message: string
  onContinue?: () => void
  onViewResults?: () => void
  className?: string
}

export function SuccessFeedback({ 
  title, 
  message, 
  onContinue, 
  onViewResults,
  className = '' 
}: SuccessFeedbackProps) {
  return (
    <div className={`animate-scale-in bg-success-500/10 border border-success-500/30 rounded-lg p-6 text-center ${className}`}>
      <div className="space-y-4">
        <div className="text-4xl mb-3">🎉</div>
        <div>
          <h4 className="text-lg font-bold text-success-300 mb-2">{title}</h4>
          <p className="text-success-400 text-sm leading-relaxed">
            {message}
          </p>
        </div>
        
        {(onContinue || onViewResults) && (
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {onContinue && (
              <button
                onClick={onContinue}
                className="btn-primary flex-1"
              >
                Continue
              </button>
            )}
            {onViewResults && (
              <button
                onClick={onViewResults}
                className="btn-secondary flex-1"
              >
                View Results
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Loading feedback component for async operations
interface LoadingFeedbackProps {
  title: string
  message?: string
  progress?: number
  steps?: string[]
  currentStep?: number
  className?: string
}

export function LoadingFeedback({ 
  title, 
  message, 
  progress, 
  steps, 
  currentStep = 0,
  className = '' 
}: LoadingFeedbackProps) {
  return (
    <div className={`bg-secondary-800/50 border border-secondary-600 rounded-lg p-6 text-center ${className}`}>
      <div className="space-y-4">
        <div className="text-3xl mb-3">
          <div className="inline-block animate-spin">⏳</div>
        </div>
        
        <div>
          <h4 className="text-lg font-bold text-white mb-2">{title}</h4>
          {message && (
            <p className="text-secondary-300 text-sm">
              {message}
            </p>
          )}
        </div>
        
        {progress !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-secondary-400">Progress</span>
              <span className="text-volt-400 font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-secondary-700 rounded-full h-2">
              <div 
                className="bg-volt-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        )}
        
        {steps && steps.length > 0 && (
          <div className="text-left space-y-2">
            <h5 className="text-sm font-medium text-secondary-300">Steps:</h5>
            <ul className="space-y-1">
              {steps.map((step, index) => (
                <li key={index} className={`flex items-center gap-2 text-xs ${
                  index < currentStep 
                    ? 'text-success-400' 
                    : index === currentStep 
                    ? 'text-volt-400' 
                    : 'text-secondary-400'
                }`}>
                  <span>
                    {index < currentStep 
                      ? '✓' 
                      : index === currentStep 
                      ? '⏳' 
                      : '○'
                    }
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default ErrorFeedback