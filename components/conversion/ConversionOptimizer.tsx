import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, Lightbulb, Target, TrendingUp, Clock, Users, Star, ArrowRight, CheckCircle } from 'lucide-react'
import { trackCustomEvent, trackConversionFunnel, trackEngagementMetrics } from '../analytics/ConversionTracker'
import { useABTest, useConversionTracking } from './ABTestFramework'
import { LeadCaptureForm } from './LeadCaptureForm'
import { ComparisonTool } from './ComparisonTool'
import { BusinessAssessment } from './BusinessAssessment'

interface ConversionOptimizerProps {
  context: string
  guideSlug?: string
  userProfile?: {
    businessType?: string
    previousEngagement?: 'high' | 'medium' | 'low'
    timeOnPage?: number
    scrollDepth?: number
  }
}

interface ProgressiveSection {
  id: string
  title: string
  description: string
  component: React.ComponentType<any>
  triggerCondition: 'immediate' | 'scroll' | 'time' | 'interaction' | 'intent'
  priority: 'high' | 'medium' | 'low'
  personalizable: boolean
  props?: Record<string, any>
}

export function ConversionOptimizer({
  context,
  guideSlug,
  userProfile
}: ConversionOptimizerProps) {
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set(['trust-indicators']))
  const [userInteractionCount, setUserInteractionCount] = useState(0)
  const [timeOnPage, setTimeOnPage] = useState(0)
  const [scrollDepth, setScrollDepth] = useState(0)
  const [showPersonalizedContent, setShowPersonalizedContent] = useState(false)
  const [personalizationData, setPersonalizationData] = useState<any>(null)
  
  const startTime = useRef(Date.now())
  const trackConversion = useConversionTracking('conversion_optimizer')

  // A/B test for section order
  const { getVariant } = useABTest()
  const sectionVariant = getVariant('conversion_section_order') || 'default'

  // Track time on page
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeOnPage(Date.now() - startTime.current)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      )
      setScrollDepth(Math.max(scrollDepth, scrollPercent))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [scrollDepth])

  // Track user interactions
  useEffect(() => {
    const handleInteraction = () => {
      setUserInteractionCount(prev => prev + 1)
    }

    document.addEventListener('click', handleInteraction)
    document.addEventListener('keydown', handleInteraction)
    
    return () => {
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('keydown', handleInteraction)
    }
  }, [])

  // Progressive disclosure logic
  useEffect(() => {
    const newVisibleSections = new Set(visibleSections)

    // Time-based revelations
    if (timeOnPage > 30000) { // 30 seconds
      newVisibleSections.add('value-proposition')
    }
    if (timeOnPage > 60000) { // 1 minute
      newVisibleSections.add('social-proof')
    }
    if (timeOnPage > 120000) { // 2 minutes
      newVisibleSections.add('comparison-tool')
    }

    // Scroll-based revelations
    if (scrollDepth > 25) {
      newVisibleSections.add('benefits-overview')
    }
    if (scrollDepth > 50) {
      newVisibleSections.add('lead-capture')
    }
    if (scrollDepth > 75) {
      newVisibleSections.add('urgency-elements')
    }

    // Interaction-based revelations
    if (userInteractionCount > 3) {
      newVisibleSections.add('interactive-elements')
    }
    if (userInteractionCount > 7) {
      newVisibleSections.add('assessment-tool')
    }

    // Personalization trigger
    if (timeOnPage > 45000 && scrollDepth > 30 && !showPersonalizedContent) {
      setShowPersonalizedContent(true)
      loadPersonalizedContent()
    }

    if (newVisibleSections.size !== visibleSections.size) {
      setVisibleSections(newVisibleSections)
      trackCustomEvent('progressive_disclosure', {
        context,
        visible_sections: Array.from(newVisibleSections),
        time_on_page: timeOnPage,
        scroll_depth: scrollDepth,
        interaction_count: userInteractionCount
      })
    }
  }, [timeOnPage, scrollDepth, userInteractionCount, visibleSections, showPersonalizedContent, context])

  const loadPersonalizedContent = useCallback(async () => {
    try {
      const response = await fetch('/api/personalization/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          guideSlug,
          userProfile: {
            ...userProfile,
            timeOnPage,
            scrollDepth,
            interactionCount: userInteractionCount
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        setPersonalizationData(data)
        trackCustomEvent('personalization_loaded', {
          context,
          personalization_type: data.type,
          recommendations: data.recommendations?.length || 0
        })
      }
    } catch (error) {
      console.error('Failed to load personalized content:', error)
    }
  }, [context, guideSlug, userProfile, timeOnPage, scrollDepth, userInteractionCount])

  const sections: ProgressiveSection[] = [
    {
      id: 'trust-indicators',
      title: 'Trust Indicators',
      description: 'Build immediate credibility',
      component: TrustIndicators,
      triggerCondition: 'immediate',
      priority: 'high',
      personalizable: false,
      props: { context }
    },
    {
      id: 'value-proposition',
      title: 'Value Proposition',
      description: 'Clear benefit statement',
      component: ValueProposition,
      triggerCondition: 'time',
      priority: 'high',
      personalizable: true,
      props: { context, personalizedData: personalizationData }
    },
    {
      id: 'benefits-overview',
      title: 'Benefits Overview',
      description: 'Key advantages highlighted',
      component: BenefitsOverview,
      triggerCondition: 'scroll',
      priority: 'medium',
      personalizable: false,
      props: { context }
    },
    {
      id: 'social-proof',
      title: 'Social Proof',
      description: 'Customer testimonials and stats',
      component: SocialProof,
      triggerCondition: 'time',
      priority: 'high',
      personalizable: true,
      props: { context, personalizedData: personalizationData }
    },
    {
      id: 'lead-capture',
      title: 'Lead Capture',
      description: 'Primary conversion form',
      component: LeadCaptureForm,
      triggerCondition: 'scroll',
      priority: 'high',
      personalizable: true,
      props: {
        context,
        style: sectionVariant === 'personalized' ? 'premium' : 'featured',
        variant: 'inline'
      }
    },
    {
      id: 'comparison-tool',
      title: 'Comparison Tool',
      description: 'Interactive manual vs automated comparison',
      component: ComparisonTool,
      triggerCondition: 'time',
      priority: 'medium',
      personalizable: false,
      props: { context, variant: 'full' }
    },
    {
      id: 'interactive-elements',
      title: 'Interactive Elements',
      description: 'Engagement tools and calculators',
      component: InteractiveElements,
      triggerCondition: 'interaction',
      priority: 'medium',
      personalizable: true,
      props: { context, personalizedData: personalizationData }
    },
    {
      id: 'assessment-tool',
      title: 'Business Assessment',
      description: 'Personalized recommendations',
      component: BusinessAssessment,
      triggerCondition: 'interaction',
      priority: 'medium',
      personalizable: true,
      props: { context, variant: 'embedded' }
    },
    {
      id: 'urgency-elements',
      title: 'Urgency Elements',
      description: 'Time-sensitive offers',
      component: UrgencyElements,
      triggerCondition: 'scroll',
      priority: 'low',
      personalizable: true,
      props: { context, personalizedData: personalizationData }
    }
  ]

  const renderSection = (section: ProgressiveSection) => {
    if (!visibleSections.has(section.id)) return null

    const Component = section.component
    return (
      <ProgressiveSection
        key={section.id}
        section={section}
        onReveal={() => {
          trackCustomEvent('section_revealed', {
            section_id: section.id,
            context,
            time_on_page: timeOnPage,
            trigger_condition: section.triggerCondition
          })
        }}
        onInteraction={() => {
          trackConversion(`section_interaction_${section.id}`, {
            section_id: section.id,
            priority: section.priority
          })
        }}
      >
        <Component {...section.props} />
      </ProgressiveSection>
    )
  }

  return (
    <div className="space-y-8">
      {sections.map(renderSection)}
      
      {/* Personalized Content Overlay */}
      {showPersonalizedContent && personalizationData && (
        <PersonalizedContentOverlay
          data={personalizationData}
          context={context}
          onClose={() => setShowPersonalizedContent(false)}
          onConvert={() => trackConversion('personalized_content_convert')}
        />
      )}
    </div>
  )
}

// Progressive Section Wrapper
function ProgressiveSection({
  section,
  children,
  onReveal,
  onInteraction
}: {
  section: ProgressiveSection
  children: React.ReactNode
  onReveal: () => void
  onInteraction: () => void
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(section.priority === 'high')
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true)
          onReveal()
        }
      },
      { threshold: 0.1 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [isVisible, onReveal])

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
    if (!isExpanded) {
      onInteraction()
    }
  }

  return (
    <div
      ref={sectionRef}
      className={`bg-gradient-to-br from-secondary-800/50 to-secondary-900/50 rounded-xl border transition-all duration-500 ${
        isVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'
      } ${
        section.priority === 'high' ? 'border-volt-500/30' :
        section.priority === 'medium' ? 'border-secondary-600' :
        'border-secondary-700'
      }`}
    >
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary-800/30 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            section.priority === 'high' ? 'bg-volt-500/20 text-volt-400' :
            section.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' :
            'bg-secondary-500/20 text-secondary-300'
          }`}>
            {section.priority === 'high' && <Target size={16} />}
            {section.priority === 'medium' && <TrendingUp size={16} />}
            {section.priority === 'low' && <Lightbulb size={16} />}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{section.title}</h3>
            <p className="text-sm text-secondary-400">{section.description}</p>
          </div>
        </div>
        
        {isExpanded ? <ChevronUp className="text-secondary-400" size={20} /> : 
                     <ChevronDown className="text-secondary-400" size={20} />}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  )
}

// Individual Components
function TrustIndicators({ context }: { context: string }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
      <div className="bg-secondary-800/50 rounded-lg p-4">
        <Users className="mx-auto text-volt-400 mb-2" size={24} />
        <div className="text-lg font-bold text-white">2,000+</div>
        <div className="text-xs text-secondary-400">Happy Customers</div>
      </div>
      <div className="bg-secondary-800/50 rounded-lg p-4">
        <Star className="mx-auto text-volt-400 mb-2" size={24} />
        <div className="text-lg font-bold text-white">4.9/5</div>
        <div className="text-xs text-secondary-400">Customer Rating</div>
      </div>
      <div className="bg-secondary-800/50 rounded-lg p-4">
        <TrendingUp className="mx-auto text-success-400 mb-2" size={24} />
        <div className="text-lg font-bold text-white">98%</div>
        <div className="text-xs text-secondary-400">Success Rate</div>
      </div>
      <div className="bg-secondary-800/50 rounded-lg p-4">
        <Clock className="mx-auto text-blue-400 mb-2" size={24} />
        <div className="text-lg font-bold text-white">40+</div>
        <div className="text-xs text-secondary-400">Hours Saved</div>
      </div>
    </div>
  )
}

function ValueProposition({ context, personalizedData }: { context: string; personalizedData?: any }) {
  const defaultValue = "Automate Your Directory Submissions and Get Found by More Customers"
  const personalizedValue = personalizedData?.valueProposition || defaultValue

  return (
    <div className="text-center py-8">
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
        {personalizedValue}
      </h2>
      <p className="text-xl text-secondary-300 max-w-3xl mx-auto">
        Stop wasting 40+ hours on manual directory submissions. Our AI-powered platform 
        gets you listed in 100+ directories automatically with 98% approval rates.
      </p>
    </div>
  )
}

function BenefitsOverview({ context }: { context: string }) {
  const benefits = [
    { icon: <Clock size={20} />, title: "Save 40+ Hours", description: "Automated submissions across 100+ directories" },
    { icon: <TrendingUp size={20} />, title: "98% Success Rate", description: "Higher approval rates than manual submissions" },
    { icon: <Target size={20} />, title: "Better Targeting", description: "AI matches your business to the right directories" },
    { icon: <CheckCircle size={20} />, title: "Real-time Tracking", description: "Monitor all submissions from one dashboard" }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {benefits.map((benefit, index) => (
        <div key={index} className="flex items-start space-x-4 p-4 bg-secondary-800/30 rounded-lg">
          <div className="p-2 bg-volt-500/20 rounded-lg text-volt-400">
            {benefit.icon}
          </div>
          <div>
            <h4 className="text-lg font-semibold text-white mb-1">{benefit.title}</h4>
            <p className="text-secondary-300">{benefit.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function SocialProof({ context, personalizedData }: { context: string; personalizedData?: any }) {
  const testimonials = personalizedData?.testimonials || [
    {
      name: "Sarah Johnson",
      company: "Local Marketing Pro",
      text: "DirectoryBolt saved me 60 hours of manual work and got us listed everywhere. ROI was immediate.",
      rating: 5
    },
    {
      name: "Mike Chen",
      company: "Chen's Restaurant",
      text: "Our local visibility increased 300% after using DirectoryBolt. More customers finding us every day.",
      rating: 5
    }
  ]

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-white text-center mb-6">
        What Our Customers Say
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {testimonials.map((testimonial: any, index: number) => (
          <div key={index} className="bg-secondary-800/50 rounded-lg p-6">
            <div className="flex items-center mb-3">
              {[...Array(testimonial.rating)].map((_, i) => (
                <Star key={i} size={16} className="text-volt-400 fill-current" />
              ))}
            </div>
            <p className="text-secondary-300 mb-4">"{testimonial.text}"</p>
            <div>
              <div className="font-semibold text-white">{testimonial.name}</div>
              <div className="text-sm text-secondary-400">{testimonial.company}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InteractiveElements({ context, personalizedData }: { context: string; personalizedData?: any }) {
  const [calculatorValue, setCalculatorValue] = useState(50)
  const savings = calculatorValue * 45 * 0.75 // directories * minutes * hourly rate approximation

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-volt-500/10 to-volt-400/10 rounded-lg p-6 border border-volt-500/20">
        <h4 className="text-lg font-semibold text-white mb-4">ROI Calculator</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-300 mb-2">
              Number of Directories: {calculatorValue}
            </label>
            <input
              type="range"
              min="10"
              max="150"
              value={calculatorValue}
              onChange={(e) => setCalculatorValue(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="bg-secondary-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-success-400">${Math.round(savings)}</div>
            <div className="text-sm text-secondary-300">Estimated Cost Savings</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function UrgencyElements({ context, personalizedData }: { context: string; personalizedData?: any }) {
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60) // 24 hours in seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="bg-gradient-to-r from-danger-500/10 to-danger-400/10 rounded-lg p-6 border border-danger-500/20 text-center">
      <h4 className="text-xl font-bold text-white mb-2">Limited Time Offer</h4>
      <p className="text-secondary-300 mb-4">
        Get 40% off your first 3 months when you start today
      </p>
      <div className="text-2xl font-bold text-danger-400 mb-4">
        {formatTime(timeLeft)} remaining
      </div>
      <button className="bg-gradient-to-r from-danger-500 to-danger-600 text-white font-bold px-8 py-3 rounded-lg hover:from-danger-400 hover:to-danger-500 transition-all duration-300 transform hover:scale-105">
        Claim Your Discount
      </button>
    </div>
  )
}

function PersonalizedContentOverlay({
  data,
  context,
  onClose,
  onConvert
}: {
  data: any
  context: string
  onClose: () => void
  onConvert: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-secondary-800 to-secondary-900 rounded-xl p-8 max-w-2xl w-full border border-volt-500/30 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-secondary-400 hover:text-white"
        >
          ×
        </button>
        
        <div className="text-center">
          <Lightbulb className="mx-auto text-volt-400 mb-4" size={48} />
          <h3 className="text-2xl font-bold text-white mb-4">
            Personalized Recommendations
          </h3>
          <p className="text-secondary-300 mb-6">
            Based on your engagement, here's what we recommend for your business
          </p>
          
          <div className="space-y-4 mb-6">
            {data.recommendations?.map((rec: any, index: number) => (
              <div key={index} className="bg-secondary-800/50 rounded-lg p-4 text-left">
                <h4 className="font-semibold text-white mb-2">{rec.title}</h4>
                <p className="text-secondary-300">{rec.description}</p>
              </div>
            ))}
          </div>
          
          <button
            onClick={() => {
              onConvert()
              onClose()
            }}
            className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-8 py-3 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105"
          >
            Get Started with These Recommendations
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook for optimized conversion tracking
export function useConversionOptimization(context: string) {
  const [optimizationData, setOptimizationData] = useState<any>(null)
  
  useEffect(() => {
    // Track engagement metrics
    const startTime = Date.now()
    let maxScrollDepth = 0
    let interactionCount = 0

    const trackMetrics = () => {
      trackEngagementMetrics({
        timeOnPage: Date.now() - startTime,
        scrollDepth: maxScrollDepth,
        interactionCount
      })
    }

    const handleScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      )
      maxScrollDepth = Math.max(maxScrollDepth, scrollPercent)
    }

    const handleInteraction = () => {
      interactionCount++
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('click', handleInteraction)
    window.addEventListener('beforeunload', trackMetrics)

    return () => {
      trackMetrics()
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('click', handleInteraction)
      window.removeEventListener('beforeunload', trackMetrics)
    }
  }, [context])

  return { optimizationData }
}