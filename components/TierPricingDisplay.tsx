// 🚀 TIER PRICING DISPLAY COMPONENT - Conversion-Optimized Pricing Table
// Advanced pricing presentation with value emphasis and social proof

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AnalysisTier, getTierManager } from '../lib/services/analysis-tier-manager'
import { getConversionTracker, ConversionEventType } from '../lib/services/conversion-tracker'

interface TierPricingDisplayProps {
  userId: string
  currentTier: AnalysisTier
  onTierSelect: (tier: AnalysisTier) => void
  highlightedTier?: AnalysisTier
  showAnnualToggle?: boolean
  showValueHighlight?: boolean
  className?: string
}

interface PricingCardProps {
  tier: AnalysisTier
  config: any
  isCurrentTier: boolean
  isHighlighted: boolean
  isAnnual: boolean
  onSelect: () => void
  valueHighlight?: {
    roi: string
    savings: string
    timeToValue: string
  }
}

const PricingCard: React.FC<PricingCardProps> = ({
  tier,
  config,
  isCurrentTier,
  isHighlighted,
  isAnnual,
  onSelect,
  valueHighlight
}) => {
  const getMonthlyPrice = () => {
    return isAnnual ? Math.round(config.price * 0.83) : config.price // 17% annual discount
  }

  const getAnnualPrice = () => {
    return config.price * 12 * 0.83 // 17% annual discount
  }

  const getTierBadge = () => {
    switch (tier) {
      case 'premium':
        return { text: 'MOST POPULAR', color: 'bg-blue-600' }
      case 'enterprise':
        return { text: 'BEST VALUE', color: 'bg-purple-600' }
      default:
        return null
    }
  }

  const badge = getTierBadge()

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ duration: 0.2 }}
      className={`
        relative rounded-2xl border-2 p-8 bg-white
        ${isHighlighted 
          ? 'border-blue-500 shadow-2xl shadow-blue-500/25 ring-4 ring-blue-500/10' 
          : 'border-gray-200 shadow-lg hover:shadow-xl'
        }
        ${isCurrentTier ? 'ring-2 ring-green-500 ring-offset-2' : ''}
        transition-all duration-300
      `}
    >
      {/* Popular badge */}
      {badge && (
        <div className={`
          absolute -top-4 left-1/2 transform -translate-x-1/2 
          ${badge.color} text-white text-sm font-bold px-4 py-2 rounded-full
        `}>
          {badge.text}
        </div>
      )}

      {/* Current tier indicator */}
      {isCurrentTier && (
        <div className="absolute -top-3 -right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
          CURRENT
        </div>
      )}

      {/* Tier name and price */}
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{config.name}</h3>
        
        <div className="mb-4">
          {config.price === 0 ? (
            <div className="text-5xl font-bold text-gray-900">Free</div>
          ) : (
            <div className="flex items-center justify-center">
              <span className="text-2xl text-gray-500">$</span>
              <span className="text-5xl font-bold text-gray-900">
                {isAnnual ? getMonthlyPrice() : config.price}
              </span>
              <span className="text-lg text-gray-500 ml-1"> ONE-TIME</span>
            </div>
          )}
          
          {isAnnual && config.price > 0 && (
            <div className="text-sm text-green-600 font-medium">
              Save ${(config.price * 12 - getAnnualPrice()).toFixed(0)} annually
            </div>
          )}
        </div>

        <p className="text-gray-600 text-sm">{config.valueProposition}</p>
      </div>

      {/* Value highlight */}
      {valueHighlight && isHighlighted && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-6 border border-blue-200">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-blue-600">{valueHighlight.roi}</div>
              <div className="text-xs text-gray-600">ROI</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">{valueHighlight.savings}</div>
              <div className="text-xs text-gray-600">Total Savings</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-600">{valueHighlight.timeToValue}</div>
              <div className="text-xs text-gray-600">Time to Value</div>
            </div>
          </div>
        </div>
      )}

      {/* Features list */}
      <ul className="space-y-3 mb-8">
        {config.features.map((feature: string, index: number) => (
          <li key={index} className="flex items-start">
            <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-gray-700 text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      {/* Limits display */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-gray-600">Total Analyses:</span>
            <span className="font-medium ml-1">
              {config.limits.monthlyAnalyses === -1 ? 'Unlimited' : config.limits.monthlyAnalyses}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Directory Access:</span>
            <span className="font-medium ml-1">
              {config.limits.directoryPreviews === -1 ? 'All' : config.limits.directoryPreviews}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Support:</span>
            <span className="font-medium ml-1 capitalize">{config.limits.supportLevel}</span>
          </div>
          <div>
            <span className="text-gray-600">AI Analysis:</span>
            <span className="font-medium ml-1 capitalize">{config.limits.aiAnalysisDepth}</span>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onSelect}
        disabled={isCurrentTier}
        className={`
          w-full py-4 px-6 rounded-xl font-semibold text-center transition-all duration-200
          ${isCurrentTier
            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
            : isHighlighted
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
            : 'bg-gray-900 text-white hover:bg-gray-800'
          }
        `}
      >
        {isCurrentTier ? 'Current Plan' : tier === 'free' ? 'Get Started Free' : config.upgradeCallToAction}
      </motion.button>

      {/* Money-back guarantee */}
      {config.price > 0 && (
        <div className="text-center mt-3 text-xs text-gray-500">
          30-day money-back guarantee
        </div>
      )}
    </motion.div>
  )
}

export const TierPricingDisplay: React.FC<TierPricingDisplayProps> = ({
  userId,
  currentTier,
  onTierSelect,
  highlightedTier = 'premium',
  showAnnualToggle = true,
  showValueHighlight = true,
  className = ''
}) => {
  const [isAnnual, setIsAnnual] = useState(false)
  const [hasTrackedView, setHasTrackedView] = useState(false)
  
  const tierManager = getTierManager()
  const allTiers = tierManager.getAllTiers()

  // Track pricing page view
  useEffect(() => {
    if (!hasTrackedView) {
      getConversionTracker().trackEvent({
        userId,
        eventType: 'pricing_viewed' as ConversionEventType,
        stage: 'consideration',
        data: { 
          currentTier,
          highlightedTier,
          showAnnual: isAnnual
        },
        source: 'tier_pricing_display',
        sessionId: `session_${Date.now()}`
      })
      setHasTrackedView(true)
    }
  }, [userId, currentTier, highlightedTier, isAnnual, hasTrackedView])

  const handleTierSelect = (tier: AnalysisTier) => {
    // Track tier selection
    getConversionTracker().trackEvent({
      userId,
      eventType: 'tier_selected' as ConversionEventType,
      stage: 'conversion',
      data: { 
        fromTier: currentTier,
        toTier: tier,
        billingCycle: 'one_time'
      },
      source: 'tier_pricing_display',
      sessionId: `session_${Date.now()}`
    })

    onTierSelect(tier)
  }

  const handleBillingToggle = (annual: boolean) => {
    setIsAnnual(annual)
    
    // Track billing preference
    getConversionTracker().trackEvent({
      userId,
      eventType: 'billing_preference_changed' as ConversionEventType,
      stage: 'consideration',
      data: { 
        billingCycle: 'one_time',
        currentTier
      },
      source: 'tier_pricing_display',
      sessionId: `session_${Date.now()}`
    })
  }

  const getValueHighlight = (tier: AnalysisTier) => {
    const highlights: Record<AnalysisTier, any> = {
      free: null,
      basic: {
        roi: '810%',
        savings: '$2,100',
        timeToValue: '7 days'
      },
      premium: {
        roi: '870%',
        savings: '$5,200',
        timeToValue: '3 days'
      },
      enterprise: {
        roi: '950%',
        savings: '$12,000',
        timeToValue: '1 day'
      }
    }

    return highlights[tier]
  }

  return (
    <div className={`max-w-7xl mx-auto ${className}`}>
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Choose Your Growth Plan
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          Unlock AI-powered business intelligence that drives real results
        </p>

        {/* One-Time Purchase Notice */}
        {showAnnualToggle && (
          <div className="flex items-center justify-center space-x-4 mb-8">
            <span className={`text-sm ${!isAnnual ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              One-Time Purchase
            </span>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleBillingToggle(!isAnnual)}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${isAnnual ? 'bg-blue-600' : 'bg-gray-200'}
              `}
            >
              <motion.span
                animate={{ x: isAnnual ? 24 : 4 }}
                transition={{ duration: 0.2 }}
                className="inline-block h-4 w-4 transform rounded-full bg-white shadow"
              />
            </motion.button>
            <div className="flex items-center space-x-2">
              <span className={`text-sm ${isAnnual ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                Annual
              </span>
              <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">
                Save 17%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {Object.entries(allTiers).map(([tier, config]) => (
          <PricingCard
            key={tier}
            tier={tier as AnalysisTier}
            config={config}
            isCurrentTier={currentTier === tier}
            isHighlighted={highlightedTier === tier}
            isAnnual={isAnnual}
            onSelect={() => handleTierSelect(tier as AnalysisTier)}
            valueHighlight={showValueHighlight ? getValueHighlight(tier as AnalysisTier) : undefined}
          />
        ))}
      </div>

      {/* Social proof and testimonials */}
      <div className="mt-16 text-center">
        <div className="flex items-center justify-center space-x-8 mb-8">
          <div className="flex items-center space-x-2">
            <div className="flex -space-x-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-8 h-8 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="text-white text-xs font-bold">U</span>
                </div>
              ))}
            </div>
            <span className="text-sm text-gray-600 font-medium">2,400+ businesses trust us</span>
          </div>
          
          <div className="flex items-center space-x-1">
            {[1,2,3,4,5].map(i => (
              <svg key={i} className="w-5 h-5 text-volt-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
            <span className="text-sm text-gray-600 ml-2">4.9/5 rating</span>
          </div>
        </div>

        {/* Value guarantee */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-8 border border-green-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Results Guarantee
          </h3>
          <p className="text-gray-700 mb-4">
            We're so confident in our AI analysis that we guarantee measurable business results 
            within 90 days or get your money back.
          </p>
          <div className="flex items-center justify-center space-x-8 text-sm text-gray-600">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              30-day money-back guarantee
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Instant feature access
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 text-purple-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              Cancel anytime
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TierPricingDisplay