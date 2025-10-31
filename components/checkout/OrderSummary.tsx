'use client'
import { useState } from 'react'

interface CheckoutState {
  step: string
  selectedPackage: string | null
  selectedAddOns: string[]
  wantsSubscription?: boolean
  customerInfo: {
    email: string
    name: string
    businessName: string
    businessWebsite: string
  }
  pricing: {
    packagePrice: number
    addOnsPrice: number
    subscriptionPrice?: number
    totalOneTime: number
    monthlyRecurring?: number
  }
}

interface OrderSummaryProps {
  checkoutState: CheckoutState
  packages: any
  addOns: any
  subscription?: any
  onCustomerInfoUpdate: (customerInfo: CheckoutState['customerInfo']) => void
  onCheckout: () => void
  onGoBack: () => void
}

export function OrderSummary({ 
  checkoutState, 
  packages, 
  addOns, 
  subscription,
  onCustomerInfoUpdate, 
  onCheckout, 
  onGoBack 
}: OrderSummaryProps) {
  const [customerInfo, setCustomerInfo] = useState(checkoutState.customerInfo)
  const [isProcessing, setIsProcessing] = useState(false)

  const selectedPackage = packages[checkoutState.selectedPackage!]
  const selectedAddOnsList = checkoutState.selectedAddOns.map(id => addOns[id])
  const wantsSubscription = !!checkoutState.wantsSubscription && !!subscription
  const subscriptionPrice = checkoutState.pricing.subscriptionPrice ?? 0
  const monthlyRecurring = checkoutState.pricing.monthlyRecurring ?? subscriptionPrice

  const handleInputChange = (field: keyof CheckoutState['customerInfo'], value: string) => {
    const updatedInfo = { ...customerInfo, [field]: value }
    setCustomerInfo(updatedInfo)
    onCustomerInfoUpdate(updatedInfo)
  }

  const handleCheckout = async () => {
    setIsProcessing(true)
    await onCheckout()
    setIsProcessing(false)
  }

  const isFormValid = () => {
    return customerInfo.email && 
           customerInfo.name && 
           customerInfo.businessName && 
           customerInfo.businessWebsite &&
           customerInfo.email.includes('@') &&
           customerInfo.businessWebsite.includes('.')
  }

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-black text-white mb-4">
          Review Your
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600"> Order</span>
        </h2>
        <p className="text-lg text-secondary-300">
          Please review your selections and provide your business information to complete your purchase.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {/* Customer Information Form */}
        <div className="bg-secondary-800/50 border border-secondary-600/50 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Business Information</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Business Name *
              </label>
              <input
                type="text"
                value={customerInfo.businessName}
                onChange={(e) => handleInputChange('businessName', e.target.value)}
                className="w-full px-4 py-3 bg-secondary-900 border border-secondary-600 rounded-lg text-white placeholder-secondary-400 focus:border-volt-400 focus:ring-1 focus:ring-volt-400 transition-colors"
                placeholder="Your Business Name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Business Website *
              </label>
              <input
                type="url"
                value={customerInfo.businessWebsite}
                onChange={(e) => handleInputChange('businessWebsite', e.target.value)}
                className="w-full px-4 py-3 bg-secondary-900 border border-secondary-600 rounded-lg text-white placeholder-secondary-400 focus:border-volt-400 focus:ring-1 focus:ring-volt-400 transition-colors"
                placeholder="https://yourbusiness.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Contact Name *
              </label>
              <input
                type="text"
                value={customerInfo.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-4 py-3 bg-secondary-900 border border-secondary-600 rounded-lg text-white placeholder-secondary-400 focus:border-volt-400 focus:ring-1 focus:ring-volt-400 transition-colors"
                placeholder="Your Full Name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={customerInfo.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-4 py-3 bg-secondary-900 border border-secondary-600 rounded-lg text-white placeholder-secondary-400 focus:border-volt-400 focus:ring-1 focus:ring-volt-400 transition-colors"
                placeholder="your@email.com"
                required
              />
            </div>
          </div>

          {/* Security Note */}
          <div className="mt-6 bg-success-900/20 border border-success-600/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-success-300 text-sm font-medium mb-2">
              <span>🔒</span>
              <span>Your information is secure</span>
            </div>
            <div className="text-xs text-secondary-400">
              We use bank-level encryption and never store your payment information. 
              Your data is only used to complete your directory submissions.
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-secondary-800/50 border border-secondary-600/50 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Order Summary</h3>
          
          {/* Package */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-bold text-white">{selectedPackage.name} Package</div>
                <div className="text-sm text-secondary-400">
                  {selectedPackage.directories} directory submissions
                </div>
              </div>
              <div className="text-lg font-bold text-volt-400">
                ${selectedPackage.price}
              </div>
            </div>
            <div className="text-xs text-secondary-400 bg-secondary-900/50 p-3 rounded">
              {selectedPackage.description}
            </div>
          </div>

          {/* Add-ons */}
          {selectedAddOnsList.length > 0 && (
            <div className="mb-6 border-t border-secondary-600 pt-6">
              <div className="font-medium text-white mb-3">Add-ons</div>
              {selectedAddOnsList.map(addOn => (
                <div key={addOn.id} className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{addOn.icon}</span>
                    <span className="text-secondary-200 text-sm">{addOn.name}</span>
                  </div>
                  <div className="text-volt-400 font-bold">+${addOn.price}</div>
                </div>
              ))}
            </div>
          )}

          {/* Subscription */}
          {wantsSubscription && subscription && (
            <div className="mb-6 border-t border-secondary-600 pt-6">
              <div className="font-medium text-white mb-3">Subscription Service</div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>🔄</span>
                  <span className="text-secondary-200 text-sm">{subscription.name}</span>
                </div>
                <div className="text-success-400 font-bold">${subscription.price}/{subscription.billing}</div>
              </div>
              <div className="text-xs text-secondary-400 bg-secondary-900/50 p-3 rounded">
                {subscription.description ?? 'Starts after your directory submissions are complete. Cancel anytime.'}
              </div>
              {Array.isArray(subscription.features) && subscription.features.length > 0 && (
                <ul className="mt-3 space-y-2 text-xs text-secondary-300">
                  {subscription.features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-success-400 mt-0.5">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Totals */}
          <div className="border-t border-secondary-600 pt-6">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-secondary-200">
                <span>One-time Payment:</span>
                <span className="font-bold">${checkoutState.pricing.totalOneTime}</span>
              </div>
              {wantsSubscription && (
                <div className="flex justify-between text-secondary-200">
                  <span>Recurring Service:</span>
                  <span className="font-bold">${monthlyRecurring} / {subscription?.billing ?? 'month'}</span>
                </div>
              )}
            </div>
            <div className="border-t border-secondary-600 pt-4">
              <div className="flex justify-between text-xl font-black">
                <span className="text-white">Total Today:</span>
                <span className="text-volt-400">${checkoutState.pricing.totalOneTime}</span>
              </div>
            </div>
          </div>

          {/* Guarantees */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 text-sm text-secondary-300">
              <span className="text-success-400">🛡️</span>
              <span>30-day money-back guarantee</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-secondary-300">
              <span className="text-success-400">⚡</span>
              <span>5-7 business day completion</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-secondary-300">
              <span className="text-success-400">📊</span>
              <span>Detailed progress reports included</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-center">
        <button
          onClick={onGoBack}
          className="px-6 py-3 border border-secondary-600 text-secondary-300 font-medium rounded-xl hover:bg-secondary-700 hover:border-secondary-500 transition-all duration-300"
        >
          ← Back to Subscription
        </button>
        
        <button
          onClick={handleCheckout}
          disabled={!isFormValid() || isProcessing}
          className={`px-12 py-4 rounded-xl font-black text-xl transition-all duration-300 transform hover:scale-105 shadow-2xl ${
            !isFormValid() || isProcessing
              ? 'bg-secondary-600 text-secondary-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-volt-500 to-volt-600 hover:from-volt-400 hover:to-volt-500 text-secondary-900 shadow-volt-500/50 animate-glow'
          }`}
        >
          {isProcessing ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent mr-3"></div>
              Processing...
            </div>
          ) : (
            <>🚀 Complete Purchase - ${checkoutState.pricing.totalOneTime}</>
          )}
        </button>
      </div>

      {/* Final Trust Elements */}
      <div className="mt-8 text-center">
        <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-secondary-400">
          <div className="flex items-center gap-2">
            <span className="text-success-400">🔒</span>
            <span>256-bit SSL Encryption</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-success-400">💳</span>
            <span>Secure Stripe Payments</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-success-400">⭐</span>
            <span>4.9/5 Customer Rating</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-success-400">🏆</span>
            <span>500+ Happy Customers</span>
          </div>
        </div>
      </div>
    </div>
  )
}