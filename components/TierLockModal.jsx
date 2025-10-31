'use client'
import { useEffect, useRef } from 'react'

const TIER_INFO = {
  starter: {
    name: 'Starter',
    price: '$49/mo',
    color: 'text-success-400',
    features: ['25 submissions/month', 'Basic analytics', 'Email support']
  },
  growth: {
    name: 'Growth', 
    price: '$79/mo',
    color: 'text-volt-400',
    features: ['50 submissions/month', 'Advanced analytics', 'Priority support', 'Medium difficulty directories']
  },
  professional: {
    name: 'Professional',
    price: '$129/mo', 
    color: 'text-purple-400',
    features: ['100+ submissions/month', 'Premium analytics', 'Phone support', 'All difficulty levels', 'API access']
  },
  enterprise: {
    name: 'Enterprise',
    price: '$299/mo',
    color: 'text-red-400',
    features: ['500+ submissions/month', 'Enterprise analytics', 'Dedicated manager', 'White-label options']
  }
}

const TIER_PROGRESSION = ['starter', 'growth', 'professional', 'enterprise']

export default function TierLockModal({
  isOpen = false,
  onClose = () => {},
  directory = null,
  currentTier = 'starter',
  requiredTier = 'growth',
  onUpgrade = () => {}
}) {
  const modalRef = useRef(null)

  // Handle escape key and backdrop click
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }

    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen || !directory) return null

  const currentTierInfo = TIER_INFO[currentTier]
  const requiredTierInfo = TIER_INFO[requiredTier]
  const currentTierIndex = TIER_PROGRESSION.indexOf(currentTier)
  const requiredTierIndex = TIER_PROGRESSION.indexOf(requiredTier)

  // Calculate savings for annual billing
  const monthlyCost = parseInt(requiredTierInfo.price.replace(/[^\d]/g, ''))
  const annualCost = Math.floor(monthlyCost * 10) // 2 months free
  const savings = (monthlyCost * 12) - annualCost

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-secondary-900/80 backdrop-blur-sm animate-fade-in" />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative bg-gradient-to-br from-secondary-800 to-secondary-900 border border-secondary-600 rounded-2xl p-8 max-w-lg w-full mx-4 animate-zoom-in shadow-2xl"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-secondary-400 hover:text-white transition-colors duration-200 p-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-black text-white mb-2">
            Premium Directory Locked
          </h2>
          <p className="text-secondary-300">
            Upgrade to access high-authority directories
          </p>
        </div>

        {/* Directory Info */}
        <div className="bg-secondary-900/50 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">{directory.name}</h3>
              <div className="text-sm text-secondary-400">{directory.category}</div>
            </div>
            <div className="text-right">
              <div className="text-volt-400 font-bold">DA {directory.authority}</div>
              <div className="text-xs text-secondary-400">Domain Authority</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-danger-400">🔴</span>
              <span className="text-secondary-300">Hard Difficulty</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⏳</span>
              <span className="text-secondary-300">{directory.timeToApproval}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>📈</span>
              <span className="text-secondary-300">
                {directory.estimatedTraffic >= 1000 ? 
                  `${Math.floor(directory.estimatedTraffic / 1000)}K` : 
                  directory.estimatedTraffic} visits/mo
              </span>
            </div>
          </div>
        </div>

        {/* Tier Comparison */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-4">Required Plan</h3>
          
          {/* Current Plan */}
          <div className="bg-secondary-700/50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-white">Your Current Plan: {currentTierInfo.name}</span>
              <span className={currentTierInfo.color}>{currentTierInfo.price}</span>
            </div>
            <div className="text-sm text-secondary-400">
              Access to easy directories only
            </div>
          </div>

          {/* Required Plan */}
          <div className="bg-volt-500/10 border border-volt-500/30 rounded-lg p-4 relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-volt-500/5 to-transparent opacity-50" />
            
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white">Upgrade to {requiredTierInfo.name}</span>
                  <span className="px-2 py-1 bg-volt-500 text-secondary-900 rounded-full text-xs font-bold">
                    RECOMMENDED
                  </span>
                </div>
                <span className={requiredTierInfo.color}>{requiredTierInfo.price}</span>
              </div>
              
              <ul className="space-y-1 mb-4">
                {requiredTierInfo.features.map((feature, index) => (
                  <li key={index} className="text-sm text-secondary-300 flex items-center gap-2">
                    <span className="text-success-400">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              
              <div className="text-sm text-volt-400 font-bold">
                Unlocks {requiredTierIndex >= 2 ? 'ALL' : requiredTierIndex >= 1 ? 'medium & easy' : 'easy'} directories
              </div>
            </div>
          </div>
        </div>

        {/* Value Proposition */}
        <div className="bg-gradient-to-r from-success-500/10 to-volt-500/10 border border-success-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">💰</span>
            <span className="text-success-400 font-bold">ROI Projection</span>
          </div>
          <p className="text-sm text-secondary-300">
            High-authority directories like <strong>{directory.name}</strong> can drive 
            <strong className="text-volt-400"> 25-100 qualified leads per month</strong>. 
            Just 1-2 new customers typically covers your entire subscription cost.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={onUpgrade}
            className="w-full bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black py-4 px-6 rounded-xl hover:from-volt-400 hover:to-volt-500 transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-volt-500/50"
          >
            🚀 Upgrade to {requiredTierInfo.name} Plan
          </button>
          
          <button
            onClick={onClose}
            className="w-full border-2 border-secondary-600 text-secondary-300 font-bold py-3 px-6 rounded-xl hover:border-secondary-500 hover:text-white transition-all duration-300"
          >
            Maybe Later
          </button>
        </div>

        {/* Guarantee */}
        <div className="text-center mt-6 pt-6 border-t border-secondary-700">
          <p className="text-xs text-secondary-400">
            ✅ 30-day money-back guarantee • ✅ Cancel anytime • ✅ No setup fees
          </p>
        </div>
      </div>
    </div>
  )
}