'use client'
import { useEffect, useState } from 'react'

interface LoadingStateProps {
  message?: string
  submessage?: string
  progress?: number
  steps?: string[]
  currentStep?: number
  showProgress?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'spinner' | 'dots' | 'bars' | 'pulse'
  className?: string
  estimatedTime?: number
  compact?: boolean
}

export function LoadingState({
  message = 'Loading...',
  submessage,
  progress,
  steps = [],
  currentStep = 0,
  showProgress = false,
  size = 'md',
  variant = 'spinner',
  className = '',
  estimatedTime,
  compact = false
}: LoadingStateProps) {
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(estimatedTime || null)

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1)
      if (estimatedTime && estimatedTimeRemaining) {
        setEstimatedTimeRemaining(prev => prev ? Math.max(0, prev - 1) : null)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [estimatedTime, estimatedTimeRemaining])

  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'text-sm'
      case 'md': return 'text-base'
      case 'lg': return 'text-lg'
      case 'xl': return 'text-xl'
      default: return 'text-base'
    }
  }

  const getSpinnerSize = () => {
    switch (size) {
      case 'sm': return 'h-4 w-4'
      case 'md': return 'h-6 w-6'
      case 'lg': return 'h-8 w-8'
      case 'xl': return 'h-12 w-12'
      default: return 'h-6 w-6'
    }
  }

  const renderLoadingIndicator = () => {
    switch (variant) {
      case 'spinner':
        return (
          <div className={`animate-spin rounded-full border-2 border-volt-500 border-t-transparent ${getSpinnerSize()}`}></div>
        )
      
      case 'dots':
        return (
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-volt-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-volt-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-volt-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        )
      
      case 'bars':
        return (
          <div className="flex space-x-1">
            <div className="w-1 h-8 bg-volt-500 rounded animate-pulse" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1 h-6 bg-volt-500 rounded animate-pulse" style={{ animationDelay: '100ms' }}></div>
            <div className="w-1 h-10 bg-volt-500 rounded animate-pulse" style={{ animationDelay: '200ms' }}></div>
            <div className="w-1 h-4 bg-volt-500 rounded animate-pulse" style={{ animationDelay: '300ms' }}></div>
            <div className="w-1 h-8 bg-volt-500 rounded animate-pulse" style={{ animationDelay: '400ms' }}></div>
          </div>
        )
      
      case 'pulse':
        return (
          <div className={`bg-volt-500 rounded-full animate-pulse ${getSpinnerSize()}`}></div>
        )
      
      default:
        return (
          <div className={`animate-spin rounded-full border-2 border-volt-500 border-t-transparent ${getSpinnerSize()}`}></div>
        )
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {renderLoadingIndicator()}
        <span className={`text-secondary-300 ${getSizeClasses()}`}>{message}</span>
        {progress !== undefined && (
          <span className="text-volt-400 font-bold text-sm">
            {Math.round(progress)}%
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center justify-center space-y-6 p-8 ${className}`}>
      {/* Loading Indicator */}
      <div className="flex flex-col items-center space-y-4">
        {renderLoadingIndicator()}
        
        {/* Main Message */}
        <h3 className={`font-bold text-white text-center ${getSizeClasses()}`}>
          {message}
        </h3>
        
        {/* Submessage */}
        {submessage && (
          <p className="text-secondary-400 text-center text-sm max-w-md">
            {submessage}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      {showProgress && progress !== undefined && (
        <div className="w-full max-w-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-secondary-400">Progress</span>
            <span className="text-sm font-bold text-volt-400">{Math.round(progress)}%</span>
          </div>
          <div className="bg-secondary-700 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-volt-500 to-volt-600 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Step Indicator */}
      {steps.length > 0 && (
        <div className="w-full max-w-md">
          <div className="space-y-2">
            {steps.map((step, index) => {
              const isCompleted = index < currentStep
              const isCurrent = index === currentStep
              const isPending = index > currentStep
              
              return (
                <div key={index} className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-300 ${
                  isCurrent ? 'bg-volt-500/20 border border-volt-500/30' : ''
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-success-500 text-white' 
                      : isCurrent 
                        ? 'bg-volt-500 text-secondary-900 animate-pulse' 
                        : 'bg-secondary-600 text-secondary-400'
                  }`}>
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  <span className={`text-sm transition-all duration-300 ${
                    isCompleted 
                      ? 'text-success-400 line-through opacity-75' 
                      : isCurrent 
                        ? 'text-volt-400 font-medium' 
                        : 'text-secondary-400'
                  }`}>
                    {step}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Time Information */}
      {(estimatedTime || timeElapsed > 10) && (
        <div className="text-center space-y-1">
          {timeElapsed > 0 && (
            <p className="text-xs text-secondary-400">
              Time elapsed: {formatTime(timeElapsed)}
            </p>
          )}
          {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
            <p className="text-xs text-volt-400">
              Estimated time remaining: {formatTime(estimatedTimeRemaining)}
            </p>
          )}
          {timeElapsed > 30 && !estimatedTimeRemaining && (
            <p className="text-xs text-secondary-500">
              Taking longer than usual... Please wait
            </p>
          )}
        </div>
      )}

      {/* Tips for Long Operations */}
      {timeElapsed > 45 && (
        <div className="bg-secondary-800/50 border border-secondary-600/30 rounded-lg p-4 max-w-md">
          <div className="flex items-start gap-3">
            <span className="text-lg">💡</span>
            <div>
              <h4 className="text-sm font-bold text-secondary-300 mb-1">
                Taking a while?
              </h4>
              <p className="text-xs text-secondary-400">
                Complex websites can take up to 2 minutes to analyze. 
                We're checking hundreds of directories to give you the most accurate results.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LoadingState