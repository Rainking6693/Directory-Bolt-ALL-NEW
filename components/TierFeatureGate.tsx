// 🚀 TIER FEATURE GATE COMPONENT - Smart Feature Access Control with Conversion Optimization
// Advanced feature gating with progressive disclosure and upgrade incentives

import React, { useState, useEffect, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AnalysisTier } from '../lib/services/analysis-tier-manager'
import { getConversionTracker } from '../lib/services/conversion-tracker'
import TierUpgradePrompt from './TierUpgradePrompt'

interface TierFeatureGateProps {
  userId: string
  currentTier: AnalysisTier
  requiredTier: AnalysisTier
  featureName: string
  children: ReactNode
  fallbackContent?: ReactNode
  showPreview?: boolean
  previewPercentage?: number
  onUpgradeRequired?: (feature: string) => void
  className?: string
}

interface FeatureLockOverlayProps {
  featureName: string
  requiredTier: AnalysisTier
  currentTier: AnalysisTier
  onUnlock: () => void
  onPreview?: () => void
  showPreview?: boolean
}

const FeatureLockOverlay: React.FC<FeatureLockOverlayProps> = ({
  featureName,
  requiredTier,
  currentTier,
  onUnlock,
  onPreview,
  showPreview = false
}) => {
  const tierLabels: Record<AnalysisTier, string> = {
    free: 'Free',
    basic: 'Starter',
    premium: 'Growth',
    enterprise: 'Enterprise'
  }

  const featureIcons: Record<string, string> = {
    screenshots: '📸',
    competitor_analysis: '🔍',
    revenue_projections: '📊',
    directory_optimization: '🎯',
    ai_analysis: '🤖',
    api_access: '🔌',
    custom_branding: '🎨',
    priority_support: '⚡'
  }

  const getFeatureIcon = (name: string): string => {
    const key = name.toLowerCase().replace(' ', '_')
    return featureIcons[key] || '⭐'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="
        absolute inset-0 bg-gradient-to-br from-gray-900/95 to-gray-800/95 
        backdrop-blur-sm rounded-lg flex items-center justify-center z-10
      "
    >
      <div className="text-center p-6 max-w-sm">
        {/* Feature icon */}
        <div className="text-6xl mb-4">
          {getFeatureIcon(featureName)}
        </div>

        {/* Lock icon with tier badge */}
        <div className="relative inline-block mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
            {tierLabels[requiredTier]}
          </div>
        </div>

        {/* Feature name */}
        <h3 className="text-xl font-bold text-white mb-2 capitalize">
          {featureName.replace('_', ' ')}
        </h3>

        {/* Description */}
        <p className="text-gray-300 mb-6 text-sm leading-relaxed">
          This premium feature is available with the {tierLabels[requiredTier]} plan and above. 
          Unlock advanced capabilities to supercharge your business growth.
        </p>

        {/* Action buttons */}
        <div className="space-y-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onUnlock}
            className="
              w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white 
              font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 
              transition-all duration-200 shadow-lg hover:shadow-xl
              flex items-center justify-center space-x-2
            "
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            <span>Unlock Feature</span>
          </motion.button>

          {showPreview && onPreview && (
            <button
              onClick={onPreview}
              className="
                w-full border border-white/30 text-white/90 font-medium py-2 px-6 
                rounded-lg hover:bg-white/10 transition-colors text-sm
              "
            >
              Preview Feature
            </button>
          )}
        </div>

        {/* Tier comparison hint */}
        <div className="mt-4 text-xs text-gray-400">
          Currently on {tierLabels[currentTier]} • Requires {tierLabels[requiredTier]}+
        </div>
      </div>
    </motion.div>
  )
}

export const TierFeatureGate: React.FC<TierFeatureGateProps> = ({
  userId,
  currentTier,
  requiredTier,
  featureName,
  children,
  fallbackContent,
  showPreview = false,
  previewPercentage = 30,
  onUpgradeRequired,
  className = ''
}) => {
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [showPreviewMode, setShowPreviewMode] = useState(false)
  const [hasTrackedFeatureLock, setHasTrackedFeatureLock] = useState(false)

  // Check tier access
  const tierHierarchy: Record<AnalysisTier, number> = {
    free: 0,
    basic: 1,
    premium: 2,
    enterprise: 3
  }

  const hasAccess = tierHierarchy[currentTier] >= tierHierarchy[requiredTier]

  // Track feature lock impression
  useEffect(() => {
    if (!hasAccess && !hasTrackedFeatureLock) {
      getConversionTracker().trackEvent({
        userId,
        eventType: 'feature_discovered',
        stage: 'awareness',
        data: { 
          featureName,
          currentTier,
          requiredTier,
          hasAccess: false
        },
        source: 'tier_feature_gate',
        sessionId: `session_${Date.now()}`
      })
      setHasTrackedFeatureLock(true)
    }
  }, [hasAccess, userId, featureName, currentTier, requiredTier, hasTrackedFeatureLock])

  const handleFeatureAttempt = () => {
    // Track feature lock event
    getConversionTracker().trackEvent({
      userId,
      eventType: 'feature_locked',
      stage: 'interest',
      data: { 
        featureName,
        currentTier,
        requiredTier
      },
      source: 'tier_feature_gate',
      sessionId: `session_${Date.now()}`
    })

    if (onUpgradeRequired) {
      onUpgradeRequired(featureName)
    }

    setShowUpgradePrompt(true)
  }

  const handlePreview = () => {
    // Track preview engagement
    getConversionTracker().trackEvent({
      userId,
      eventType: 'feature_attempted',
      stage: 'interest',
      data: { 
        featureName,
        currentTier,
        requiredTier,
        interaction: 'preview'
      },
      source: 'tier_feature_gate',
      sessionId: `session_${Date.now()}`
    })

    setShowPreviewMode(true)
    
    // Auto-hide preview after some time and show upgrade prompt
    setTimeout(() => {
      setShowPreviewMode(false)
      setShowUpgradePrompt(true)
    }, 10000) // 10 seconds preview
  }

  const handleUpgrade = (targetTier: AnalysisTier) => {
    // Track upgrade intent
    getConversionTracker().trackEvent({
      userId,
      eventType: 'upgrade_started',
      stage: 'conversion',
      data: { 
        trigger: featureName,
        fromTier: currentTier,
        toTier: targetTier
      },
      source: 'tier_feature_gate',
      sessionId: `session_${Date.now()}`
    })

    // In a real app, this would trigger the payment flow
    console.log('Redirect to upgrade flow:', targetTier)
    setShowUpgradePrompt(false)
  }

  // Generate upgrade prompt based on feature
  const generateUpgradePrompt = () => {
    const featurePrompts: Record<string, any> = {
      screenshots: {
        title: 'Professional Website Screenshots',
        message: 'See how your website looks on desktop and mobile with high-quality screenshots for professional presentations.',
        valueProposition: 'Professional visual analysis for better client presentations',
        features: ['Desktop & mobile screenshots', 'High-resolution captures', 'Multiple viewport sizes'],
        ctaText: 'Enable Screenshots - Start Free Trial'
      },
      competitor_analysis: {
        title: 'AI-Powered Competitor Intelligence',
        message: 'Understand your competitive landscape with comprehensive competitor analysis and market positioning insights.',
        valueProposition: 'Stay ahead of competition with AI-powered market intelligence',
        features: ['Competitor identification', 'Market gap analysis', 'Strategic positioning advice'],
        ctaText: 'Unlock Competitor Analysis - Upgrade Now'
      },
      revenue_projections: {
        title: 'Revenue Growth Projections',
        message: 'See exactly how directory submissions will impact your revenue with AI-powered financial projections.',
        valueProposition: 'Data-driven revenue forecasting for smarter business decisions',
        features: ['12-month revenue projections', 'ROI calculations', 'Growth scenario modeling'],
        ctaText: 'See Revenue Impact - Upgrade to Growth Plan'
      },
      directory_optimization: {
        title: 'AI Directory Optimization',
        message: 'Get AI-optimized directory descriptions and submission strategies tailored for maximum impact.',
        valueProposition: 'AI-optimized submissions for 3x better results',
        features: ['AI-generated descriptions', 'Timing optimization', 'Success probability scoring'],
        ctaText: 'Optimize Submissions - Start Trial'
      }
    }

    const prompt = featurePrompts[featureName] || {
      title: 'Unlock Premium Feature',
      message: 'This advanced feature is designed to accelerate your business growth.',
      valueProposition: 'Advanced capabilities for serious businesses',
      features: ['Professional tools', 'Advanced analytics', 'Priority support'],
      ctaText: 'Upgrade Now'
    }

    return {
      ...prompt,
      urgency: currentTier === 'free' ? 'Start your 7-day free trial today!' : undefined
    }
  }

  // If user has access, render normally
  if (hasAccess) {
    return <div className={className}>{children}</div>
  }

  // Render with feature gate
  return (
    <div className={`relative ${className}`}>
      {/* Blurred/limited content for preview */}
      {showPreviewMode ? (
        <div className="relative">
          <div 
            className="overflow-hidden" 
            style={{ 
              maxHeight: `${previewPercentage}%`,
              filter: 'blur(2px)',
              opacity: 0.7
            }}
          >
            {children}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent" />
          
          {/* Preview banner */}
          <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
            Preview Mode
          </div>
        </div>
      ) : (
        <>
          {/* Fallback content or placeholder */}
          {fallbackContent || (
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="font-medium">Premium Feature</p>
                <p className="text-sm">Upgrade to unlock</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Feature lock overlay */}
      <AnimatePresence>
        {!showPreviewMode && (
          <FeatureLockOverlay
            featureName={featureName}
            requiredTier={requiredTier}
            currentTier={currentTier}
            onUnlock={handleFeatureAttempt}
            onPreview={showPreview ? handlePreview : undefined}
            showPreview={showPreview}
          />
        )}
      </AnimatePresence>

      {/* Upgrade prompt modal */}
      <AnimatePresence>
        {showUpgradePrompt && (
          <TierUpgradePrompt
            userId={userId}
            currentTier={currentTier}
            upgradePrompt={generateUpgradePrompt()}
            onUpgrade={handleUpgrade}
            onDismiss={() => setShowUpgradePrompt(false)}
            trigger={featureName}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default TierFeatureGate