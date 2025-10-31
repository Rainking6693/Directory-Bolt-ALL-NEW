'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { OnboardingStepProps } from '../OnboardingFlow'
import { getTier, canAccessFeature } from '../../../lib/config/pricing'

interface Feature {
  id: string
  name: string
  description: string
  icon: string
  available: boolean
  tier: string
  highlight?: boolean
}

export default function FeatureDiscoveryStep({
  onNext,
  data,
  updateData
}: OnboardingStepProps) {
  const [discoveredFeatures, setDiscoveredFeatures] = useState<string[]>(data.discoveredFeatures || [])
  const [interestedFeatures, setInterestedFeatures] = useState<string[]>(data.interestedFeatures || [])
  
  const userTier = data.userTier || 'starter'
  const tierInfo = getTier(userTier)

  // Generate feature list based on user's tier
  const features: Feature[] = [
    {
      id: 'ai-directory-submissions',
      name: 'AI Directory Submissions',
      description: 'Automated submission to high-quality business directories',
      icon: '🚀',
      available: true,
      tier: 'starter',
      highlight: true
    },
    {
      id: 'competitive-analysis',
      name: 'Competitive Analysis',
      description: 'AI-powered insights into your competitors strategies',
      icon: '🎯',
      available: canAccessFeature(userTier, 'competitorAnalysis'),
      tier: 'growth'
    },
    {
      id: 'seo-content-gap',
      name: 'SEO Content Gap Analysis',
      description: 'Identify content opportunities your competitors are missing',
      icon: '🔍',
      available: canAccessFeature(userTier, 'seoTools'),
      tier: 'professional'
    },
    {
      id: 'real-time-analytics',
      name: 'Real-time Analytics',
      description: 'Live dashboard with performance metrics and insights',
      icon: '📊',
      available: true,
      tier: 'starter',
      highlight: true
    },
    {
      id: 'api-access',
      name: 'API Access',
      description: 'Integrate DirectoryBolt data into your existing systems',
      icon: '🔗',
      available: canAccessFeature(userTier, 'apiAccess'),
      tier: 'professional'
    },
    {
      id: 'white-label-reports',
      name: 'White-label Reports',
      description: 'Branded reports for your clients and stakeholders',
      icon: '📄',
      available: canAccessFeature(userTier, 'whiteLabel'),
      tier: 'professional'
    },
    {
      id: 'dedicated-support',
      name: 'Dedicated Account Manager',
      description: 'Personal support specialist for your account',
      icon: '👤',
      available: canAccessFeature(userTier, 'dedicatedSupport'),
      tier: 'enterprise'
    },
    {
      id: 'custom-integrations',
      name: 'Custom Integrations',
      description: 'Tailored integrations for your specific business needs',
      icon: '⚙️',
      available: canAccessFeature(userTier, 'dedicatedSupport'),
      tier: 'enterprise'
    }
  ]

  // Update parent data when selections change
  useEffect(() => {
    updateData('discoveredFeatures', discoveredFeatures)
    updateData('interestedFeatures', interestedFeatures)
  }, [discoveredFeatures, interestedFeatures, updateData])

  const markAsDiscovered = (featureId: string) => {
    if (!discoveredFeatures.includes(featureId)) {
      setDiscoveredFeatures(prev => [...prev, featureId])
    }
  }

  const toggleInterest = (featureId: string) => {
    setInterestedFeatures(prev => 
      prev.includes(featureId) 
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    )
    markAsDiscovered(featureId)
  }

  const availableFeatures = features.filter(f => f.available)
  const unavailableFeatures = features.filter(f => !f.available)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto"
    >
      <div className="bg-secondary-800 rounded-2xl border border-secondary-700 p-8">
        <div className="mb-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-2">
            Discover Your Features
          </h3>
          <p className="text-secondary-400 mb-4">
            Explore what's available in your {tierInfo?.name || userTier} plan
          </p>
          <div className="inline-flex items-center gap-2 bg-volt-500/20 text-volt-400 px-4 py-2 rounded-lg">
            <span className="text-lg">⚡</span>
            <span className="font-semibold">{tierInfo?.name || userTier} Plan</span>
            <span className="text-sm opacity-75">• {tierInfo?.directories || 0} directories</span>
          </div>
        </div>

        {/* Available Features */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            ✅ Features Available to You
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableFeatures.map(feature => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                onClick={() => markAsDiscovered(feature.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:scale-105 ${
                  feature.highlight
                    ? 'border-volt-500 bg-volt-500/20'
                    : discoveredFeatures.includes(feature.id)
                    ? 'border-success-500 bg-success-500/20'
                    : 'border-secondary-600 bg-secondary-700/50 hover:border-secondary-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{feature.icon}</div>
                  <div className="flex-1">
                    <h5 className="font-semibold text-white mb-1">{feature.name}</h5>
                    <p className="text-sm text-secondary-400 mb-3">{feature.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-success-400 font-medium">
                        ✓ Included in {feature.tier}
                      </span>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleInterest(feature.id)
                        }}
                        className={`text-xs px-3 py-1 rounded-full transition-colors ${
                          interestedFeatures.includes(feature.id)
                            ? 'bg-volt-500 text-secondary-900'
                            : 'bg-secondary-600 text-secondary-300 hover:bg-secondary-500'
                        }`}
                      >
                        {interestedFeatures.includes(feature.id) ? 'Interested ⭐' : 'Mark Interest'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Unavailable Features (Upgrade Opportunities) */}
        {unavailableFeatures.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              🔒 Upgrade to Unlock
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {unavailableFeatures.map(feature => (
                <div
                  key={feature.id}
                  className="p-4 rounded-lg border-2 border-secondary-600 bg-secondary-700/30 opacity-75"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl opacity-50">{feature.icon}</div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-white mb-1">{feature.name}</h5>
                      <p className="text-sm text-secondary-400 mb-3">{feature.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-orange-400 font-medium">
                          🔒 Requires {feature.tier} plan
                        </span>
                        
                        <button
                          onClick={() => toggleInterest(feature.id)}
                          className={`text-xs px-3 py-1 rounded-full transition-colors ${
                            interestedFeatures.includes(feature.id)
                              ? 'bg-orange-500 text-white'
                              : 'bg-secondary-600 text-secondary-300 hover:bg-secondary-500'
                          }`}
                        >
                          {interestedFeatures.includes(feature.id) ? 'Want This ⭐' : 'Interested?'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature Interest Summary */}
        {interestedFeatures.length > 0 && (
          <div className="bg-volt-500/10 border border-volt-500/30 rounded-lg p-4 mb-6">
            <h5 className="font-semibold text-volt-400 mb-2">Features You're Interested In:</h5>
            <div className="flex flex-wrap gap-2">
              {interestedFeatures.map(featureId => {
                const feature = features.find(f => f.id === featureId)
                return feature ? (
                  <span
                    key={featureId}
                    className={`px-3 py-1 rounded-full text-sm ${
                      feature.available
                        ? 'bg-success-500/20 text-success-300'
                        : 'bg-orange-500/20 text-orange-300'
                    }`}
                  >
                    {feature.icon} {feature.name}
                  </span>
                ) : null
              })}
            </div>
          </div>
        )}

        {/* Quick Start Tips */}
        <div className="bg-secondary-700/50 rounded-lg p-4 mb-6">
          <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
            💡 Quick Start Tips
          </h5>
          <ul className="text-sm text-secondary-300 space-y-1">
            <li>• Start with AI Directory Submissions to build your online presence</li>
            <li>• Check your dashboard regularly for submission updates</li>
            <li>• Use analytics to track your visibility improvements</li>
            {userTier !== 'starter' && (
              <li>• Explore competitive analysis to stay ahead of rivals</li>
            )}
          </ul>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onNext}
            className="bg-volt-500 hover:bg-volt-400 text-secondary-900 font-bold py-3 px-8 rounded-lg transition-colors flex items-center gap-2"
          >
            Let's Get Started! →
          </button>
        </div>
      </div>
    </motion.div>
  )
}