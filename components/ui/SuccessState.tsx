'use client'
import { useEffect, useState } from 'react'

interface SuccessStateProps {
  title?: string
  message?: string
  details?: string[]
  icon?: string
  actions?: Array<{
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary' | 'outline'
    icon?: string
  }>
  autoHide?: number
  onClose?: () => void
  className?: string
  showConfetti?: boolean
  compact?: boolean
}

export function SuccessState({
  title = 'Success!',
  message = 'Operation completed successfully',
  details = [],
  icon = '🎉',
  actions = [],
  autoHide,
  onClose,
  className = '',
  showConfetti = false,
  compact = false
}: SuccessStateProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState<number | undefined>(autoHide)

  useEffect(() => {
    if (autoHide && timeRemaining) {
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (!prev) return prev
          const next = prev - 1
          if (next <= 0) {
            onClose?.()
            return undefined
          }
          return next
        })
      }, 1000)

      return () => clearInterval(interval)
    }

    return () => {}
  }, [autoHide, timeRemaining, onClose])

  // Confetti effect
  useEffect(() => {
    if (showConfetti && isVisible) {
      const confettiContainer = document.createElement('div')
      confettiContainer.className = 'fixed inset-0 pointer-events-none z-50'
      document.body.appendChild(confettiContainer)

      // Create confetti particles
      for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div')
        confetti.className = 'absolute animate-bounce'
        confetti.innerHTML = ['🎉', '✨', '🎊', '⭐', '💫'][Math.floor(Math.random() * 5)]
        confetti.style.left = Math.random() * 100 + '%'
        confetti.style.top = '-10px'
        confetti.style.animationDelay = Math.random() * 3 + 's'
        confetti.style.animationDuration = Math.random() * 2 + 2 + 's'
        confetti.style.fontSize = Math.random() * 10 + 15 + 'px'
        confetti.style.opacity = Math.random() * 0.7 + 0.3 + ''
        confettiContainer.appendChild(confetti)

        // Animate falling
        setTimeout(() => {
          confetti.style.transform = `translateY(${window.innerHeight + 100}px) rotate(${Math.random() * 360}deg)`
          confetti.style.transition = `transform ${Math.random() * 2 + 2}s ease-out`
        }, Math.random() * 500)
      }

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(confettiContainer)
      }, 5000)
    }
  }, [showConfetti, isVisible])

  if (!isVisible) return null

  const getButtonClasses = (variant: 'primary' | 'secondary' | 'outline' = 'primary') => {
    const baseClasses = 'px-4 py-2 rounded-lg font-bold transition-all duration-300 transform hover:scale-105'
    
    switch (variant) {
      case 'primary':
        return `${baseClasses} bg-gradient-to-r from-success-500 to-success-600 text-white hover:from-success-400 hover:to-success-500`
      case 'secondary':
        return `${baseClasses} bg-secondary-700 text-white hover:bg-secondary-600`
      case 'outline':
        return `${baseClasses} border-2 border-success-500 text-success-500 hover:bg-success-500 hover:text-white`
      default:
        return `${baseClasses} bg-gradient-to-r from-success-500 to-success-600 text-white hover:from-success-400 hover:to-success-500`
    }
  }

  if (compact) {
    return (
      <div className={`bg-success-900/20 border border-success-500/30 p-3 rounded-lg flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <div>
            <p className="text-success-300 font-medium text-sm">{title}</p>
            {message && (
              <p className="text-success-400/80 text-xs">{message}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {actions.slice(0, 1).map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className={`text-xs px-3 py-1 ${getButtonClasses(action.variant)}`}
            >
              {action.icon} {action.label}
            </button>
          ))}
          {onClose && (
            <button
              onClick={onClose}
              className="text-secondary-400 hover:text-white transition-colors p-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-br from-success-900/30 to-success-800/20 border border-success-500/30 rounded-xl p-8 text-center animate-zoom-in ${className}`}>
      {/* Close Button */}
      {onClose && !autoHide && (
        <div className="flex justify-end mb-4">
          <button
            onClick={onClose}
            className="text-secondary-400 hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Icon */}
      <div className="text-6xl mb-4 animate-bounce">{icon}</div>

      {/* Title */}
      <h2 className="text-2xl md:text-3xl font-bold text-success-400 mb-3 animate-slide-up">
        {title}
      </h2>

      {/* Message */}
      <p className="text-lg text-secondary-200 mb-4 max-w-md mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {message}
      </p>

      {/* Details */}
      {details.length > 0 && (
        <div className="bg-success-900/20 border border-success-600/30 rounded-lg p-4 mb-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <ul className="space-y-2">
            {details.map((detail, index) => (
              <li key={index} className="flex items-center gap-2 text-success-300 text-sm">
                <span className="text-success-400">✓</span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className={getButtonClasses(action.variant)}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Auto-hide countdown */}
      {autoHide && timeRemaining && (
        <div className="mt-4 text-sm text-secondary-400 animate-fade-in">
          Auto-closing in {timeRemaining} seconds...
        </div>
      )}

      {/* Celebration Animation */}
      {showConfetti && (
        <style jsx>{`
          @keyframes celebrate {
            0% { transform: scale(1) rotate(0deg); }
            25% { transform: scale(1.1) rotate(5deg); }
            50% { transform: scale(1) rotate(-5deg); }
            75% { transform: scale(1.05) rotate(3deg); }
            100% { transform: scale(1) rotate(0deg); }
          }
          .animate-celebrate {
            animation: celebrate 0.6s ease-in-out;
          }
        `}</style>
      )}
    </div>
  )
}

export default SuccessState