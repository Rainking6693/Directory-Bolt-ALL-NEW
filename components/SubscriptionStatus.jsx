'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { UpgradeButton } from './CheckoutButton'

const PLAN_DETAILS = {
  free: {
    name: 'Free Plan',
    color: 'secondary',
    icon: '🆓',
    description: 'Basic features to get started',
    limits: {
      directories: 5,
      websites: 1,
      ai_optimization: false,
      support: 'Email only'
    }
  },
  starter: {
    name: 'Starter',
    color: 'volt',
    icon: '🚀',
    description: 'Perfect for small businesses',
    limits: {
      directories: 25,
      websites: 3,
      ai_optimization: false,
      support: 'Email'
    }
  },
  professional: {
    name: 'Professional',
    color: 'success',
    icon: '⭐',
    description: 'AI-powered optimization',
    limits: {
      directories: 100,
      websites: 10,
      ai_optimization: true,
      support: 'Priority phone + email'
    }
  },
  enterprise: {
    name: 'Enterprise',
    color: 'volt',
    icon: '👑',
    description: 'Unlimited everything',
    limits: {
      directories: 'Unlimited',
      websites: 'Unlimited',
      ai_optimization: true,
      support: 'Dedicated account manager'
    }
  }
}

const SubscriptionStatus = ({
  currentPlan = 'free',
  usage = {},
  nextBillingDate,
  isAnnual = false,
  showUpgradeButton = true,
  compact = false,
  className = ''
}) => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const plan = PLAN_DETAILS[currentPlan]

  // Mock usage data if not provided
  const mockUsage = {
    directories_used: currentPlan === 'free' ? 3 : currentPlan === 'starter' ? 12 : 45,
    websites_used: currentPlan === 'free' ? 1 : currentPlan === 'starter' ? 2 : 5,
    ai_optimizations_used: currentPlan === 'professional' || currentPlan === 'enterprise' ? 15 : 0,
    ...usage
  }

  const getUsagePercentage = (used, limit) => {
    if (limit === 'Unlimited' || typeof limit !== 'number') return 0
    return Math.min((used / limit) * 100, 100)
  }

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return 'danger'
    if (percentage >= 75) return 'warning'
    return 'success'
  }

  const handleManageSubscription = () => {
    router.push('/account')
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-3 bg-secondary-800/50 border border-secondary-600 rounded-lg px-4 py-2 ${className}`}>
        <span className="text-lg">{plan.icon}</span>
        <div>
          <div className="text-sm font-semibold text-volt-400">{plan.name}</div>
          <div className="text-xs text-secondary-400">{plan.description}</div>
        </div>
        {showUpgradeButton && currentPlan !== 'enterprise' && (
          <UpgradeButton 
            plan={currentPlan === 'free' ? 'starter' : 'professional'}
            size="sm"
            className="ml-2"
          />
        )}
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-br from-secondary-800 to-secondary-900 rounded-xl border border-secondary-600 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-r from-volt-500 to-volt-600 rounded-xl flex items-center justify-center text-2xl">
            {plan.icon}
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{plan.name}</h3>
            <p className="text-secondary-400">{plan.description}</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
            plan.color === 'volt' ? 'bg-volt-500/20 text-volt-400' :
            plan.color === 'success' ? 'bg-success-500/20 text-success-400' :
            'bg-secondary-600 text-secondary-300'
          }`}>
            {currentPlan === 'free' ? 'Free Forever' : 
             nextBillingDate ? `Next billing: ${nextBillingDate}` : 
             'Active'}
          </div>
          {isAnnual && currentPlan !== 'free' && (
            <div className="text-xs text-success-400 mt-1">20% Annual Discount</div>
          )}
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Directory Submissions */}
        <div className="bg-secondary-900/50 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-secondary-300">Directory Submissions</span>
            <span className="text-sm text-white">
              {mockUsage.directories_used} / {plan.limits.directories}
            </span>
          </div>
          {plan.limits.directories !== 'Unlimited' && (
            <div className="w-full bg-secondary-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full bg-gradient-to-r ${
                  getUsageColor(getUsagePercentage(mockUsage.directories_used, plan.limits.directories)) === 'danger' 
                    ? 'from-danger-500 to-danger-600'
                    : getUsageColor(getUsagePercentage(mockUsage.directories_used, plan.limits.directories)) === 'warning'
                    ? 'from-orange-400 to-orange-500'
                    : 'from-success-500 to-success-600'
                }`}
                style={{ width: `${getUsagePercentage(mockUsage.directories_used, plan.limits.directories)}%` }}
              ></div>
            </div>
          )}
        </div>

        {/* Websites */}
        <div className="bg-secondary-900/50 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-secondary-300">Websites</span>
            <span className="text-sm text-white">
              {mockUsage.websites_used} / {plan.limits.websites}
            </span>
          </div>
          {plan.limits.websites !== 'Unlimited' && (
            <div className="w-full bg-secondary-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full bg-gradient-to-r ${
                  getUsageColor(getUsagePercentage(mockUsage.websites_used, plan.limits.websites)) === 'danger' 
                    ? 'from-danger-500 to-danger-600'
                    : getUsageColor(getUsagePercentage(mockUsage.websites_used, plan.limits.websites)) === 'warning'
                    ? 'from-orange-400 to-orange-500'
                    : 'from-success-500 to-success-600'
                }`}
                style={{ width: `${getUsagePercentage(mockUsage.websites_used, plan.limits.websites)}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-secondary-300 mb-3">Plan Features</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-3">
            <span className={plan.limits.ai_optimization ? 'text-success-400' : 'text-secondary-500'}>
              {plan.limits.ai_optimization ? '✓' : '✗'}
            </span>
            <span className={`text-sm ${plan.limits.ai_optimization ? 'text-white' : 'text-secondary-500'}`}>
              AI Optimization
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-success-400">✓</span>
            <span className="text-sm text-white">
              {plan.limits.support}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-success-400">✓</span>
            <span className="text-sm text-white">
              Analytics Dashboard
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={currentPlan === 'enterprise' ? 'text-success-400' : 'text-secondary-500'}>
              {currentPlan === 'enterprise' ? '✓' : '✗'}
            </span>
            <span className={`text-sm ${currentPlan === 'enterprise' ? 'text-white' : 'text-secondary-500'}`}>
              White-label Branding
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {showUpgradeButton && currentPlan !== 'enterprise' && (
          <UpgradeButton 
            plan={currentPlan === 'free' ? 'starter' : currentPlan === 'starter' ? 'professional' : 'enterprise'}
            size="md"
            className="flex-1"
          >
            {currentPlan === 'free' ? 'Upgrade to Starter' : 
             currentPlan === 'starter' ? 'Upgrade to Pro' : 
             'Upgrade to Enterprise'}
          </UpgradeButton>
        )}
        
        {currentPlan !== 'free' && (
          <button
            onClick={handleManageSubscription}
            className="flex-1 px-6 py-3 border-2 border-secondary-600 text-secondary-300 font-bold rounded-xl hover:border-secondary-500 hover:text-white transition-all duration-300"
          >
            Manage Subscription
          </button>
        )}

        {currentPlan === 'free' && (
          <button
            onClick={() => router.push('/pricing')}
            className="flex-1 px-6 py-3 border-2 border-volt-500 text-volt-500 font-bold rounded-xl hover:bg-volt-500 hover:text-secondary-900 transition-all duration-300"
          >
            View All Plans
          </button>
        )}
      </div>

      {/* Usage Warnings */}
      {plan.limits.directories !== 'Unlimited' && getUsagePercentage(mockUsage.directories_used, plan.limits.directories) >= 80 && (
        <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-orange-400">⚠️</span>
            <span className="text-sm text-orange-300">
              You've used {getUsagePercentage(mockUsage.directories_used, plan.limits.directories).toFixed(0)}% of your directory submissions. 
              {getUsagePercentage(mockUsage.directories_used, plan.limits.directories) >= 90 && ' Consider upgrading to avoid interruption.'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default SubscriptionStatus