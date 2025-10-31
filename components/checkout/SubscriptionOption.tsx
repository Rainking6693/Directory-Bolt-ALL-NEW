'use client'
import { useState } from 'react'

interface Subscription {
  id: string
  name: string
  price: number
  billing: string
  description: string
  features: string[]
}

interface SubscriptionOptionProps {
  subscription: Subscription
  wantsSubscription: boolean
  onComplete: (wantsSubscription: boolean) => void
  onGoBack: () => void
}

export function SubscriptionOption({ 
  subscription, 
  wantsSubscription, 
  onComplete, 
  onGoBack 
}: SubscriptionOptionProps) {
  const [selected, setSelected] = useState<boolean>(wantsSubscription)

  const handleContinue = () => {
    onComplete(selected)
  }

  const handleSkip = () => {
    onComplete(false)
  }

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-black text-white mb-4">
          Optional: Keep Your Listings
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600"> Active</span>
        </h2>
        <p className="text-lg text-secondary-300 max-w-3xl mx-auto">
          Your main analysis is a one-time purchase. Optionally add our monitoring service to ensure your 
          directory listings stay visible and current over time.
        </p>
      </div>

      {/* Main Options */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 max-w-4xl mx-auto">
        {/* No Subscription Option */}
        <div
          className={`relative transform transition-all duration-300 hover:scale-102 cursor-pointer ${
            !selected ? 'scale-105' : ''
          }`}
          onClick={() => setSelected(false)}
        >
          <div className={`h-full bg-gradient-to-br backdrop-blur-sm rounded-2xl p-8 border-2 transition-all duration-300 ${
            !selected
              ? 'from-secondary-700/80 to-secondary-800/60 border-volt-400 shadow-xl shadow-volt-400/20'
              : 'from-secondary-800/80 to-secondary-900/60 border-secondary-600 hover:border-secondary-500'
          }`}>
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">📦</div>
              <h3 className={`text-2xl font-bold mb-2 ${!selected ? 'text-volt-300' : 'text-white'}`}>
                One-Time Purchase Only
              </h3>
              <div className="text-3xl font-black text-white mb-2">
                $0<span className="text-lg text-secondary-400">/month</span>
              </div>
              <p className="text-secondary-300">Your main purchase is complete - no monitoring needed</p>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3 text-sm">
                <span className="text-success-400 text-lg flex-shrink-0 mt-0.5">✅</span>
                <span className="text-secondary-200">All directory submissions completed</span>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <span className="text-success-400 text-lg flex-shrink-0 mt-0.5">✅</span>
                <span className="text-secondary-200">Final report with all listings</span>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <span className="text-warning-400 text-lg flex-shrink-0 mt-0.5">⚠️</span>
                <span className="text-secondary-200">No ongoing monitoring or updates</span>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <span className="text-warning-400 text-lg flex-shrink-0 mt-0.5">⚠️</span>
                <span className="text-secondary-200">Manual resubmission if listings are removed</span>
              </li>
            </ul>

            <button className={`w-full py-3 rounded-xl font-bold transition-all duration-300 ${
              !selected
                ? 'bg-volt-500 hover:bg-volt-400 text-secondary-900'
                : 'bg-secondary-700 hover:bg-secondary-600 text-white border border-secondary-600'
            }`}>
              Select One-Time Only
            </button>
          </div>
        </div>

        {/* Subscription Option */}
        <div
          className={`relative transform transition-all duration-300 hover:scale-102 cursor-pointer ${
            selected ? 'scale-105' : ''
          }`}
          onClick={() => setSelected(true)}
        >
          {/* Recommended Badge */}
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
            <span className="bg-gradient-to-r from-success-500 to-success-600 text-white font-black px-6 py-2 rounded-full text-sm shadow-lg">
              🏆 RECOMMENDED
            </span>
          </div>

          <div className={`h-full bg-gradient-to-br backdrop-blur-sm rounded-2xl p-8 border-2 transition-all duration-300 ${
            selected
              ? 'from-success-500/20 to-success-600/10 border-success-500 shadow-xl shadow-success-500/20'
              : 'from-secondary-800/80 to-secondary-900/60 border-secondary-600 hover:border-secondary-500'
          }`}>
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">🔄</div>
              <h3 className={`text-2xl font-bold mb-2 ${selected ? 'text-success-300' : 'text-white'}`}>
                {subscription.name}
              </h3>
              <div className="text-3xl font-black mb-2">
                <span className={selected ? 'text-success-400' : 'text-volt-400'}>
                  ${subscription.price}
                </span>
                <span className="text-lg text-secondary-400">/{subscription.billing}</span>
              </div>
              <p className="text-secondary-300">{subscription.description}</p>
            </div>

            <ul className="space-y-3 mb-8">
              {subscription.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3 text-sm">
                  <span className={`${selected ? 'text-success-400' : 'text-success-400'} text-lg flex-shrink-0 mt-0.5`}>
                    ✅
                  </span>
                  <span className="text-secondary-200">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Value Proposition */}
            <div className={`p-4 rounded-lg mb-6 ${
              selected
                ? 'bg-success-500/10 border border-success-500/30'
                : 'bg-secondary-700/50 border border-secondary-600/50'
            }`}>
              <div className={`text-sm font-bold mb-2 ${selected ? 'text-success-400' : 'text-volt-400'}`}>
                💰 ROI Protection:
              </div>
              <div className="text-xs text-secondary-300">
                Studies show 30% of directory listings become inactive within 12 months. 
                This service protects your investment and maintains your SEO gains.
              </div>
            </div>

            <button className={`w-full py-3 rounded-xl font-bold transition-all duration-300 ${
              selected
                ? 'bg-gradient-to-r from-success-500 to-success-600 hover:from-success-400 hover:to-success-500 text-white shadow-xl shadow-success-500/50'
                : 'bg-secondary-700 hover:bg-secondary-600 text-white border border-secondary-600'
            }`}>
              Add Subscription (+${subscription.price}/mo)
            </button>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-secondary-800/50 border border-secondary-600/50 rounded-xl p-6 mb-8 max-w-3xl mx-auto">
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-white mb-2">Why Our Customers Choose Auto Update</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-black text-success-400 mb-2">87%</div>
            <div className="text-sm text-secondary-300">Of listings need updates within 1 year</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-volt-400 mb-2">$2,400</div>
            <div className="text-sm text-secondary-300">Average value saved per customer annually</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-success-400 mb-2">24/7</div>
            <div className="text-sm text-secondary-300">Continuous monitoring & protection</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <button
          onClick={onGoBack}
          className="px-6 py-3 border border-secondary-600 text-secondary-300 font-medium rounded-xl hover:bg-secondary-700 hover:border-secondary-500 transition-all duration-300"
        >
          ← Back to Add-ons
        </button>
        
        <button
          onClick={handleSkip}
          className="px-8 py-3 border border-secondary-600 text-secondary-300 font-medium rounded-xl hover:bg-secondary-700 hover:border-secondary-500 transition-all duration-300"
        >
          Skip Monitoring Service
        </button>
        
        <button
          onClick={handleContinue}
          className="px-10 py-4 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-volt-500/50 animate-glow"
        >
          Review Order →
        </button>
      </div>

      {/* Risk-Free Note */}
      <div className="mt-8 text-center">
        <div className="bg-success-900/20 border border-success-600/30 rounded-lg p-4 max-w-2xl mx-auto">
          <div className="text-sm text-success-300 font-medium mb-1">🛡️ Risk-Free Promise</div>
          <div className="text-sm text-secondary-400">
            Cancel the monitoring service anytime. No contracts, no fees. 
            Your main analysis purchase is complete regardless.
          </div>
        </div>
      </div>
    </div>
  )
}