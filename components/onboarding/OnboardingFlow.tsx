'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { UserIcon, GlobeAltIcon, CogIcon, RocketLaunchIcon } from '@heroicons/react/24/outline'

export interface OnboardingStep {
  id: string
  title: string
  description: string
  component: React.ComponentType<OnboardingStepProps>
  icon: React.ComponentType<any>
  optional?: boolean
}

export interface OnboardingStepProps {
  onNext: () => void
  onSkip?: () => void
  onPrev?: () => void
  data: Record<string, any>
  updateData: (key: string, value: any) => void
  isLast?: boolean
  isFirst?: boolean
}

interface OnboardingFlowProps {
  userId: string
  userTier: string
  onComplete: (data: Record<string, any>) => void
  onSkip?: () => void
  className?: string
}

// Import step components (we'll create these)
import WelcomeStep from './steps/WelcomeStep'
import BusinessInfoStep from './steps/BusinessInfoStep'
import GoalsStep from './steps/GoalsStep'
import FeatureDiscoveryStep from './steps/FeatureDiscoveryStep'
import CompletionStep from './steps/CompletionStep'

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to DirectoryBolt',
    description: 'Let\'s get you set up for success',
    component: WelcomeStep,
    icon: RocketLaunchIcon
  },
  {
    id: 'business-info',
    title: 'Business Information',
    description: 'Tell us about your business',
    component: BusinessInfoStep,
    icon: UserIcon
  },
  {
    id: 'goals',
    title: 'Your Goals',
    description: 'What are you looking to achieve?',
    component: GoalsStep,
    icon: CogIcon
  },
  {
    id: 'feature-discovery',
    title: 'Discover Features',
    description: 'Explore what\'s available in your plan',
    component: FeatureDiscoveryStep,
    icon: GlobeAltIcon
  },
  {
    id: 'completion',
    title: 'You\'re All Set!',
    description: 'Ready to start growing your business',
    component: CompletionStep,
    icon: RocketLaunchIcon
  }
]

export default function OnboardingFlow({
  userId,
  userTier,
  onComplete,
  onSkip,
  className = ''
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [onboardingData, setOnboardingData] = useState<Record<string, any>>({
    userId,
    userTier,
    completedAt: null,
    skippedSteps: []
  })
  const [isAnimating, setIsAnimating] = useState(false)
  const router = useRouter()

  // Check if user has already completed onboarding
  useEffect(() => {
    checkOnboardingStatus()
  }, [userId])

  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch(`/api/onboarding/status?userId=${userId}`)
      if (response.ok) {
        const { completed, data } = await response.json()
        if (completed) {
          // User already completed onboarding, skip to dashboard
          onComplete(data || {})
          return
        }
        // Load any existing partial data
        if (data) {
          setOnboardingData(prev => ({ ...prev, ...data }))
        }
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error)
    }
  }

  const updateData = (key: string, value: any) => {
    setOnboardingData(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleNext = () => {
    if (isAnimating) return
    
    setIsAnimating(true)
    
    // Save progress
    saveProgress()
    
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleComplete()
    }
    
    setTimeout(() => setIsAnimating(false), 300)
  }

  const handlePrev = () => {
    if (isAnimating || currentStep === 0) return
    
    setIsAnimating(true)
    setCurrentStep(prev => prev - 1)
    setTimeout(() => setIsAnimating(false), 300)
  }

  const handleSkipStep = () => {
    const step = ONBOARDING_STEPS[currentStep]
    if (!step || !step.optional) return
    
    setOnboardingData(prev => ({
      ...prev,
      skippedSteps: [...(prev.skippedSteps || []), step.id]
    }))
    
    saveProgress()
    handleNext()
  }

  const handleSkipAll = () => {
    if (!onSkip) return
    
    // Mark as skipped in data
    const skippedData = {
      ...onboardingData,
      skipped: true,
      completedAt: new Date().toISOString()
    }
    
    saveOnboardingData(skippedData)
    onSkip()
  }

  const handleComplete = () => {
    const completedData = {
      ...onboardingData,
      completedAt: new Date().toISOString(),
      completed: true
    }
    
    saveOnboardingData(completedData)
    onComplete(completedData)
  }

  const saveProgress = async () => {
    try {
      await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          currentStep,
          data: onboardingData
        })
      })
    } catch (error) {
      console.error('Failed to save onboarding progress:', error)
    }
  }

  const saveOnboardingData = async (data: Record<string, any>) => {
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          data
        })
      })
    } catch (error) {
      console.error('Failed to save onboarding data:', error)
    }
  }

  const step = ONBOARDING_STEPS[currentStep]
  if (!step) {
    return <div>Invalid step</div>
  }
  const StepComponent = step.component
  const IconComponent = step.icon

  return (
    <div className={`min-h-screen bg-secondary-900 ${className}`}>
      {/* Header */}
      <header className="bg-secondary-800 border-b border-secondary-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-volt-500 rounded-xl flex items-center justify-center">
                <span className="text-2xl font-bold text-secondary-900">⚡</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">DirectoryBolt</h1>
                <p className="text-secondary-400 text-sm">Getting Started</p>
              </div>
            </div>
            
            {onSkip && (
              <button
                onClick={handleSkipAll}
                className="text-secondary-400 hover:text-secondary-300 text-sm font-medium transition-colors"
              >
                Skip Setup
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-secondary-800 border-b border-secondary-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-secondary-400 min-w-0">
              Step {currentStep + 1} of {ONBOARDING_STEPS.length}
            </span>
            <div className="flex-1 bg-secondary-700 rounded-full h-2">
              <motion.div
                className="bg-volt-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-sm text-volt-400 font-medium">
              {Math.round(((currentStep + 1) / ONBOARDING_STEPS.length) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-volt-500/20 rounded-full mb-6">
            <IconComponent className="w-8 h-8 text-volt-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">{step.title}</h2>
          <p className="text-xl text-secondary-400 max-w-2xl mx-auto">
            {step.description}
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <StepComponent
              onNext={handleNext}
              onSkip={step?.optional ? handleSkipStep : undefined}
              onPrev={currentStep > 0 ? handlePrev : undefined}
              data={onboardingData}
              updateData={updateData}
              isFirst={currentStep === 0}
              isLast={currentStep === ONBOARDING_STEPS.length - 1}
            />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-secondary-800 border-t border-secondary-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0 || isAnimating}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                currentStep === 0 || isAnimating
                  ? 'text-secondary-500 cursor-not-allowed'
                  : 'text-secondary-300 hover:text-white hover:bg-secondary-700'
              }`}
            >
              ← Previous
            </button>

            <div className="flex items-center gap-2">
              {ONBOARDING_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index <= currentStep ? 'bg-volt-500' : 'bg-secondary-600'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-4">
              {step?.optional && (
                <button
                  onClick={handleSkipStep}
                  disabled={isAnimating}
                  className="text-secondary-400 hover:text-secondary-300 font-medium transition-colors"
                >
                  Skip
                </button>
              )}
              
              <button
                onClick={handleNext}
                disabled={isAnimating}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  isAnimating
                    ? 'bg-secondary-600 text-secondary-400 cursor-not-allowed'
                    : 'bg-volt-500 text-secondary-900 hover:bg-volt-400'
                }`}
              >
                {currentStep === ONBOARDING_STEPS.length - 1 ? 'Get Started' : 'Continue'} →
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}