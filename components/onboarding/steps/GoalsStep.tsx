'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { OnboardingStepProps } from '../OnboardingFlow'

interface Goal {
  id: string
  title: string
  description: string
  icon: string
}

interface Priority {
  id: string
  title: string
  description: string
}

const BUSINESS_GOALS: Goal[] = [
  {
    id: 'increase-visibility',
    title: 'Increase Online Visibility',
    description: 'Get found by more potential customers online',
    icon: '👁️'
  },
  {
    id: 'generate-leads',
    title: 'Generate More Leads',
    description: 'Drive qualified prospects to your business',
    icon: '🎯'
  },
  {
    id: 'build-authority',
    title: 'Build Industry Authority',
    description: 'Establish credibility and trust in your field',
    icon: '🏆'
  },
  {
    id: 'local-presence',
    title: 'Strengthen Local Presence',
    description: 'Dominate local search results in your area',
    icon: '📍'
  },
  {
    id: 'compete-better',
    title: 'Outrank Competitors',
    description: 'Gain competitive advantage in search results',
    icon: '⚔️'
  },
  {
    id: 'save-time',
    title: 'Save Time & Resources',
    description: 'Automate marketing tasks to focus on your business',
    icon: '⏰'
  }
]

const PRIORITIES: Priority[] = [
  {
    id: 'speed',
    title: 'Speed',
    description: 'Get results as quickly as possible'
  },
  {
    id: 'quality',
    title: 'Quality',
    description: 'Focus on high-authority, relevant directories'
  },
  {
    id: 'coverage',
    title: 'Coverage',
    description: 'Maximum reach across all relevant platforms'
  },
  {
    id: 'local',
    title: 'Local Focus',
    description: 'Prioritize local and regional directories'
  }
]

export default function GoalsStep({
  onNext,
  data,
  updateData
}: OnboardingStepProps) {
  const [selectedGoals, setSelectedGoals] = useState<string[]>(data.goals || [])
  const [selectedPriority, setSelectedPriority] = useState<string>(data.priority || '')
  const [timeline, setTimeline] = useState<string>(data.timeline || '')
  const [additionalNotes, setAdditionalNotes] = useState<string>(data.additionalNotes || '')

  // Update parent data when selections change
  useEffect(() => {
    updateData('goals', selectedGoals)
    updateData('priority', selectedPriority)
    updateData('timeline', timeline)
    updateData('additionalNotes', additionalNotes)
  }, [selectedGoals, selectedPriority, timeline, additionalNotes, updateData])

  const toggleGoal = (goalId: string) => {
    setSelectedGoals(prev => 
      prev.includes(goalId) 
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    )
  }

  const canContinue = selectedGoals.length > 0 && selectedPriority && timeline

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="bg-secondary-800 rounded-2xl border border-secondary-700 p-8">
        <div className="mb-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-2">
            What are your main goals?
          </h3>
          <p className="text-secondary-400">
            Help us understand what success looks like for your business
          </p>
        </div>

        {/* Business Goals Selection */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-white mb-4">
            Select your primary goals (choose all that apply):
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BUSINESS_GOALS.map(goal => (
              <div
                key={goal.id}
                onClick={() => toggleGoal(goal.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:scale-105 ${
                  selectedGoals.includes(goal.id)
                    ? 'border-volt-500 bg-volt-500/20'
                    : 'border-secondary-600 bg-secondary-700/50 hover:border-secondary-500'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">{goal.icon}</div>
                  <h5 className="font-semibold text-white mb-1">{goal.title}</h5>
                  <p className="text-sm text-secondary-400">{goal.description}</p>
                </div>
                {selectedGoals.includes(goal.id) && (
                  <div className="flex justify-center mt-2">
                    <div className="w-6 h-6 bg-volt-500 rounded-full flex items-center justify-center">
                      <span className="text-secondary-900 text-sm">✓</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Priority Selection */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-white mb-4">
            What's your top priority?
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRIORITIES.map(priority => (
              <div
                key={priority.id}
                onClick={() => setSelectedPriority(priority.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedPriority === priority.id
                    ? 'border-volt-500 bg-volt-500/20'
                    : 'border-secondary-600 bg-secondary-700/50 hover:border-secondary-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-semibold text-white mb-1">{priority.title}</h5>
                    <p className="text-sm text-secondary-400">{priority.description}</p>
                  </div>
                  {selectedPriority === priority.id && (
                    <div className="w-6 h-6 bg-volt-500 rounded-full flex items-center justify-center">
                      <span className="text-secondary-900 text-sm">✓</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Selection */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-white mb-4">
            When do you need results?
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 'asap', label: 'ASAP', description: 'Start immediately' },
              { id: '30-days', label: '30 Days', description: 'Within a month' },
              { id: '90-days', label: '90 Days', description: 'Within 3 months' }
            ].map(option => (
              <div
                key={option.id}
                onClick={() => setTimeline(option.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all text-center ${
                  timeline === option.id
                    ? 'border-volt-500 bg-volt-500/20'
                    : 'border-secondary-600 bg-secondary-700/50 hover:border-secondary-500'
                }`}
              >
                <h5 className="font-semibold text-white mb-1">{option.label}</h5>
                <p className="text-sm text-secondary-400">{option.description}</p>
                {timeline === option.id && (
                  <div className="flex justify-center mt-2">
                    <div className="w-6 h-6 bg-volt-500 rounded-full flex items-center justify-center">
                      <span className="text-secondary-900 text-sm">✓</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Additional Notes */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-white mb-4">
            Additional notes (optional)
          </h4>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            rows={3}
            placeholder="Any specific requirements, target markets, or other details we should know..."
            className="w-full px-4 py-3 rounded-lg bg-secondary-700 border border-secondary-600 text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500/50 transition-colors resize-none"
          />
        </div>

        {/* Progress Summary */}
        {selectedGoals.length > 0 && (
          <div className="bg-volt-500/10 border border-volt-500/30 rounded-lg p-4 mb-6">
            <h5 className="font-semibold text-volt-400 mb-2">Your Goals Summary:</h5>
            <div className="flex flex-wrap gap-2">
              {selectedGoals.map(goalId => {
                const goal = BUSINESS_GOALS.find(g => g.id === goalId)
                return goal ? (
                  <span
                    key={goalId}
                    className="bg-volt-500/20 text-volt-300 px-3 py-1 rounded-full text-sm"
                  >
                    {goal.icon} {goal.title}
                  </span>
                ) : null
              })}
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={onNext}
            disabled={!canContinue}
            className={`font-bold py-3 px-8 rounded-lg transition-colors flex items-center gap-2 ${
              canContinue
                ? 'bg-volt-500 hover:bg-volt-400 text-secondary-900'
                : 'bg-secondary-600 text-secondary-400 cursor-not-allowed'
            }`}
          >
            {canContinue ? 'Continue →' : 'Please select your goals and priority'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}