// 🚀 TIER UPGRADE PROMPT COMPONENT - Conversion-Optimized Upgrade UI
// Advanced upgrade prompts with value demonstration and urgency tactics

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AnalysisTier, UpgradePrompt } from '../lib/services/analysis-tier-manager'
import { getConversionTracker, ConversionEventType } from '../lib/services/conversion-tracker'

interface TierUpgradePromptProps {
  userId: string
  currentTier: AnalysisTier
  upgradePrompt: UpgradePrompt
  onUpgrade: (targetTier: AnalysisTier) => void
  onDismiss: () => void
  valueDemo?: {
    value: string
    metrics: Record<string, number>
    projections: Record<string, number>
  }
  trigger?: string
  className?: string
}

export const TierUpgradePrompt: React.FC<TierUpgradePromptProps> = ({
  userId,
  currentTier,
  upgradePrompt,
  onUpgrade,
  onDismiss,
  valueDemo,
  trigger = 'feature_lock',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(true)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  // Track prompt display
  useEffect(() => {
    getConversionTracker().trackEvent({
      userId,
      eventType: 'upgrade_prompt_shown',
      stage: 'consideration',
      data: { 
        trigger,
        currentTier,
        promptTitle: upgradePrompt.title 
      },
      source: 'tier_upgrade_prompt',
      sessionId: `session_${Date.now()}`
    })
  }, [userId, trigger, currentTier, upgradePrompt.title])

  // Handle discount countdown
  useEffect(() => {
    if (upgradePrompt.discount?.validUntil) {
      const updateCountdown = () => {
        const now = new Date().getTime()
        const target = new Date(upgradePrompt.discount!.validUntil).getTime()
        const diff = target - now

        if (diff <= 0) {
          setTimeLeft(null)
        } else {
          const minutes = Math.floor(diff / 1000 / 60)
          const seconds = Math.floor((diff / 1000) % 60)
          setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`)
        }
      }

      updateCountdown()
      const interval = setInterval(updateCountdown, 1000)
      return () => clearInterval(interval)
    }

    return () => {}
  }, [upgradePrompt.discount?.validUntil])

  const handleUpgradeClick = () => {
    // Track conversion event
    getConversionTracker().trackEvent({
      userId,
      eventType: 'upgrade_prompt_clicked',
      stage: 'conversion',
      data: { 
        trigger,
        currentTier,
        targetTier: getTargetTier()
      },
      source: 'tier_upgrade_prompt',
      sessionId: `session_${Date.now()}`
    })

    onUpgrade(getTargetTier())
  }

  const handleDismiss = () => {
    // Track dismissal
    getConversionTracker().trackEvent({
      userId,
      eventType: 'upgrade_prompt_dismissed' as ConversionEventType,
      stage: 'consideration',
      data: { 
        trigger,
        currentTier,
        dismissalReason: 'user_action'
      },
      source: 'tier_upgrade_prompt',
      sessionId: `session_${Date.now()}`
    })

    setIsVisible(false)
    setTimeout(onDismiss, 300) // Allow exit animation
  }

  const getTargetTier = (): AnalysisTier => {
    return currentTier === 'free' ? 'premium' : 'enterprise'
  }

  const formatTimeLeft = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`
          fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm
          ${className}
        `}
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          className="
            relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl 
            border border-gray-200 overflow-hidden
          "
        >
          {/* Header with urgency indicator */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{upgradePrompt.title}</h2>
                {upgradePrompt.urgency && (
                  <p className="text-sm text-blue-100 mt-1">{upgradePrompt.urgency}</p>
                )}
              </div>
              
              {/* Discount countdown */}
              {upgradePrompt.discount && timeLeft !== null && (
                <div className="text-right">
                  <div className="bg-white bg-opacity-20 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium">Limited Time</p>
                    <p className="text-lg font-bold tracking-wide">⏳ {timeLeft}</p>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleDismiss}
                className="text-white hover:text-gray-200 transition-colors"
                aria-label="Close upgrade prompt"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Main message */}
            <p className="text-gray-700 text-lg mb-6">{upgradePrompt.message}</p>

            {/* Value demonstration */}
            {valueDemo && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 mb-6 border border-green-200">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Your Business Impact Projection
                </h3>
                
                <p className="text-gray-700 mb-4">{valueDemo.value}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(valueDemo.metrics).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {typeof value === 'number' && value > 1000 ? 
                          `${(value / 1000).toFixed(1)}K` : 
                          value.toLocaleString()
                        }
                      </div>
                      <div className="text-sm text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ROI Highlight */}
                {valueDemo.projections.roi && (
                  <div className="mt-4 text-center p-3 bg-white rounded-lg border">
                    <p className="text-sm text-gray-600">Expected ROI</p>
                    <p className="text-3xl font-bold text-green-600">
                      {valueDemo.projections.roi}%
                    </p>
                    <p className="text-xs text-gray-500">within 90 days</p>
                  </div>
                )}
              </div>
            )}

            {/* Value proposition */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-3">{upgradePrompt.valueProposition}</h3>
              <ul className="space-y-2">
                {upgradePrompt.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-700">
                    <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Discount banner */}
            {upgradePrompt.discount && (
              <div className="bg-volt-50 border border-volt-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-volt-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                  <div>
                    <p className="font-medium text-volt-800">
                      Limited Time: Save {upgradePrompt.discount.percentage}%
                    </p>
                    <p className="text-sm text-volt-700">
                      Offer expires {upgradePrompt.discount.validUntil.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleUpgradeClick}
                className="
                  flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white 
                  font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 
                  transition-all duration-200 shadow-lg hover:shadow-xl
                  flex items-center justify-center space-x-2
                "
              >
                <span>{upgradePrompt.ctaText}</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </motion.button>
              
              <button
                onClick={handleDismiss}
                className="
                  sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 
                  font-medium rounded-lg hover:bg-gray-50 transition-colors
                "
              >
                Maybe Later
              </button>
            </div>

            {/* Trust indicators */}
            <div className="mt-6 text-center text-sm text-gray-500">
              <div className="flex items-center justify-center space-x-6">
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  30-day money-back guarantee
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-blue-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Secure payment
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-purple-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Cancel anytime
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default TierUpgradePrompt