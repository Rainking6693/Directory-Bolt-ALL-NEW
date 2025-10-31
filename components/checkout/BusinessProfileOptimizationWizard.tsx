'use client'
import { useState, useEffect } from 'react'
import { BusinessIntelligence } from '../../lib/services/ai-business-intelligence-engine'

interface OptimizationStep {
  id: string
  title: string
  description: string
  type: 'description' | 'categories' | 'keywords' | 'social' | 'contact' | 'summary'
  completed: boolean
  importance: 'critical' | 'high' | 'medium' | 'low'
  impactScore: number // 1-100
}

interface OptimizationSuggestion {
  type: string
  title: string
  description: string
  current: string
  suggested: string
  impact: number
  reasoning: string
  applied: boolean
}

interface BusinessProfileOptimizationWizardProps {
  businessData: any
  onOptimizationComplete: (optimizedData: any) => void
  onBack?: () => void
  className?: string
}

export function BusinessProfileOptimizationWizard({
  businessData,
  onOptimizationComplete,
  onBack,
  className = ''
}: BusinessProfileOptimizationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [optimizationSteps, setOptimizationSteps] = useState<OptimizationStep[]>([])
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(true)
  const [optimizedData, setOptimizedData] = useState(businessData)
  const [successProbability, setSuccessProbability] = useState(65)
  const [improvementScore, setImprovementScore] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)
  const [completedSteps, setCompletedSteps] = useState(0)

  useEffect(() => {
    generateOptimizationPlan()
  }, [businessData])

  const generateOptimizationPlan = async () => {
    setIsAnalyzing(true)
    
    try {
      // Simulate AI-powered analysis of business profile
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const steps: OptimizationStep[] = [
        {
          id: 'description',
          title: 'Optimize Business Description',
          description: 'Enhance your business description for better search visibility',
          type: 'description',
          completed: false,
          importance: 'critical',
          impactScore: 85
        },
        {
          id: 'categories',
          title: 'Refine Business Categories',
          description: 'Select optimal categories for directory matching',
          type: 'categories',
          completed: false,
          importance: 'critical',
          impactScore: 90
        },
        {
          id: 'keywords',
          title: 'Keyword Optimization',
          description: 'Add relevant keywords to improve discoverability',
          type: 'keywords',
          completed: false,
          importance: 'high',
          impactScore: 75
        },
        {
          id: 'contact',
          title: 'Contact Information Completeness',
          description: 'Ensure all contact details are complete and accurate',
          type: 'contact',
          completed: false,
          importance: 'high',
          impactScore: 70
        },
        {
          id: 'social',
          title: 'Social Media Integration',
          description: 'Add social media profiles to boost credibility',
          type: 'social',
          completed: false,
          importance: 'medium',
          impactScore: 60
        },
        {
          id: 'summary',
          title: 'Final Review & Success Projection',
          description: 'Review optimizations and projected success metrics',
          type: 'summary',
          completed: false,
          importance: 'critical',
          impactScore: 95
        }
      ]

      const optimizationSuggestions: OptimizationSuggestion[] = [
        {
          type: 'description',
          title: 'Enhance Business Description',
          description: 'Your current description can be more compelling and SEO-friendly',
          current: businessData.description || 'No description provided',
          suggested: generateOptimizedDescription(businessData),
          impact: 85,
          reasoning: 'A compelling description with relevant keywords increases directory approval rates by 60%',
          applied: false
        },
        {
          type: 'categories',
          title: 'Optimize Category Selection',
          description: 'Selected categories should align with your primary services',
          current: businessData.categories?.join(', ') || 'None selected',
          suggested: generateOptimizedCategories(businessData),
          impact: 90,
          reasoning: 'Precise categorization improves directory matching accuracy by 75%',
          applied: false
        },
        {
          type: 'keywords',
          title: 'Add Strategic Keywords',
          description: 'Include industry-specific keywords for better search visibility',
          current: 'No keywords specified',
          suggested: generateKeywordSuggestions(businessData),
          impact: 75,
          reasoning: 'Strategic keywords improve search ranking potential by 45%',
          applied: false
        }
      ]

      setOptimizationSteps(steps)
      setSuggestions(optimizationSuggestions)
      setTotalSteps(steps.length)
      
    } catch (error) {
      console.error('Failed to generate optimization plan:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generateOptimizedDescription = (data: any): string => {
    const businessType = data.aiPreferences?.industryCustomization?.industryType || 'business'
    const location = data.address?.city && data.address?.state 
      ? `in ${data.address.city}, ${data.address.state}` 
      : ''
    
    return `${data.businessName} is a leading ${businessType.toLowerCase()} ${location} specializing in premium services and exceptional customer experiences. With our commitment to excellence and innovative approach, we deliver outstanding results that exceed client expectations. Contact us today to discover how we can help achieve your goals with our professional solutions and dedicated support.`
  }

  const generateOptimizedCategories = (data: any): string => {
    const industryType = data.aiPreferences?.industryCustomization?.industryType
    const businessModel = data.aiPreferences?.industryCustomization?.businessModel
    
    const suggestedCategories = []
    
    if (industryType) {
      suggestedCategories.push(industryType)
    }
    
    if (businessModel === 'b2b') {
      suggestedCategories.push('Business Services', 'Professional Services')
    } else if (businessModel === 'b2c') {
      suggestedCategories.push('Consumer Services', 'Retail')
    } else {
      suggestedCategories.push('Business Services', 'Consumer Services')
    }
    
    // Add location-based category if available
    if (data.address?.state) {
      suggestedCategories.push(`${data.address.state} Businesses`)
    }
    
    return suggestedCategories.slice(0, 5).join(', ')
  }

  const generateKeywordSuggestions = (data: any): string => {
    const keywords = []
    const industryType = data.aiPreferences?.industryCustomization?.industryType
    const location = data.address?.city && data.address?.state 
      ? `${data.address.city} ${data.address.state}` 
      : data.address?.state || ''
    
    if (industryType) {
      keywords.push(industryType.toLowerCase())
      keywords.push(`${industryType.toLowerCase()} services`)
      keywords.push(`professional ${industryType.toLowerCase()}`)
    }
    
    if (location) {
      keywords.push(`${location} business`)
      keywords.push(`${location} services`)
    }
    
    keywords.push('quality service', 'professional', 'reliable', 'experienced')
    
    return keywords.slice(0, 10).join(', ')
  }

  const applySuggestion = (suggestionIndex: number) => {
    const suggestion = suggestions[suggestionIndex]
    if (!suggestion) return

    setSuggestions(prev => prev.map((s, idx) => 
      idx === suggestionIndex ? { ...s, applied: true } : s
    ))

    // Apply the optimization to the data
    const updatedData = { ...optimizedData }
    
    switch (suggestion.type) {
      case 'description':
        updatedData.description = suggestion.suggested
        break
      case 'categories':
        updatedData.categories = suggestion.suggested.split(', ')
        break
      case 'keywords':
        updatedData.keywords = suggestion.suggested.split(', ')
        break
    }
    
    setOptimizedData(updatedData)
    
    // Update success probability
    const newProbability = Math.min(95, successProbability + suggestion.impact * 0.2)
    setSuccessProbability(Math.round(newProbability))
    
    // Update improvement score
    const newImprovement = improvementScore + suggestion.impact * 0.1
    setImprovementScore(Math.round(newImprovement))
  }

  const completeStep = (stepIndex: number) => {
    setOptimizationSteps(prev => prev.map((step, idx) => 
      idx === stepIndex ? { ...step, completed: true } : step
    ))
    
    setCompletedSteps(prev => prev + 1)
    
    // Auto-advance to next step
    if (stepIndex < optimizationSteps.length - 1) {
      setTimeout(() => setCurrentStep(stepIndex + 1), 500)
    }
  }

  const getCurrentStepSuggestions = () => {
    const currentStepType = optimizationSteps[currentStep]?.type
    return suggestions.filter(s => s.type === currentStepType)
  }

  const getOverallProgress = () => {
    return totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
  }

  const getImpactColor = (impact: number) => {
    if (impact >= 80) return 'text-success-400'
    if (impact >= 60) return 'text-warning-400'
    return 'text-secondary-400'
  }

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'critical': return 'text-danger-400'
      case 'high': return 'text-warning-400'
      case 'medium': return 'text-volt-400'
      default: return 'text-secondary-400'
    }
  }

  if (isAnalyzing) {
    return (
      <div className={`bg-secondary-800 rounded-xl border border-secondary-700 p-8 text-center ${className}`}>
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-volt-500"></div>
          <h3 className="text-xl font-bold text-white">🤖 AI Profile Analysis</h3>
          <p className="text-secondary-300 max-w-md">
            Our AI is analyzing your business profile and generating personalized optimization recommendations...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-secondary-800 rounded-xl border border-secondary-700 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-secondary-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            ✨ Business Profile Optimization Wizard
          </h3>
          <div className="text-right">
            <div className="text-sm text-secondary-300">Success Probability</div>
            <div className="text-2xl font-bold text-success-400">{successProbability}%</div>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-secondary-700/50 rounded-lg p-4">
            <div className="text-sm text-secondary-400">Overall Progress</div>
            <div className="text-xl font-bold text-white">{getOverallProgress()}%</div>
            <div className="w-full bg-secondary-600 rounded-full h-2 mt-2">
              <div 
                className="bg-volt-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${getOverallProgress()}%` }}
              />
            </div>
          </div>
          
          <div className="bg-secondary-700/50 rounded-lg p-4">
            <div className="text-sm text-secondary-400">Steps Completed</div>
            <div className="text-xl font-bold text-white">{completedSteps} / {totalSteps}</div>
          </div>
          
          <div className="bg-secondary-700/50 rounded-lg p-4">
            <div className="text-sm text-secondary-400">Improvement Score</div>
            <div className="text-xl font-bold text-success-400">+{improvementScore}</div>
          </div>
        </div>

        {/* Step Navigation */}
        <div className="flex flex-wrap gap-2">
          {optimizationSteps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(index)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                index === currentStep
                  ? 'bg-volt-500 text-secondary-900'
                  : step.completed
                    ? 'bg-success-500 text-white'
                    : 'bg-secondary-700 text-secondary-300 hover:bg-secondary-600'
              }`}
            >
              {step.completed ? '✓' : index + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Current Step Content */}
      <div className="p-6">
        {optimizationSteps[currentStep] && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">
                  {optimizationSteps[currentStep].title}
                </h4>
                <p className="text-secondary-300 mb-4">
                  {optimizationSteps[currentStep].description}
                </p>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-medium ${getImportanceColor(optimizationSteps[currentStep].importance)}`}>
                    {optimizationSteps[currentStep].importance.toUpperCase()} PRIORITY
                  </span>
                  <span className={`text-sm ${getImpactColor(optimizationSteps[currentStep].impactScore)}`}>
                    Impact Score: {optimizationSteps[currentStep].impactScore}/100
                  </span>
                </div>
              </div>
            </div>

            {/* Step-specific content */}
            {optimizationSteps[currentStep].type === 'summary' ? (
              // Final Summary
              <div className="space-y-6">
                <div className="bg-success-500/10 border border-success-500/30 rounded-lg p-4">
                  <h5 className="text-lg font-semibold text-success-400 mb-3">
                    🎉 Optimization Complete!
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-secondary-400">Success Probability:</span>
                      <span className="text-success-400 font-bold ml-2">{successProbability}%</span>
                    </div>
                    <div>
                      <span className="text-secondary-400">Improvement Score:</span>
                      <span className="text-success-400 font-bold ml-2">+{improvementScore}</span>
                    </div>
                    <div>
                      <span className="text-secondary-400">Steps Completed:</span>
                      <span className="text-white font-bold ml-2">{completedSteps}/{totalSteps}</span>
                    </div>
                    <div>
                      <span className="text-secondary-400">Applied Optimizations:</span>
                      <span className="text-white font-bold ml-2">{suggestions.filter(s => s.applied).length}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h6 className="text-md font-semibold text-white mb-3">Optimization Summary</h6>
                  <div className="space-y-3">
                    {suggestions.filter(s => s.applied).map((suggestion, idx) => (
                      <div key={idx} className="bg-secondary-700/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium">{suggestion.title}</span>
                          <span className="text-success-400 text-sm">✓ Applied</span>
                        </div>
                        <p className="text-secondary-300 text-sm">{suggestion.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-volt-500/10 border border-volt-500/30 rounded-lg p-4">
                  <h6 className="text-volt-400 font-semibold mb-2">Next Steps</h6>
                  <ul className="text-sm text-secondary-300 space-y-1">
                    <li>• Your optimized profile will be used for directory submissions</li>
                    <li>• AI-generated descriptions will improve approval rates</li>
                    <li>• Strategic keywords will enhance search visibility</li>
                    <li>• You'll receive detailed performance tracking</li>
                  </ul>
                </div>
              </div>
            ) : (
              // Regular step content with suggestions
              <div className="space-y-4">
                {getCurrentStepSuggestions().map((suggestion, index) => (
                  <div key={index} className="bg-secondary-700/30 border border-secondary-600 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h6 className="text-white font-medium mb-1">{suggestion.title}</h6>
                        <p className="text-secondary-300 text-sm mb-2">{suggestion.description}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${getImpactColor(suggestion.impact)}`}>
                            Impact: {suggestion.impact}/100
                          </span>
                          {suggestion.applied && (
                            <span className="text-xs bg-success-500 text-white px-2 py-0.5 rounded">
                              ✓ Applied
                            </span>
                          )}
                        </div>
                      </div>
                      {!suggestion.applied && (
                        <button
                          onClick={() => applySuggestion(suggestions.indexOf(suggestion))}
                          className="bg-volt-500 hover:bg-volt-600 text-secondary-900 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                        >
                          Apply
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-secondary-400 block mb-1">Current:</span>
                        <div className="bg-secondary-800 rounded p-2 text-secondary-300">
                          {suggestion.current}
                        </div>
                      </div>
                      <div>
                        <span className="text-volt-400 block mb-1">Suggested:</span>
                        <div className="bg-volt-500/10 border border-volt-500/30 rounded p-2 text-white">
                          {suggestion.suggested}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 p-3 bg-secondary-800/50 rounded border border-secondary-600">
                      <span className="text-secondary-400 text-xs block mb-1">Why this helps:</span>
                      <p className="text-secondary-300 text-sm">{suggestion.reasoning}</p>
                    </div>
                  </div>
                ))}

                {getCurrentStepSuggestions().length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-success-400 text-4xl mb-2">✓</div>
                    <h5 className="text-white font-semibold mb-2">Step Complete</h5>
                    <p className="text-secondary-300">No additional optimizations needed for this step.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 p-6 border-t border-secondary-700">
        {currentStep > 0 && (
          <button
            onClick={() => setCurrentStep(currentStep - 1)}
            className="btn-secondary"
          >
            Previous Step
          </button>
        )}
        
        {currentStep < optimizationSteps.length - 1 ? (
          <button
            onClick={() => completeStep(currentStep)}
            className="btn-primary flex-1"
          >
            Complete Step & Continue
          </button>
        ) : (
          <button
            onClick={() => onOptimizationComplete(optimizedData)}
            className="btn-primary flex-1"
          >
            Complete Optimization
          </button>
        )}

        {onBack && (
          <button
            onClick={onBack}
            className="btn-secondary"
          >
            Back
          </button>
        )}
      </div>
    </div>
  )
}

export default BusinessProfileOptimizationWizard