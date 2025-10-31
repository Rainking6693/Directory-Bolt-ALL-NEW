import React, { useState } from 'react'
import StreamlinedCheckout from '../checkout/StreamlinedCheckout'

interface PricingPlan {
  name: string
  price: number
  directories: number
  features: string[]
  popular?: boolean
}

const PLANS: PricingPlan[] = [
  {
    name: 'Starter',
    price: 149,
    directories: 50,
    features: [
      '50 Directory Submissions',
      'Basic Business Intelligence',
      'Email Support',
      '5-7 Day Processing'
    ]
  },
  {
    name: 'Growth',
    price: 299,
    directories: 150,
    features: [
      '150 Directory Submissions',
      'Advanced AI Analysis',
      'Priority Support',
      '3-5 Day Processing',
      'Competitive Analysis'
    ],
    popular: true
  },
  {
    name: 'Professional',
    price: 499,
    directories: 300,
    features: [
      '300 Directory Submissions',
      'Premium AI Intelligence',
      'SEO Content Gap Analysis',
      'Dedicated Support',
      '2-3 Day Processing',
      'Custom Reporting'
    ]
  },
  {
    name: 'Enterprise',
    price: 799,
    directories: 500,
    features: [
      '500 Directory Submissions',
      'Enterprise AI Intelligence',
      'Advanced SEO Content Gap Analysis',
      'White-glove Support',
      '1-2 Day Processing',
      'Custom Solutions'
    ]
  }
]

export default function StreamlinedPricing() {
  const [selectedPlan, setSelectedPlan] = useState<string>('growth')
  const [showCheckout, setShowCheckout] = useState(false)

  const selectedPlanData = PLANS.find(plan => plan.name.toLowerCase() === selectedPlan)

  if (showCheckout && selectedPlanData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <button
              onClick={() => setShowCheckout(false)}
              className="text-blue-600 hover:text-blue-800 mb-4"
            >
              ← Back to Plans
            </button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Complete Your Purchase
            </h1>
            <p className="text-gray-600">
              You're purchasing the {selectedPlanData.name} plan
            </p>
          </div>
          <StreamlinedCheckout
            selectedPlan={selectedPlan}
            planPrice={selectedPlanData.price}
            planName={selectedPlanData.name}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Growth Plan
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Get your business listed on high-authority directories with our AI-powered submission service. 
            Just pay, provide your business details, and we'll handle the rest.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-white rounded-2xl shadow-lg p-8 transition-all duration-300 hover:shadow-xl ${
                plan.popular ? 'ring-2 ring-blue-500 scale-105 shadow-2xl' : 'hover:scale-102'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg border-2 border-white">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">
                    ${plan.price}
                  </span>
                  <span className="text-gray-600 ml-2">one-time</span>
                </div>
                <p className="text-gray-600">
                  {plan.directories} Directory Submissions
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  setSelectedPlan(plan.name.toLowerCase())
                  setShowCheckout(true)
                }}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                  plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                Get Started
              </button>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-blue-600">1</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Choose & Pay</h3>
                <p className="text-gray-600 text-sm">
                  Select your plan and complete payment with just your email address
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-blue-600">2</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Provide Details</h3>
                <p className="text-gray-600 text-sm">
                  Complete a simple form with your business information
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-blue-600">3</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">We Handle Everything</h3>
                <p className="text-gray-600 text-sm">
                  Our team submits your business to directories automatically
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
