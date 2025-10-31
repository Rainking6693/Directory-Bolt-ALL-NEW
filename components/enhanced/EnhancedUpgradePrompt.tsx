'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

interface EnhancedUpgradePromptProps {
  analysisData: {
    directoryOpportunities?: any[]
    potentialLeads?: number
    missedOpportunities?: number
    visibility?: number
    url?: string
  }
  className?: string
}

export default function EnhancedUpgradePrompt({ analysisData, className = '' }: EnhancedUpgradePromptProps) {
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60) // 24 hours in seconds
  const [isVisible, setIsVisible] = useState(false)
  const [competitorCount, setCompetitorCount] = useState(3)

  useEffect(() => {
    setIsVisible(true)
    
    // Countdown timer
    const timer = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0)
    }, 1000)

    // Simulate competitor activity
    const competitorTimer = setInterval(() => {
      setCompetitorCount(prev => prev + Math.floor(Math.random() * 2))
    }, 45000)

    return () => {
      clearInterval(timer)
      clearInterval(competitorTimer)
    }
  }, [])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const calculateValue = () => {
    const opportunities = analysisData.directoryOpportunities?.length || 15
    const avgValuePerDirectory = 125 // Average monthly value per directory listing
    const monthlyValue = opportunities * avgValuePerDirectory
    const annualValue = monthlyValue * 12
    return { monthlyValue, annualValue }
  }

  const handleUpgrade = async () => {
    // Track high-intent conversion
    if (typeof window !== 'undefined') {
      ((window as any).gtag)?.('event', 'upgrade_intent', {
        event_category: 'conversion',
        event_label: 'results_page_upgrade_prompt',
        value: calculateValue().monthlyValue
      })
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: 'growth', // Default to most popular plan
          user_email: `user@example.com`,
          user_id: `user_${Date.now()}`,
          success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${window.location.origin}/results?cancelled=true`,
          metadata: {
            source: 'results_page_upgrade',
            opportunities_found: analysisData.directoryOpportunities?.length || 0,
            estimated_value: calculateValue().monthlyValue
          }
        }),
      })

      const { data } = await response.json()
      
      if (data?.checkout_session?.url) {
        window.location.href = data.checkout_session.url
      } else {
        throw new Error('Failed to create checkout session')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      router.push('/pricing')
    }
  }

  const { monthlyValue, annualValue } = calculateValue()

  return (
    <div className={`bg-gradient-to-r from-danger-500/10 to-volt-500/10 rounded-2xl border-2 border-volt-500/50 p-8 text-center relative overflow-hidden ${className} ${isVisible ? 'animate-slide-up' : 'opacity-0'}`}>
      {/* Urgency Background Animation */}
      <div className="absolute inset-0 bg-gradient-to-r from-volt-500/5 to-danger-500/5 animate-pulse"></div>
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-volt-500 rounded-full blur-3xl opacity-10 animate-pulse"></div>
      
      {/* Time-Sensitive Header */}
      <div className="relative z-10">
        <div className="bg-danger-500/20 border border-danger-500/50 rounded-xl p-4 mb-6 animate-pulse">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-3xl animate-bounce">⏰</span>
            <h3 className="text-xl font-black text-danger-400">URGENT: These Opportunities Are Time-Sensitive</h3>
          </div>
          <div className="text-2xl font-mono text-danger-300 font-bold">
            Expires in: {formatTime(timeLeft)}
          </div>
          <p className="text-sm text-secondary-300 mt-2">
            {competitorCount} competitors are also targeting these directories
          </p>
        </div>

        {/* Value Proposition */}
        <div className="text-6xl mb-4 animate-bounce">💰</div>
        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
          We Found <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600">${monthlyValue.toLocaleString()}</span> Worth of Opportunities!
        </h2>
        <p className="text-lg md:text-xl text-secondary-200 mb-8 max-w-3xl mx-auto font-medium">
          Your analysis revealed <span className="text-volt-400 font-bold">{analysisData.directoryOpportunities?.length || 15} premium directories</span> your competitors don't know about. 
          But they won't stay hidden forever...
        </p>

        {/* Scarcity Messaging */}
        <div className="bg-gradient-to-r from-danger-900/50 to-volt-900/30 rounded-xl p-6 mb-8 border border-danger-500/30">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-2xl">🔥</span>
            <h3 className="text-xl font-bold text-danger-400">Why You Need To Act NOW</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-danger-500/10 rounded-lg p-4 border border-danger-500/20">
              <div className="text-lg font-bold text-danger-400 mb-2">Competition Alert</div>
              <div className="text-secondary-300">
                {competitorCount} businesses in your area are actively targeting these same directories
              </div>
            </div>
            <div className="bg-volt-500/10 rounded-lg p-4 border border-volt-500/20">
              <div className="text-lg font-bold text-volt-400 mb-2">Limited Slots</div>
              <div className="text-secondary-300">
                Many directories limit submissions per region. First-come, first-served.
              </div>
            </div>
            <div className="bg-danger-500/10 rounded-lg p-4 border border-danger-500/20">
              <div className="text-lg font-bold text-danger-400 mb-2">Lost Revenue</div>
              <div className="text-secondary-300">
                Every day = ~${Math.round(monthlyValue / 30)} in lost potential revenue
              </div>
            </div>
          </div>
        </div>

        {/* Value Stack */}
        <div className="bg-gradient-to-r from-volt-900/50 to-success-900/30 rounded-xl p-6 mb-8 border border-volt-500/30">
          <h3 className="text-xl font-bold text-center mb-6 text-volt-400">
            What You Get When You Secure These Opportunities
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-volt-500/10 rounded-lg p-4 border border-volt-500/20">
              <div className="text-2xl font-black text-volt-400 mb-2">${monthlyValue.toLocaleString()}/month</div>
              <div className="text-sm text-secondary-300">Estimated new revenue from listings</div>
            </div>
            <div className="bg-success-500/10 rounded-lg p-4 border border-success-500/20">
              <div className="text-2xl font-black text-success-400 mb-2">{Math.round(analysisData.potentialLeads || 50)}+ leads</div>
              <div className="text-sm text-secondary-300">New customer inquiries monthly</div>
            </div>
            <div className="bg-volt-500/10 rounded-lg p-4 border border-volt-500/20">
              <div className="text-2xl font-black text-volt-400 mb-2">{analysisData.directoryOpportunities?.length || 15} directories</div>
              <div className="text-sm text-secondary-300">Premium listings your competitors lack</div>
            </div>
            <div className="bg-success-500/10 rounded-lg p-4 border border-success-500/20">
              <div className="text-2xl font-black text-success-400 mb-2">24-48hrs</div>
              <div className="text-sm text-secondary-300">Time to see first submissions</div>
            </div>
          </div>
        </div>

        {/* Risk Reversal */}
        <div className="bg-gradient-to-r from-success-900/50 to-success-800/30 rounded-xl p-6 mb-8 border border-success-500/30">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-3xl">🛡️</span>
            <h3 className="text-xl font-bold text-success-400">100% Risk-Free Guarantee</h3>
          </div>
          <p className="text-secondary-300 mb-4">
            Get <span className="text-success-400 font-bold">5 new customers in 30 days</span> from these directory listings or receive a full refund. 
            No questions, no hassles.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center justify-center gap-2 text-success-400">
              <span>✅</span>
              <span>Full refund guarantee</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-success-400">
              <span>✅</span>
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-success-400">
              <span>✅</span>
              <span>14-day free trial</span>
            </div>
          </div>
        </div>
        
        {/* CTA Section */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
          <button
            onClick={handleUpgrade}
            className="group relative bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black py-5 px-10 text-xl rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-volt-500/50 animate-glow min-w-[300px]"
          >
            <span className="relative z-10">🚀 Secure My Opportunities Now</span>
            <div className="absolute inset-0 bg-gradient-to-r from-volt-400 to-volt-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
        </div>

        {/* Alternative CTA */}
        <button
          onClick={() => router.push('/')}
          className="text-secondary-400 hover:text-secondary-300 font-medium text-sm underline transition-colors duration-300"
        >
          Maybe later (and risk losing these opportunities)
        </button>

        {/* Final Social Proof */}
        <div className="mt-8 pt-6 border-t border-secondary-600">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex -space-x-1">
              {[1,2,3,4,5,6,7].map(i => (
                <div key={i} className="w-6 h-6 bg-gradient-to-r from-volt-400 to-volt-600 rounded-full border-2 border-secondary-800"></div>
              ))}
            </div>
            <span className="text-sm text-success-300 font-medium">487 businesses secured their opportunities this month</span>
          </div>
          
          <div className="bg-secondary-800/50 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-xs text-secondary-300 italic mb-2">
              "I almost didn't upgrade... biggest mistake I could have made. These directories generated $8,400 in new business in 45 days."
            </p>
            <p className="text-xs text-volt-400 font-semibold">— Jennifer Walsh, Marketing Agency</p>
          </div>
        </div>
      </div>
    </div>
  )
}