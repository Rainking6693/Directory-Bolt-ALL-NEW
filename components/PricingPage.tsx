'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import FeatureTooltip from './ui/FeatureTooltip'
// @ts-ignore - CheckoutButton is a .jsx file
import CheckoutButton from './CheckoutButton'
import { PRICING_TIERS, getAllTiers, type PricingTier } from '../lib/config/pricing'

// Use centralized pricing configuration
const pricingTiers = getAllTiers()

const testimonials = [
  {
    name: 'Sarah Chen',
    company: 'Local Dental Practice',
    role: 'Practice Owner',
    content: 'DirectoryBolt increased our online visibility by 400%. We now get 3-4 new patients per week from local searches.',
    rating: 5,
    results: '+400% online visibility'
  },
  {
    name: 'Marcus Rodriguez',
    company: 'Rodriguez Auto Repair',
    role: 'Owner',
    content: 'Best one-time investment we made. No monthly fees, just results. Brought in $15K in new business in 60 days.',
    rating: 5,
    results: '$15K new revenue'
  },
  {
    name: 'Jennifer Walsh',
    company: 'Walsh Marketing Agency',
    role: 'CEO',
    content: 'We use DirectoryBolt for all our clients. The ROI is incredible - clients see results in weeks, not months.',
    rating: 5,
    results: '600% client ROI'
  }
]

export default function PricingPage() {
  const router = useRouter()
  const [isAnnual, setIsAnnual] = useState(false) // Keep for legacy support, but no longer used
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [showROICalculator, setShowROICalculator] = useState(false)
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([])
  
  // ROI Calculator State
  const [currentRevenue, setCurrentRevenue] = useState(10000)
  const [newCustomersWorth, setNewCustomersWorth] = useState(500)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  // Generate button style based on tier properties
  const getButtonStyle = (tier: PricingTier): string => {
    if (tier.highlighted || tier.popular) {
      return 'bg-gradient-to-r from-volt-500 to-volt-600 hover:from-volt-400 hover:to-volt-500 text-secondary-900 font-black'
    }
    if (tier.id === 'enterprise') {
      return 'bg-gradient-to-r from-success-500 to-success-600 hover:from-success-400 hover:to-success-500 text-white font-black'
    }
    return 'bg-secondary-700 hover:bg-secondary-600 text-white'
  }

  // Generate button text based on tier
  const getButtonText = (tier: PricingTier): string => {
    switch (tier.id) {
      case 'starter': return 'Purchase Analysis'
      case 'growth': return 'Buy Intelligence Package'
      case 'professional': return 'Purchase Enterprise'
      case 'enterprise': return 'Buy Complete Suite'
      default: return 'Purchase Plan'
    }
  }

  // URL functions for checkout
  const getSuccessUrl = (planId: string) => {
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/success?session_id={CHECKOUT_SESSION_ID}&plan=${planId}&billing=one_time`
  }

  const getCancelUrl = (planId: string) => {
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/pricing?cancelled=true&plan=${planId}&billing=one_time`
  }

  const calculateROI = (tier: PricingTier) => {
    const oneTimeInvestment = tier.price
    const estimatedNewCustomers = parseInt(tier.valueProps.newCustomers.split('-')[0] || '2')
    const monthlyReturn = estimatedNewCustomers * newCustomersWorth
    const roiPercentage = ((monthlyReturn - oneTimeInvestment) / oneTimeInvestment) * 100
    
    return {
      monthlyReturn,
      roiPercentage: Math.round(roiPercentage),
      annualReturn: monthlyReturn * 12,
      oneTimeInvestment: oneTimeInvestment
    }
  }

  const handleAddOnToggle = (addOnId: string) => {
    setSelectedAddOns(prev => {
      if (prev.includes(addOnId)) {
        return prev.filter(id => id !== addOnId)
      } else {
        return [...prev, addOnId]
      }
    })
  }

  const getAddOnTotal = () => {
    const addOnPrices: { [key: string]: number } = {
      fast_track: 25,
      premium_directories: 15,
      manual_qa: 10,
      csv_export: 9
    }
    return selectedAddOns.reduce((total, addOnId) => total + (addOnPrices[addOnId] || 0), 0)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900 text-white">
      {/* Header Section */}
      <section className={`relative pt-20 pb-16 px-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-volt-500 rounded-full blur-3xl opacity-10 animate-pulse-volt"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-volt-400 rounded-full blur-3xl opacity-10 animate-pulse-volt" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto text-center">
          {/* Main Header */}
          <div className="animate-slide-up">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight">
              Choose Your
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600 animate-glow">
                Growth Plan
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-secondary-300 mb-8 max-w-4xl mx-auto">
              Stop losing customers to competitors. Get listed in 480+ directories with a one-time purchase and 
              <span className="text-volt-400 font-bold"> dominate local search results</span>
            </p>
          </div>

          {/* Value Proposition Cards */}
          <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-white">
              Why Choose DirectoryBolt
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-5xl mx-auto">
              <div className="bg-gradient-to-br from-success-900/50 to-success-800/30 p-6 rounded-xl border border-success-600/50 backdrop-blur-sm">
                <div className="text-4xl mb-4">⏱️</div>
                <h3 className="text-lg font-bold text-success-300 mb-2">Save 40+ Hours Total</h3>
              <p className="text-sm text-secondary-300">One-time automated directory submissions vs manual work</p>
            </div>
            
            <div className="bg-gradient-to-br from-volt-900/50 to-volt-800/30 p-6 rounded-xl border border-volt-600/50 backdrop-blur-sm">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-lg font-bold text-volt-300 mb-2">Proven ROI: 400-800%</h3>
              <p className="text-sm text-secondary-300">Average client return on investment</p>
            </div>
            
            <div className="bg-gradient-to-br from-success-900/50 to-success-800/30 p-6 rounded-xl border border-success-600/50 backdrop-blur-sm">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-lg font-bold text-success-300 mb-2">Results in 30 Days</h3>
              <p className="text-sm text-secondary-300">Or your money back - guaranteed</p>
            </div>
            </div>
          </div>

          {/* One-Time Purchase Message */}
          <div className="animate-slide-up flex items-center justify-center gap-4 mb-12" style={{ animationDelay: '0.6s' }}>
            <div className="bg-gradient-to-r from-volt-500/20 to-volt-600/10 border border-volt-500/30 px-6 py-3 rounded-full">
              <span className="text-volt-400 font-bold text-lg">💡 One-Time Purchase - No Monthly Fees!</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards Section */}
      <section className="px-4 pb-16">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-12 text-white">
            Choose Your Plan
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6 sm:gap-8 mb-16">
            {pricingTiers.map((tier, index) => {
              const roi = calculateROI(tier)
              return (
                <div
                  key={tier.id}
                  className={`relative transform transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-volt-500/20 ${
                    tier.highlighted ? 'scale-105' : ''
                  } animate-slide-up group`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Popular Badge */}
                  {tier.popular && (
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-20">
                      <span className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black px-4 py-2 rounded-full text-xs shadow-lg whitespace-nowrap">
                        🔥 {tier.badge || 'MOST POPULAR'}
                      </span>
                    </div>
                  )}

                  <div className={`h-full bg-gradient-to-br backdrop-blur-sm rounded-2xl p-6 sm:p-8 transition-all duration-300 group-hover:bg-gradient-to-br ${
                    tier.highlighted
                      ? 'from-volt-500/20 to-volt-600/10 border-2 border-volt-500 shadow-2xl shadow-volt-500/20 group-hover:from-volt-500/30 group-hover:to-volt-600/20'
                      : 'from-secondary-800/80 to-secondary-900/60 border border-secondary-600 group-hover:from-secondary-700/90 group-hover:to-secondary-800/70 group-hover:border-volt-500/50'
                  }`}>
                    {/* Header */}
                    <div className="text-center mb-6">
                      <h3 className={`text-2xl font-bold mb-2 ${tier.highlighted ? 'text-volt-300' : 'text-white'}`}>
                        {tier.name}
                      </h3>
                      <div className="mb-4">
                        <div className="text-5xl font-black mb-2">
                          <span className={tier.highlighted ? 'text-volt-400' : 'text-volt-400'}>
                            ${tier.price}
                          </span>
                          <span className="text-lg text-secondary-400"> ONE-TIME</span>
                        </div>
                        {/* No annual pricing - one-time purchase only */}
                      </div>
                      <p className="text-secondary-300 text-sm">{tier.description}</p>
                    </div>

                    {/* Features */}
                    <ul className="space-y-3 mb-6">
                      {tier.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-3 text-sm">
                          <span className={`${tier.highlighted ? 'text-volt-400' : 'text-success-400'} text-lg flex-shrink-0 mt-0.5`}>
                            ✅
                          </span>
                          <span className="text-secondary-200">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* ROI Box */}
                    <div className={`p-4 rounded-lg mb-6 ${
                      tier.highlighted
                        ? 'bg-volt-500/10 border border-volt-500/30'
                        : 'bg-secondary-700/50 border border-secondary-600/50'
                    }`}>
                      <div className={`text-sm font-bold mb-2 ${tier.highlighted ? 'text-volt-400' : 'text-volt-400'}`}>
                        💰 ROI Projection:
                      </div>
                      <div className="text-xs text-secondary-300 space-y-1">
                        <div>• {tier.valueProps.timesSaved}</div>
                        <div>• {tier.valueProps.visibilityIncrease}</div>
                        <div>• {tier.valueProps.newCustomers}</div>
                        <div className="font-bold text-success-400">• ROI: {tier.valueProps.roiPercentage}</div>
                      </div>
                    </div>

                    {/* CTA Button - Enhanced for mobile responsiveness */}
                    <div className="w-full space-y-3">
                      <CheckoutButton
                        plan={tier.id}
                        variant={tier.highlighted ? 'primary' : 'secondary'}
                        size="lg"
                        className={`w-full py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all duration-300 transform hover:scale-105 shadow-lg group-hover:shadow-2xl ${getButtonStyle(tier)} min-h-[48px] sm:min-h-[56px] flex items-center justify-center`}
                        successUrl={getSuccessUrl(tier.id)}
                        cancelUrl={getCancelUrl(tier.id)}
                        customerEmail=""
                        showAddOnUpsell={tier.id !== 'free' && tier.id !== 'subscription'}
                        addons={selectedAddOns}
                        metadata={{ billingPeriod: 'one_time', price: tier.price }}
                        onAddOnsSelected={(addons: any) => {
                          console.log('Add-ons selected for plan:', tier.id, addons)
                          if (typeof window !== 'undefined' && (window as any).gtag) {
                            (window as any).gtag('event', 'addons_selected', {
                              plan: tier.id,
                              addons: addons,
                              total_addon_value: addons.reduce((sum: number, id: string) => {
                                const prices: any = { fast_track: 25, premium_directories: 15, manual_qa: 10, csv_export: 9 }
                                return sum + (prices[id] || 0)
                              }, 0)
                            })
                          }
                        }}
                        onSuccess={(data: any) => {
                          console.log('Checkout success:', data)
                          // Track conversion event
                          if (typeof window !== 'undefined' && (window as any).gtag) {
                            (window as any).gtag('event', 'purchase_initiated', {
                              plan: tier.id,
                              billing: 'one_time',
                              value: tier.price
                            })
                          }
                        }}
                        onError={(error: any) => {
                          console.error('Checkout error for plan:', tier.id, error)
                          // Enhanced mobile error handling
                          const errorMessage = error?.message || 'Checkout temporarily unavailable';
                          if (typeof window !== 'undefined') {
                            if (window.innerWidth < 768) {
                              // Mobile-specific fallback
                              alert(`${errorMessage}. Redirecting to manual setup...`);
                            }
                            router.push(`/analyze?recommended_plan=${tier.id}&billing=one_time&error=checkout_failed`);
                          }
                        }}
                      >
                        {getButtonText(tier)}
                      </CheckoutButton>
                      {tier.id !== 'free' && (
                        <div className="text-center text-xs sm:text-sm text-secondary-400 group-hover:text-secondary-300 transition-colors px-2">
                          <span className="inline-flex items-center gap-1">
                            <span>🔒</span>
                            <span>One-time purchase • 30-day guarantee</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Directory Examples */}
                    <div className="text-center mt-4 p-3 bg-secondary-900/30 rounded-lg border border-secondary-600/30 group-hover:bg-secondary-900/50 group-hover:border-secondary-500/50 transition-all duration-300">
                      <div className="text-xs font-bold text-secondary-300 mb-2">
                        {tier.id === 'subscription' ? '🎯 One-Time Service' : `🎯 ${tier.directories} Premium Directories`}
                      </div>
                      <div className="text-xs text-secondary-400 space-y-1">
                        {tier.id === 'starter' && (
                          <>
                            <div>• Product Hunt (DA 91)</div>
                            <div>• Crunchbase (DA 91)</div>
                            <div>• G2.com (DA 80)</div>
                            <div>• F6S (DA 72) + 46 more</div>
                          </>
                        )}
                        {tier.id === 'growth' && (
                          <>
                            <div>• All Starter directories PLUS:</div>
                            <div>• Hacker News (DA 89)</div>
                            <div>• AlternativeTo (DA 87)</div>
                            <div>• GetApp (DA 91) + 47 more</div>
                          </>
                        )}
                        {tier.id === 'pro' && (
                          <>
                            <div>• All Growth directories PLUS:</div>
                            <div>• 100 additional premium sites</div>
                            <div>• Industry-specific directories</div>
                            <div>• Regional platforms</div>
                          </>
                        )}
                        {tier.id === 'subscription' && (
                          <>
                            <div>• Keep all listings updated</div>
                            <div>• Automatic resubmissions</div>
                            <div>• Quarterly reports</div>
                            <div>• Profile optimization</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Add-ons Section */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4">
              Enhance Your
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600"> Package</span>
            </h2>
            <p className="text-lg sm:text-xl text-secondary-300">
              Add powerful extras to accelerate your results
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div 
              className={`cursor-pointer p-4 sm:p-6 rounded-2xl border-2 backdrop-blur-sm transition-all duration-300 transform hover:scale-105 group ${
                selectedAddOns.includes('fast_track')
                  ? 'bg-volt-500/10 border-volt-500 shadow-lg shadow-volt-500/20'
                  : 'bg-gradient-to-br from-secondary-800/80 to-secondary-900/60 border-secondary-600 hover:border-volt-500/50 hover:from-secondary-700/90 hover:to-secondary-800/70'
              }`}
              onClick={() => handleAddOnToggle('fast_track')}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
                <div className="mb-2 sm:mb-0">
                  <h3 className={`text-base sm:text-lg font-bold flex items-center gap-2 transition-colors ${
                    selectedAddOns.includes('fast_track') ? 'text-volt-300' : 'text-white group-hover:text-volt-300'
                  }`}>
                    <span>⚡</span> Fast-Track Submission
                    {selectedAddOns.includes('fast_track') && <span className="text-sm bg-volt-500 text-secondary-900 px-2 py-1 rounded-full ml-2">✓</span>}
                  </h3>
                  <p className="text-xs sm:text-sm text-secondary-300 group-hover:text-secondary-200 transition-colors">Priority processing within 24 hours</p>
                </div>
                <div className="text-volt-400 font-black text-lg sm:text-xl group-hover:text-volt-300 transition-colors">+$25</div>
              </div>
              <div className="text-xs text-secondary-400 group-hover:text-secondary-300 transition-colors">
                Skip the queue and get your submissions processed first
              </div>
            </div>

            <div 
              className={`cursor-pointer p-4 sm:p-6 rounded-2xl border-2 backdrop-blur-sm transition-all duration-300 transform hover:scale-105 group ${
                selectedAddOns.includes('premium_directories')
                  ? 'bg-volt-500/10 border-volt-500 shadow-lg shadow-volt-500/20'
                  : 'bg-gradient-to-br from-secondary-800/80 to-secondary-900/60 border-secondary-600 hover:border-volt-500/50 hover:from-secondary-700/90 hover:to-secondary-800/70'
              }`}
              onClick={() => handleAddOnToggle('premium_directories')}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
                <div className="mb-2 sm:mb-0">
                  <h3 className={`text-base sm:text-lg font-bold flex items-center gap-2 transition-colors ${
                    selectedAddOns.includes('premium_directories') ? 'text-volt-300' : 'text-white group-hover:text-volt-300'
                  }`}>
                    <span>👑</span> Premium Directories Only
                    {selectedAddOns.includes('premium_directories') && <span className="text-sm bg-volt-500 text-secondary-900 px-2 py-1 rounded-full ml-2">✓</span>}
                  </h3>
                  <p className="text-xs sm:text-sm text-secondary-300 group-hover:text-secondary-200 transition-colors">Focus on high-authority directories</p>
                </div>
                <div className="text-volt-400 font-black text-lg sm:text-xl group-hover:text-volt-300 transition-colors">+$15</div>
              </div>
              <div className="text-xs text-secondary-400 group-hover:text-secondary-300 transition-colors">
                Target only directories with DA 70+ for maximum impact
              </div>
            </div>

            <div 
              className={`cursor-pointer p-4 sm:p-6 rounded-2xl border-2 backdrop-blur-sm transition-all duration-300 transform hover:scale-105 group ${
                selectedAddOns.includes('manual_qa')
                  ? 'bg-volt-500/10 border-volt-500 shadow-lg shadow-volt-500/20'
                  : 'bg-gradient-to-br from-secondary-800/80 to-secondary-900/60 border-secondary-600 hover:border-volt-500/50 hover:from-secondary-700/90 hover:to-secondary-800/70'
              }`}
              onClick={() => handleAddOnToggle('manual_qa')}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
                <div className="mb-2 sm:mb-0">
                  <h3 className={`text-base sm:text-lg font-bold flex items-center gap-2 transition-colors ${
                    selectedAddOns.includes('manual_qa') ? 'text-volt-300' : 'text-white group-hover:text-volt-300'
                  }`}>
                    <span>🔍</span> Manual QA Review
                    {selectedAddOns.includes('manual_qa') && <span className="text-sm bg-volt-500 text-secondary-900 px-2 py-1 rounded-full ml-2">✓</span>}
                  </h3>
                  <p className="text-xs sm:text-sm text-secondary-300 group-hover:text-secondary-200 transition-colors">Human verification of all submissions</p>
                </div>
                <div className="text-volt-400 font-black text-lg sm:text-xl group-hover:text-volt-300 transition-colors">+$10</div>
              </div>
              <div className="text-xs text-secondary-400 group-hover:text-secondary-300 transition-colors">
                Expert review to ensure perfect listing quality
              </div>
            </div>

            <div 
              className={`cursor-pointer p-4 sm:p-6 rounded-2xl border-2 backdrop-blur-sm transition-all duration-300 transform hover:scale-105 group ${
                selectedAddOns.includes('csv_export')
                  ? 'bg-volt-500/10 border-volt-500 shadow-lg shadow-volt-500/20'
                  : 'bg-gradient-to-br from-secondary-800/80 to-secondary-900/60 border-secondary-600 hover:border-volt-500/50 hover:from-secondary-700/90 hover:to-secondary-800/70'
              }`}
              onClick={() => handleAddOnToggle('csv_export')}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
                <div className="mb-2 sm:mb-0">
                  <h3 className={`text-base sm:text-lg font-bold flex items-center gap-2 transition-colors ${
                    selectedAddOns.includes('csv_export') ? 'text-volt-300' : 'text-white group-hover:text-volt-300'
                  }`}>
                    <span>📊</span> CSV Export
                    {selectedAddOns.includes('csv_export') && <span className="text-sm bg-volt-500 text-secondary-900 px-2 py-1 rounded-full ml-2">✓</span>}
                  </h3>
                  <p className="text-xs sm:text-sm text-secondary-300 group-hover:text-secondary-200 transition-colors">Export submission results to CSV</p>
                </div>
                <div className="text-volt-400 font-black text-lg sm:text-xl group-hover:text-volt-300 transition-colors">+$9</div>
              </div>
              <div className="text-xs text-secondary-400 group-hover:text-secondary-300 transition-colors">
                Download your complete listing data for analysis
              </div>
            </div>
          </div>

          {/* Add-On Summary */}
          {selectedAddOns.length > 0 && (
            <div className="text-center mt-6 p-4 bg-volt-500/10 border border-volt-500/30 rounded-xl">
              <h3 className="text-lg font-bold text-volt-300 mb-2">
                Selected Add-ons (+${getAddOnTotal()})
              </h3>
              <div className="flex flex-wrap justify-center gap-2">
                {selectedAddOns.map(addOnId => {
                  const addOnNames: { [key: string]: string } = {
                    fast_track: 'Fast-Track Submission',
                    premium_directories: 'Premium Directories',
                    manual_qa: 'Manual QA Review',
                    csv_export: 'CSV Export'
                  }
                  return (
                    <span key={addOnId} className="bg-volt-500/20 text-volt-300 px-3 py-1 rounded-full text-sm">
                      {addOnNames[addOnId]}
                    </span>
                  )
                })}
              </div>
              <p className="text-xs text-secondary-300 mt-2">
                These will be pre-selected during checkout for any plan
              </p>
            </div>
          )}

          <div className="text-center mt-6 sm:mt-8">
            <p className="text-sm sm:text-base text-volt-400 font-bold mb-2">
              💡 Click add-ons above to pre-select them for checkout
            </p>
            <p className="text-xs sm:text-sm text-secondary-400">
              Maximum revenue potential: Base plan + $59 in add-ons per customer
            </p>
          </div>
        </div>
      </section>

      {/* ROI Calculator Section */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4">
              Calculate Your
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600"> ROI</span>
            </h2>
            <p className="text-lg sm:text-xl text-secondary-300">
              See exactly how much DirectoryBolt could be worth to your business
            </p>
          </div>

          <div className="bg-gradient-to-br from-secondary-800/80 to-secondary-900/60 p-6 sm:p-8 rounded-2xl border border-secondary-600 backdrop-blur-sm hover:border-volt-500/30 hover:from-secondary-700/90 hover:to-secondary-800/70 transition-all duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-secondary-300 mb-2">
                  Current Business Revenue
                </label>
                <input
                  type="range"
                  min="1000"
                  max="100000"
                  step="1000"
                  value={currentRevenue}
                  onChange={(e) => setCurrentRevenue(parseInt(e.target.value))}
                  className="w-full h-3 bg-secondary-700 rounded-lg appearance-none cursor-pointer range-slider"
                />
                <div className="text-2xl font-bold text-volt-400 mt-2">
                  ${currentRevenue.toLocaleString()}/month
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-secondary-300 mb-2">
                  Average Customer Value
                </label>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  value={newCustomersWorth}
                  onChange={(e) => setNewCustomersWorth(parseInt(e.target.value))}
                  className="w-full h-3 bg-secondary-700 rounded-lg appearance-none cursor-pointer range-slider"
                />
                <div className="text-2xl font-bold text-volt-400 mt-2">
                  ${newCustomersWorth}/customer
                </div>
              </div>
            </div>

            {/* ROI Results */}
            <div className="border-t border-secondary-600 pt-6">
              <h3 className="text-xl font-bold mb-4 text-center">
                Your Potential ROI with Growth Plan:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(() => {
                  const growthTier = pricingTiers.find(t => t.id === 'growth')!
                  const roi = calculateROI(growthTier)
                  return (
                    <>
                      <div className="text-center p-4 bg-success-900/30 rounded-lg border border-success-600/30">
                        <div className="text-2xl font-black text-success-400">
                          +${roi.monthlyReturn.toLocaleString()}
                        </div>
                        <div className="text-sm text-secondary-300">Projected Monthly Revenue</div>
                      </div>
                      <div className="text-center p-4 bg-volt-900/30 rounded-lg border border-volt-600/30">
                        <div className="text-2xl font-black text-volt-400">
                          {roi.roiPercentage}% ROI
                        </div>
                        <div className="text-sm text-secondary-300">Return on Investment</div>
                      </div>
                      <div className="text-center p-4 bg-success-900/30 rounded-lg border border-success-600/30">
                        <div className="text-2xl font-black text-success-400">
                          ${roi.annualReturn.toLocaleString()}
                        </div>
                        <div className="text-sm text-secondary-300">Annual Revenue</div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4">
              Join 500+ Businesses
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600"> Crushing It</span>
            </h2>
            <p className="text-lg sm:text-xl text-secondary-300">
              See what real customers are saying about their results
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-secondary-800/80 to-secondary-900/60 p-4 sm:p-6 rounded-2xl border border-secondary-600 backdrop-blur-sm animate-slide-up hover:border-volt-500/50 hover:from-secondary-700/90 hover:to-secondary-800/70 hover:scale-105 transition-all duration-300 group"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <span key={i} className="text-volt-400 text-lg sm:text-xl group-hover:text-volt-300 transition-colors">⭐</span>
                  ))}
                </div>
                <blockquote className="text-secondary-200 mb-4 italic text-sm sm:text-base group-hover:text-secondary-100 transition-colors">
                  "{testimonial.content}"
                </blockquote>
                <div className="border-t border-secondary-600 pt-4 group-hover:border-secondary-500 transition-colors">
                  <div className="font-bold text-white text-sm sm:text-base group-hover:text-volt-300 transition-colors">{testimonial.name}</div>
                  <div className="text-xs sm:text-sm text-secondary-400 group-hover:text-secondary-300 transition-colors">{testimonial.role}</div>
                  <div className="text-xs sm:text-sm text-secondary-400 group-hover:text-secondary-300 transition-colors">{testimonial.company}</div>
                  <div className="text-volt-400 font-bold text-xs sm:text-sm mt-2 group-hover:text-volt-300 transition-colors">
                    Result: {testimonial.results}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust Indicators */}
          <div className="text-center">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center items-center gap-4 sm:gap-6 lg:gap-8 mb-8 text-secondary-400">
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="text-success-400 text-lg sm:text-xl">🔒</span>
                <span>256-bit SSL</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="text-success-400 text-lg sm:text-xl">🏆</span>
                <span>SOC 2 Compliant</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="text-success-400 text-lg sm:text-xl">⭐</span>
                <span>4.9/5 Rating</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="text-success-400 text-lg sm:text-xl">🚀</span>
                <span>99.9% Uptime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-4 pb-16 sm:pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-volt-500/20 to-volt-600/20 p-6 sm:p-8 lg:p-12 rounded-2xl border border-volt-500/30 backdrop-blur-sm hover:from-volt-500/30 hover:to-volt-600/30 hover:border-volt-500/50 transition-all duration-500 group">
            
            {/* Urgency indicator */}
            <div className="inline-flex items-center gap-2 bg-danger-500/20 border border-danger-500/30 px-4 py-2 rounded-full text-xs sm:text-sm font-bold text-danger-300 mb-6 animate-pulse">
              <div className="w-2 h-2 bg-danger-400 rounded-full animate-ping"></div>
              487 businesses joined this month • Limited spots remaining
            </div>
            
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mb-6">
              Ready to Dominate
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600"> Local Search?</span>
            </h2>
            <p className="text-lg sm:text-xl text-secondary-300 mb-8">
              Join 500+ businesses already getting more customers with DirectoryBolt
            </p>
            
            {/* Enhanced mobile-first button layout */}
            <div className="flex flex-col gap-4 justify-center items-center mb-8 sm:flex-row sm:gap-6">
              <CheckoutButton
                plan="growth"
                variant="primary"
                size="xl"
                className="group w-full sm:w-auto px-6 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black text-base sm:text-xl rounded-xl hover:from-volt-400 hover:to-volt-500 transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-volt-500/50 animate-glow min-h-[56px] sm:min-h-[64px] max-w-sm sm:max-w-none"
                successUrl={getSuccessUrl('growth')}
                cancelUrl={getCancelUrl('growth')}
                customerEmail=""
                showAddOnUpsell={true}
                addons={selectedAddOns}
                onAddOnsSelected={(addons: any) => {
                  console.log('Final CTA add-ons selected:', addons)
                  if (typeof window !== 'undefined' && (window as any).gtag) {
                    (window as any).gtag('event', 'addons_selected', {
                      plan: 'growth',
                      addons: addons,
                      source: 'final_cta',
                      total_addon_value: addons.reduce((sum: number, id: string) => {
                        const prices: any = { fast_track: 25, premium_directories: 15, manual_qa: 10, csv_export: 9 }
                        return sum + (prices[id] || 0)
                      }, 0)
                    })
                  }
                }}
                onSuccess={(data: any) => {
                  console.log('Final CTA checkout success:', data)
                  if (typeof window !== 'undefined' && (window as any).gtag) {
                    (window as any).gtag('event', 'purchase_initiated', {
                      plan: 'growth',
                      billing: 'one_time',
                      value: 299,
                      source: 'final_cta'
                    })
                  }
                }}
                onError={(error: any) => {
                  console.error('Final CTA checkout error:', error)
                  // Mobile-friendly error handling
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    const shortError = error?.message?.substring(0, 50) || 'Checkout error';
                    alert(`${shortError}... Redirecting to alternative signup.`);
                  }
                }}
              >
                🚀 Purchase Now
              </CheckoutButton>
              
              <button
                onClick={() => router.push('/analyze')}
                className="w-full sm:w-auto px-6 sm:px-8 py-4 border-2 border-volt-500 text-volt-500 font-bold text-base sm:text-lg rounded-xl hover:bg-volt-500 hover:text-secondary-900 transform hover:scale-105 transition-all duration-300 min-h-[56px] sm:min-h-[64px] flex items-center justify-center max-w-sm sm:max-w-none"
              >
                ⚡ Free Analysis First
              </button>
            </div>

            {/* Guarantee */}
            <div className="bg-success-900/30 border border-success-600/30 p-4 sm:p-6 rounded-xl mb-6 group-hover:bg-success-900/50 group-hover:border-success-600/50 transition-all duration-300">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-2">
                <span className="text-success-400 text-xl sm:text-2xl">🛡️</span>
                <span className="text-lg sm:text-xl font-bold text-success-400 text-center sm:text-left">30-Day Money-Back Guarantee</span>
              </div>
              <p className="text-sm sm:text-base text-secondary-300 text-center">
                See results in 30 days or get a full refund. No questions asked.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center items-center gap-4 sm:gap-8 text-xs sm:text-sm text-secondary-400">
              <span className="flex items-center gap-1"><span>✅</span> No recurring fees</span>
              <span className="flex items-center gap-1"><span>✅</span> Lifetime access</span>
              <span className="flex items-center gap-1"><span>✅</span> 30-day guarantee</span>
              <span className="flex items-center gap-1"><span>✅</span> Instant delivery</span>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .range-slider::-webkit-slider-thumb {
          appearance: none;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: #f59e0b;
          cursor: pointer;
          border: 2px solid #1e293b;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
        }
        
        .range-slider::-moz-range-thumb {
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: #f59e0b;
          cursor: pointer;
          border: 2px solid #1e293b;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
        }
      `}</style>
    </div>
  )
}