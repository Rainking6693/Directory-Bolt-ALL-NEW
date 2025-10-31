'use client'
import React, { useState, useEffect } from 'react'

// Premium Upgrade Prompt System - Phase 2.3 DirectoryBolt AI-Enhanced plan
// Shows limited results with clear value demonstration and specific benefits

interface UpgradePromptProps {
  currentTier: 'free' | 'professional' | 'enterprise'
  totalOpportunities: number
  shownOpportunities: number
  estimatedValue: number
  onUpgrade?: () => void
  onDismiss?: () => void
  context?: 'results' | 'analysis' | 'export' | 'descriptions'
}

interface ValueDemonstration {
  title: string
  current: string | number
  premium: string | number
  highlight: boolean
  description: string
}

export function PremiumUpgradePrompt({ 
  currentTier, 
  totalOpportunities, 
  shownOpportunities, 
  estimatedValue,
  onUpgrade,
  onDismiss,
  context = 'results'
}: UpgradePromptProps) {
  const [showAnimation, setShowAnimation] = useState(false)
  const [selectedBenefit, setSelectedBenefit] = useState(0)

  useEffect(() => {
    setShowAnimation(true)
    const interval = setInterval(() => {
      setSelectedBenefit(prev => (prev + 1) % 4)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const hiddenOpportunities = Math.max(0, totalOpportunities - shownOpportunities)
  const potentialMonthlyValue = Math.round(estimatedValue * 2.5)
  const yearlyValue = potentialMonthlyValue * 12

  const contextMessages = {
    results: {
      title: "Unlock Your Complete Business Analysis",
      subtitle: "You're seeing just a preview. Get the full $2,600+ AI analysis that drives real results.",
      icon: "📊"
    },
    analysis: {
      title: "Premium AI Analysis Locked",
      subtitle: "Access advanced competitive intelligence and market positioning strategies.",
      icon: "🧠"
    },
    export: {
      title: "Export Premium Reports",
      subtitle: "Generate professional PDF reports and CSV exports for your business analysis.",
      icon: "📄"
    },
    descriptions: {
      title: "AI-Optimized Descriptions Locked",
      subtitle: "Get multiple AI-generated descriptions optimized for each directory's requirements.",
      icon: "✨"
    }
  }

  const currentMessage = contextMessages[context]

  const valueDemonstrations: ValueDemonstration[] = [
    {
      title: "Directory Opportunities",
      current: shownOpportunities,
      premium: `${totalOpportunities}+`,
      highlight: true,
      description: "Access to all premium and exclusive directories"
    },
    {
      title: "AI-Generated Descriptions",
      current: "1 basic",
      premium: "5-10 per directory",
      highlight: true,
      description: "Multiple optimized versions for higher success rates"
    },
    {
      title: "Success Probability Analysis",
      current: "Basic scoring",
      premium: "Advanced AI scoring",
      highlight: false,
      description: "Detailed probability analysis with reasoning"
    },
    {
      title: "Competitive Intelligence",
      current: "Limited insights",
      premium: "Full competitor analysis",
      highlight: true,
      description: "Complete competitive landscape and positioning advice"
    },
    {
      title: "Monthly Lead Potential",
      current: "~500 leads",
      premium: `~${potentialMonthlyValue.toLocaleString()} leads`,
      highlight: true,
      description: "Based on premium directory traffic and success rates"
    },
    {
      title: "ROI Projection",
      current: "Basic estimates",
      premium: "Detailed projections",
      highlight: false,
      description: "Month-by-month growth projections and revenue estimates"
    }
  ]

  const benefits = [
    {
      icon: "🎯",
      title: `${hiddenOpportunities}+ Premium Directories`,
      description: "High-authority directories with exclusive access and higher success rates",
      color: "volt"
    },
    {
      icon: "🤖",
      title: "AI-Optimized Descriptions",
      description: "Multiple variations per directory, optimized for maximum approval rates",
      color: "success"
    },
    {
      icon: "📊",
      title: "Advanced Analytics",
      description: "Success probability scoring, competitive analysis, and ROI projections",
      color: "blue"
    },
    {
      icon: "🚀",
      title: "White-Label Reports",
      description: "Professional PDF reports you can brand and share with clients",
      color: "purple"
    }
  ]

  const testimonials = [
    {
      name: "Sarah Chen",
      business: "Digital Marketing Agency",
      quote: "The AI descriptions increased our directory approval rate by 300%. ROI was immediate.",
      results: "+$15K monthly revenue"
    },
    {
      name: "Michael Rodriguez",
      business: "Local Business Owner",
      quote: "Went from 5 directory listings to 47 in 2 months. Customer calls tripled.",
      results: "+200% more customers"
    },
    {
      name: "Jessica Park",
      business: "SaaS Startup",
      quote: "The competitive analysis helped us find gaps our competitors missed. Game-changer.",
      results: "47 new directories"
    }
  ]

  if (currentTier !== 'free') {
    return null // Don't show upgrade prompts for paid users
  }

  return (
    <div className={`bg-gradient-to-r from-volt-500/10 to-volt-600/10 rounded-2xl border border-volt-500/30 p-8 ${showAnimation ? 'animate-slide-up' : ''}`}>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-4 animate-bounce">{currentMessage.icon}</div>
        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
          {currentMessage.title}
        </h2>
        <p className="text-lg md:text-xl text-secondary-200 mb-6 max-w-3xl mx-auto">
          {currentMessage.subtitle}
        </p>
      </div>

      {/* Value Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {valueDemonstrations.filter(v => v.highlight).map((demo, index) => (
          <div key={index} className="bg-secondary-800/30 rounded-xl p-6 border border-volt-500/20">
            <div className="text-center">
              <div className="text-sm text-secondary-400 mb-2">{demo.title}</div>
              <div className="flex items-center justify-center gap-4 mb-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-secondary-300">{demo.current}</div>
                  <div className="text-xs text-secondary-400">Current</div>
                </div>
                <div className="text-volt-400 text-2xl">→</div>
                <div className="text-center">
                  <div className="text-2xl font-black text-volt-400">{demo.premium}</div>
                  <div className="text-xs text-volt-300">Premium</div>
                </div>
              </div>
              <div className="text-xs text-secondary-300">{demo.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Benefits Showcase */}
      <div className="bg-secondary-800/30 rounded-xl p-6 mb-8">
        <h3 className="text-xl font-bold text-white mb-4 text-center">What You Get With Premium:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {benefits.map((benefit, index) => (
            <button
              key={index}
              onClick={() => setSelectedBenefit(index)}
              className={`p-4 rounded-lg transition-all text-center ${
                selectedBenefit === index
                  ? 'bg-volt-500/20 border-2 border-volt-500/50 transform scale-105'
                  : 'bg-secondary-700/50 border border-secondary-600 hover:bg-secondary-700'
              }`}
            >
              <div className="text-3xl mb-2">{benefit.icon}</div>
              <div className="text-sm font-bold text-white">{benefit.title}</div>
            </button>
          ))}
        </div>
        <div className="text-center p-4 bg-volt-500/10 rounded-lg border border-volt-500/20">
          <p className="text-secondary-200">{benefits[selectedBenefit].description}</p>
        </div>
      </div>

      {/* ROI Calculator */}
      <div className="bg-gradient-to-r from-success-500/10 to-success-600/10 rounded-xl border border-success-500/30 p-6 mb-8">
        <h3 className="text-xl font-bold text-success-400 mb-4 text-center">Your Potential ROI:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-black text-success-400">{potentialMonthlyValue.toLocaleString()}</div>
            <div className="text-sm text-secondary-300">Additional Monthly Leads</div>
          </div>
          <div>
            <div className="text-3xl font-black text-success-400">${(yearlyValue * 0.02).toLocaleString()}</div>
            <div className="text-sm text-secondary-300">Est. Annual Revenue Increase</div>
          </div>
          <div>
            <div className="text-3xl font-black text-success-400">{Math.round(yearlyValue * 0.02 / 1596)}x</div>
            <div className="text-sm text-secondary-300">ROI on $129 one-time plan</div>
          </div>
        </div>
      </div>

      {/* Social Proof - Testimonials */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-white mb-4 text-center">What Our Customers Say:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-secondary-800/30 rounded-lg p-4 border border-secondary-600">
              <div className="mb-3">
                <div className="flex -space-x-1 mb-2">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="w-4 h-4 bg-volt-400 rounded-full"></div>
                  ))}
                </div>
                <p className="text-sm text-secondary-200 italic">"{testimonial.quote}"</p>
              </div>
              <div className="border-t border-secondary-600 pt-3">
                <div className="text-sm font-bold text-white">{testimonial.name}</div>
                <div className="text-xs text-secondary-400">{testimonial.business}</div>
                <div className="text-xs text-success-400 font-bold mt-1">{testimonial.results}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="group relative bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black py-4 px-8 text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-volt-500/50"
          >
            <span className="relative z-10">🚀 Purchase Now</span>
            <div className="absolute inset-0 bg-gradient-to-r from-volt-400 to-volt-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
        )}
        
        <button
          onClick={() => window.open('/pricing', '_blank')}
          className="border-2 border-volt-500 text-volt-500 font-bold py-4 px-8 text-lg rounded-xl hover:bg-volt-500 hover:text-secondary-900 transition-all duration-300"
        >
          View All Plans
        </button>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-secondary-400 hover:text-white text-sm underline transition-colors"
          >
            Maybe later
          </button>
        )}
      </div>

      {/* Guarantee */}
      <div className="mt-6 text-center">
        <div className="inline-flex items-center gap-2 bg-success-500/10 border border-success-500/30 rounded-full px-4 py-2">
          <span className="text-success-400">💰</span>
          <span className="text-sm text-success-300 font-medium">
            30-day money-back guarantee • Cancel anytime • Results guaranteed
          </span>
        </div>
      </div>

      {/* Urgency Element */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
          <span className="text-orange-400">⏰</span>
          <span className="text-sm text-orange-300">
            {hiddenOpportunities} directories waiting • Don't let competitors get there first
          </span>
        </div>
      </div>
    </div>
  )
}