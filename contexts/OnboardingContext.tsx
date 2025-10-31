// User Onboarding Context and Tutorial System
// Provides guided tutorials, feature discovery, and engagement tracking

'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface OnboardingStep {
  id: string
  title: string
  description: string
  target: string // CSS selector for the target element
  position: 'top' | 'bottom' | 'left' | 'right'
  component?: string // Which component/page this step belongs to
  tier?: 'starter' | 'growth' | 'professional' | 'enterprise' // Tier-specific features
  action?: {
    type: 'click' | 'input' | 'wait'
    target?: string
    value?: string
  }
  completed?: boolean
}

interface OnboardingFlow {
  id: string
  name: string
  description: string
  steps: OnboardingStep[]
  requiredTier?: string
  category: 'getting-started' | 'features' | 'advanced' | 'enterprise'
}

interface OnboardingContextType {
  activeFlow: OnboardingFlow | null
  currentStep: number
  isOnboardingActive: boolean
  completedFlows: string[]
  userProgress: Record<string, number>
  startOnboarding: (flowId: string) => void
  nextStep: () => void
  previousStep: () => void
  skipOnboarding: () => void
  completeStep: (stepId: string) => void
  markFlowComplete: (flowId: string) => void
  getUserProgress: () => number
  shouldShowFeatureDiscovery: (feature: string) => boolean
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

// Pre-defined onboarding flows
const ONBOARDING_FLOWS: OnboardingFlow[] = [
  {
    id: 'getting-started',
    name: 'Getting Started with DirectoryBolt',
    description: 'Learn the basics of DirectoryBolt and get your first directory submissions',
    category: 'getting-started',
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to DirectoryBolt!',
        description: "Let's get you started with automated directory submissions to boost your local SEO.",
        target: '[data-onboarding=\"dashboard-header\"]',
        position: 'bottom'
      },
      {
        id: 'business-info',
        title: 'Complete Your Business Information',
        description: 'Accurate business details ensure successful directory submissions.',
        target: '[data-onboarding=\"business-info\"]',
        position: 'right',
        action: { type: 'click', target: '[data-onboarding=\"edit-business-info\"]' }
      },
      {
        id: 'view-progress',
        title: 'Track Your Progress',
        description: 'Monitor your directory submissions and approval status in real-time.',
        target: '[data-onboarding=\"progress-ring\"]',
        position: 'left'
      },
      {
        id: 'directory-grid',
        title: 'Your Directory Submissions',
        description: 'See all your directory submissions, their status, and estimated traffic impact.',
        target: '[data-onboarding=\"directory-grid\"]',
        position: 'top'
      },
      {
        id: 'notifications',
        title: 'Stay Updated',
        description: 'Get notified about submission approvals, rejections, and important updates.',
        target: '[data-onboarding=\"notifications\"]',
        position: 'bottom'
      }
    ]
  },
  {
    id: 'advanced-features',
    name: 'Advanced Features Tour',
    description: 'Discover powerful features to maximize your local SEO impact',
    category: 'features',
    requiredTier: 'growth',
    steps: [
      {
        id: 'ai-analysis',
        title: 'AI-Powered Business Analysis',
        description: 'Get insights into your competitive position and optimization opportunities.',
        target: '[data-onboarding=\"ai-analysis\"]',
        position: 'bottom',
        tier: 'growth'
      },
      {
        id: 'competitive-benchmarking',
        title: 'Competitive Benchmarking',
        description: 'Compare your directory presence with competitors in your industry.',
        target: '[data-onboarding=\"competitive-analysis\"]',
        position: 'right',
        tier: 'professional'
      },
      {
        id: 'content-gap-analysis',
        title: 'SEO Content Gap Analysis',
        description: 'Identify content opportunities to outrank your competition.',
        target: '[data-onboarding=\"content-gap\"]',
        position: 'left',
        tier: 'professional'
      }
    ]
  },
  {
    id: 'enterprise-features',
    name: 'Enterprise Features',
    description: 'Unlock the full power of DirectoryBolt for your organization',
    category: 'enterprise',
    requiredTier: 'enterprise',
    steps: [
      {
        id: 'team-management',
        title: 'Team Management',
        description: 'Add team members and manage permissions across your organization.',
        target: '[data-onboarding=\"team-management\"]',
        position: 'bottom',
        tier: 'enterprise'
      },
      {
        id: 'white-label',
        title: 'White-Label Branding',
        description: "Customize the platform with your company's branding and colors.",
        target: '[data-onboarding=\"branding\"]',
        position: 'right',
        tier: 'enterprise'
      },
      {
        id: 'api-access',
        title: 'API Integration',
        description: 'Integrate DirectoryBolt with your existing tools and workflows.',
        target: '[data-onboarding=\"api-settings\"]',
        position: 'left',
        tier: 'enterprise'
      },
      {
        id: 'advanced-reporting',
        title: 'Advanced Reporting',
        description: 'Generate detailed reports and export data for stakeholders.',
        target: '[data-onboarding=\"reporting\"]',
        position: 'top',
        tier: 'enterprise'
      }
    ]
  }
]

interface OnboardingProviderProps {
  children: ReactNode
  userTier?: string
}

export function OnboardingProvider({ children, userTier = 'starter' }: OnboardingProviderProps) {
  const [activeFlow, setActiveFlow] = useState<OnboardingFlow | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [isOnboardingActive, setIsOnboardingActive] = useState(false)
  const [completedFlows, setCompletedFlows] = useState<string[]>([])
  const [userProgress, setUserProgress] = useState<Record<string, number>>({})

  // Load user progress from localStorage
  useEffect(() => {
    const savedProgress = localStorage.getItem('onboarding-progress')
    const savedFlows = localStorage.getItem('completed-flows')
    
    if (savedProgress) {
      setUserProgress(JSON.parse(savedProgress))
    }
    
    if (savedFlows) {
      setCompletedFlows(JSON.parse(savedFlows))
    }

    // Auto-start getting-started flow for new users
    const hasSeenOnboarding = localStorage.getItem('onboarding-seen')
    if (!hasSeenOnboarding) {
      setTimeout(() => {
        startOnboarding('getting-started')
        localStorage.setItem('onboarding-seen', 'true')
      }, 2000) // Wait 2 seconds after dashboard loads
    }
  }, [])

  const startOnboarding = (flowId: string) => {
    const flow = ONBOARDING_FLOWS.find(f => f.id === flowId)
    if (flow && (!flow.requiredTier || canAccessTier(flow.requiredTier, userTier))) {
      setActiveFlow(flow)
      setCurrentStep(0)
      setIsOnboardingActive(true)
    }
  }

  const nextStep = () => {
    if (activeFlow && currentStep < activeFlow.steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Flow completed
      if (activeFlow) {
        markFlowComplete(activeFlow.id)
      }
      setIsOnboardingActive(false)
      setActiveFlow(null)
    }
  }

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const skipOnboarding = () => {
    setIsOnboardingActive(false)
    setActiveFlow(null)
    setCurrentStep(0)
  }

  const completeStep = (stepId: string) => {
    if (activeFlow) {
      const newProgress = { ...userProgress }
      newProgress[activeFlow.id] = Math.max(newProgress[activeFlow.id] || 0, currentStep + 1)
      setUserProgress(newProgress)
      localStorage.setItem('onboarding-progress', JSON.stringify(newProgress))
    }
  }

  const markFlowComplete = (flowId: string) => {
    const newCompletedFlows = [...completedFlows, flowId]
    setCompletedFlows(newCompletedFlows)
    localStorage.setItem('completed-flows', JSON.stringify(newCompletedFlows))
  }

  const getUserProgress = () => {
    const totalSteps = ONBOARDING_FLOWS.reduce((sum, flow) => sum + flow.steps.length, 0)
    const completedSteps = Object.values(userProgress).reduce((sum, progress) => sum + progress, 0)
    return Math.round((completedSteps / totalSteps) * 100)
  }

  const shouldShowFeatureDiscovery = (feature: string) => {
    // Show feature discovery for features user hasn't discovered yet
    const discoveredFeatures = JSON.parse(localStorage.getItem('discovered-features') || '[]')
    return !discoveredFeatures.includes(feature)
  }

  const value: OnboardingContextType = {
    activeFlow,
    currentStep,
    isOnboardingActive,
    completedFlows,
    userProgress,
    startOnboarding,
    nextStep,
    previousStep,
    skipOnboarding,
    completeStep,
    markFlowComplete,
    getUserProgress,
    shouldShowFeatureDiscovery
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return context
}

// Helper function to check tier access
function canAccessTier(requiredTier: string, userTier: string): boolean {
  const tierHierarchy = ['starter', 'growth', 'professional', 'enterprise']
  const requiredIndex = tierHierarchy.indexOf(requiredTier)
  const userIndex = tierHierarchy.indexOf(userTier)
  return userIndex >= requiredIndex
}

// Export flows for use in other components
export { ONBOARDING_FLOWS }
export type { OnboardingFlow, OnboardingStep }