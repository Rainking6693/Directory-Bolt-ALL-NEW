'use client'
import { useState, useEffect } from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'volt' | 'secondary' | 'white' | 'success' | 'danger' | 'warning'
  className?: string
}

export function LoadingSpinner({
  size = 'md',
  color = 'volt',
  className = ''
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  const colorClasses = {
    volt: 'border-volt-500 border-t-transparent',
    secondary: 'border-secondary-400 border-t-transparent',
    white: 'border-white border-t-transparent',
    success: 'border-success-500 border-t-transparent',
    danger: 'border-danger-500 border-t-transparent',
    warning: 'border-warning-500 border-t-transparent'
  }

  return (
    <div 
      className={`animate-spin rounded-full border-2 ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

interface LoadingDotsProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'volt' | 'secondary' | 'white' | 'success' | 'danger' | 'warning'
  className?: string
}

export function LoadingDots({
  size = 'md',
  color = 'volt',
  className = ''
}: LoadingDotsProps) {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  }

  const colorClasses = {
    volt: 'bg-volt-500',
    secondary: 'bg-secondary-400',
    white: 'bg-white',
    success: 'bg-success-500',
    danger: 'bg-danger-500',
    warning: 'bg-warning-500'
  }

  return (
    <div className={`flex space-x-1 ${className}`}>
      <div 
        className={`rounded-full ${sizeClasses[size]} ${colorClasses[color]} animate-bounce`}
        style={{ animationDelay: '0ms' }}
      ></div>
      <div 
        className={`rounded-full ${sizeClasses[size]} ${colorClasses[color]} animate-bounce`}
        style={{ animationDelay: '150ms' }}
      ></div>
      <div 
        className={`rounded-full ${sizeClasses[size]} ${colorClasses[color]} animate-bounce`}
        style={{ animationDelay: '300ms' }}
      ></div>
    </div>
  )
}

interface LoadingBarProps {
  progress?: number
  indeterminate?: boolean
  color?: 'volt' | 'secondary' | 'success' | 'danger' | 'warning'
  height?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingBar({
  progress = 0,
  indeterminate = false,
  color = 'volt',
  height = 'sm',
  className = ''
}: LoadingBarProps) {
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  }

  const colorClasses = {
    volt: 'bg-volt-500',
    secondary: 'bg-secondary-400',
    success: 'bg-success-500',
    danger: 'bg-danger-500',
    warning: 'bg-warning-500'
  }

  const backgroundColorClasses = {
    volt: 'bg-volt-900/30',
    secondary: 'bg-secondary-600',
    success: 'bg-success-900/30',
    danger: 'bg-danger-900/30',
    warning: 'bg-warning-900/30'
  }

  return (
    <div className={`w-full ${backgroundColorClasses[color]} rounded-full ${heightClasses[height]} overflow-hidden ${className}`}>
      <div
        className={`${heightClasses[height]} ${colorClasses[color]} rounded-full transition-all duration-300 ${
          indeterminate ? 'animate-pulse' : ''
        }`}
        style={{
          width: indeterminate ? '100%' : `${Math.min(100, Math.max(0, progress))}%`
        }}
      />
    </div>
  )
}

interface LoadingOverlayProps {
  show: boolean
  message?: string
  submessage?: string
  spinner?: boolean
  className?: string
  children?: React.ReactNode
}

export function LoadingOverlay({
  show,
  message = 'Loading...',
  submessage,
  spinner = true,
  className = '',
  children
}: LoadingOverlayProps) {
  if (!show) return null

  return (
    <div className={`fixed inset-0 bg-secondary-900/80 backdrop-blur-sm z-50 flex items-center justify-center ${className}`}>
      <div className="bg-secondary-800 rounded-xl p-8 max-w-md mx-4 text-center border border-secondary-600">
        {spinner && (
          <div className="mb-4 flex justify-center">
            <LoadingSpinner size="lg" color="volt" />
          </div>
        )}
        
        <h3 className="text-lg font-semibold text-white mb-2">{message}</h3>
        
        {submessage && (
          <p className="text-secondary-300 text-sm mb-4">{submessage}</p>
        )}
        
        {children}
      </div>
    </div>
  )
}

interface ProgressStepsProps {
  steps: string[]
  currentStep: number
  completedSteps?: Set<number>
  className?: string
}

export function ProgressSteps({
  steps,
  currentStep,
  completedSteps = new Set(),
  className = ''
}: ProgressStepsProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const isCompleted = completedSteps.has(stepNumber)
        const isCurrent = currentStep === stepNumber
        const isUpcoming = stepNumber > currentStep

        return (
          <div key={index} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all duration-300 ${
              isCompleted
                ? 'bg-success-500 text-white'
                : isCurrent
                ? 'bg-volt-500 text-secondary-900 animate-pulse'
                : 'bg-secondary-600 text-secondary-400'
            }`}>
              {isCompleted ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                stepNumber
              )}
            </div>
            
            <span className={`ml-2 text-sm font-medium ${
              isCurrent ? 'text-volt-400' : isCompleted ? 'text-success-400' : 'text-secondary-400'
            }`}>
              {step}
            </span>
            
            {index < steps.length - 1 && (
              <div className={`mx-4 h-0.5 w-8 transition-colors duration-300 ${
                isCompleted ? 'bg-success-500' : 'bg-secondary-600'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
  animate?: boolean
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  className = '',
  animate = true
}: SkeletonProps) {
  const widthStyle = typeof width === 'number' ? `${width}px` : width
  const heightStyle = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`bg-secondary-700 rounded ${animate ? 'animate-pulse' : ''} ${className}`}
      style={{ width: widthStyle, height: heightStyle }}
    />
  )
}

interface TypingIndicatorProps {
  message?: string
  className?: string
}

export function TypingIndicator({
  message = 'Processing',
  className = ''
}: TypingIndicatorProps) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return ''
        return prev + '.'
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`flex items-center text-secondary-400 ${className}`}>
      <LoadingDots size="sm" color="secondary" className="mr-2" />
      <span className="text-sm">
        {message}{dots}
      </span>
    </div>
  )
}