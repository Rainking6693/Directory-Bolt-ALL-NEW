'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    period: 'month',
    description: 'Perfect for small businesses getting started',
    features: [
      '25 directory submissions per month',
      'Basic website analysis',
      'Email support',
      'Monthly reporting',
      'Standard processing speed',
      '14-day free trial'
    ],
    limitations: [],
    cta: 'Start Free Trial',
    highlight: false,
    stripePackage: 'starter',
    badge: 'POPULAR'
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 79,
    period: 'month',
    description: 'Most popular for growing businesses',
    features: [
      '50 directory submissions per month',
      'Advanced analytics & reporting',
      'Priority email support',
      'Faster processing',
      'Bulk submission tools',
      '14-day free trial',
      'Success tracking dashboard'
    ],
    limitations: [],
    cta: 'Start Free Trial',
    highlight: true,
    stripePackage: 'growth',
    badge: 'MOST POPULAR'
  },
  {
    id: 'professional',
    name: 'Professional', 
    price: 129,
    period: 'month',
    description: 'Advanced features for serious growth',
    features: [
      '100+ directory submissions per month',
      'Premium analytics & custom reports',
      'Phone & email support',
      'Priority processing',
      'API access for integrations',
      'Custom submission workflows',
      '14-day free trial',
      'Advanced success metrics'
    ],
    limitations: [],
    cta: 'Start Free Trial',
    highlight: false,
    stripePackage: 'professional',
    badge: null
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    period: 'month', 
    description: 'Complete solution for agencies & enterprises',
    features: [
      '480+ directory submissions per month',
      'Enterprise analytics & custom dashboards',
      'Dedicated account manager',
      'White-label branding options',
      'Full API access & webhooks',
      'Custom integrations & workflows',
      'SLA guarantees & priority support',
      '14-day free trial',
      'Team collaboration tools'
    ],
    limitations: [],
    cta: 'Start Free Trial',
    highlight: false,
    stripePackage: 'enterprise',
    badge: 'ENTERPRISE'
  }
]

export default function PricingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTier, setSelectedTier] = useState(null)
  const [isAnnual, setIsAnnual] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [hasExtendedTrial, setHasExtendedTrial] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    
    // Check if user is returning from cancel page
    if (typeof window !== 'undefined') {
      const returningFromCancel = localStorage.getItem('returning_from_cancel');
      if (returningFromCancel === 'true') {
        setHasExtendedTrial(true);
        localStorage.removeItem('returning_from_cancel');
      }
    }
  }, [])

  const handleSelectPlan = async (tier) => {
    setIsLoading(true)
    setSelectedTier(tier.id)

    try {
      // Create Stripe checkout session for subscription
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: tier.stripePackage,
          user_email: 'test@directorybolt.com', // TODO: Get from auth context
          user_id: 'user_123', // TODO: Get from auth context
          success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${window.location.origin}/cancel`,
          extended_trial: hasExtendedTrial
        }),
      })

      const data = await response.json()
      
      if (data.success && data.data.checkout_session.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.data.checkout_session.url
      } else {
        throw new Error(data.error?.message || 'Failed to create checkout session')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Payment setup failed. Please try again or contact support.')
    } finally {
      setIsLoading(false)
      setSelectedTier(null)
    }
  }

  const getDiscountedPrice = (price) => {
    return isAnnual ? Math.floor(price * 10) : price // 2 months free with annual
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900 text-white">
      {/* Header */}
      <section className={`relative py-16 px-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        {/* Volt Yellow Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-volt-500 rounded-full blur-3xl opacity-10 animate-pulse-volt"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-volt-400 rounded-full blur-3xl opacity-10 animate-pulse-volt" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative z-10 container mx-auto max-w-6xl text-center">
          {/* Extended Trial Banner */}
          {hasExtendedTrial && (
            <div className="animate-slide-up mb-8">
              <div className="bg-gradient-to-r from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-6 max-w-2xl mx-auto">
                <div className="flex items-center justify-center mb-4">
                  <span className="text-3xl mr-3">🎁</span>
                  <h2 className="text-2xl font-bold text-green-400">Extended Trial Activated!</h2>
                </div>
                <p className="text-secondary-300">
                  You now get <strong className="text-green-400">21 days free</strong> instead of 14, plus personal onboarding and priority support!
                </p>
              </div>
            </div>
          )}
          
          <div className="animate-slide-up">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight">
              Choose Your
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600 animate-glow">
                Growth Plan
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-secondary-300 mb-8 max-w-3xl mx-auto">
              Stop losing customers to competitors. Get listed everywhere that matters.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-center mb-12">
              <span className={`text-lg font-semibold mr-4 ${!isAnnual ? 'text-volt-400' : 'text-secondary-400'}`}>
                Monthly
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
                  isAnnual ? 'bg-volt-500' : 'bg-secondary-600'
                }`}
              >
                <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                  isAnnual ? 'translate-x-6' : 'translate-x-0'
                }`}></div>
              </button>
              <span className={`text-lg font-semibold ml-4 ${isAnnual ? 'text-volt-400' : 'text-secondary-400'}`}>
                Annual
                <span className="ml-2 text-sm bg-volt-500/20 text-volt-400 px-2 py-1 rounded-full">
                  Save 20%
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="relative pb-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {PRICING_TIERS.map((tier, index) => {
              const price = getDiscountedPrice(tier.price)
              const isPopular = tier.highlight
              const isSelected = selectedTier === tier.id
              
              return (
                <div
                  key={tier.id}
                  className={`relative bg-gradient-to-br backdrop-blur-sm rounded-2xl border-2 transition-all duration-300 hover:scale-105 animate-slide-up ${
                    isPopular
                      ? 'from-volt-500/20 to-volt-600/10 border-volt-500 shadow-2xl shadow-volt-500/20 scale-105'
                      : 'from-secondary-800/80 to-secondary-900/60 border-secondary-600 hover:border-secondary-500'
                  }`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Badge */}
                  {tier.badge && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className={`font-black px-6 py-2 rounded-full text-sm ${
                        isPopular 
                          ? 'bg-volt-500 text-secondary-900'
                          : 'bg-secondary-700 text-volt-400'
                      }`}>
                        {tier.badge}
                      </span>
                    </div>
                  )}

                  <div className="p-8">
                    {/* Plan Name & Price */}
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                      <div className="mb-4">
                        {tier.price === 0 ? (
                          <span className="text-4xl font-black text-volt-400">FREE</span>
                        ) : (
                          <div>
                            <span className="text-4xl font-black text-volt-400">
                              ${price}
                            </span>
                            <span className="text-lg text-secondary-400">
                              /{tier.period}
                            </span>
                            {isAnnual && tier.price > 0 && (
                              <div className="text-sm text-secondary-400 line-through">
                                ${tier.price}/{tier.period}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-secondary-300">{tier.description}</p>
                    </div>

                    {/* Features */}
                    <ul className="space-y-3 mb-8">
                      {tier.features.map((feature, idx) => {
                        // Replace trial period dynamically
                        let displayFeature = feature;
                        if (hasExtendedTrial && feature.includes('14-day free trial')) {
                          displayFeature = feature.replace('14-day free trial', '21-day free trial + onboarding');
                        }
                        
                        return (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="text-success-400 mt-1">✓</span>
                            <span className="text-sm">
                              {displayFeature}
                              {hasExtendedTrial && feature.includes('14-day free trial') && (
                                <span className="ml-2 text-green-400 font-semibold">🎁</span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                      {tier.limitations.map((limitation, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="text-danger-400 mt-1">✗</span>
                          <span className="text-sm text-secondary-400">{limitation}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA Button */}
                    <button
                      onClick={() => handleSelectPlan(tier)}
                      disabled={isLoading && isSelected}
                      className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 ${
                        isPopular
                          ? 'bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 hover:from-volt-400 hover:to-volt-500 shadow-2xl hover:shadow-volt-500/50'
                          : 'bg-secondary-700 text-white hover:bg-secondary-600 border border-secondary-600'
                      } ${
                        isLoading && isSelected ? 'opacity-75 cursor-not-allowed' : ''
                      }`}
                    >
                      {isLoading && isSelected ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent mr-2"></div>
                          Processing...
                        </div>
                      ) : (
                        tier.cta
                      )}
                    </button>

                    {/* ROI Prediction for paid plans */}
                    {tier.price > 0 && (
                      <div className={`mt-6 p-4 rounded-lg ${
                        isPopular ? 'bg-volt-500/10 border border-volt-500/30' : 'bg-secondary-700/50'
                      }`}>
                        <div className="text-sm text-volt-400 font-bold mb-2">💰 ROI Projection:</div>
                        <div className="text-xs text-secondary-300">
                          {tier.id === 'starter' && (
                            <>
                              • Save 20+ hours/month<br/>
                              • +15% local search visibility<br/>
                              • Avg. 3-5 new customers/month
                            </>
                          )}
                          {tier.id === 'professional' && (
                            <>
                              • Save 50+ hours/month<br/>
                              • +40% search visibility<br/>
                              • Avg. 15-25 new customers/month<br/>
                              • <strong className="text-volt-400">ROI: 300-500%</strong>
                            </>
                          )}
                          {tier.id === 'enterprise' && (
                            <>
                              • Serve unlimited clients<br/>
                              • Charge $500-2000/client<br/>
                              • Complete automation<br/>
                              • <strong className="text-volt-400">Revenue: $10K+/month</strong>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA and Guarantee */}
      <section className="relative py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="bg-gradient-to-r from-volt-500/20 to-volt-600/20 p-8 rounded-2xl border border-volt-500/30 mb-8">
            <h3 className="text-3xl font-bold mb-4">
              🚀 Ready to dominate local search?
            </h3>
            <p className="text-lg text-secondary-300 mb-6">
              Join 500+ businesses already crushing their competition
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={() => router.push('/analyze')}
                className="px-8 py-4 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-volt-500/50"
              >
                Start Free Analysis
              </button>
              <span className="text-secondary-400">or</span>
              <button 
                onClick={() => router.push('/?section=demo')}
                className="px-8 py-4 border-2 border-volt-500 text-volt-500 font-bold text-lg rounded-xl hover:bg-volt-500 hover:text-secondary-900 transform hover:scale-105 transition-all duration-300"
              >
                See Live Demo
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-secondary-400">
            <span>✅ 30-day money-back guarantee</span>
            <span>✅ Cancel anytime</span>
            <span>✅ No setup fees</span>
            <span>✅ Results in 30 days or refund</span>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative py-16 px-4 bg-secondary-900/50">
        <div className="container mx-auto max-w-4xl">
          <h3 className="text-3xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-bold text-volt-400 mb-2">How quickly will I see results?</h4>
                <p className="text-secondary-300 text-sm">Most customers see improved search visibility within 30 days, with significant traffic increases within 60-90 days.</p>
              </div>
              <div>
                <h4 className="text-lg font-bold text-volt-400 mb-2">Can I change plans anytime?</h4>
                <p className="text-secondary-300 text-sm">Yes! Upgrade or downgrade your plan at any time. Changes take effect at your next billing cycle.</p>
              </div>
              <div>
                <h4 className="text-lg font-bold text-volt-400 mb-2">What's included in the free trial?</h4>
                <p className="text-secondary-300 text-sm">Full access to all features for 14 days, including AI optimization and premium directory submissions.</p>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-bold text-volt-400 mb-2">Do you offer refunds?</h4>
                <p className="text-secondary-300 text-sm">30-day money-back guarantee on all paid plans, no questions asked.</p>
              </div>
              <div>
                <h4 className="text-lg font-bold text-volt-400 mb-2">Is my data secure?</h4>
                <p className="text-secondary-300 text-sm">Yes, we use enterprise-grade encryption and never share your business information with third parties.</p>
              </div>
              <div>
                <h4 className="text-lg font-bold text-volt-400 mb-2">Need help choosing a plan?</h4>
                <p className="text-secondary-300 text-sm">Contact our sales team at sales@directorybolt.com or start with our free analysis to get personalized recommendations.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}