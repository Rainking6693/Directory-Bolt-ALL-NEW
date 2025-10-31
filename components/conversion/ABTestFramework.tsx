import React, { useState, useEffect, useContext, createContext, useCallback } from 'react'
import { trackABTest, trackCustomEvent } from '../analytics/ConversionTracker'

// Types
interface ABTestVariant {
  id: string
  name: string
  weight: number
  component?: React.ComponentType<any>
  props?: Record<string, any>
  metadata?: Record<string, any>
}

interface ABTest {
  id: string
  name: string
  description?: string
  status: 'draft' | 'running' | 'paused' | 'completed'
  startDate?: Date
  endDate?: Date
  targetSampleSize?: number
  variants: ABTestVariant[]
  conversionGoals: string[]
  audienceFilters?: ABTestAudience
  trafficAllocation: number // Percentage of traffic to include in test
}

interface ABTestAudience {
  includeReturningUsers?: boolean
  includeNewUsers?: boolean
  geoFilter?: string[]
  deviceFilter?: ('desktop' | 'mobile' | 'tablet')[]
  sourceFilter?: string[]
  customFilters?: Record<string, any>
}

interface ABTestResult {
  testId: string
  variantId: string
  userId: string
  sessionId: string
  timestamp: Date
  conversionEvents: string[]
  metadata?: Record<string, any>
}

interface ABTestContext {
  getVariant: (testId: string) => string | null
  trackConversion: (testId: string, eventName: string, data?: Record<string, any>) => void
  registerTest: (test: ABTest) => void
  getUserId: () => string
  getSessionId: () => string
}

// Context for A/B testing
const ABTestingContext = createContext<ABTestContext | null>(null)

// A/B Test Provider
interface ABTestProviderProps {
  children: React.ReactNode
  config?: {
    persistVariants?: boolean
    enableDevMode?: boolean
    apiEndpoint?: string
  }
}

export function ABTestProvider({ 
  children, 
  config = {} 
}: ABTestProviderProps) {
  const {
    persistVariants = true,
    enableDevMode = process.env.NODE_ENV === 'development',
    apiEndpoint = '/api/ab-testing'
  } = config

  const [tests, setTests] = useState<Map<string, ABTest>>(new Map())
  const [userVariants, setUserVariants] = useState<Map<string, string>>(new Map())
  const [userId] = useState(() => generateUserId())
  const [sessionId] = useState(() => generateSessionId())

  // Load persisted variants on mount
  useEffect(() => {
    if (persistVariants && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ab_test_variants')
        if (saved) {
          const parsed = JSON.parse(saved)
          setUserVariants(new Map(Object.entries(parsed)))
        }
      } catch (error) {
        console.warn('Failed to load AB test variants from localStorage:', error)
      }
    }
  }, [persistVariants])

  // Save variants when they change
  useEffect(() => {
    if (persistVariants && typeof window !== 'undefined') {
      try {
        const variants = Object.fromEntries(userVariants)
        localStorage.setItem('ab_test_variants', JSON.stringify(variants))
      } catch (error) {
        console.warn('Failed to save AB test variants to localStorage:', error)
      }
    }
  }, [userVariants, persistVariants])

  const registerTest = useCallback((test: ABTest) => {
    setTests(prev => new Map(prev).set(test.id, test))
    
    if (enableDevMode) {
      console.log('AB Test registered:', test.id, test)
    }
  }, [enableDevMode])

  const getVariant = useCallback((testId: string): string | null => {
    const test = tests.get(testId)
    if (!test || test.status !== 'running') {
      return null
    }

    // Check if user already has a variant for this test
    if (userVariants.has(testId)) {
      return userVariants.get(testId)!
    }

    // Check traffic allocation
    if (Math.random() > (test.trafficAllocation / 100)) {
      return null // User not included in test
    }

    // Check audience filters
    if (!isUserInAudience(test.audienceFilters)) {
      return null
    }

    // Select variant based on weights
    const selectedVariant = selectVariantByWeight(test.variants)
    if (selectedVariant) {
      setUserVariants(prev => new Map(prev).set(testId, selectedVariant.id))
      
      // Track assignment
      trackABTest(test.id, selectedVariant.id, {
        user_id: userId,
        session_id: sessionId,
        test_name: test.name,
        variant_name: selectedVariant.name
      })

      if (enableDevMode) {
        console.log(`AB Test Assignment: ${testId} -> ${selectedVariant.id}`)
      }

      // Send to analytics
      sendTestAssignment(test.id, selectedVariant.id)
    }

    return selectedVariant?.id || null
  }, [tests, userVariants, userId, sessionId, enableDevMode])

  const trackConversion = useCallback((
    testId: string, 
    eventName: string, 
    data: Record<string, any> = {}
  ) => {
    const variantId = userVariants.get(testId)
    const test = tests.get(testId)
    
    if (!variantId || !test) return

    const conversionData = {
      test_id: testId,
      variant_id: variantId,
      event_name: eventName,
      user_id: userId,
      session_id: sessionId,
      test_name: test.name,
      ...data
    }

    trackCustomEvent('ab_test_conversion', conversionData)

    if (enableDevMode) {
      console.log('AB Test Conversion:', conversionData)
    }

    // Send to analytics
    sendConversionEvent(testId, variantId, eventName, conversionData)
  }, [userVariants, tests, userId, sessionId, enableDevMode])

  const sendTestAssignment = async (testId: string, variantId: string) => {
    try {
      await fetch(`${apiEndpoint}/assignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId,
          variantId,
          userId,
          sessionId,
          timestamp: new Date().toISOString()
        })
      })
    } catch (error) {
      console.error('Failed to send AB test assignment:', error)
    }
  }

  const sendConversionEvent = async (
    testId: string, 
    variantId: string, 
    eventName: string, 
    data: Record<string, any>
  ) => {
    try {
      await fetch(`${apiEndpoint}/conversion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId,
          variantId,
          eventName,
          userId,
          sessionId,
          data,
          timestamp: new Date().toISOString()
        })
      })
    } catch (error) {
      console.error('Failed to send AB test conversion:', error)
    }
  }

  const contextValue: ABTestContext = {
    getVariant,
    trackConversion,
    registerTest,
    getUserId: () => userId,
    getSessionId: () => sessionId
  }

  return (
    <ABTestingContext.Provider value={contextValue}>
      {children}
    </ABTestingContext.Provider>
  )
}

// Hook to use A/B testing context
export function useABTest() {
  const context = useContext(ABTestingContext)
  if (!context) {
    throw new Error('useABTest must be used within an ABTestProvider')
  }
  return context
}

// Component for A/B testing
interface ABTestComponentProps {
  testId: string
  variants: Record<string, React.ComponentType<any>>
  defaultVariant?: string
  children?: React.ReactNode
  fallback?: React.ComponentType<any>
  onVariantSelected?: (variantId: string) => void
}

export function ABTestComponent({
  testId,
  variants,
  defaultVariant,
  children,
  fallback: Fallback,
  onVariantSelected,
  ...props
}: ABTestComponentProps) {
  const { getVariant } = useABTest()
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)

  useEffect(() => {
    const variant = getVariant(testId)
    setSelectedVariant(variant)
    
    if (variant && onVariantSelected) {
      onVariantSelected(variant)
    }
  }, [testId, getVariant, onVariantSelected])

  if (selectedVariant && variants[selectedVariant]) {
    const VariantComponent = variants[selectedVariant]
    return <VariantComponent {...props} />
  }

  if (defaultVariant && variants[defaultVariant]) {
    const DefaultComponent = variants[defaultVariant]
    return <DefaultComponent {...props} />
  }

  if (Fallback) {
    return <Fallback {...props} />
  }

  return <>{children}</>
}

// Hook for simple A/B testing
export function useSimpleABTest(
  testId: string,
  variants: string[],
  defaultVariant?: string
): string {
  const { getVariant } = useABTest()
  const [selectedVariant, setSelectedVariant] = useState<string>(defaultVariant || variants[0])

  useEffect(() => {
    const variant = getVariant(testId)
    if (variant && variants.includes(variant)) {
      setSelectedVariant(variant)
    }
  }, [testId, getVariant, variants])

  return selectedVariant
}

// Conversion tracking hook
export function useConversionTracking(testId: string) {
  const { trackConversion } = useABTest()

  return useCallback((eventName: string, data?: Record<string, any>) => {
    trackConversion(testId, eventName, data)
  }, [testId, trackConversion])
}

// Test configuration component
export function ABTestConfig({ 
  tests, 
  onTestUpdate 
}: { 
  tests: ABTest[]
  onTestUpdate: (test: ABTest) => void 
}) {
  return (
    <div className="bg-secondary-800 rounded-lg p-6">
      <h3 className="text-lg font-bold text-white mb-4">A/B Test Configuration</h3>
      <div className="space-y-4">
        {tests.map(test => (
          <div key={test.id} className="border border-secondary-700 rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-semibold text-white">{test.name}</h4>
                <p className="text-sm text-secondary-300">{test.description}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                test.status === 'running' ? 'bg-success-500/20 text-success-400' :
                test.status === 'paused' ? 'bg-volt-500/20 text-volt-400' :
                test.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                'bg-secondary-500/20 text-secondary-300'
              }`}>
                {test.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-secondary-400">Traffic:</span>
                <span className="text-white ml-2">{test.trafficAllocation}%</span>
              </div>
              <div>
                <span className="text-secondary-400">Variants:</span>
                <span className="text-white ml-2">{test.variants.length}</span>
              </div>
            </div>
            
            <div className="mt-3">
              <div className="text-sm text-secondary-400 mb-2">Variants:</div>
              <div className="space-y-1">
                {test.variants.map(variant => (
                  <div key={variant.id} className="flex justify-between items-center bg-secondary-700/50 rounded px-3 py-1">
                    <span className="text-white text-sm">{variant.name}</span>
                    <span className="text-secondary-300 text-xs">{variant.weight}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Utility functions
function generateUserId(): string {
  if (typeof window !== 'undefined') {
    let userId = localStorage.getItem('ab_test_user_id')
    if (!userId) {
      userId = 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2)
      localStorage.setItem('ab_test_user_id', userId)
    }
    return userId
  }
  return 'user_' + Date.now().toString(36)
}

function generateSessionId(): string {
  return 'session_' + Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function selectVariantByWeight(variants: ABTestVariant[]): ABTestVariant | null {
  const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0)
  let random = Math.random() * totalWeight
  
  for (const variant of variants) {
    random -= variant.weight
    if (random <= 0) {
      return variant
    }
  }
  
  return variants[0] || null
}

function isUserInAudience(filters?: ABTestAudience): boolean {
  if (!filters) return true
  
  // Simplified audience filtering - expand based on needs
  if (typeof window === 'undefined') return false
  
  // Device type check
  if (filters.deviceFilter) {
    const userAgent = navigator.userAgent.toLowerCase()
    const isMobile = /mobile|android|iphone|ipad/.test(userAgent)
    const isTablet = /tablet|ipad/.test(userAgent) && !/mobile/.test(userAgent)
    const isDesktop = !isMobile && !isTablet
    
    const deviceType = isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile'
    if (!filters.deviceFilter.includes(deviceType)) {
      return false
    }
  }
  
  // Geo filter (would need IP geolocation service)
  if (filters.geoFilter) {
    // Implement geo filtering based on your geolocation service
  }
  
  // Source filter
  if (filters.sourceFilter) {
    const referrer = document.referrer
    const matchesSource = filters.sourceFilter.some(source => 
      referrer.includes(source) || window.location.href.includes(source)
    )
    if (!matchesSource) {
      return false
    }
  }
  
  return true
}

// Predefined test configurations
export const CONVERSION_TESTS: ABTest[] = [
  {
    id: 'lead_capture_form_style',
    name: 'Lead Capture Form Style Test',
    description: 'Testing different styles for lead capture forms',
    status: 'running',
    trafficAllocation: 100,
    variants: [
      { id: 'minimal', name: 'Minimal Style', weight: 33 },
      { id: 'featured', name: 'Featured Style', weight: 33 },
      { id: 'premium', name: 'Premium Style', weight: 34 }
    ],
    conversionGoals: ['form_submission', 'email_signup']
  },
  {
    id: 'comparison_tool_variant',
    name: 'Comparison Tool Variant Test',
    description: 'Testing different comparison tool presentations',
    status: 'running',
    trafficAllocation: 100,
    variants: [
      { id: 'full', name: 'Full Comparison', weight: 50 },
      { id: 'compact', name: 'Compact View', weight: 50 }
    ],
    conversionGoals: ['tool_interaction', 'cta_click']
  },
  {
    id: 'exit_intent_offer',
    name: 'Exit Intent Offer Test',
    description: 'Testing different exit intent popup offers',
    status: 'running',
    trafficAllocation: 80,
    variants: [
      { id: 'lead-magnet', name: 'Free Checklist', weight: 25 },
      { id: 'discount', name: '40% Discount', weight: 25 },
      { id: 'consultation', name: 'Free Consultation', weight: 25 },
      { id: 'newsletter', name: 'Newsletter Signup', weight: 25 }
    ],
    conversionGoals: ['popup_conversion', 'email_capture']
  }
]