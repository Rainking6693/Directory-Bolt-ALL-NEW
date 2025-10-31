'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { OnboardingStepProps } from '../OnboardingFlow'
import { getTier } from '../../../lib/config/pricing'

export default function CompletionStep({
  onNext,
  data,
  updateData
}: OnboardingStepProps) {
  const [isCompleting, setIsCompleting] = useState(false)
  const userTier = data.userTier || 'starter'
  const tierInfo = getTier(userTier)

  // Update completion data
  useEffect(() => {
    updateData('onboardingCompleted', true)
    updateData('completedAt', new Date().toISOString())
  }, [updateData])

  const handleGetStarted = async () => {
    setIsCompleting(true)
    
    // Simulate any final setup
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    onNext()
  }

  const goals = data.goals || []
  const businessName = data.businessName || 'Your Business'
  const priority = data.priority || ''
  const timeline = data.timeline || ''

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'speed': return 'Speed - Get results quickly'
      case 'quality': return 'Quality - Focus on high-authority directories'
      case 'coverage': return 'Coverage - Maximum reach'
      case 'local': return 'Local Focus - Regional directories'
      default: return priority
    }
  }

  const getTimelineText = (timeline: string) => {
    switch (timeline) {
      case 'asap': return 'ASAP - Start immediately'
      case '30-days': return 'Within 30 days'
      case '90-days': return 'Within 3 months'
      default: return timeline
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <div className="bg-secondary-800 rounded-2xl border border-secondary-700 p-8">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-20 h-20 bg-success-500 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <span className="text-4xl">🎉</span>
          </motion.div>
          
          <h3 className="text-3xl font-bold text-white mb-4">
            Welcome to DirectoryBolt, {businessName}!
          </h3>
          <p className="text-xl text-secondary-300 mb-6">
            You're all set up and ready to transform your online visibility
          </p>
        </div>

        {/* Setup Summary */}
        <div className="bg-secondary-700/50 rounded-lg p-6 mb-8">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            📋 Your Setup Summary
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-secondary-400">Plan:</span>
              <div className="text-white font-medium">
                {tierInfo?.name || userTier} • {tierInfo?.directories} directories
              </div>
            </div>
            
            <div>
              <span className="text-secondary-400">Industry:</span>
              <div className="text-white font-medium">{data.industry || 'Not specified'}</div>
            </div>
            
            <div>
              <span className="text-secondary-400">Priority:</span>
              <div className="text-white font-medium">{getPriorityText(priority)}</div>
            </div>
            
            <div>
              <span className="text-secondary-400">Timeline:</span>
              <div className="text-white font-medium">{getTimelineText(timeline)}</div>
            </div>
            
            {goals.length > 0 && (
              <div className="md:col-span-2">
                <span className="text-secondary-400">Goals:</span>
                <div className="text-white font-medium">
                  {goals.length} goal{goals.length > 1 ? 's' : ''} selected
                </div>
              </div>
            )}
          </div>
        </div>

        {/* What Happens Next */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            🚀 What Happens Next
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-volt-500 rounded-full flex items-center justify-center text-secondary-900 font-bold">
                1
              </div>
              <div>
                <h5 className="font-semibold text-white">AI Analysis Begins</h5>
                <p className="text-secondary-400 text-sm">
                  Our AI will analyze your business and identify the best directories for your industry and location
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-volt-500 rounded-full flex items-center justify-center text-secondary-900 font-bold">
                2
              </div>
              <div>
                <h5 className="font-semibold text-white">Automated Submissions</h5>
                <p className="text-secondary-400 text-sm">
                  We'll start submitting your business to high-quality directories based on your priority settings
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-volt-500 rounded-full flex items-center justify-center text-secondary-900 font-bold">
                3
              </div>
              <div>
                <h5 className="font-semibold text-white">Real-time Updates</h5>
                <p className="text-secondary-400 text-sm">
                  Track your progress in real-time through your dashboard and receive notifications
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="bg-volt-500/10 border border-volt-500/30 rounded-lg p-4 mb-8">
          <h5 className="font-semibold text-volt-400 mb-2 flex items-center gap-2">
            💡 Pro Tips for Success
          </h5>
          <ul className="text-sm text-secondary-300 space-y-1">
            <li>• Check your dashboard regularly for submission updates</li>
            <li>• Respond promptly to any directory verification emails</li>
            <li>• Keep your business information consistent across all platforms</li>
            {userTier !== 'starter' && (
              <li>• Use the analytics tools to track your growing online presence</li>
            )}
          </ul>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={handleGetStarted}
            disabled={isCompleting}
            className={`font-bold py-4 px-8 rounded-lg transition-all flex items-center gap-2 mx-auto ${
              isCompleting
                ? 'bg-secondary-600 text-secondary-400 cursor-not-allowed'
                : 'bg-volt-500 hover:bg-volt-400 text-secondary-900 hover:scale-105'
            }`}
          >
            {isCompleting ? (
              <>
                <div className="w-5 h-5 border-2 border-secondary-400 border-t-secondary-200 rounded-full animate-spin"></div>
                Setting up your account...
              </>
            ) : (
              <>
                🚀 Launch My Dashboard
              </>
            )}
          </button>
          
          <p className="text-secondary-400 text-sm mt-4">
            You'll be redirected to your dashboard where you can track your progress
          </p>
        </div>

        {/* Contact Info */}
        <div className="mt-8 pt-6 border-t border-secondary-700 text-center">
          <p className="text-secondary-400 text-sm mb-2">
            Need help? We're here for you!
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <a href="mailto:support@directorybolt.com" className="text-volt-400 hover:text-volt-300">
              📧 Email Support
            </a>
            {userTier === 'enterprise' && (
              <span className="text-success-400">
                👤 Dedicated Account Manager
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}