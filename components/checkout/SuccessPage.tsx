'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

// Import types
import type { SuccessPagePlans, SuccessPageAddOns, PackageId, AddOnId } from '../../types/checkout'

interface SuccessPageProps {
  sessionId?: string
  type?: string
  customerId?: string
}

interface CheckoutSession {
  id: string
  status: string
  customer: {
    id: string
    email: string
    name: string
  }
  payment_intent: {
    id: string
    amount?: number | null
    currency: string
  }
  metadata: {
    package_id?: string
    add_ons?: string
    wants_subscription?: string
    business_name?: string
    business_website?: string
  }
}

export default function SuccessPage({ sessionId, type, customerId }: SuccessPageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<CheckoutSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSubscriptionUpsell, setShowSubscriptionUpsell] = useState(false)
  const [subscriptionProcessing, setSubscriptionProcessing] = useState(false)

  const fetchSessionDetails = useCallback(async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/checkout-session/${sessionId}`)
      const data = await response.json()
      
      if (data.success && data.session) {
        setSession(data.session)
        
        // Show subscription upsell if they indicated interest but didn't purchase it yet
        if (data.session.metadata?.wants_subscription === 'true' && type !== 'subscription') {
          setShowSubscriptionUpsell(true)
        }
      } else {
        setError(data.error?.message || 'Failed to retrieve session details')
      }
    } catch (err) {
      console.error('Error fetching session:', err)
      setError('Failed to load payment details')
    } finally {
      setLoading(false)
    }
  }, [sessionId, type])

  useEffect(() => {
    if (sessionId) {
      fetchSessionDetails()
    } else {
      setError('No session ID provided')
      setLoading(false)
    }
  }, [sessionId, fetchSessionDetails])

  const handleSubscriptionCheckout = async () => {
    if (!session) return
    
    try {
      setSubscriptionProcessing(true)
      
      const response = await fetch('/api/create-subscription-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: 'auto_update',
          customer_email: session.customer.email,
          customer_name: session.customer.name,
          customer_id: session.customer.id,
          success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}&type=subscription`,
          cancel_url: `${window.location.origin}/success?session_id=${sessionId}&subscription_cancelled=true`,
          trial_period_days: 14,
          metadata: {
            original_package: session.metadata?.package_id || '',
            business_name: session.metadata?.business_name || '',
            business_website: session.metadata?.business_website || ''
          }
        })
      })

      const data = await response.json()

      if (data.success && data.data?.checkout_session?.url) {
        window.location.href = data.data.checkout_session.url
      } else {
        throw new Error('Failed to create subscription checkout')
      }
    } catch (err) {
      console.error('Subscription checkout error:', err)
      alert('There was an error setting up your subscription. Please contact support.')
      setSubscriptionProcessing(false)
    }
  }

  const handleSkipSubscription = () => {
    setShowSubscriptionUpsell(false)
  }

  const getPackageInfo = () => {
    if (!session?.metadata?.package_id) return null
    
    const packages: SuccessPagePlans = {
      starter: { name: 'Starter Intelligence', directories: 100, price: 149 },
      growth: { name: 'Growth Intelligence', directories: 250, price: 299 },
      professional: { name: 'Professional Intelligence', directories: 400, price: 499 },
      enterprise: { name: 'Enterprise Intelligence', directories: 500, price: 799 }
    }
    
    return packages[session.metadata.package_id as PackageId]
  }

  const getAddOnsList = () => {
    if (!session?.metadata?.add_ons) return []
    
    const addOnIds = session.metadata.add_ons.split(',').filter(Boolean)
    const addOns: SuccessPageAddOns = {
      fast_track: { name: 'Fast-track Submission', icon: '⚡' },
      premium_directories: { name: 'Premium Directories Only', icon: '👑' },
      manual_qa: { name: 'Manual QA Review', icon: '🔍' },
      csv_export: { name: 'CSV Export', icon: '📊' }
    }
    
    return addOnIds.map(id => addOns[id as AddOnId]).filter(Boolean)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-success-500 to-success-600 rounded-full flex items-center justify-center animate-pulse">
            <div className="text-2xl">🎉</div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Processing your order...</h2>
          <p className="text-secondary-300">Please wait while we confirm your payment.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 mx-auto mb-6 bg-danger-500 rounded-full flex items-center justify-center">
            <div className="text-2xl">❌</div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Payment Verification Error</h2>
          <p className="text-secondary-300 mb-6">{error}</p>
          <button
            onClick={() => router.push('/checkout')}
            className="px-6 py-3 bg-volt-500 hover:bg-volt-400 text-secondary-900 font-bold rounded-xl transition-all duration-300"
          >
            Return to Checkout
          </button>
        </div>
      </div>
    )
  }

  const packageInfo = getPackageInfo()
  const addOnsList = getAddOnsList()

  return (
    <>
      <Head>
        <title>Payment Successful - DirectoryBolt</title>
        <meta name="description" content="Your DirectoryBolt order has been confirmed. We'll begin processing your directory submissions immediately." />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
        <div className="px-4 py-16">
          <div className="max-w-4xl mx-auto">
            {/* Success Header */}
            <div className="text-center mb-12 animate-slide-up">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-success-500 to-success-600 rounded-full flex items-center justify-center shadow-2xl shadow-success-500/50">
                <div className="text-4xl">🎉</div>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
                Payment Successful!
              </h1>
              <p className="text-xl text-secondary-300 max-w-2xl mx-auto">
                Thank you for choosing DirectoryBolt. We've received your payment and will begin processing your directory submissions immediately.
              </p>
            </div>

            {/* Order Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              {/* Payment Details */}
              <div className="bg-secondary-800/50 border border-secondary-600/50 rounded-xl p-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <span>💳</span> Payment Confirmed
                </h2>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-secondary-300">Order ID:</span>
                    <span className="text-white font-mono">{session?.id?.slice(-8).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-secondary-300">Amount Paid:</span>
                    <span className="text-success-400 font-bold text-xl">
                      ${((session?.payment_intent?.amount ?? 0) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-secondary-300">Customer Email:</span>
                    <span className="text-white">{session?.customer?.email}</span>
                  </div>
                  {session?.metadata?.business_name && (
                    <div className="flex justify-between items-center">
                      <span className="text-secondary-300">Business:</span>
                      <span className="text-white">{session.metadata.business_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Package Details */}
              <div className="bg-secondary-800/50 border border-secondary-600/50 rounded-xl p-8 animate-slide-up" style={{ animationDelay: '0.4s' }}>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <span>📦</span> Your Package
                </h2>
                
                {packageInfo && (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-lg font-bold text-white">{packageInfo.name} Package</span>
                      <span className="text-volt-400 font-bold">${packageInfo.price}</span>
                    </div>
                    <div className="text-secondary-300 text-sm mb-4">
                      {packageInfo.directories} premium directory submissions
                    </div>
                  </div>
                )}

                {addOnsList.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-medium text-white mb-3">Add-ons Included:</h3>
                    {addOnsList.map((addOn, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-secondary-300 mb-2">
                        <span>{addOn.icon}</span>
                        <span>{addOn.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-success-900/30 border border-success-600/30 rounded-lg p-4">
                  <div className="text-success-300 font-medium mb-2">✅ What happens next:</div>
                  <ul className="text-sm text-secondary-300 space-y-1">
                    <li>• We'll begin your directory submissions within 24 hours</li>
                    <li>• You'll receive daily progress updates via email</li>
                    <li>• Complete submissions typically finish in 5-7 business days</li>
                    <li>• Final report with all listings will be sent to your email</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Subscription Upsell */}
            {showSubscriptionUpsell && type !== 'subscription' && (
              <div className="bg-gradient-to-r from-volt-500/20 to-volt-600/10 border border-volt-500/30 rounded-xl p-8 mb-12 animate-slide-up" style={{ animationDelay: '0.6s' }}>
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    🔄 Protect Your Investment
                  </h2>
                  <p className="text-secondary-300">
                    Keep your directory listings active and up-to-date with our Auto Update service
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-secondary-900/50 rounded-lg p-6 border border-secondary-600/50">
                    <h3 className="font-bold text-white mb-4">Without Auto Update:</h3>
                    <ul className="space-y-2 text-sm text-secondary-300">
                      <li className="flex items-center gap-2">
                        <span className="text-warning-400">⚠️</span>
                        <span>30% of listings become inactive within 12 months</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-warning-400">⚠️</span>
                        <span>Manual resubmission required if removed</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-warning-400">⚠️</span>
                        <span>No monitoring for outdated information</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-success-900/30 border border-success-600/30 rounded-lg p-6">
                    <h3 className="font-bold text-success-300 mb-4">With Auto Update ($49/month):</h3>
                    <ul className="space-y-2 text-sm text-secondary-300">
                      <li className="flex items-center gap-2">
                        <span className="text-success-400">✅</span>
                        <span>24/7 monitoring of all your listings</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-success-400">✅</span>
                        <span>Automatic resubmission if removed</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-success-400">✅</span>
                        <span>Profile updates when business info changes</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-success-400">✅</span>
                        <span>Monthly performance reports</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm text-secondary-400 mb-6">
                    Starts after your directory submissions are complete. Cancel anytime. 14-day free trial.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={handleSkipSubscription}
                      className="px-6 py-3 border border-secondary-600 text-secondary-300 font-medium rounded-xl hover:bg-secondary-700 hover:border-secondary-500 transition-all duration-300"
                    >
                      No Thanks
                    </button>
                    
                    <button
                      onClick={handleSubscriptionCheckout}
                      disabled={subscriptionProcessing}
                      className="px-10 py-4 bg-gradient-to-r from-success-500 to-success-600 text-white font-black text-lg rounded-xl hover:from-success-400 hover:to-success-500 transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-success-500/50 disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      {subscriptionProcessing ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent mr-2"></div>
                          Setting up...
                        </div>
                      ) : (
                        '🔄 Add Auto Update Service'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="bg-secondary-800/50 border border-secondary-600/50 rounded-xl p-8 text-center animate-slide-up" style={{ animationDelay: '0.8s' }}>
              <h2 className="text-2xl font-bold text-white mb-6">What's Next?</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-volt-500/20 border border-volt-500/30 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📧</span>
                  </div>
                  <h3 className="font-bold text-white mb-2">Check Your Email</h3>
                  <p className="text-sm text-secondary-300">
                    Confirmation and next steps have been sent to {session?.customer?.email}
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-volt-500/20 border border-volt-500/30 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🚀</span>
                  </div>
                  <h3 className="font-bold text-white mb-2">We Start Working</h3>
                  <p className="text-sm text-secondary-300">
                    Our team begins your directory submissions within 24 hours
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-volt-500/20 border border-volt-500/30 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📊</span>
                  </div>
                  <h3 className="font-bold text-white mb-2">Track Progress</h3>
                  <p className="text-sm text-secondary-300">
                    Daily updates and final report with all your new listings
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => router.push('/')}
                  className="px-8 py-3 bg-secondary-700 hover:bg-secondary-600 text-white font-medium rounded-xl transition-all duration-300"
                >
                  Return Home
                </button>
                
                <a
                  href="mailto:support@directorybolt.com"
                  className="px-8 py-3 border border-volt-500 text-volt-500 font-medium rounded-xl hover:bg-volt-500 hover:text-secondary-900 transition-all duration-300"
                >
                  Contact Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}