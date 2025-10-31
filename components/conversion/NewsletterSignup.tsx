import React, { useState, useEffect } from 'react'
import { Mail, CheckCircle, ArrowRight, Users, TrendingUp, Clock, Gift, Star } from 'lucide-react'
import { trackCustomEvent, trackConversionFunnel } from '../analytics/ConversionTracker'

interface NewsletterSignupProps {
  variant?: 'inline' | 'sidebar' | 'footer' | 'modal' | 'sticky'
  style?: 'minimal' | 'featured' | 'premium'
  title?: string
  subtitle?: string
  incentive?: string
  context?: string
  showBenefits?: boolean
  showSocialProof?: boolean
  showPreview?: boolean
  position?: 'top' | 'middle' | 'bottom'
}

interface NewsletterBenefit {
  icon: React.ReactNode
  title: string
  description: string
}

interface SocialProofItem {
  metric: string
  label: string
  icon: React.ReactNode
}

export function NewsletterSignup({
  variant = 'inline',
  style = 'featured',
  title = 'Get Weekly Directory Marketing Tips',
  subtitle = 'Join 2,000+ business owners growing their online presence',
  incentive = 'Plus: Get our free Directory ROI Calculator',
  context = 'guide',
  showBenefits = true,
  showSocialProof = true,
  showPreview = false,
  position = 'middle'
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [showFullForm, setShowFullForm] = useState(false)

  // Track component view
  useEffect(() => {
    trackCustomEvent('newsletter_signup_viewed', {
      variant,
      style,
      context,
      position,
      show_benefits: showBenefits
    })
  }, [variant, style, context, position, showBenefits])

  const benefits: NewsletterBenefit[] = [
    {
      icon: <TrendingUp size={16} className="text-volt-400" />,
      title: 'Weekly Growth Tips',
      description: 'Actionable strategies to increase your local visibility'
    },
    {
      icon: <Star size={16} className="text-volt-400" />,
      title: 'Directory Spotlights',
      description: 'Featured directories that could boost your business'
    },
    {
      icon: <Users size={16} className="text-blue-400" />,
      title: 'Case Studies',
      description: 'Real results from businesses like yours'
    },
    {
      icon: <Gift size={16} className="text-success-400" />,
      title: 'Exclusive Tools',
      description: 'Free resources only for newsletter subscribers'
    }
  ]

  const socialProof: SocialProofItem[] = [
    {
      metric: '2,000+',
      label: 'Subscribers',
      icon: <Users size={16} />
    },
    {
      metric: '4.9/5',
      label: 'Rating',
      icon: <Star size={16} />
    },
    {
      metric: '23%',
      label: 'Avg Growth',
      icon: <TrendingUp size={16} />
    }
  ]

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          source: `newsletter_${variant}`,
          context,
          variant,
          style,
          position
        })
      })

      if (response.ok) {
        setIsSubmitted(true)
        trackConversionFunnel('newsletter_subscription_success', {
          variant,
          style,
          context,
          position
        })

        // Auto-reset after 5 seconds for inline variants
        if (variant === 'inline' || variant === 'sidebar') {
          setTimeout(() => {
            setIsSubmitted(false)
            setEmail('')
          }, 5000)
        }
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to subscribe. Please try again.')
        trackCustomEvent('newsletter_subscription_error', {
          variant,
          context,
          error: errorData.message
        })
      }
    } catch (error) {
      setError('Network error. Please try again.')
      trackCustomEvent('newsletter_subscription_error', {
        variant,
        context,
        error: 'network_error'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getContainerClasses = () => {
    const baseClasses = "rounded-xl border transition-all duration-300"
    
    const variants = {
      inline: "w-full max-w-2xl mx-auto",
      sidebar: "w-full",
      footer: "w-full max-w-md",
      modal: "w-full max-w-md mx-auto",
      sticky: "fixed bottom-4 right-4 w-80 z-40 shadow-2xl"
    }

    const styles = {
      minimal: "bg-secondary-800/30 border-secondary-700 p-4",
      featured: "bg-gradient-to-br from-secondary-800 to-secondary-900 border-secondary-700 p-6",
      premium: "bg-gradient-to-br from-volt-500/5 to-volt-400/5 border-volt-500/30 p-8 shadow-xl shadow-volt-500/5"
    }

    return `${baseClasses} ${variants[variant]} ${styles[style]}`
  }

  const getInputClasses = () => {
    const baseClasses = "flex-1 px-4 py-3 bg-secondary-700 border rounded-lg text-white placeholder-secondary-400 focus:outline-none focus:ring-2 transition-colors"
    
    if (error) {
      return `${baseClasses} border-danger-500 focus:ring-danger-500/50`
    }
    
    return `${baseClasses} border-secondary-600 focus:border-volt-500 focus:ring-volt-500/50`
  }

  if (isSubmitted && (variant === 'modal' || variant === 'sticky')) {
    return (
      <div className={getContainerClasses()}>
        <div className="text-center">
          <CheckCircle className="mx-auto text-success-400 mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2">
            Welcome to the Newsletter!
          </h3>
          <p className="text-secondary-300 mb-4">
            Check your email for a confirmation link and your free Directory ROI Calculator.
          </p>
          <div className="bg-volt-500/10 border border-volt-500/30 rounded-lg p-3">
            <p className="text-sm text-volt-400">
              <strong>Pro Tip:</strong> Add us to your contacts so you never miss our weekly tips!
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={getContainerClasses()}>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-volt-500/20 rounded-full mb-4">
          <Mail className="text-volt-400" size={24} />
        </div>
        <h3 className={`font-bold text-white mb-2 ${
          style === 'premium' ? 'text-2xl' : 'text-xl'
        }`}>
          {title}
        </h3>
        <p className="text-secondary-300">
          {subtitle}
        </p>
        {incentive && (
          <div className="mt-3 inline-flex items-center px-3 py-1 bg-success-500/20 text-success-400 rounded-full text-sm font-medium">
            <Gift size={14} className="mr-1" />
            {incentive}
          </div>
        )}
      </div>

      {/* Social Proof */}
      {showSocialProof && (
        <div className="flex justify-center space-x-6 mb-6">
          {socialProof.map((item, index) => (
            <div key={index} className="text-center">
              <div className="flex items-center justify-center text-volt-400 mb-1">
                {item.icon}
              </div>
              <div className="text-white font-bold text-sm">{item.metric}</div>
              <div className="text-secondary-400 text-xs">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className={`flex gap-3 ${variant === 'sidebar' ? 'flex-col' : 'flex-row'}`}>
          <input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={getInputClasses()}
            required
          />
          <button
            type="submit"
            disabled={isSubmitting || !validateEmail(email)}
            className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-6 py-3 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center whitespace-nowrap"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-secondary-900 border-t-transparent mr-2" />
                Subscribing...
              </>
            ) : (
              <>
                Subscribe
                <ArrowRight size={16} className="ml-2" />
              </>
            )}
          </button>
        </div>
        
        {error && (
          <p className="text-danger-400 text-sm mt-2 flex items-center">
            <CheckCircle size={14} className="mr-1" />
            {error}
          </p>
        )}

        {isSubmitted && variant === 'inline' && (
          <div className="mt-3 flex items-center text-success-400 text-sm">
            <CheckCircle size={14} className="mr-2" />
            Success! Check your email for confirmation.
          </div>
        )}
      </form>

      {/* Benefits */}
      {showBenefits && (
        <div className="space-y-3 mb-6">
          <h4 className="text-sm font-semibold text-white">What you'll get:</h4>
          <div className="grid grid-cols-1 gap-3">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="mt-0.5">
                  {benefit.icon}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{benefit.title}</div>
                  <div className="text-xs text-secondary-400">{benefit.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Link */}
      {showPreview && (
        <div className="text-center mb-4">
          <button
            onClick={() => {
              trackCustomEvent('newsletter_preview_clicked', { variant, context })
            }}
            className="text-volt-400 hover:text-volt-300 text-sm underline"
          >
            See a sample newsletter
          </button>
        </div>
      )}

      {/* Trust Indicators */}
      <div className="text-center text-xs text-secondary-400 space-y-1">
        <div className="flex items-center justify-center space-x-4">
          <span className="flex items-center">
            <CheckCircle size={10} className="mr-1 text-success-400" />
            Weekly delivery
          </span>
          <span className="flex items-center">
            <CheckCircle size={10} className="mr-1 text-success-400" />
            No spam
          </span>
          <span className="flex items-center">
            <CheckCircle size={10} className="mr-1 text-success-400" />
            Unsubscribe anytime
          </span>
        </div>
        <p>We respect your privacy and never share your email.</p>
      </div>
    </div>
  )
}

// Floating Newsletter Widget
export function FloatingNewsletterWidget() {
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 10000) // Show after 10 seconds

    return () => clearTimeout(timer)
  }, [])

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
    if (!isExpanded) {
      trackCustomEvent('floating_newsletter_expanded', {
        context: 'floating_widget'
      })
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {isExpanded ? (
        <div className="bg-gradient-to-br from-secondary-800 to-secondary-900 rounded-xl border border-secondary-700 p-4 w-80 shadow-2xl">
          <div className="flex justify-between items-start mb-4">
            <h4 className="text-white font-semibold">Quick Newsletter Signup</h4>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-secondary-400 hover:text-white"
            >
              ×
            </button>
          </div>
          <NewsletterSignup
            variant="modal"
            style="minimal"
            title="Stay Updated"
            subtitle="Get weekly directory tips"
            showBenefits={false}
            showSocialProof={false}
            context="floating_widget"
          />
        </div>
      ) : (
        <button
          onClick={handleToggle}
          className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-4 py-3 rounded-full shadow-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 flex items-center space-x-2"
        >
          <Mail size={18} />
          <span>Get Tips</span>
        </button>
      )}
    </div>
  )
}

// Newsletter Banner
export function NewsletterBanner({ 
  onClose, 
  context = 'banner' 
}: { 
  onClose?: () => void
  context?: string 
}) {
  return (
    <div className="bg-gradient-to-r from-volt-500/10 to-volt-400/10 border-y border-volt-500/30 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-volt-500/20 rounded-full p-2">
              <Mail className="text-volt-400" size={20} />
            </div>
            <div>
              <h4 className="text-white font-semibold">
                Get Weekly Directory Marketing Tips
              </h4>
              <p className="text-secondary-300 text-sm">
                Join 2,000+ businesses growing their online presence
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <form className="flex space-x-2">
              <input
                type="email"
                placeholder="your@email.com"
                className="px-3 py-2 bg-secondary-700 border border-secondary-600 rounded text-white placeholder-secondary-400 focus:outline-none focus:border-volt-500 w-48"
              />
              <button
                type="submit"
                className="bg-volt-500 text-secondary-900 font-semibold px-4 py-2 rounded hover:bg-volt-400 transition-colors"
              >
                Subscribe
              </button>
            </form>
            
            {onClose && (
              <button
                onClick={onClose}
                className="text-secondary-400 hover:text-white ml-2"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook for managing newsletter popup timing
export function useNewsletterPopup(
  delay: number = 30000,
  scrollThreshold: number = 50
) {
  const [shouldShow, setShouldShow] = useState(false)
  const [hasShown, setHasShown] = useState(false)

  useEffect(() => {
    if (hasShown) return

    // Time-based trigger
    const timer = setTimeout(() => {
      setShouldShow(true)
    }, delay)

    // Scroll-based trigger
    const handleScroll = () => {
      const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      if (scrollPercent >= scrollThreshold && !hasShown) {
        setShouldShow(true)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [delay, scrollThreshold, hasShown])

  const markAsShown = () => {
    setHasShown(true)
    setShouldShow(false)
  }

  return { shouldShow, markAsShown }
}