'use client'
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface TierFeature {
  name: string
  description: string
  free: boolean | string
  starter: boolean | string
  growth: boolean | string
  professional: boolean | string
  category: 'analysis' | 'directories' | 'support' | 'reporting' | 'advanced'
}

interface TierBenefit {
  tier: 'starter' | 'growth' | 'professional'
  title: string
  subtitle: string
  monthlyValue: number
  yearlyValue: number
  yearlyDiscount: number
  features: string[]
  badge?: string
  popular?: boolean
  bestValue?: boolean
  urgencyOffer?: {
    discount: number
    timeLeft: number
    reason: string
  }
}

interface TierDifferentiationProps {
  currentTier: 'free' | 'starter' | 'growth' | 'professional'
  onUpgrade: (tier: string) => void
  showComparison?: boolean
  analysisData?: {
    opportunitiesFound: number
    estimatedValue: number
    competitorAdvantages: number
  }
}

export default function TierDifferentiation({
  currentTier,
  onUpgrade,
  showComparison = true,
  analysisData
}: TierDifferentiationProps) {
  const [isAnnual, setIsAnnual] = useState(false)
  const [hoveredTier, setHoveredTier] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(23 * 3600 + 47 * 60) // 23h 47m

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const tierFeatures: TierFeature[] = [
    // Analysis Features
    {
      name: 'Directory Opportunities Identified',
      description: 'AI-powered directory discovery and analysis',
      category: 'analysis',
      free: '5 basic directories',
      starter: '25 high-authority directories',
      growth: '50 premium directories',
      professional: '100+ exclusive directories'
    },
    {
      name: 'Success Rate Analysis',
      description: 'Historical approval rates and probability scoring',
      category: 'analysis',
      free: 'Basic scoring',
      starter: 'Advanced scoring',
      growth: 'Predictive analytics',
      professional: 'AI-powered predictions'
    },
    {
      name: 'Competitive Intelligence',
      description: 'Market gap analysis and positioning insights',
      category: 'analysis',
      free: false,
      starter: 'Basic analysis',
      growth: 'Comprehensive analysis',
      professional: 'Real-time monitoring'
    },
    {
      name: 'Financial Projections',
      description: 'ROI calculations and revenue forecasts',
      category: 'analysis',
      free: false,
      starter: false,
      growth: 'Conservative estimates',
      professional: 'Multi-scenario modeling'
    },
    {
      name: 'SEO Impact Analysis',
      description: 'Backlink value and authority boost calculations',
      category: 'analysis',
      free: false,
      starter: 'Basic SEO metrics',
      growth: 'Advanced SEO analysis',
      professional: 'Technical SEO audit'
    },
    
    // Directory Features
    {
      name: 'Directory Submissions',
      description: 'Automated submission to approved directories',
      category: 'directories',
      free: false,
      starter: 'Manual submissions',
      growth: 'Semi-automated',
      professional: 'Fully automated'
    },
    {
      name: 'Submission Tracking',
      description: 'Real-time status updates and progress monitoring',
      category: 'directories',
      free: false,
      starter: 'Weekly updates',
      growth: 'Daily updates',
      professional: 'Real-time tracking'
    },
    {
      name: 'Content Optimization',
      description: 'AI-optimized listings for maximum impact',
      category: 'directories',
      free: false,
      starter: 'Basic optimization',
      growth: 'Advanced optimization',
      professional: 'Dynamic optimization'
    },
    {
      name: 'Approval Follow-ups',
      description: 'Automated follow-up messages for pending submissions',
      category: 'directories',
      free: false,
      starter: false,
      growth: 'Automated follow-ups',
      professional: 'Intelligent follow-ups'
    },
    
    // Support Features
    {
      name: 'Customer Support',
      description: 'Help when you need it most',
      category: 'support',
      free: 'Community forum',
      starter: 'Email (48hr response)',
      growth: 'Priority email (24hr)',
      professional: 'Phone + dedicated manager'
    },
    {
      name: 'Onboarding',
      description: 'Getting started assistance',
      category: 'support',
      free: 'Self-service',
      starter: 'Email onboarding',
      growth: 'Video calls',
      professional: 'White-glove setup'
    },
    
    // Reporting Features
    {
      name: 'Analytics Dashboard',
      description: 'Track performance and monitor success',
      category: 'reporting',
      free: 'Basic metrics',
      starter: 'Standard dashboard',
      growth: 'Advanced analytics',
      professional: 'Custom dashboard'
    },
    {
      name: 'PDF Reports',
      description: 'Professional reports for stakeholders',
      category: 'reporting',
      free: false,
      starter: 'Monthly reports',
      growth: 'Weekly reports',
      professional: 'Custom frequency'
    },
    {
      name: 'White-label Reporting',
      description: 'Brand reports with your company logo',
      category: 'reporting',
      free: false,
      starter: false,
      growth: false,
      professional: true
    },
    
    // Advanced Features
    {
      name: 'API Access',
      description: 'Integrate with your existing tools',
      category: 'advanced',
      free: false,
      starter: false,
      growth: false,
      professional: 'Full API access'
    },
    {
      name: 'Bulk Operations',
      description: 'Manage multiple businesses at once',
      category: 'advanced',
      free: false,
      starter: false,
      growth: false,
      professional: 'Unlimited businesses'
    },
    {
      name: 'Custom Integrations',
      description: 'Connect with your CRM and marketing tools',
      category: 'advanced',
      free: false,
      starter: false,
      growth: 'Standard integrations',
      professional: 'Custom integrations'
    }
  ]

  const tierBenefits: TierBenefit[] = [
    {
      tier: 'starter',
      title: 'Starter',
      subtitle: 'Perfect for testing ROI',
      monthlyValue: 79,
      yearlyValue: 63,
      yearlyDiscount: 20,
      badge: 'Most Affordable',
      features: [
        '25 high-authority directories',
        'Basic competitive analysis',
        'Email support (48hr)',
        'Monthly PDF reports',
        'Standard analytics dashboard'
      ]
    },
    {
      tier: 'growth',
      title: 'Growth',
      subtitle: 'Ideal for serious growth',
      monthlyValue: 149,
      yearlyValue: 119,
      yearlyDiscount: 20,
      popular: true,
      badge: 'Most Popular',
      urgencyOffer: {
        discount: 25,
        timeLeft: timeLeft,
        reason: 'Limited monthly spots'
      },
      features: [
        '50 premium directories',
        'Comprehensive analysis',
        'Priority support (24hr)',
        'Weekly PDF reports',
        'Advanced analytics',
        'Semi-automated submissions'
      ]
    },
    {
      tier: 'professional',
      title: 'Professional',
      subtitle: 'Maximum market dominance',
      monthlyValue: 299,
      yearlyValue: 239,
      yearlyDiscount: 20,
      bestValue: true,
      badge: 'Best ROI',
      features: [
        '100+ exclusive directories',
        'Real-time competitive monitoring',
        'Dedicated success manager',
        'White-label reporting',
        'Full API access',
        'Fully automated submissions'
      ]
    }
  ]

  const FeatureComparisonTable = () => (
    <div className="bg-secondary-800/50 rounded-2xl border border-secondary-700 overflow-hidden">
      <div className="p-6 border-b border-secondary-700">
        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
          <span>📊</span>
          Feature Comparison Matrix
        </h3>
        <p className="text-secondary-400 mt-2">
          Compare all plans side-by-side to find the perfect fit for your business
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary-700/50">
            <tr>
              <th className="text-left p-4 text-secondary-300 font-semibold">Features</th>
              <th className="text-center p-4 text-secondary-300 font-semibold">
                <div className="flex flex-col items-center">
                  <span>Free</span>
                  <span className="text-xs opacity-75">Current Plan</span>
                </div>
              </th>
              <th className="text-center p-4 text-secondary-300 font-semibold">Starter</th>
              <th className="text-center p-4 text-secondary-300 font-semibold relative">
                <div className="flex flex-col items-center">
                  <span>Growth</span>
                  <span className="absolute -top-2 bg-volt-500 text-secondary-900 text-xs px-2 py-1 rounded-full font-bold">
                    POPULAR
                  </span>
                </div>
              </th>
              <th className="text-center p-4 text-secondary-300 font-semibold relative">
                <div className="flex flex-col items-center">
                  <span>Professional</span>
                  <span className="absolute -top-2 bg-success-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                    BEST VALUE
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(
              tierFeatures.reduce((acc, feature) => {
                if (!acc[feature.category]) acc[feature.category] = []
                acc[feature.category].push(feature)
                return acc
              }, {} as Record<string, TierFeature[]>)
            ).map(([category, features]) => (
              <React.Fragment key={category}>
                <tr className="bg-secondary-800/30">
                  <td colSpan={5} className="p-4 text-volt-400 font-bold text-sm uppercase tracking-wide border-t border-secondary-700">
                    {category === 'analysis' && '🎯 Analysis & Intelligence'}
                    {category === 'directories' && '📋 Directory Management'}
                    {category === 'support' && '💬 Support & Services'}
                    {category === 'reporting' && '📊 Reporting & Analytics'}
                    {category === 'advanced' && '🚀 Advanced Features'}
                  </td>
                </tr>
                {features.map((feature, idx) => (
                  <tr key={`${category}-${idx}`} className="border-b border-secondary-700/50 hover:bg-secondary-800/30 transition-colors">
                    <td className="p-4">
                      <div>
                        <div className="text-white font-medium">{feature.name}</div>
                        <div className="text-secondary-400 text-xs mt-1">{feature.description}</div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {feature.free === true ? (
                        <span className="text-success-400 text-xl">✓</span>
                      ) : feature.free === false ? (
                        <span className="text-secondary-500 text-xl">✕</span>
                      ) : (
                        <span className="text-secondary-300 text-sm">{feature.free}</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {feature.starter === true ? (
                        <span className="text-success-400 text-xl">✓</span>
                      ) : feature.starter === false ? (
                        <span className="text-secondary-500 text-xl">✕</span>
                      ) : (
                        <span className="text-volt-300 text-sm font-medium">{feature.starter}</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {feature.growth === true ? (
                        <span className="text-success-400 text-xl">✓</span>
                      ) : feature.growth === false ? (
                        <span className="text-secondary-500 text-xl">✕</span>
                      ) : (
                        <span className="text-volt-300 text-sm font-medium">{feature.growth}</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {feature.professional === true ? (
                        <span className="text-success-400 text-xl">✓</span>
                      ) : feature.professional === false ? (
                        <span className="text-secondary-500 text-xl">✕</span>
                      ) : (
                        <span className="text-success-300 text-sm font-medium">{feature.professional}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const TierCard = ({ benefit }: { benefit: TierBenefit }) => {
    const isCurrentTier = currentTier === benefit.tier
    const currentPrice = isAnnual ? benefit.yearlyValue : benefit.monthlyValue
    const originalPrice = benefit.monthlyValue
    const discountedPrice = benefit.urgencyOffer 
      ? Math.round(currentPrice * (1 - benefit.urgencyOffer.discount / 100))
      : currentPrice

    return (
      <motion.div
        whileHover={{ scale: 1.02, y: -5 }}
        onHoverStart={() => setHoveredTier(benefit.tier)}
        onHoverEnd={() => setHoveredTier(null)}
        className={`relative bg-gradient-to-br backdrop-blur-sm rounded-2xl border-2 transition-all duration-500 ${
          benefit.popular
            ? 'from-volt-500/30 to-volt-600/20 border-volt-500 shadow-2xl shadow-volt-500/30 scale-105 z-10'
            : benefit.bestValue
              ? 'from-success-500/30 to-success-600/20 border-success-500 shadow-xl'
              : 'from-secondary-800/80 to-secondary-900/60 border-secondary-600'
        }`}
      >
        {/* Badge */}
        {benefit.badge && (
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
            <span className={`font-black px-6 py-2 rounded-full text-sm shadow-lg animate-pulse ${
              benefit.popular
                ? 'bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900'
                : benefit.bestValue
                  ? 'bg-gradient-to-r from-success-500 to-success-600 text-white'
                  : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
            }`}>
              🔥 {benefit.badge}
            </span>
          </div>
        )}

        {/* Current Tier Indicator */}
        {isCurrentTier && (
          <div className="absolute top-4 right-4 bg-success-500 text-white text-xs px-3 py-1 rounded-full font-bold">
            CURRENT PLAN
          </div>
        )}

        <div className="p-8">
          {/* Urgency Offer */}
          {benefit.urgencyOffer && (
            <div className="bg-danger-500/20 border border-danger-500/50 rounded-lg p-3 mb-6 text-center">
              <div className="text-danger-400 font-bold text-sm mb-1">
                🔥 LIMITED TIME: {benefit.urgencyOffer.discount}% OFF
              </div>
              <div className="text-danger-300 text-xs">
                {benefit.urgencyOffer.reason} • Expires in {formatTime(benefit.urgencyOffer.timeLeft)}
              </div>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-8">
            <h3 className={`text-2xl font-bold mb-2 ${
              benefit.popular ? 'text-volt-300' : benefit.bestValue ? 'text-success-300' : 'text-white'
            }`}>
              {benefit.title}
            </h3>
            <p className="text-secondary-400 mb-6">{benefit.subtitle}</p>
            
            <div className="mb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                {benefit.urgencyOffer && (
                  <span className="text-lg text-secondary-400 line-through">
                    ${originalPrice}
                  </span>
                )}
                <span className="text-5xl font-black">
                  <span className={benefit.popular ? 'text-volt-400' : benefit.bestValue ? 'text-success-400' : 'text-volt-400'}>
                    ${discountedPrice}
                  </span>
                  <span className="text-lg text-secondary-400">/month</span>
                </span>
              </div>
              {isAnnual && benefit.yearlyDiscount > 0 && (
                <div className="text-sm text-success-400 font-bold">
                  Save ${(benefit.monthlyValue - benefit.yearlyValue) * 12}/year
                </div>
              )}
            </div>
          </div>

          {/* Value Proposition */}
          {analysisData && benefit.tier === 'growth' && (
            <div className="bg-volt-500/10 border border-volt-500/30 rounded-lg p-4 mb-6">
              <div className="text-sm font-bold text-volt-400 mb-2">
                🎯 Based on Your Analysis:
              </div>
              <div className="text-xs text-secondary-300 space-y-1">
                <div>• {analysisData.opportunitiesFound} directories identified</div>
                <div>• ${analysisData.estimatedValue}/month potential value</div>
                <div>• {Math.round((analysisData.estimatedValue / discountedPrice) * 100)}% estimated ROI</div>
              </div>
            </div>
          )}

          {/* Features */}
          <div className="space-y-3 mb-8">
            {benefit.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 text-sm">
                <span className={`flex-shrink-0 mt-0.5 ${
                  benefit.popular ? 'text-volt-400' : benefit.bestValue ? 'text-success-400' : 'text-success-400'
                }`}>
                  ✓
                </span>
                <span className="text-secondary-200">{feature}</span>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          {!isCurrentTier ? (
            <button
              onClick={() => onUpgrade(benefit.tier)}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg ${
                benefit.popular
                  ? 'bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 hover:from-volt-400 hover:to-volt-500 animate-glow'
                  : benefit.bestValue
                    ? 'bg-gradient-to-r from-success-500 to-success-600 text-white hover:from-success-400 hover:to-success-500'
                    : 'bg-secondary-700 hover:bg-secondary-600 text-white'
              }`}
            >
              {benefit.urgencyOffer ? `🔥 Claim ${benefit.urgencyOffer.discount}% Discount` : `Upgrade to ${benefit.title}`}
              <div className="text-sm opacity-80 font-normal mt-1">
                {isAnnual ? 'Billed annually' : 'Billed monthly'} • Cancel anytime
              </div>
            </button>
          ) : (
            <div className="w-full py-4 rounded-xl font-bold text-lg bg-success-500/20 border-2 border-success-500/50 text-success-400 text-center">
              ✓ Your Current Plan
              <div className="text-sm opacity-80 font-normal mt-1">
                Enjoying all these features
              </div>
            </div>
          )}

          {/* Guarantee */}
          <div className="text-center mt-4 text-xs text-secondary-400">
            🛡️ 30-day money-back guarantee
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-black text-white mb-4">
          Choose Your Success Level
        </h2>
        <p className="text-secondary-300 text-lg max-w-3xl mx-auto mb-8">
          Every tier includes professional-grade analysis worth $2,600+ in consulting fees. 
          <span className="text-volt-400 font-bold"> Choose the level that matches your growth ambitions.</span>
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className={`font-medium ${!isAnnual ? 'text-white' : 'text-secondary-400'}`}>
            Monthly
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${
              isAnnual ? 'bg-volt-500' : 'bg-secondary-600'
            }`}
          >
            <div className={`absolute w-6 h-6 bg-white rounded-full top-1 transition-transform duration-300 ${
              isAnnual ? 'translate-x-9' : 'translate-x-1'
            }`}></div>
          </button>
          <span className={`font-medium ${isAnnual ? 'text-white' : 'text-secondary-400'}`}>
            Annual
          </span>
          {isAnnual && (
            <span className="bg-success-500 text-white text-xs px-2 py-1 rounded-full font-bold ml-2">
              Save 20%
            </span>
          )}
        </div>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {tierBenefits.map(benefit => (
          <TierCard key={benefit.tier} benefit={benefit} />
        ))}
      </div>

      {/* Feature Comparison */}
      {showComparison && <FeatureComparisonTable />}

      {/* Trust Signals */}
      <div className="bg-secondary-800/30 rounded-2xl border border-secondary-700 p-8 text-center">
        <h3 className="text-2xl font-bold text-white mb-6">
          Trusted by 500+ Growing Businesses
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-secondary-700/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-success-400 mb-1">94%</div>
            <div className="text-sm text-secondary-300">Success Rate</div>
          </div>
          <div className="bg-secondary-700/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-volt-400 mb-1">15 days</div>
            <div className="text-sm text-secondary-300">Avg. ROI Time</div>
          </div>
          <div className="bg-secondary-700/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-400 mb-1">$5.2K</div>
            <div className="text-sm text-secondary-300">Avg. Monthly Value</div>
          </div>
          <div className="bg-secondary-700/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-success-400 mb-1">4.9/5</div>
            <div className="text-sm text-secondary-300">Customer Rating</div>
          </div>
        </div>
      </div>
    </div>
  )
}