'use client'
import { useState, useEffect, useCallback } from 'react'
import { Transition } from '@headlessui/react'

export interface ToastProps {
  id?: string
  title?: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

export function Toast({
  id,
  title,
  message,
  type = 'info',
  duration = 5000,
  onClose,
  showCloseButton = true,
  className = ''
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => {
      if (onClose) {
        onClose()
      }
    }, 300) // Match transition duration
  }, [onClose])

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose()
      }, duration)

      return () => clearTimeout(timer)
    }

    return () => {}
  }, [duration, handleClose])

  const getToastStyles = () => {
    const baseStyles = 'rounded-lg shadow-lg p-4 max-w-md w-full pointer-events-auto'
    
    const typeStyles = {
      success: 'bg-success-900/90 border border-success-500/30 text-success-100',
      error: 'bg-danger-900/90 border border-danger-500/30 text-danger-100',
      warning: 'bg-warning-900/90 border border-warning-500/30 text-warning-100',
      info: 'bg-secondary-800/90 border border-secondary-600/30 text-secondary-100'
    }
    
    return `${baseStyles} ${typeStyles[type]} ${className}`
  }

  const getIcon = () => {
    const iconProps = "w-5 h-5"
    
    switch (type) {
      case 'success':
        return (
          <svg className={`${iconProps} text-success-400`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      case 'error':
        return (
          <svg className={`${iconProps} text-danger-400`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'warning':
        return (
          <svg className={`${iconProps} text-warning-400`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'info':
      default:
        return (
          <svg className={`${iconProps} text-secondary-400`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  return (
    <Transition
      show={isVisible}
      enter="transform ease-out duration-300 transition"
      enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enterTo="translate-y-0 opacity-100 sm:translate-x-0"
      leave="transition ease-in duration-100"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className={getToastStyles()}>
        <div className="flex">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="ml-3 w-0 flex-1">
            {title && (
              <p className="text-sm font-medium">
                {title}
              </p>
            )}
            <p className={`text-sm ${title ? 'mt-1' : ''}`}>
              {message}
            </p>
          </div>
          {showCloseButton && (
            <div className="ml-4 flex-shrink-0 flex">
              <button
                onClick={handleClose}
                className="inline-flex text-current hover:text-white transition-colors focus:outline-none focus:text-white"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </Transition>
  )
}

// Toast Container Component
export interface ToastContainerProps {
  toasts: ToastProps[]
  onRemoveToast: (id: string) => void
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
  className?: string
}

export function ToastContainer({
  toasts,
  onRemoveToast,
  position = 'top-right',
  className = ''
}: ToastContainerProps) {
  const getPositionStyles = () => {
    switch (position) {
      case 'top-left':
        return 'top-0 left-0'
      case 'top-center':
        return 'top-0 left-1/2 transform -translate-x-1/2'
      case 'top-right':
        return 'top-0 right-0'
      case 'bottom-left':
        return 'bottom-0 left-0'
      case 'bottom-center':
        return 'bottom-0 left-1/2 transform -translate-x-1/2'
      case 'bottom-right':
        return 'bottom-0 right-0'
      default:
        return 'top-0 right-0'
    }
  }

  return (
    <div 
      className={`fixed z-50 pointer-events-none p-6 ${getPositionStyles()} ${className}`}
      aria-live="assertive"
    >
      <div className="space-y-4">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={() => onRemoveToast(toast.id!)}
          />
        ))}
      </div>
    </div>
  )
}

// Hook for managing toasts
export function useToasts() {
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const addToast = (toast: Omit<ToastProps, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { ...toast, id }
    setToasts(prev => [...prev, newToast])
    return id
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  const clearToasts = () => {
    setToasts([])
  }

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts
  }
}