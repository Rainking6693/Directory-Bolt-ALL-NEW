'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ContentPreview {
  type: 'chart' | 'table' | 'report_section' | 'feature' | 'directory_list'
  title: string
  description: string
  previewData?: any
  fullDataCount?: number
  valueProposition: string
  estimatedValue?: number
  tier: 'starter' | 'growth' | 'professional'
}

interface PremiumContentOverlaysProps {
  content: ContentPreview
  userTier: 'free' | 'starter' | 'growth' | 'professional'
  onUpgrade: () => void
  showTeaser?: boolean
  blurIntensity?: 'light' | 'medium' | 'heavy'
}

export default function PremiumContentOverlays({
  content,
  userTier,
  onUpgrade,
  showTeaser = true,
  blurIntensity = 'medium'
}: PremiumContentOverlaysProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showFullOverlay, setShowFullOverlay] = useState(false)
  const [interactionCount, setInteractionCount] = useState(0)

  const isLocked = () => {
    const tierLevels = { free: 0, starter: 1, growth: 2, professional: 3 }
    const contentTierLevels = { starter: 1, growth: 2, professional: 3 }
    return tierLevels[userTier] < contentTierLevels[content.tier]
  }

  const getBlurClass = () => {
    switch (blurIntensity) {
      case 'light': return 'backdrop-blur-sm'
      case 'medium': return 'backdrop-blur-md'
      case 'heavy': return 'backdrop-blur-lg'
      default: return 'backdrop-blur-md'
    }
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'starter': return 'from-orange-500 to-orange-600'
      case 'growth': return 'from-volt-500 to-volt-600'
      case 'professional': return 'from-success-500 to-success-600'
      default: return 'from-volt-500 to-volt-600'
    }
  }

  const getTierPrice = (tier: string) => {
    switch (tier) {
      case 'starter': return '$79'
      case 'growth': return '$149'
      case 'professional': return '$299'
      default: return '$149'
    }
  }

  const handleInteraction = () => {
    setInteractionCount(prev => prev + 1)
    if (interactionCount >= 2) {
      setShowFullOverlay(true)
    }
  }

  // Preview data teasers based on content type
  const renderPreviewTeaser = () => {
    if (!showTeaser || !content.previewData) return null

    switch (content.type) {
      case 'chart':
        return (
          <div className="grid grid-cols-2 gap-4 mb-4">
            {content.previewData.slice(0, 4).map((item: any, index: number) => (
              <div key={index} className="bg-secondary-700/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-volt-400 mb-1">
                  {typeof item.value === 'number' ? `${item.value}%` : item.value}
                </div>
                <div className="text-xs text-secondary-400">{item.label}</div>
              </div>
            ))}
          </div>
        )

      case 'table':
        return (
          <div className="space-y-2 mb-4">
            {content.previewData.slice(0, 3).map((row: any, index: number) => (
              <div key={index} className="flex justify-between items-center py-2 border-b border-secondary-700/50">
                <span className="text-secondary-300 text-sm">{row.name}</span>
                <span className="text-volt-400 font-medium">{row.value}</span>
              </div>
            ))}
            <div className="text-center text-secondary-500 text-xs">
              + {(content.fullDataCount || 10) - 3} more items
            </div>
          </div>
        )

      case 'directory_list':
        return (
          <div className="space-y-3 mb-4">
            {content.previewData.slice(0, 2).map((directory: any, index: number) => (
              <div key={index} className="bg-secondary-700/30 rounded-lg p-3 border border-secondary-600">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-white font-medium text-sm">{directory.name}</div>
                    <div className="text-secondary-400 text-xs">{directory.domain}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-success-400 font-bold text-sm">{directory.authority}</div>
                    <div className="text-secondary-400 text-xs">DA Score</div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-secondary-400">Success Rate:</span>
                  <span className="text-volt-400 font-medium">{directory.successRate}%</span>
                </div>
              </div>
            ))}
          </div>
        )

      default:
        return null
    }
  }

  if (!isLocked()) {
    return null // Don't show overlay if content is accessible
  }

  return (
    <div className="relative">
      {/* Blurred Preview Content */}
      <div className={`filter blur-sm opacity-60 ${showTeaser ? 'mb-4' : ''}`}>
        {renderPreviewTeaser()}
      </div>

      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-br from-secondary-900/90 to-secondary-800/80 ${getBlurClass()} rounded-xl flex items-center justify-center transition-all duration-300 ${
          isHovered ? 'bg-secondary-900/95' : ''
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleInteraction}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-6 max-w-md"
        >
          {/* Lock Icon */}
          <motion.div
            animate={{ 
              scale: isHovered ? 1.1 : 1,
              rotate: isHovered ? 5 : 0 
            }}
            transition={{ duration: 0.3 }}
            className="text-6xl mb-4"
          >
            🔒
          </motion.div>

          {/* Title */}
          <h3 className="text-xl font-bold text-white mb-2">
            {content.title}
          </h3>

          {/* Description */}
          <p className="text-secondary-300 text-sm mb-4">
            {content.description}
          </p>

          {/* Value Proposition */}
          <div className="bg-volt-500/10 border border-volt-500/30 rounded-lg p-4 mb-4">
            <div className="text-volt-400 font-semibold text-sm mb-2">
              🎯 What you'll get:
            </div>
            <div className="text-secondary-200 text-sm">
              {content.valueProposition}
            </div>
            {content.estimatedValue && (
              <div className="text-success-400 font-bold text-lg mt-2">
                Worth ${content.estimatedValue.toLocaleString()}/month
              </div>
            )}
          </div>

          {/* Tier Badge */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`bg-gradient-to-r ${getTierColor(content.tier)} text-white px-3 py-1 rounded-full text-xs font-bold uppercase`}>
              {content.tier} Feature
            </div>
            <div className="text-secondary-400 text-xs">
              From {getTierPrice(content.tier)}/month
            </div>
          </div>

          {/* CTA Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              onUpgrade()
            }}
            className={`bg-gradient-to-r ${getTierColor(content.tier)} text-white font-bold py-3 px-6 rounded-lg hover:shadow-lg transition-all duration-300 text-sm`}
          >
            🚀 Unlock Now
          </motion.button>

          {/* Interaction Hint */}
          <div className="text-secondary-500 text-xs mt-3">
            {interactionCount === 0 && 'Click to see upgrade options'}
            {interactionCount === 1 && 'One more click for special offer'}
            {interactionCount >= 2 && 'Opening upgrade options...'}
          </div>
        </motion.div>
      </div>

      {/* Hover Enhancement */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -inset-2 bg-gradient-to-r from-volt-500/20 to-volt-600/20 rounded-xl border border-volt-500/40 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Full Overlay Modal */}
      <AnimatePresence>
        {showFullOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowFullOverlay(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-secondary-800 to-secondary-900 rounded-2xl border-2 border-volt-500/50 p-8 max-w-lg mx-auto text-center relative"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowFullOverlay(false)}
                className="absolute top-4 right-4 text-secondary-400 hover:text-white transition-colors text-2xl"
              >
                ×
              </button>

              {/* Enhanced Content */}
              <div className="text-5xl mb-4">🎯</div>
              <h2 className="text-2xl font-black text-white mb-4">
                Ready to Unlock This Premium Feature?
              </h2>
              
              <p className="text-secondary-300 mb-6">
                Join thousands of businesses getting {content.tier} insights that drive real growth.
              </p>

              {/* Feature Benefits */}
              <div className="bg-volt-500/10 border border-volt-500/30 rounded-xl p-6 mb-6 text-left">
                <h3 className="text-lg font-bold text-volt-400 mb-4 text-center">
                  What You'll Get with {content.tier.charAt(0).toUpperCase() + content.tier.slice(1)}:
                </h3>
                <div className="space-y-3">
                  {content.tier === 'starter' && [
                    '25 high-authority directories',
                    'Basic competitive analysis',
                    'Email support (48hr response)',
                    'Monthly PDF reports'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start gap-3 text-sm">
                      <span className="text-success-400 flex-shrink-0 mt-1">✓</span>
                      <span className="text-secondary-200">{feature}</span>
                    </div>
                  ))}
                  
                  {content.tier === 'growth' && [
                    '50 premium directories',
                    'Advanced competitive intelligence',
                    'Priority support (24hr response)',
                    'Weekly PDF reports',
                    'Financial projections & ROI modeling',
                    'Semi-automated submissions'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start gap-3 text-sm">
                      <span className="text-success-400 flex-shrink-0 mt-1">✓</span>
                      <span className="text-secondary-200">{feature}</span>
                    </div>
                  ))}
                  
                  {content.tier === 'professional' && [
                    '100+ exclusive directories',
                    'Real-time competitive monitoring',
                    'Dedicated success manager',
                    'White-label reporting',
                    'Full API access',
                    'Custom integrations',
                    'Fully automated submissions'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start gap-3 text-sm">
                      <span className="text-success-400 flex-shrink-0 mt-1">✓</span>
                      <span className="text-secondary-200">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Value Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-success-500/10 rounded-lg p-3 border border-success-500/20">
                  <div className="text-lg font-black text-success-400 mb-1">
                    {content.tier === 'starter' ? '450' : content.tier === 'growth' ? '680' : '920'}%
                  </div>
                  <div className="text-xs text-secondary-300">Avg ROI</div>
                </div>
                <div className="bg-volt-500/10 rounded-lg p-3 border border-volt-500/20">
                  <div className="text-lg font-black text-volt-400 mb-1">
                    {content.tier === 'starter' ? '21' : content.tier === 'growth' ? '14' : '7'}
                  </div>
                  <div className="text-xs text-secondary-300">Days to Payback</div>
                </div>
                <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/20">
                  <div className="text-lg font-black text-orange-400 mb-1">
                    {content.tier === 'starter' ? '94' : content.tier === 'growth' ? '97' : '99'}%
                  </div>
                  <div className="text-xs text-secondary-300">Success Rate</div>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => {
                  setShowFullOverlay(false)
                  onUpgrade()
                }}
                className={`w-full bg-gradient-to-r ${getTierColor(content.tier)} text-white font-bold py-4 px-8 rounded-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 mb-4`}
              >
                🚀 Upgrade to {content.tier.charAt(0).toUpperCase() + content.tier.slice(1)} - {getTierPrice(content.tier)}/month
                <div className="text-sm opacity-80 font-normal mt-1">
                  14-day free trial • Cancel anytime
                </div>
              </button>

              {/* Guarantee */}
              <div className="text-xs text-secondary-400">
                🛡️ 30-day money-back guarantee • No risk
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle Animation Effects */}
      <div className="absolute top-2 right-2 opacity-20">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="w-3 h-3 bg-volt-500 rounded-full"
        />
      </div>
    </div>
  )
}

// Specialized overlay components for different content types
export const ChartOverlay = ({ 
  chartData, 
  userTier, 
  onUpgrade 
}: { 
  chartData: any
  userTier: 'free' | 'starter' | 'growth' | 'professional'
  onUpgrade: () => void 
}) => (
  <PremiumContentOverlays
    content={{
      type: 'chart',
      title: 'Advanced Analytics',
      description: 'Detailed performance metrics and competitive insights',
      previewData: chartData,
      valueProposition: 'Get data-driven insights that reveal exactly where your competitors are weak and where you can dominate.',
      estimatedValue: 2600,
      tier: 'growth'
    }}
    userTier={userTier}
    onUpgrade={onUpgrade}
  />
)

export const DirectoryListOverlay = ({ 
  directories, 
  userTier, 
  onUpgrade 
}: { 
  directories: any[]
  userTier: 'free' | 'starter' | 'growth' | 'professional'
  onUpgrade: () => void 
}) => (
  <PremiumContentOverlays
    content={{
      type: 'directory_list',
      title: 'Premium Directory Access',
      description: `${directories.length - 5} additional high-value directories`,
      previewData: directories.slice(5, 7),
      fullDataCount: directories.length - 5,
      valueProposition: 'Access exclusive directories your competitors don\'t know about, with 90%+ approval rates and high-authority backlinks.',
      estimatedValue: Math.round((directories.length - 5) * 180),
      tier: userTier === 'free' ? 'starter' : 'growth'
    }}
    userTier={userTier}
    onUpgrade={onUpgrade}
  />
)

export const ReportSectionOverlay = ({ 
  sectionTitle, 
  userTier, 
  onUpgrade 
}: { 
  sectionTitle: string
  userTier: 'free' | 'starter' | 'growth' | 'professional'
  onUpgrade: () => void 
}) => (
  <PremiumContentOverlays
    content={{
      type: 'report_section',
      title: `${sectionTitle} - Premium Analysis`,
      description: 'Professional-grade business intelligence and strategic insights',
      valueProposition: 'Get consultant-level analysis that typically costs $2,600+ from business intelligence firms.',
      estimatedValue: 2600,
      tier: 'growth'
    }}
    userTier={userTier}
    onUpgrade={onUpgrade}
    blurIntensity="heavy"
  />
)