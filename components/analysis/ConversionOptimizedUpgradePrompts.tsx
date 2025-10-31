'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AnalysisContext {
  businessName: string
  opportunitiesFound: number
  estimatedMonthlyValue: number
  competitorAdvantages: number
  industryType: string
  currentVisibilityGap: number
  timeToROI: number // days
  confidenceScore: number
}

interface UpgradePrompt {
  id: string
  trigger: 'feature_click' | 'time_spent' | 'analysis_complete' | 'exit_intent' | 'scroll_depth'
  title: string
  headline: string
  urgencyMessage: string
  valueProps: string[]
  socialProof: string
  ctaText: string
  ctaSubtext: string
  backgroundColor: string
  borderColor: string
  intensity: 'low' | 'medium' | 'high'
  discount?: {
    percentage: number
    timeLeft: number
    reason: string
  }
}

interface ConversionOptimizedUpgradePromptsProps {
  analysisContext: AnalysisContext
  currentTier: 'free' | 'starter' | 'growth' | 'professional'
  onUpgrade: (plan: string) => void
  onDismiss: () => void
  triggerType?: string
}

export default function ConversionOptimizedUpgradePrompts({
  analysisContext,
  currentTier,
  onUpgrade,
  onDismiss,
  triggerType = 'feature_click'
}: ConversionOptimizedUpgradePromptsProps) {
  const [activePrompt, setActivePrompt] = useState<UpgradePrompt | null>(null)
  const [timeOnPage, setTimeOnPage] = useState(0)
  const [interactionCount, setInteractionCount] = useState(0)
  const [urgencyTimer, setUrgencyTimer] = useState(27 * 60 + 34) // 27m 34s
  const [competitorActivity, setCompetitorActivity] = useState(3)
  const [showExitIntent, setShowExitIntent] = useState(false)

  useEffect(() => {
    // Time tracking
    const timeTracker = setInterval(() => {
      setTimeOnPage(prev => prev + 1)
    }, 1000)

    // Urgency countdown
    const urgencyTracker = setInterval(() => {
      setUrgencyTimer(prev => prev > 0 ? prev - 1 : 0)
    }, 1000)

    // Competitor activity simulation
    const competitorTracker = setInterval(() => {
      if (Math.random() > 0.7) {
        setCompetitorActivity(prev => prev + 1)
      }
    }, 30000)

    // Exit intent detection
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && timeOnPage > 60 && !showExitIntent) {
        setShowExitIntent(true)
        setActivePrompt(getPromptByTrigger('exit_intent'))
      }
    }

    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      clearInterval(timeTracker)
      clearInterval(urgencyTracker)
      clearInterval(competitorTracker)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [timeOnPage, showExitIntent])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const calculateROI = () => {
    const oneTimeInvestment = currentTier === 'free' ? 149 : 299 // Growth or Professional - ONE TIME
    const monthlyReturn = analysisContext.estimatedMonthlyValue
    return Math.round((monthlyReturn / oneTimeInvestment) * 100)
  }

  const upgradePrompts: UpgradePrompt[] = [
    {
      id: 'feature_click_high',
      trigger: 'feature_click',
      title: '🔒 Premium Feature Locked',
      headline: `Unlock ${analysisContext.opportunitiesFound - 5} More Opportunities Worth $${(analysisContext.estimatedMonthlyValue - 1200).toLocaleString()}/Month`,
      urgencyMessage: `⚡ ${competitorActivity} competitors in ${analysisContext.industryType} are targeting these same directories`,
      valueProps: [
        `Complete analysis of all ${analysisContext.opportunitiesFound} opportunities`,
        `Advanced competitive intelligence and market positioning`,
        `Financial projections and ROI calculations`,
        `Automated directory submission system`,
        `Priority support with dedicated success manager`
      ],
      socialProof: `487 ${analysisContext.industryType} businesses upgraded this month`,
      ctaText: `🚀 Unlock Full Analysis - From $149 ONE-TIME`,
      ctaSubtext: `${analysisContext.timeToROI}-day payback period • One-time purchase only`,
      backgroundColor: 'from-volt-500/20 to-danger-500/10',
      borderColor: 'border-volt-500/50',
      intensity: 'high'
    },
    {
      id: 'exit_intent_mega',
      trigger: 'exit_intent',
      title: '🛑 Wait! Don\'t Leave Empty-Handed',
      headline: `Last Chance: Get ${analysisContext.opportunitiesFound} Opportunities for 40% Off`,
      urgencyMessage: `This offer expires when you close this window. Timer: ${formatTime(urgencyTimer)}`,
      valueProps: [
        `All ${analysisContext.opportunitiesFound} directory opportunities unlocked`,
        `$${analysisContext.estimatedMonthlyValue.toLocaleString()} monthly value potential`,
        `${calculateROI()}% ROI based on your analysis`,
        `Complete competitive intelligence report`,
        `30-day money-back guarantee`
      ],
      socialProof: `Don't be like the 73% who missed out and watched competitors take their spots`,
      ctaText: `🔥 Claim 40% Discount - Only $89 ONE-TIME`,
      ctaSubtext: `Limited time offer • Regular price $149 one-time after`,
      backgroundColor: 'from-danger-500/20 to-volt-500/20',
      borderColor: 'border-danger-500/70',
      intensity: 'high',
      discount: {
        percentage: 40,
        timeLeft: urgencyTimer,
        reason: 'Exit intent special offer'
      }
    },
    {
      id: 'analysis_complete_value',
      trigger: 'analysis_complete',
      title: '🎯 Your Analysis is Complete',
      headline: `Ready to Capture ${analysisContext.opportunitiesFound} Opportunities Worth $${analysisContext.estimatedMonthlyValue.toLocaleString()}/Month?`,
      urgencyMessage: `Industry data shows ${analysisContext.currentVisibilityGap}% visibility gap costs you ~$${Math.round(analysisContext.estimatedMonthlyValue * 3.6)}/year in lost revenue`,
      valueProps: [
        `Turn insights into action with automated submissions`,
        `Get ahead of competitors with exclusive directory access`,
        `Professional-grade reports for stakeholders`,
        `Real-time performance tracking and optimization`,
        `Dedicated success manager to guide your growth`
      ],
      socialProof: `Join 94% of our customers who see results within ${analysisContext.timeToROI} days`,
      ctaText: `🎯 Start Dominating Your Market - $149 ONE-TIME`,
      ctaSubtext: `One-time purchase • ${calculateROI()}% ROI based on your data`,
      backgroundColor: 'from-success-500/10 to-volt-500/10',
      borderColor: 'border-success-500/40',
      intensity: 'medium'
    },
    {
      id: 'time_spent_authority',
      trigger: 'time_spent',
      title: '💡 Still Researching?',
      headline: `While You Think, ${competitorActivity} Competitors Are Taking Action`,
      urgencyMessage: `Every day you wait = ~$${Math.round(analysisContext.estimatedMonthlyValue / 30)} in lost revenue opportunity`,
      valueProps: [
        `Stop researching, start dominating your market`,
        `First-mover advantage in ${analysisContext.opportunitiesFound} premium directories`,
        `Professional consulting value worth $2,600 included`,
        `Risk-free with our 30-day money-back guarantee`,
        `Results guaranteed or full refund`
      ],
      socialProof: `${analysisContext.industryType} leaders choose DirectoryBolt 3:1 over competitors`,
      ctaText: `💪 Stop Waiting, Start Winning - $149 ONE-TIME`,
      ctaSubtext: `Join the 94% who see results • 30-day money-back guarantee`,
      backgroundColor: 'from-orange-500/10 to-volt-500/10',
      borderColor: 'border-orange-500/40',
      intensity: 'medium'
    },
    {
      id: 'scroll_depth_social',
      trigger: 'scroll_depth',
      title: '🏆 You\'re Serious About Growth',
      headline: `Smart ${analysisContext.industryType} Leaders Choose the Growth Plan`,
      urgencyMessage: `⭐ Most popular choice: 73% of businesses your size select Growth`,
      valueProps: [
        `Everything you saw in the analysis + execution`,
        `50 premium directories vs competitors' 10-15`,
        `Advanced AI optimization for higher approval rates`,
        `Weekly strategy calls with your success manager`,
        `White-label reports to impress your stakeholders`
      ],
      socialProof: `Trusted by 500+ growing businesses in ${analysisContext.industryType}`,
      ctaText: `🌟 Join the Top Performers - $149 ONE-TIME`,
      ctaSubtext: `Most popular plan • 30-day money-back guarantee`,
      backgroundColor: 'from-success-500/10 to-volt-500/10',
      borderColor: 'border-success-500/40',
      intensity: 'low'
    }
  ]

  const getPromptByTrigger = (trigger: string): UpgradePrompt => {
    const matchingPrompts = upgradePrompts.filter(p => p.trigger === trigger)
    if (matchingPrompts.length === 0) return upgradePrompts[0]
    
    // Select based on user behavior and context
    if (trigger === 'exit_intent') return matchingPrompts[0]
    if (timeOnPage > 300 && interactionCount > 5) {
      return matchingPrompts.find(p => p.intensity === 'high') || matchingPrompts[0]
    }
    return matchingPrompts[0]
  }

  // Auto-trigger logic
  useEffect(() => {
    if (timeOnPage === 120 && !activePrompt) {
      setActivePrompt(getPromptByTrigger('time_spent'))
    }
  }, [timeOnPage, activePrompt])

  const handleFeatureClick = () => {
    setInteractionCount(prev => prev + 1)
    if (!activePrompt) {
      setActivePrompt(getPromptByTrigger('feature_click'))
    }
  }

  const handleUpgradeClick = (prompt: UpgradePrompt) => {
    // Track conversion context
    if (typeof window !== 'undefined') {
      ((window as any).gtag)?.('event', 'upgrade_prompt_clicked', {
        event_category: 'conversion',
        event_label: prompt.id,
        value: analysisContext.estimatedMonthlyValue,
        custom_parameters: {
          trigger: prompt.trigger,
          time_on_page: timeOnPage,
          interaction_count: interactionCount,
          opportunities_shown: analysisContext.opportunitiesFound,
          estimated_value: analysisContext.estimatedMonthlyValue
        }
      })
    }
    
    onUpgrade('growth') // Default to Growth plan for most prompts
  }

  const UpgradePromptModal = ({ prompt }: { prompt: UpgradePrompt }) => (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3 }}
          className={`bg-gradient-to-br ${prompt.backgroundColor} rounded-2xl border-2 ${prompt.borderColor} p-8 max-w-2xl mx-auto text-center relative overflow-hidden`}
        >
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-volt-500/5 to-danger-500/5 animate-pulse"></div>
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-volt-500 rounded-full blur-3xl opacity-10 animate-pulse"></div>
          
          {/* Close Button */}
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 text-secondary-400 hover:text-white transition-colors text-2xl"
          >
            ×
          </button>

          <div className="relative z-10">
            {/* Urgency Indicator */}
            <div className="bg-danger-500/20 border border-danger-500/50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-3xl animate-bounce">⏰</span>
                <h3 className="text-lg font-black text-danger-400">{prompt.title}</h3>
              </div>
              <div className="text-danger-300 text-sm">
                {prompt.urgencyMessage}
              </div>
              {prompt.discount && (
                <div className="text-2xl font-mono text-danger-300 font-bold mt-2">
                  Offer expires: {formatTime(prompt.discount.timeLeft)}
                </div>
              )}
            </div>

            {/* Main Headline */}
            <div className="text-4xl mb-4 animate-bounce">💰</div>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-6">
              {prompt.headline}
            </h2>

            {/* Value Stack */}
            <div className="bg-gradient-to-r from-volt-900/50 to-success-900/30 rounded-xl p-6 mb-6 border border-volt-500/30">
              <h3 className="text-lg font-bold text-center mb-4 text-volt-400">
                What You Get When You Upgrade:
              </h3>
              <div className="space-y-3 text-left">
                {prompt.valueProps.map((prop, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm">
                    <span className="text-success-400 flex-shrink-0 mt-1">✓</span>
                    <span className="text-secondary-200">{prop}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Value Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-success-500/10 rounded-lg p-4 border border-success-500/20">
                <div className="text-2xl font-black text-success-400 mb-1">
                  ${analysisContext.estimatedMonthlyValue.toLocaleString()}
                </div>
                <div className="text-xs text-secondary-300">Monthly Value Potential</div>
              </div>
              <div className="bg-volt-500/10 rounded-lg p-4 border border-volt-500/20">
                <div className="text-2xl font-black text-volt-400 mb-1">
                  {calculateROI()}%
                </div>
                <div className="text-xs text-secondary-300">Estimated Monthly ROI</div>
              </div>
              <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/20">
                <div className="text-2xl font-black text-orange-400 mb-1">
                  {analysisContext.timeToROI}
                </div>
                <div className="text-xs text-secondary-300">Days to Break Even</div>
              </div>
            </div>

            {/* Social Proof */}
            <div className="bg-secondary-800/50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="flex -space-x-1">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="w-6 h-6 bg-gradient-to-r from-volt-400 to-volt-600 rounded-full border-2 border-secondary-800"></div>
                  ))}
                </div>
                <span className="text-sm text-success-300 font-medium ml-2">Real customers</span>
              </div>
              <p className="text-sm text-secondary-300 italic">
                {prompt.socialProof}
              </p>
            </div>

            {/* Primary CTA */}
            <button
              onClick={() => handleUpgradeClick(prompt)}
              className="w-full group relative bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black py-5 px-8 text-xl rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-volt-500/50 animate-glow mb-4"
            >
              <span className="relative z-10">{prompt.ctaText}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-volt-400 to-volt-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="text-sm opacity-80 font-normal mt-2">
                {prompt.ctaSubtext}
              </div>
            </button>

            {/* Risk Reversal */}
            <div className="bg-success-900/50 rounded-lg p-4 mb-4 border border-success-500/30">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-2xl">🛡️</span>
                <span className="text-success-400 font-bold">100% Risk-Free Guarantee</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="flex items-center justify-center gap-2 text-success-400">
                  <span>✅</span>
                  <span>30-day full refund</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-success-400">
                  <span>✅</span>
                  <span>Cancel anytime</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-success-400">
                  <span>✅</span>
                  <span>Results guaranteed</span>
                </div>
              </div>
            </div>

            {/* Secondary CTA */}
            <button
              onClick={onDismiss}
              className="text-secondary-400 hover:text-secondary-300 font-medium text-sm underline transition-colors duration-300"
            >
              Maybe later (and risk losing these opportunities to competitors)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )

  // Inline upgrade prompt for feature clicks
  const InlineUpgradePrompt = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-volt-500/20 to-danger-500/10 rounded-xl border-2 border-volt-500/50 p-6 my-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🔒</span>
            <h3 className="text-lg font-bold text-volt-400">Premium Feature</h3>
          </div>
          <p className="text-secondary-300 text-sm mb-3">
            Unlock {analysisContext.opportunitiesFound - 5} more opportunities worth ${((analysisContext.estimatedMonthlyValue - 1200) * 12).toLocaleString()}/year in potential revenue
          </p>
          <div className="flex items-center gap-4 text-xs text-secondary-400">
            <span>⚡ {calculateROI()}% ROI</span>
            <span>🎯 {analysisContext.timeToROI}-day payback</span>
            <span>🛡️ 30-day guarantee</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setActivePrompt(getPromptByTrigger('feature_click'))}
            className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-2 px-4 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 text-sm whitespace-nowrap"
          >
            🚀 Unlock Now
          </button>
          <div className="text-xs text-center text-secondary-400">From $149 ONE-TIME</div>
        </div>
      </div>
    </motion.div>
  )

  return (
    <>
      {/* Modal Prompt */}
      {activePrompt && (
        <UpgradePromptModal prompt={activePrompt} />
      )}

      {/* Inline Prompt Component */}
      <div onClick={handleFeatureClick}>
        <InlineUpgradePrompt />
      </div>

      {/* Floating CTA for engaged users */}
      {timeOnPage > 180 && !activePrompt && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-40"
        >
          <button
            onClick={() => setActivePrompt(getPromptByTrigger('time_spent'))}
            className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-3 px-6 rounded-full shadow-2xl hover:shadow-volt-500/50 transition-all duration-300 transform hover:scale-105 animate-bounce"
          >
            💡 Ready to unlock {analysisContext.opportunitiesFound} opportunities?
          </button>
        </motion.div>
      )}
    </>
  )
}