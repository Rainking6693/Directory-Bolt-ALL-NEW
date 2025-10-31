'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

interface SmartPricingRecommendationsProps {
  analysisData?: {
    businessSize?: 'small' | 'medium' | 'large'
    industry?: string
    potentialLeads?: number
    visibility?: number
  }
  userSource?: 'organic' | 'paid' | 'referral' | 'direct'
}

interface PricingTier {
  id: string
  name: string
  price: number
  annualPrice: number
  description: string
  directories: number
  features: string[]
  recommended?: boolean
  popular?: boolean
  bestValue?: boolean
  urgencyOffer?: {
    discount: number
    timeLeft: number
    reason: string
  }
  roi: {
    monthlyLeads: string
    revenueIncrease: string
    paybackPeriod: string
  }
}

export default function SmartPricingRecommendations({ 
  analysisData, 
  userSource = 'direct' 
}: SmartPricingRecommendationsProps) {
  const router = useRouter()
  const [isAnnual, setIsAnnual] = useState(false)
  const [recommendedPlan, setRecommendedPlan] = useState<string>('growth')
  const [timeLeft, setTimeLeft] = useState(47 * 60 * 60 + 23 * 60) // 47 hours 23 minutes
  const [showExitIntent, setShowExitIntent] = useState(false)
  const [signupsToday, setSignupsToday] = useState(23)

  const pricingTiers: PricingTier[] = [
    {
      id: 'starter',
      name: 'Starter',
      price: 49,
      annualPrice: 39,
      description: 'Perfect for testing ROI with high-authority directories',
      directories: 25,
      features: [
        '🎯 Top 25 highest-authority directories (60-91 DA)',
        '⭐ Product Hunt, Crunchbase, G2 access guaranteed',
        '✅ 90%+ approval rates (easiest submissions only)',
        '📊 Real-time submission tracking',
        '📧 Email support (24-48hr response)',
        '🎨 AI-optimized listing descriptions',
        '📈 Monthly performance reports'
      ],
      roi: {
        monthlyLeads: '8-15 leads',
        revenueIncrease: '+35% visibility',
        paybackPeriod: '15-20 days'
      }
    },
    {
      id: 'growth',
      name: 'Growth',
      price: 79,
      annualPrice: 63,
      description: 'Most popular - ideal for serious business growth',
      directories: 50,
      recommended: true,
      popular: true,
      features: [
        '🚀 All Starter directories PLUS 25 premium sites',
        '🔥 Hacker News, AlternativeTo, GetApp access',
        '🤖 Advanced AI listing optimization',
        '📈 Competitor analysis & monitoring',
        '💬 Priority support (same-day response)',
        '📊 Advanced analytics dashboard',
        '🎯 Industry-specific directory targeting',
        '⚡ Weekly submission batches'
      ],
      roi: {
        monthlyLeads: '20-35 leads',
        revenueIncrease: '+65% visibility',
        paybackPeriod: '8-12 days'
      },
      urgencyOffer: {
        discount: 20,
        timeLeft: timeLeft,
        reason: 'Limited monthly spots available'
      }
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 129,
      annualPrice: 119,
      description: 'Maximum exposure for established businesses',
      directories: 100,
      bestValue: true,
      features: [
        '🌟 All Growth directories PLUS 50 premium sites',
        '📊 Custom branded analytics reports',
        '🔧 API access for seamless integrations',
        '📞 Phone support & dedicated success manager',
        '📈 White-label client reporting',
        '🎯 Custom directory research & submissions',
        '⚡ Daily submission monitoring',
        '🔔 Real-time competitor alerts'
      ],
      roi: {
        monthlyLeads: '40-60 leads',
        revenueIncrease: '+85% visibility',
        paybackPeriod: '5-7 days'
      }
    }
  ]

  useEffect(() => {
    // Smart plan recommendation based on analysis data
    if (analysisData) {
      const { businessSize, potentialLeads = 0, visibility = 0 } = analysisData
      
      if (businessSize === 'large' || potentialLeads > 40 || visibility < 30) {
        setRecommendedPlan('professional')
      } else if (businessSize === 'medium' || potentialLeads > 20 || visibility < 50) {
        setRecommendedPlan('growth')
      } else {
        setRecommendedPlan('starter')
      }
    }

    // Urgency timer
    const timer = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0)
    }, 1000)

    // Simulate daily signups
    const signupTimer = setInterval(() => {
      setSignupsToday(prev => prev + Math.floor(Math.random() * 2))
    }, 60000)

    // Exit intent detection
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !showExitIntent) {
        setShowExitIntent(true)
      }
    }

    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      clearInterval(timer)
      clearInterval(signupTimer)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [analysisData, showExitIntent])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const handlePlanSelect = async (tier: PricingTier) => {
    // Track plan selection with context
    if (typeof window !== 'undefined') {
      ((window as any).gtag)?.('event', 'plan_selected', {
        event_category: 'conversion',
        event_label: tier.id,
        value: isAnnual ? tier.annualPrice : tier.price,
        custom_parameters: {
          recommended_plan: recommendedPlan,
          user_source: userSource,
          has_analysis_data: !!analysisData
        }
      })
    }

    if (tier.id === 'enterprise') {
      window.open('mailto:sales@directorybolt.com?subject=Enterprise Plan Inquiry', '_blank')
      return
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: tier.id,
          billing: isAnnual ? 'annual' : 'monthly',
          user_email: `user@example.com`,
          user_id: `user_${Date.now()}`,
          success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${window.location.origin}/pricing?cancelled=true`,
          metadata: {
            source: 'smart_pricing_recommendations',
            recommended_plan: recommendedPlan,
            selected_plan: tier.id,
            analysis_data: analysisData ? JSON.stringify(analysisData) : null
          }
        }),
      })

      const { data } = await response.json()
      
      if (data?.checkout_session?.url) {
        window.location.href = data.checkout_session.url
      } else {
        throw new Error('Failed to create checkout session')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      router.push(`/analyze?plan=${tier.id}&billing=${isAnnual ? 'annual' : 'monthly'}`)
    }
  }

  // Exit intent popup
  const ExitIntentOffer = () => (
    showExitIntent && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-r from-danger-500/20 to-volt-500/20 rounded-2xl border border-volt-500/50 p-8 max-w-lg mx-auto text-center animate-zoom-in">
          <div className="text-6xl mb-4 animate-bounce">🛑</div>
          <h3 className="text-3xl font-bold text-white mb-4">Wait! Don't Miss Out</h3>
          <p className="text-secondary-300 mb-6">
            Get 20% off your first month - this offer expires when you leave this page
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                setShowExitIntent(false)
                handlePlanSelect(pricingTiers.find(t => t.id === recommendedPlan)!)
              }}
              className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-3 px-6 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all"
            >
              Claim 20% Discount
            </button>
            <button
              onClick={() => setShowExitIntent(false)}
              className="border border-secondary-600 text-secondary-300 font-bold py-3 px-6 rounded-lg hover:bg-secondary-600 hover:text-white transition-all"
            >
              No Thanks
            </button>
          </div>
        </div>
      </div>
    )
  )

  return (
    <div className="space-y-8">
      <ExitIntentOffer />
      
      {/* Urgency Banner */}
      <div className="bg-gradient-to-r from-danger-500/20 to-volt-500/20 rounded-2xl border border-volt-500/50 p-6 text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="text-3xl animate-pulse">⏰</span>
          <div>
            <h3 className="text-xl font-bold text-volt-400">Limited Time: March Enrollment Closing Soon</h3>
            <p className="text-secondary-300">Only accepting {50 - signupsToday} more businesses this month</p>
          </div>
        </div>
        <div className="text-2xl font-mono text-volt-400 font-bold">
          Time remaining: {formatTime(timeLeft)}
        </div>
      </div>

      {/* Smart Recommendation Header */}
      {analysisData && (
        <div className="bg-gradient-to-r from-volt-500/10 to-volt-600/10 rounded-2xl border border-volt-500/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🎯</span>
            <h3 className="text-xl font-bold text-volt-400">AI-Powered Recommendation</h3>
          </div>
          <p className="text-secondary-300 mb-4">
            Based on your business analysis, we recommend the <span className="text-volt-400 font-bold">{pricingTiers.find(t => t.id === recommendedPlan)?.name}</span> plan 
            for optimal ROI and growth.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-volt-500/10 rounded-lg p-3">
              <div className="font-bold text-volt-400">Your Potential</div>
              <div className="text-secondary-300">{analysisData.potentialLeads || 25} monthly leads</div>
            </div>
            <div className="bg-volt-500/10 rounded-lg p-3">
              <div className="font-bold text-volt-400">Current Visibility</div>
              <div className="text-secondary-300">{analysisData.visibility || 45}% (needs improvement)</div>
            </div>
            <div className="bg-volt-500/10 rounded-lg p-3">
              <div className="font-bold text-volt-400">Business Size</div>
              <div className="text-secondary-300 capitalize">{analysisData.businessSize || 'Small'} business</div>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {pricingTiers.map((tier) => {
          const isRecommended = tier.id === recommendedPlan
          const currentPrice = isAnnual ? tier.annualPrice : tier.price
          const savings = isAnnual ? (tier.price - tier.annualPrice) * 12 : 0
          
          return (
            <div
              key={tier.id}
              className={`relative transform transition-all duration-500 hover:scale-105 ${
                isRecommended ? 'scale-105 z-10' : ''
              }`}
            >
              {/* Recommendation Badge */}
              {isRecommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                  <span className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black px-6 py-2 rounded-full text-sm shadow-lg animate-pulse">
                    🤖 AI RECOMMENDED FOR YOU
                  </span>
                </div>
              )}

              {/* Popular Badge */}
              {tier.popular && !isRecommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                  <span className="bg-gradient-to-r from-success-500 to-success-600 text-white font-black px-6 py-2 rounded-full text-sm shadow-lg">
                    🔥 MOST POPULAR
                  </span>
                </div>
              )}

              {/* Best Value Badge */}
              {tier.bestValue && !isRecommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                  <span className="bg-gradient-to-r from-purple-500 to-purple-600 text-white font-black px-6 py-2 rounded-full text-sm shadow-lg">
                    💎 BEST VALUE
                  </span>
                </div>
              )}

              <div className={`h-full bg-gradient-to-br backdrop-blur-sm rounded-2xl p-8 border-2 ${
                isRecommended
                  ? 'from-volt-500/30 to-volt-600/20 border-volt-500 shadow-2xl shadow-volt-500/30'
                  : tier.popular
                  ? 'from-success-500/20 to-success-600/10 border-success-500/50 shadow-xl'
                  : 'from-secondary-800/80 to-secondary-900/60 border-secondary-600'
              }`}>
                {/* Urgency Offer */}
                {tier.urgencyOffer && (
                  <div className="bg-danger-500/20 border border-danger-500/50 rounded-lg p-3 mb-4 text-center">
                    <div className="text-danger-400 font-bold text-sm">
                      🔥 {tier.urgencyOffer.discount}% OFF - {tier.urgencyOffer.reason}
                    </div>
                    <div className="text-danger-300 text-xs">
                      Expires in {formatTime(tier.urgencyOffer.timeLeft)}
                    </div>
                  </div>
                )}

                {/* Header */}
                <div className="text-center mb-6">
                  <h3 className={`text-2xl font-bold mb-2 ${isRecommended ? 'text-volt-300' : 'text-white'}`}>
                    {tier.name}
                  </h3>
                  <div className="mb-4">
                    <div className="flex items-center justify-center gap-2">
                      {tier.urgencyOffer && (
                        <span className="text-lg text-secondary-400 line-through">
                          ${currentPrice}
                        </span>
                      )}
                      <span className="text-5xl font-black">
                        <span className={isRecommended ? 'text-volt-400' : 'text-volt-400'}>
                          ${tier.urgencyOffer ? Math.round(currentPrice * (1 - tier.urgencyOffer.discount / 100)) : currentPrice}
                        </span>
                        <span className="text-lg text-secondary-400">/month</span>
                      </span>
                    </div>
                    {savings > 0 && (
                      <div className="text-sm text-success-400 font-bold mt-1">
                        Save ${savings}/year with annual billing
                      </div>
                    )}
                  </div>
                  <p className="text-secondary-300 text-sm">{tier.description}</p>
                </div>

                {/* ROI Preview */}
                <div className={`p-4 rounded-lg mb-6 ${
                  isRecommended
                    ? 'bg-volt-500/10 border border-volt-500/30'
                    : 'bg-secondary-700/50 border border-secondary-600/50'
                }`}>
                  <div className={`text-sm font-bold mb-2 ${isRecommended ? 'text-volt-400' : 'text-volt-400'}`}>
                    📈 Expected Results:
                  </div>
                  <div className="text-xs text-secondary-300 space-y-1">
                    <div>• {tier.roi.monthlyLeads} new monthly leads</div>
                    <div>• {tier.roi.revenueIncrease} search visibility boost</div>
                    <div>• {tier.roi.paybackPeriod} typical payback period</div>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {tier.features.slice(0, 5).map((feature, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm">
                      <span className={`${isRecommended ? 'text-volt-400' : 'text-success-400'} flex-shrink-0 mt-0.5`}>
                        ✅
                      </span>
                      <span className="text-secondary-200">{feature}</span>
                    </li>
                  ))}
                  {tier.features.length > 5 && (
                    <li className="text-xs text-secondary-400 pl-6">
                      + {tier.features.length - 5} more features
                    </li>
                  )}
                </ul>

                {/* Social Proof */}
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="flex -space-x-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="w-5 h-5 bg-gradient-to-r from-volt-400 to-volt-600 rounded-full border border-secondary-800"></div>
                      ))}
                    </div>
                    <span className="text-xs text-secondary-400">
                      {tier.id === 'starter' ? '127' : tier.id === 'growth' ? '284' : '96'} businesses chose this plan
                    </span>
                  </div>
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handlePlanSelect(tier)}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg ${
                    isRecommended
                      ? 'bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 hover:from-volt-400 hover:to-volt-500 animate-glow'
                      : tier.popular
                      ? 'bg-gradient-to-r from-success-500 to-success-600 text-white hover:from-success-400 hover:to-success-500'
                      : 'bg-secondary-700 hover:bg-secondary-600 text-white'
                  }`}
                >
                  {isRecommended ? '🚀 Get Recommended Plan' : tier.popular ? '🔥 Choose Popular Plan' : 'Select Plan'}
                  <span className="block text-sm opacity-80 font-normal">
                    {tier.urgencyOffer ? `Save ${tier.urgencyOffer.discount}% • ` : ''}14-day free trial
                  </span>
                </button>

                {/* Guarantee */}
                <div className="text-center mt-4 text-xs text-secondary-400">
                  🛡️ 30-day money-back guarantee
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Social Proof Section */}
      <div className="bg-secondary-800/50 rounded-2xl border border-secondary-600 p-8 text-center">
        <h3 className="text-2xl font-bold mb-6 text-white">Join Today's Success Stories</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-secondary-900/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-success-400 mb-2">{signupsToday}</div>
            <div className="text-sm text-secondary-300">Businesses joined today</div>
          </div>
          <div className="bg-secondary-900/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-volt-400 mb-2">487</div>
            <div className="text-sm text-secondary-300">Active this month</div>
          </div>
          <div className="bg-secondary-900/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-success-400 mb-2">94%</div>
            <div className="text-sm text-secondary-300">See results in 30 days</div>
          </div>
        </div>
      </div>
    </div>
  )
}