// 🚀 ENHANCED SAMPLE ANALYSIS MODAL
// Interactive demo showing complete AI business intelligence analysis across multiple industries

'use client'
import { useState, useEffect } from 'react'
// @ts-ignore - StartTrialButton is provided from a JS module
import { StartTrialButton } from '../CheckoutButton'
import { getSampleAnalysis, getAllSampleAnalyses, type SampleAnalysis } from '../../lib/data/sample-analyses'

interface EnhancedSampleAnalysisModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function EnhancedSampleAnalysisModal({ isOpen, onClose }: EnhancedSampleAnalysisModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState('saas')
  const [currentSample, setCurrentSample] = useState<SampleAnalysis>(getSampleAnalysis('saas'))

  const steps = [
    'Business Profile Detection',
    'Market Analysis',
    'Directory Opportunities',
    'AI Insights & Recommendations',
    'Revenue Projections'
  ]

  const industryOptions = [
    { id: 'saas', name: 'SaaS/Technology', icon: '💻' },
    { id: 'restaurant', name: 'Restaurant', icon: '🍽️' },
    { id: 'healthcare', name: 'Healthcare', icon: '🏥' },
    { id: 'ecommerce', name: 'E-commerce', icon: '🛍️' },
    { id: 'consulting', name: 'Consulting', icon: '📊' },
    { id: 'realestate', name: 'Real Estate', icon: '🏠' }
  ]

  // Update sample data when industry changes
  useEffect(() => {
    setCurrentSample(getSampleAnalysis(selectedIndustry))
  }, [selectedIndustry])

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0)
      setIsAnimating(true)
      
      // Simulate analysis steps
      const timer = setInterval(() => {
        setCurrentStep(prev => {
          if (prev < steps.length - 1) {
            return prev + 1
          } else {
            setIsAnimating(false)
            clearInterval(timer)
            return prev
          }
        })
      }, 800)

      return () => clearInterval(timer)
    }

    return () => {}
  }, [isOpen, steps.length, selectedIndustry])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-gradient-to-br from-secondary-800 to-secondary-900 rounded-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto border border-volt-500/30 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-secondary-600 sticky top-0 bg-secondary-800/90 backdrop-blur-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h2 className="text-3xl font-black text-white mb-2">
                🤖 <span className="text-volt-400">AI Business Intelligence</span> Demo
              </h2>
              <p className="text-secondary-300">See exactly what our $299 AI analysis delivers across different industries</p>
            </div>
            <button
              onClick={onClose}
              className="text-secondary-400 hover:text-secondary-200 p-2 hover:bg-secondary-700 rounded-lg transition-all"
            >
              ✕
            </button>
          </div>
          
          {/* Industry Selector */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-secondary-300 mb-3">Choose Industry Example:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {industryOptions.map((industry) => (
                <button
                  key={industry.id}
                  onClick={() => {
                    setSelectedIndustry(industry.id)
                    setCurrentStep(0)
                    setIsAnimating(true)
                    
                    // Restart animation
                    setTimeout(() => {
                      const timer = setInterval(() => {
                        setCurrentStep(prev => {
                          if (prev < steps.length - 1) {
                            return prev + 1
                          } else {
                            setIsAnimating(false)
                            clearInterval(timer)
                            return prev
                          }
                        })
                      }, 600)
                    }, 100)
                  }}
                  className={`p-3 rounded-lg text-center transition-all duration-300 ${
                    selectedIndustry === industry.id
                      ? 'bg-volt-500/20 border-2 border-volt-500 text-volt-300'
                      : 'bg-secondary-700/50 border-2 border-secondary-600 text-secondary-300 hover:border-volt-500/50 hover:text-volt-400'
                  }`}
                >
                  <div className="text-lg mb-1">{industry.icon}</div>
                  <div className="text-xs font-medium">{industry.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Analysis Progress */}
        {isAnimating && (
          <div className="p-6 border-b border-secondary-600">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-volt-400">
                🔍 Analyzing {currentSample.businessProfile.name}...
              </h3>
              <button
                onClick={() => setIsAnimating(false)}
                className="text-sm text-volt-400 hover:text-volt-300 underline transition-colors"
              >
                Skip Animation →
              </button>
            </div>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-500 ${
                    index < currentStep
                      ? 'bg-success-500/20 border border-success-500/40 text-success-200'
                      : index === currentStep
                      ? 'bg-volt-500/20 border border-volt-500/40 text-volt-200 animate-pulse'
                      : 'bg-secondary-800/30 border border-secondary-600/30 text-secondary-500'
                  }`}
                >
                  <div className="w-8 h-8 flex items-center justify-center">
                    {index < currentStep ? (
                      <span className="text-success-400 text-xl">✅</span>
                    ) : index === currentStep ? (
                      <div className="w-5 h-5 border-3 border-volt-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-secondary-600 text-lg">⏳</span>
                    )}
                  </div>
                  <span className="font-medium">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {!isAnimating && (
          <div className="p-6 space-y-8">
            {/* Business Profile */}
            <div className="bg-gradient-to-r from-volt-500/10 to-volt-600/10 rounded-xl border border-volt-500/30 p-6">
              <h3 className="text-xl font-bold text-volt-400 mb-4">🎯 Business Profile Detected</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-secondary-400 text-sm">Company:</span>
                  <div className="text-white font-semibold">{currentSample.businessProfile.name}</div>
                </div>
                <div>
                  <span className="text-secondary-400 text-sm">Industry:</span>
                  <div className="text-white font-semibold">{currentSample.businessProfile.industry}</div>
                </div>
                <div>
                  <span className="text-secondary-400 text-sm">Model:</span>
                  <div className="text-white font-semibold">{currentSample.businessProfile.businessModel}</div>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-secondary-400 text-sm">Description:</span>
                <div className="text-white">{currentSample.businessProfile.description}</div>
              </div>
              <div className="mt-4">
                <span className="text-secondary-400 text-sm">Target Audience:</span>
                <div className="text-white">{currentSample.businessProfile.targetAudience.join(', ')}</div>
              </div>
            </div>

            {/* Key Metrics */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">📊 Key Performance Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-4 text-center">
                  <div className="text-2xl font-black text-volt-400 mb-1">{currentSample.metrics.visibilityScore}%</div>
                  <div className="text-xs text-secondary-300">Visibility Score</div>
                </div>
                <div className="bg-secondary-800/50 rounded-xl border border-success-500/30 p-4 text-center">
                  <div className="text-2xl font-black text-success-400 mb-1">{currentSample.metrics.seoScore}%</div>
                  <div className="text-xs text-secondary-300">SEO Score</div>
                </div>
                <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-4 text-center">
                  <div className="text-2xl font-black text-volt-400 mb-1">{currentSample.metrics.directoryOpportunities}</div>
                  <div className="text-xs text-secondary-300">Opportunities</div>
                </div>
                <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-4 text-center">
                  <div className="text-2xl font-black text-volt-400 mb-1">{currentSample.metrics.potentialLeads.toLocaleString()}</div>
                  <div className="text-xs text-secondary-300">Potential Leads</div>
                </div>
                <div className="bg-secondary-800/50 rounded-xl border border-danger-500/30 p-4 text-center">
                  <div className="text-2xl font-black text-danger-400 mb-1">{currentSample.metrics.competitorAdvantage}%</div>
                  <div className="text-xs text-secondary-300">Behind Competitors</div>
                </div>
              </div>
            </div>

            {/* Directory Opportunities */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">🎯 Top Directory Opportunities</h3>
              <div className="space-y-4">
                {currentSample.directoryOpportunities.map((dir, index) => (
                  <div key={index} className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-bold text-white">{index + 1}. {dir.name}</h4>
                          <span className="px-2 py-1 bg-success-500/20 text-success-300 rounded-full text-xs font-bold">
                            {dir.difficulty}
                          </span>
                          <span className="px-2 py-1 bg-volt-500/20 text-volt-300 rounded-full text-xs font-bold">
                            {dir.authority}/100 DA
                          </span>
                          <span className="px-2 py-1 bg-secondary-700/50 text-secondary-300 rounded-full text-xs font-bold">
                            {dir.cost === 0 ? 'FREE' : `$${dir.cost}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                          <div className="bg-secondary-900/30 rounded-lg p-2">
                            <span className="text-xs text-secondary-400">Monthly Traffic:</span>
                            <div className="text-white font-semibold">{dir.estimatedTraffic.toLocaleString()}</div>
                          </div>
                          <div className="bg-secondary-900/30 rounded-lg p-2">
                            <span className="text-xs text-secondary-400">Success Rate:</span>
                            <div className="text-success-400 font-semibold">{dir.successProbability}%</div>
                          </div>
                          <div className="bg-secondary-900/30 rounded-lg p-2">
                            <span className="text-xs text-secondary-400">Authority:</span>
                            <div className="text-volt-400 font-semibold">{dir.authority}/100</div>
                          </div>
                        </div>
                        <div className="bg-gradient-to-r from-volt-500/10 to-volt-600/10 rounded-lg p-3 border border-volt-500/20">
                          <h5 className="text-sm font-bold text-volt-400 mb-1">🤖 AI Insight:</h5>
                          <p className="text-sm text-secondary-200">{dir.reasoning}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2 lg:w-32">
                        <div className="w-12 h-12 rounded-full bg-success-500/20 text-success-400 border border-success-500/30 flex items-center justify-center text-xl">
                          🎯
                        </div>
                        <span className="text-success-400 font-bold text-sm">HIGH PRIORITY</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-secondary-800/50 rounded-xl border border-success-500/30 p-6">
                <h4 className="text-lg font-bold text-success-400 mb-4">✅ Competitive Advantages</h4>
                <ul className="space-y-2">
                  {currentSample.aiInsights.competitiveAdvantages.map((advantage, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-success-400 mt-1">•</span>
                      <span className="text-secondary-200 text-sm">{advantage}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6">
                <h4 className="text-lg font-bold text-volt-400 mb-4">🚀 Growth Opportunities</h4>
                <ul className="space-y-2">
                  {currentSample.aiInsights.improvementSuggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-volt-400 mt-1">•</span>
                      <span className="text-secondary-200 text-sm">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Revenue Projections */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">💰 Revenue Impact Projections</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-success-500/10 to-success-600/10 rounded-xl border border-success-500/30 p-6">
                  <h4 className="text-lg font-bold text-success-400 mb-4">Conservative Scenario</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-secondary-300">Revenue Increase:</span>
                      <span className="text-success-400 font-bold">${currentSample.revenueProjections.conservative.projectedRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-300">Traffic Boost:</span>
                      <span className="text-success-400 font-bold">+{currentSample.revenueProjections.conservative.trafficIncrease}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-300">Lead Increase:</span>
                      <span className="text-success-400 font-bold">+{currentSample.revenueProjections.conservative.leadIncrease}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-300">Conversion Rate:</span>
                      <span className="text-success-400 font-bold">{currentSample.revenueProjections.conservative.conversionRate}%</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-volt-500/10 to-volt-600/10 rounded-xl border border-volt-500/30 p-6">
                  <h4 className="text-lg font-bold text-volt-400 mb-4">Optimistic Scenario</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-secondary-300">Revenue Increase:</span>
                      <span className="text-volt-400 font-bold">${currentSample.revenueProjections.optimistic.projectedRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-300">Traffic Boost:</span>
                      <span className="text-volt-400 font-bold">+{currentSample.revenueProjections.optimistic.trafficIncrease}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-300">Lead Increase:</span>
                      <span className="text-volt-400 font-bold">+{currentSample.revenueProjections.optimistic.leadIncrease}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-300">Conversion Rate:</span>
                      <span className="text-volt-400 font-bold">{currentSample.revenueProjections.optimistic.conversionRate}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Success Factors */}
            <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6">
              <h4 className="text-lg font-bold text-volt-400 mb-4">🎯 Key Success Factors</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {currentSample.aiInsights.successFactors.map((factor, index) => (
                  <div key={index} className="bg-secondary-900/30 rounded-lg p-3 text-center">
                    <span className="text-secondary-200 text-sm">{factor}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Section */}
            <div className="bg-gradient-to-r from-volt-500/10 to-volt-600/10 rounded-2xl border border-volt-500/30 p-8 text-center">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-2xl font-bold text-white mb-4">
                Get This Level of Intelligence for <span className="text-volt-400">Your Business</span>
              </h3>
              <p className="text-secondary-200 mb-6 max-w-2xl mx-auto">
                This is exactly what you'll receive with our Growth Intelligence plan. 
                Complete AI analysis, directory opportunities, and revenue projections for just $299.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
                <StartTrialButton
                  plan="growth"
                  className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black py-4 px-8 text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 shadow-2xl"
                  successUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/success?session_id={CHECKOUT_SESSION_ID}&plan=growth&source=demo&industry=${selectedIndustry}`}
                  cancelUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/pricing?cancelled=true&plan=growth&source=demo&industry=${selectedIndustry}`}
                >
                  🚀 Get My Analysis Now - $299
                </StartTrialButton>
                <button
                  onClick={onClose}
                  className="border-2 border-volt-500 text-volt-500 font-bold py-4 px-8 text-lg rounded-xl hover:bg-volt-500 hover:text-secondary-900 transition-all duration-300"
                >
                  Maybe Later
                </button>
              </div>
              
              <div className="text-sm text-secondary-300">
                💰 <strong className="text-volt-400">30-day money-back guarantee</strong> • 
                <strong className="text-volt-400">Results in 48 hours</strong> • 
                <strong className="text-volt-400">Save 93% vs. consultants</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}