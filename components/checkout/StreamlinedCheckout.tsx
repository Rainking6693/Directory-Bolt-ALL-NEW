import React, { useState } from 'react'
import { useRouter } from 'next/router'

interface StreamlinedCheckoutProps {
  selectedPlan: string
  planPrice: number
  planName: string
}

export default function StreamlinedCheckout({ 
  selectedPlan, 
  planPrice, 
  planName 
}: StreamlinedCheckoutProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  const handleCheckout = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      // Create Stripe checkout session with minimal info
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: selectedPlan,
          customerEmail: email,
          success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}&plan=${selectedPlan}&collect_info=true`,
          cancel_url: `${window.location.origin}/pricing?cancelled=true&plan=${selectedPlan}`,
          metadata: {
            plan: selectedPlan,
            planName: planName,
            collect_business_info: 'true' // Flag to indicate we need to collect business info after payment
          }
        })
      })

      const data = await response.json()

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Failed to create checkout session')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      setError(error instanceof Error ? error.message : 'An unexpected error occurred')
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Complete Your Purchase
        </h2>
        <p className="text-gray-600">
          Just your email to get started. We'll collect your business details after payment.
        </p>
      </div>

      {/* Plan Summary */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-900">{planName}</h3>
            <p className="text-sm text-gray-600">One-time payment</p>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            ${planPrice}
          </div>
        </div>
      </div>

      {/* Email Input */}
      <div className="mb-6">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email Address *
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="your@email.com"
          required
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Checkout Button */}
      <button
        onClick={handleCheckout}
        disabled={isProcessing || !email}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : `Pay $${planPrice} - Continue to Payment`}
      </button>

      {/* Security Notice */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          🔒 Secure payment powered by Stripe. Your business information will be collected after payment.
        </p>
      </div>
    </div>
  )
}
