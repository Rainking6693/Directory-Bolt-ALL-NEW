'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

interface Plan {
  id: string
  name: string
  price: number
  directories: number
  description: string
  features: string[]
  popular?: boolean
}

interface AddOn {
  id: string
  name: string
  price: number
  description: string
  icon: string
}

interface EnhancedCheckoutProps {
  selectedPlan?: string
  plans: Record<string, Plan>
  onCheckoutStart?: () => void
  onCheckoutComplete?: (data: any) => void
  onError?: (error: any) => void
}

// Add-on definitions matching your requirements
const ADD_ONS: Record<string, AddOn> = {
  fasttrack: {
    id: 'fasttrack',
    name: 'Fast-Track Submission',
    price: 25,
    description: 'Complete your submissions in 1-2 business days instead of 5-7 days',
    icon: '⚡'
  },
  premium: {
    id: 'premium',
    name: 'Premium Directories Only',
    price: 15,
    description: 'Submit only to high-authority, premium directories (DA 70+)',
    icon: '👑'
  },
  qa: {
    id: 'qa',
    name: 'Manual QA Review',
    price: 10,
    description: 'Human quality assurance review of all submissions before going live',
    icon: '🔍'
  },
  csv: {
    id: 'csv',
    name: 'CSV Export',
    price: 9,
    description: 'Download detailed CSV report of all submissions and results',
    icon: '📊'
  }
}

export default function EnhancedCheckout({ 
  selectedPlan = 'growth', 
  plans, 
  onCheckoutStart, 
  onCheckoutComplete, 
  onError 
}: EnhancedCheckoutProps) {
  const router = useRouter()
  const [currentPlan, setCurrentPlan] = useState(selectedPlan)
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customerInfo, setCustomerInfo] = useState({
    email: '',
    name: '',
    businessName: '',
    businessWebsite: ''
  })
  const [showCustomerForm, setShowCustomerForm] = useState(false)

  // Calculate total pricing
  const calculatePricing = () => {
    const planPrice = plans[currentPlan]?.price || 0
    const addOnsPrice = selectedAddOns.reduce((total, addOnId) => {
      return total + (ADD_ONS[addOnId]?.price || 0)
    }, 0)
    
    return {
      planPrice,
      addOnsPrice,
      total: planPrice + addOnsPrice
    }
  }

  const pricing = calculatePricing()

  // Handle add-on selection
  const toggleAddOn = (addOnId: string) => {
    setSelectedAddOns(prev => 
      prev.includes(addOnId) 
        ? prev.filter(id => id !== addOnId)
        : [...prev, addOnId]
    )
  }

  // Handle plan selection
  const handlePlanChange = (planId: string) => {
    setCurrentPlan(planId)
  }

  // Handle customer info update
  const updateCustomerInfo = (field: string, value: string) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }))
  }

  // Validate customer info
  const isCustomerInfoValid = () => {
    return customerInfo.email && customerInfo.name && customerInfo.businessName
  }

  // Handle checkout process
  const handleCheckout = async () => {
    if (!isCustomerInfoValid()) {
      setShowCustomerForm(true)
      setError('Please complete all required customer information fields.')
      return
    }

    setIsProcessing(true)
    setError(null)
    onCheckoutStart?.()

    try {
      // Prepare checkout data
      const checkoutData = {
        plan: currentPlan,
        addons: selectedAddOns,
        customerEmail: customerInfo.email,
        success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}&plan=${currentPlan}`,
        cancel_url: `${window.location.origin}/pricing?cancelled=true&plan=${currentPlan}`,
        metadata: {
          customer_name: customerInfo.name,
          business_name: customerInfo.businessName,
          business_website: customerInfo.businessWebsite,
          selected_addons: selectedAddOns.join(',')
        }
      }

      console.log('Creating checkout session with data:', checkoutData)

      // Call the Stripe checkout API
      const response = await fetch('/api/create-checkout-session-v3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkoutData)
      })

      const data = await response.json()
      console.log('Checkout API response:', data)

      if (data.success && data.checkoutUrl) {
        onCheckoutComplete?.(data)
        // Redirect to Stripe checkout
        window.location.href = data.checkoutUrl
      } else {
        throw new Error(data.error || 'Failed to create checkout session')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during checkout'
      setError(errorMessage)
      onError?.(error)
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
            Complete Your Order
          </h1>
          <p className="text-lg sm:text-xl text-secondary-300">
            Select your plan and add-ons to get started
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Plan Selection */}
          <div className="lg:col-span-2">
            {/* Plan Options */}
            <div className="bg-secondary-800/50 backdrop-blur-sm border border-secondary-700 rounded-2xl p-6 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6">Choose Your Plan</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(plans).map(([planId, plan]) => (
                  <div
                    key={planId}
                    className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                      currentPlan === planId
                        ? 'border-volt-500 bg-volt-500/10'
                        : 'border-secondary-600 bg-secondary-800/50 hover:border-secondary-500'
                    }`}
                    onClick={() => handlePlanChange(planId)}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-volt-500 text-secondary-900 px-4 py-1 rounded-full text-sm font-bold">
                          POPULAR
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                      <div className="text-3xl font-black text-volt-400 mb-2">
                        ${plan.price}
                      </div>
                      <p className="text-secondary-300 text-sm mb-4">{plan.description}</p>
                      <div className="text-sm text-secondary-400">
                        {plan.directories} submissions
                      </div>
                    </div>
                    
                    <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 ${
                      currentPlan === planId
                        ? 'bg-volt-500 border-volt-500'
                        : 'border-secondary-500'
                    }`}>
                      {currentPlan === planId && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-secondary-900 rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add-ons Selection */}
            <div className="bg-secondary-800/50 backdrop-blur-sm border border-secondary-700 rounded-2xl p-6 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6">Add-on Services</h2>
              <div className="space-y-4">
                {Object.entries(ADD_ONS).map(([addOnId, addOn]) => (
                  <div
                    key={addOnId}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                      selectedAddOns.includes(addOnId)
                        ? 'border-volt-500 bg-volt-500/10'
                        : 'border-secondary-600 bg-secondary-800/50 hover:border-secondary-500'
                    }`}
                    onClick={() => toggleAddOn(addOnId)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">{addOn.icon}</div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{addOn.name}</h3>
                        <p className="text-secondary-300 text-sm">{addOn.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-volt-400 font-bold">+${addOn.price}</div>
                      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                        selectedAddOns.includes(addOnId)
                          ? 'bg-volt-500 border-volt-500'
                          : 'border-secondary-500'
                      }`}>
                        {selectedAddOns.includes(addOnId) && (
                          <svg className="w-4 h-4 text-secondary-900" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Information Form */}
            {showCustomerForm && (
              <div className="bg-secondary-800/50 backdrop-blur-sm border border-secondary-700 rounded-2xl p-6 mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Customer Information</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-secondary-300 text-sm font-medium mb-2">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      value={customerInfo.name}
                      onChange={(e) => updateCustomerInfo('name', e.target.value)}
                      className="w-full px-4 py-3 bg-secondary-700 border border-secondary-600 rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-secondary-300 text-sm font-medium mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={customerInfo.email}
                      onChange={(e) => updateCustomerInfo('email', e.target.value)}
                      className="w-full px-4 py-3 bg-secondary-700 border border-secondary-600 rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent"
                      placeholder="john@company.com"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-secondary-300 text-sm font-medium mb-2">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      value={customerInfo.businessName}
                      onChange={(e) => updateCustomerInfo('businessName', e.target.value)}
                      className="w-full px-4 py-3 bg-secondary-700 border border-secondary-600 rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent"
                      placeholder="Your Business LLC"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-secondary-300 text-sm font-medium mb-2">
                      Business Website
                    </label>
                    <input
                      type="url"
                      value={customerInfo.businessWebsite}
                      onChange={(e) => updateCustomerInfo('businessWebsite', e.target.value)}
                      className="w-full px-4 py-3 bg-secondary-700 border border-secondary-600 rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent"
                      placeholder="https://yourbusiness.com"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-secondary-800/50 backdrop-blur-sm border border-secondary-700 rounded-2xl p-4 sm:p-6 lg:sticky lg:top-8">
              <h2 className="text-2xl font-bold text-white mb-6">Order Summary</h2>
              
              {/* Selected Plan */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center pb-4 border-b border-secondary-700">
                  <div>
                    <h3 className="font-semibold text-white">{plans[currentPlan]?.name}</h3>
                    <p className="text-sm text-secondary-300">{plans[currentPlan]?.directories} submissions</p>
                  </div>
                  <div className="text-volt-400 font-bold">${pricing.planPrice}</div>
                </div>
                
                {/* Selected Add-ons */}
                {selectedAddOns.map(addOnId => (
                  <div key={addOnId} className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span>{ADD_ONS[addOnId]?.icon}</span>
                      <span className="text-white text-sm">{ADD_ONS[addOnId]?.name}</span>
                    </div>
                    <div className="text-volt-400 font-semibold">+${ADD_ONS[addOnId]?.price}</div>
                  </div>
                ))}
              </div>
              
              {/* Total */}
              <div className="border-t border-secondary-700 pt-4 mb-8">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-white">Total</span>
                  <span className="text-2xl font-black text-volt-400">${pricing.total}</span>
                </div>
                <p className="text-sm text-secondary-400 mt-2">One-time payment</p>
              </div>
              
              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h4 className="text-red-400 font-medium mb-1">Checkout Error</h4>
                      <p className="text-red-300 text-sm">{error}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="mt-3 text-red-400 hover:text-red-300 text-sm underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              
              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-all duration-300 transform hover:scale-105 hover:from-volt-400 hover:to-volt-500 focus:outline-none focus:ring-2 focus:ring-volt-500 focus:ring-offset-2 focus:ring-offset-secondary-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-95"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  `Complete Purchase - $${pricing.total}`
                )}
              </button>
              
              {/* Security Badge */}
              <div className="mt-6 text-center">
                <div className="flex items-center justify-center space-x-2 text-secondary-400 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span>Secured by Stripe</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}