'use client'
import { useState, useEffect } from 'react'
import { UpgradeButton } from './CheckoutButton'

const UpgradePrompt = ({
  currentPlan = 'free',
  feature = 'this feature',
  requiredPlan = 'starter',
  variant = 'modal',
  onClose,
  className = '',
  children,
  showBenefits = true,
  showComparison = false
}) => {
  const [isVisible, setIsVisible] = useState(true)
  const [animationClass, setAnimationClass] = useState('animate-slide-up')

  const UPGRADE_MESSAGES = {
    free: {
      starter: {
        title: '🚀 Unlock Starter Features',
        subtitle: 'Get 5x more directory submissions + priority support',
        benefits: [
          '25 premium directory submissions',
          '3 websites included',
          'Email support',
          'Monthly reporting',
          'Success tracking'
        ],
        urgency: 'Start your free trial today!'
      },
      professional: {
        title: '⭐ Go Pro for Maximum Growth',
        subtitle: 'AI-powered optimization + unlimited potential',
        benefits: [
          '100+ premium directory submissions',
          'AI-powered optimization',
          '10 websites included',
          'Priority phone support',
          'Advanced analytics',
          'Competitor analysis'
        ],
        urgency: 'Join 500+ businesses crushing their competition!'
      },
      enterprise: {
        title: '👑 Enterprise Unlimited Power',
        subtitle: 'White-label solution for agencies & large businesses',
        benefits: [
          'Unlimited directory submissions',
          'Unlimited websites',
          'White-label branding',
          'Dedicated account manager',
          'API access',
          'Custom integrations'
        ],
        urgency: 'Scale your business without limits!'
      }
    },
    starter: {
      professional: {
        title: '⭐ Upgrade to Professional',
        subtitle: 'Unlock AI optimization + advanced features',
        benefits: [
          'AI-powered optimization',
          '4x more directory submissions (100+)',
          'Priority phone support',
          'Advanced analytics dashboard',
          'Competitor analysis',
          '7 more websites'
        ],
        urgency: '300-500% ROI typical for Pro users!'
      },
      enterprise: {
        title: '👑 Scale to Enterprise',
        subtitle: 'Unlimited everything + white-label branding',
        benefits: [
          'Unlimited directory submissions',
          'Unlimited websites',
          'White-label branding',
          'Team collaboration',
          'Dedicated account manager',
          'API access'
        ],
        urgency: 'Perfect for agencies serving multiple clients!'
      }
    },
    professional: {
      enterprise: {
        title: '👑 Unlock Enterprise Features',
        subtitle: 'White-label branding + unlimited scale',
        benefits: [
          'Unlimited directory submissions',
          'Unlimited websites',
          'White-label branding',
          'Team collaboration tools',
          'Dedicated account manager',
          'Custom integrations'
        ],
        urgency: 'Ideal for agencies & enterprise clients!'
      }
    }
  }

  const message = UPGRADE_MESSAGES[currentPlan]?.[requiredPlan] || UPGRADE_MESSAGES.free.starter

  const handleClose = () => {
    setAnimationClass('animate-slide-down opacity-0')
    setTimeout(() => {
      setIsVisible(false)
      if (onClose) onClose()
    }, 300)
  }

  const handleUpgrade = () => {
    // Analytics tracking could go here
    console.log(`Upgrade clicked: ${currentPlan} → ${requiredPlan} for ${feature}`)
  }

  if (!isVisible) return null

  // Modal variant
  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className={`bg-gradient-to-br from-secondary-800 to-secondary-900 rounded-2xl border border-secondary-600 p-8 max-w-2xl w-full mx-4 shadow-2xl ${animationClass} ${className}`}>
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 text-secondary-400 hover:text-white rounded-full hover:bg-secondary-700 transition-colors flex items-center justify-center"
          >
            ✕
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black mb-3">
              {message.title}
            </h2>
            <p className="text-lg text-secondary-300">
              {message.subtitle}
            </p>
          </div>

          {/* Feature Context */}
          <div className="bg-volt-500/10 border border-volt-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <h3 className="font-bold text-white mb-1">Feature Locked</h3>
                <p className="text-sm text-secondary-300">
                  You need <strong className="text-volt-400">{requiredPlan}</strong> to use {feature}
                </p>
              </div>
            </div>
          </div>

          {/* Benefits */}
          {showBenefits && (
            <div className="mb-8">
              <h3 className="font-bold text-white mb-4">What you'll get:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {message.benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-success-400">✓</span>
                    <span className="text-sm text-secondary-200">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Urgency */}
          <div className="bg-gradient-to-r from-volt-500/20 to-volt-600/20 rounded-lg p-4 mb-6">
            <p className="text-center text-volt-300 font-semibold">
              ⚡ {message.urgency}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <UpgradeButton
              plan={requiredPlan}
              size="lg"
              className="flex-1"
              onSuccess={handleUpgrade}
            >
              Upgrade to {requiredPlan}
            </UpgradeButton>
            <button
              onClick={handleClose}
              className="flex-1 px-6 py-3 border border-secondary-600 text-secondary-300 font-bold rounded-xl hover:border-secondary-500 hover:text-white transition-all duration-300"
            >
              Maybe Later
            </button>
          </div>

          {/* Guarantee */}
          <div className="text-center mt-4 text-xs text-secondary-400">
            30-day money-back guarantee • Cancel anytime
          </div>
        </div>
      </div>
    )
  }

  // Banner variant
  if (variant === 'banner') {
    return (
      <div className={`bg-gradient-to-r from-volt-500/20 to-volt-600/10 border border-volt-500/30 rounded-lg p-4 mb-6 ${animationClass} ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl">🔒</span>
            <div>
              <h3 className="font-bold text-volt-400 mb-1">{feature} requires {requiredPlan}</h3>
              <p className="text-sm text-secondary-300">{message.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UpgradeButton
              plan={requiredPlan}
              size="sm"
              onSuccess={handleUpgrade}
            >
              Upgrade
            </UpgradeButton>
            {onClose && (
              <button
                onClick={handleClose}
                className="text-secondary-400 hover:text-white p-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Card variant
  if (variant === 'card') {
    return (
      <div className={`bg-gradient-to-br from-secondary-800 to-secondary-900 rounded-xl border border-volt-500/30 p-6 ${animationClass} ${className}`}>
        {/* Feature locked icon */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-volt-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{feature} is locked</h3>
          <p className="text-secondary-300">Upgrade to {requiredPlan} to unlock this feature</p>
        </div>

        {/* Quick benefits */}
        {showBenefits && (
          <div className="mb-6">
            <div className="grid grid-cols-1 gap-2">
              {message.benefits.slice(0, 3).map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-success-400 text-sm">✓</span>
                  <span className="text-sm text-secondary-200">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action */}
        <UpgradeButton
          plan={requiredPlan}
          size="md"
          className="w-full"
          onSuccess={handleUpgrade}
        >
          Upgrade to {requiredPlan}
        </UpgradeButton>

        {onClose && (
          <button
            onClick={handleClose}
            className="w-full mt-3 text-sm text-secondary-400 hover:text-white transition-colors"
          >
            Maybe later
          </button>
        )}
      </div>
    )
  }

  // Inline variant
  if (variant === 'inline') {
    return (
      <div className={`inline-flex items-center gap-3 bg-volt-500/10 border border-volt-500/30 rounded-lg px-4 py-2 ${className}`}>
        <span className="text-volt-400">🔒</span>
        <span className="text-sm text-secondary-300">
          {feature} requires <strong className="text-volt-400">{requiredPlan}</strong>
        </span>
        <UpgradeButton
          plan={requiredPlan}
          size="sm"
          variant="secondary"
          onSuccess={handleUpgrade}
        >
          Upgrade
        </UpgradeButton>
      </div>
    )
  }

  // Custom children variant
  return (
    <div className={`${animationClass} ${className}`}>
      {children || (
        <div className="text-center py-8">
          <h3 className="text-2xl font-bold text-white mb-4">{message.title}</h3>
          <p className="text-secondary-300 mb-6">{message.subtitle}</p>
          <UpgradeButton
            plan={requiredPlan}
            size="lg"
            onSuccess={handleUpgrade}
          >
            Upgrade to {requiredPlan}
          </UpgradeButton>
        </div>
      )}
    </div>
  )
}

// Preset components for common scenarios
export const DirectoryLimitPrompt = ({ currentPlan = 'free', ...props }) => (
  <UpgradePrompt
    currentPlan={currentPlan}
    feature="additional directory submissions"
    requiredPlan={currentPlan === 'free' ? 'starter' : 'professional'}
    {...props}
  />
)

export const AIOptimizationPrompt = ({ currentPlan = 'free', ...props }) => (
  <UpgradePrompt
    currentPlan={currentPlan}
    feature="AI optimization"
    requiredPlan="professional"
    {...props}
  />
)

export const MultipleWebsitesPrompt = ({ currentPlan = 'free', ...props }) => (
  <UpgradePrompt
    currentPlan={currentPlan}
    feature="multiple websites"
    requiredPlan={currentPlan === 'free' ? 'starter' : 'professional'}
    {...props}
  />
)

export const WhiteLabelPrompt = ({ currentPlan = 'free', ...props }) => (
  <UpgradePrompt
    currentPlan={currentPlan}
    feature="white-label branding"
    requiredPlan="enterprise"
    {...props}
  />
)

export default UpgradePrompt