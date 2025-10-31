import React, { useState, useEffect, useRef } from 'react'
import { X, Download, Mail, Clock, CheckCircle, AlertTriangle, Gift, Zap } from 'lucide-react'
import { trackCustomEvent, trackConversionFunnel } from '../analytics/ConversionTracker'

interface ExitIntentPopupProps {
  isVisible: boolean
  onClose: () => void
  variant?: 'lead-magnet' | 'discount' | 'consultation' | 'newsletter'
  context?: string
  urgency?: 'low' | 'medium' | 'high'
  personalizedOffer?: string
}

interface PopupVariant {
  title: string
  subtitle: string
  offer: string
  ctaText: string
  icon: React.ReactNode
  color: string
  urgencyText?: string
}

export function ExitIntentPopup({
  isVisible,
  onClose,
  variant = 'lead-magnet',
  context = 'guide',
  urgency = 'medium',
  personalizedOffer
}: ExitIntentPopupProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes
  const popupRef = useRef<HTMLDivElement>(null)

  // Track popup view
  useEffect(() => {
    if (isVisible) {
      trackCustomEvent('exit_intent_popup_shown', {
        variant,
        context,
        urgency,
        has_personalized_offer: !!personalizedOffer
      })
    }
  }, [isVisible, variant, context, urgency, personalizedOffer])

  // Timer for urgency
  useEffect(() => {
    if (isVisible && urgency === 'high' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)

      return () => clearInterval(timer)
    }

    return () => {}
  }, [isVisible, urgency, timeLeft])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isVisible])

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }

    if (isVisible) {
      document.addEventListener('mousedown', handleOutsideClick)
    }

    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isVisible])

  const variants: Record<string, PopupVariant> = {
    'lead-magnet': {
      title: 'Wait! Get Your Free Directory Checklist',
      subtitle: 'Before you go, grab our comprehensive directory submission checklist',
      offer: 'Complete checklist of 100+ business directories with submission requirements and tips',
      ctaText: 'Download Free Checklist',
      icon: <Download size={32} className="text-volt-400" />,
      color: 'from-volt-500 to-volt-600',
      urgencyText: 'Limited time offer'
    },
    'discount': {
      title: 'Exclusive 40% Off DirectoryBolt',
      subtitle: 'This offer expires when you leave this page',
      offer: personalizedOffer || '40% off your first 3 months of DirectoryBolt Pro',
      ctaText: 'Claim Your Discount',
      icon: <Gift size={32} className="text-success-400" />,
      color: 'from-success-500 to-success-600',
      urgencyText: 'Offer expires in'
    },
    'consultation': {
      title: 'Free 15-Minute Strategy Call',
      subtitle: 'Get personalized directory recommendations from our experts',
      offer: 'One-on-one consultation to identify the best directories for your business type',
      ctaText: 'Book Free Call',
      icon: <Clock size={32} className="text-blue-400" />,
      color: 'from-blue-500 to-blue-600',
      urgencyText: 'Only 3 spots left today'
    },
    'newsletter': {
      title: 'Stay Updated with Directory Tips',
      subtitle: 'Join 2,000+ business owners getting weekly directory marketing insights',
      offer: 'Weekly newsletter with directory opportunities, SEO tips, and case studies',
      ctaText: 'Subscribe for Free',
      icon: <Mail size={32} className="text-purple-400" />,
      color: 'from-purple-500 to-purple-600'
    }
  }

  const currentVariant = variants[variant]

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateEmail(email)) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/exit-intent/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          variant,
          context,
          personalizedOffer,
          source: 'exit_intent_popup'
        })
      })

      if (response.ok) {
        setIsSubmitted(true)
        trackConversionFunnel('exit_intent_conversion', {
          variant,
          context,
          email_provided: true,
          urgency
        })

        // Auto-close after success
        setTimeout(() => {
          onClose()
        }, 3000)
      } else {
        throw new Error('Failed to submit')
      }
    } catch (error) {
      console.error('Exit intent submission error:', error)
      trackCustomEvent('exit_intent_error', {
        variant,
        context,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    trackCustomEvent('exit_intent_popup_closed', {
      variant,
      context,
      converted: isSubmitted,
      time_shown: Date.now()
    })
    onClose()
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div
        ref={popupRef}
        className="bg-gradient-to-br from-secondary-800 to-secondary-900 rounded-2xl border border-secondary-700 max-w-md w-full mx-4 relative shadow-2xl transform transition-all duration-300 scale-100"
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-secondary-400 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-secondary-800/50 rounded-full mb-4">
              {currentVariant.icon}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {currentVariant.title}
            </h2>
            <p className="text-secondary-300">
              {currentVariant.subtitle}
            </p>
          </div>

          {/* Urgency Timer */}
          {urgency === 'high' && currentVariant.urgencyText && timeLeft > 0 && (
            <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-3 mb-6 text-center">
              <div className="flex items-center justify-center text-danger-400 mb-1">
                <AlertTriangle size={16} className="mr-2" />
                <span className="text-sm font-medium">{currentVariant.urgencyText}</span>
              </div>
              <div className="text-2xl font-bold text-danger-400">
                {formatTime(timeLeft)}
              </div>
            </div>
          )}

          {/* Offer Description */}
          <div className="bg-secondary-800/50 rounded-lg p-4 mb-6">
            <p className="text-secondary-300 text-sm leading-relaxed">
              {currentVariant.offer}
            </p>
          </div>

          {isSubmitted ? (
            /* Success State */
            <div className="text-center">
              <CheckCircle className="mx-auto text-success-400 mb-4" size={48} />
              <h3 className="text-xl font-bold text-white mb-2">
                {variant === 'lead-magnet' ? 'Download Link Sent!' : 
                 variant === 'discount' ? 'Discount Code Sent!' :
                 variant === 'consultation' ? 'Booking Link Sent!' :
                 'Welcome to the Newsletter!'}
              </h3>
              <p className="text-secondary-300 text-sm">
                Check your email for next steps. This window will close automatically.
              </p>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-secondary-700 border border-secondary-600 rounded-lg text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500/50 focus:border-volt-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !validateEmail(email)}
                className={`w-full bg-gradient-to-r ${currentVariant.color} text-white font-bold py-3 px-6 rounded-lg hover:opacity-90 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center`}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    {variant === 'lead-magnet' && <Download size={18} className="mr-2" />}
                    {variant === 'discount' && <Gift size={18} className="mr-2" />}
                    {variant === 'consultation' && <Clock size={18} className="mr-2" />}
                    {variant === 'newsletter' && <Mail size={18} className="mr-2" />}
                    {currentVariant.ctaText}
                  </>
                )}
              </button>
            </form>
          )}

          {/* Trust Indicators */}
          {!isSubmitted && (
            <div className="mt-6 pt-4 border-t border-secondary-700">
              <div className="flex items-center justify-center text-xs text-secondary-400 space-x-4">
                <div className="flex items-center">
                  <CheckCircle size={12} className="mr-1 text-success-400" />
                  No spam, ever
                </div>
                <div className="flex items-center">
                  <CheckCircle size={12} className="mr-1 text-success-400" />
                  Unsubscribe anytime
                </div>
                <div className="flex items-center">
                  <CheckCircle size={12} className="mr-1 text-success-400" />
                  2,000+ subscribers
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Animated Border Effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-volt-500/20 via-transparent to-volt-500/20 pointer-events-none">
          <div className="absolute inset-[1px] bg-gradient-to-br from-secondary-800 to-secondary-900 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

// Hook for detecting exit intent
export function useExitIntent(
  callback: () => void,
  enabled: boolean = true,
  delay: number = 1000
) {
  const [hasTriggered, setHasTriggered] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!enabled || hasTriggered) return

    const handleMouseLeave = (e: MouseEvent) => {
      // Only trigger if mouse is leaving from the top of the viewport
      if (e.clientY <= 0) {
        timeoutRef.current = setTimeout(() => {
          if (!hasTriggered) {
            setHasTriggered(true)
            callback()
            trackCustomEvent('exit_intent_detected', {
              trigger: 'mouse_leave',
              page_url: window.location.href
            })
          }
        }, delay)
      }
    }

    const handleMouseEnter = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }

    // Also detect rapid scrolling to top
    let lastScrollY = window.scrollY
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollDelta = lastScrollY - currentScrollY
      
      // If user scrolls up rapidly when near top of page
      if (currentScrollY < 100 && scrollDelta > 50) {
        if (!hasTriggered) {
          setHasTriggered(true)
          callback()
          trackCustomEvent('exit_intent_detected', {
            trigger: 'rapid_scroll_up',
            page_url: window.location.href
          })
        }
      }
      lastScrollY = currentScrollY
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseenter', handleMouseEnter)
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseenter', handleMouseEnter)
      window.removeEventListener('scroll', handleScroll)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [enabled, hasTriggered, callback, delay])

  const reset = () => setHasTriggered(false)
  
  return { hasTriggered, reset }
}

// Provider component for managing exit intent popups
interface ExitIntentProviderProps {
  children: React.ReactNode
  config?: {
    enabled?: boolean
    delay?: number
    variants?: string[]
    context?: string
  }
}

export function ExitIntentProvider({ 
  children, 
  config = {}
}: ExitIntentProviderProps) {
  const {
    enabled = true,
    delay = 1000,
    variants = ['lead-magnet'],
    context = 'global'
  } = config

  const [showPopup, setShowPopup] = useState(false)
  const [currentVariant, setCurrentVariant] = useState(variants[0])

  const handleExitIntent = () => {
    // A/B test variant selection
    const randomVariant = variants[Math.floor(Math.random() * variants.length)]
    setCurrentVariant(randomVariant)
    setShowPopup(true)

    trackCustomEvent('exit_intent_triggered', {
      variant: randomVariant,
      context,
      page_url: window.location.href
    })
  }

  const { hasTriggered, reset } = useExitIntent(handleExitIntent, enabled, delay)

  const handleClose = () => {
    setShowPopup(false)
  }

  return (
    <>
      {children}
      <ExitIntentPopup
        isVisible={showPopup}
        onClose={handleClose}
        variant={currentVariant as any}
        context={context}
      />
    </>
  )
}