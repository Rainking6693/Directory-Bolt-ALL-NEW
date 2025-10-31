import React, { useState, useEffect } from 'react'
import { ChevronRight, ChevronLeft, CheckCircle, Star, MapPin, Users, DollarSign, Target, TrendingUp, AlertTriangle, Lightbulb, Award } from 'lucide-react'
import { trackCustomEvent, trackConversionFunnel } from '../analytics/ConversionTracker'

interface BusinessAssessmentProps {
  onComplete?: (results: AssessmentResults) => void
  onClose?: () => void
  context?: string
  variant?: 'full' | 'quick' | 'embedded'
}

interface AssessmentQuestion {
  id: string
  question: string
  type: 'single' | 'multiple' | 'scale' | 'text'
  options?: string[]
  category: 'business' | 'marketing' | 'technical' | 'goals'
  weight: number
  helpText?: string
}

interface AssessmentResults {
  score: number
  tier: 'starter' | 'professional' | 'enterprise'
  recommendations: Recommendation[]
  priorityDirectories: string[]
  estimatedImpact: {
    timeToResults: string
    expectedLiftPercent: number
    monthlyLeadIncrease: string
  }
}

interface Recommendation {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: string
  directoryCount?: number
}

export function BusinessAssessment({
  onComplete,
  onClose,
  context = 'guide',
  variant = 'full'
}: BusinessAssessmentProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<{ [key: string]: string | string[] | number }>({})
  const [isComplete, setIsComplete] = useState(false)
  const [results, setResults] = useState<AssessmentResults | null>(null)
  const [showResults, setShowResults] = useState(false)

  // Track assessment start
  useEffect(() => {
    trackCustomEvent('business_assessment_started', {
      variant,
      context
    })
  }, [variant, context])

  const questions: AssessmentQuestion[] = [
    {
      id: 'business_type',
      question: 'What type of business do you operate?',
      type: 'single',
      category: 'business',
      weight: 3,
      options: [
        'Local Service Business (Plumber, Lawyer, Dentist)',
        'E-commerce/Online Retail',
        'Restaurant/Food Service',
        'Professional Services (Consultant, Agency)',
        'Healthcare Practice',
        'Real Estate',
        'Technology/Software Company',
        'Manufacturing/B2B',
        'Non-profit Organization',
        'Other'
      ]
    },
    {
      id: 'business_age',
      question: 'How long has your business been operating?',
      type: 'single',
      category: 'business',
      weight: 2,
      options: [
        'Less than 6 months',
        '6 months - 2 years',
        '2 - 5 years',
        '5 - 10 years',
        'More than 10 years'
      ]
    },
    {
      id: 'locations',
      question: 'How many physical locations do you have?',
      type: 'single',
      category: 'business',
      weight: 3,
      options: [
        'Online only (no physical location)',
        'Single location',
        '2-3 locations',
        '4-10 locations',
        'More than 10 locations'
      ]
    },
    {
      id: 'monthly_revenue',
      question: 'What is your approximate monthly revenue?',
      type: 'single',
      category: 'business',
      weight: 2,
      options: [
        'Under $5,000',
        '$5,000 - $25,000',
        '$25,000 - $100,000',
        '$100,000 - $500,000',
        'Over $500,000',
        'Prefer not to say'
      ]
    },
    {
      id: 'current_visibility',
      question: 'How would you rate your current online visibility?',
      type: 'scale',
      category: 'marketing',
      weight: 3,
      helpText: '1 = Very poor, 10 = Excellent'
    },
    {
      id: 'directory_presence',
      question: 'Which directories are you currently listed in?',
      type: 'multiple',
      category: 'marketing',
      weight: 2,
      options: [
        'Google My Business',
        'Yelp',
        'Facebook Business',
        'Yellow Pages',
        'Bing Places',
        'Industry-specific directories',
        'Local chamber of commerce',
        'None of the above'
      ]
    },
    {
      id: 'marketing_budget',
      question: 'What is your monthly marketing budget?',
      type: 'single',
      category: 'marketing',
      weight: 2,
      options: [
        'Under $500',
        '$500 - $2,000',
        '$2,000 - $10,000',
        '$10,000 - $50,000',
        'Over $50,000'
      ]
    },
    {
      id: 'biggest_challenge',
      question: 'What is your biggest marketing challenge?',
      type: 'single',
      category: 'marketing',
      weight: 3,
      options: [
        'Not enough website traffic',
        'Low conversion rates',
        'Poor search engine rankings',
        'Inconsistent online presence',
        'Competitors outranking us',
        'Limited marketing resources/time',
        'Difficulty measuring ROI',
        'Managing multiple marketing channels'
      ]
    },
    {
      id: 'technical_comfort',
      question: 'How comfortable are you with marketing technology?',
      type: 'scale',
      category: 'technical',
      weight: 1,
      helpText: '1 = Not comfortable at all, 10 = Very comfortable'
    },
    {
      id: 'growth_goals',
      question: 'What are your primary growth goals? (Select all that apply)',
      type: 'multiple',
      category: 'goals',
      weight: 3,
      options: [
        'Increase local customers',
        'Expand to new geographic areas',
        'Improve online reputation',
        'Generate more qualified leads',
        'Increase brand awareness',
        'Compete more effectively',
        'Automate marketing processes',
        'Improve search rankings'
      ]
    }
  ]

  const quickQuestions = questions.slice(0, 5) // For quick variant

  const getCurrentQuestions = () => {
    return variant === 'quick' ? quickQuestions : questions
  }

  const currentQuestion = getCurrentQuestions()[currentStep]

  const handleAnswer = (answer: string | string[] | number) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }))

    // Track answer
    trackCustomEvent('assessment_question_answered', {
      question_id: currentQuestion.id,
      answer,
      step: currentStep,
      context
    })
  }

  const handleNext = () => {
    if (currentStep < getCurrentQuestions().length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeAssessment()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const completeAssessment = () => {
    const assessmentResults = calculateResults()
    setResults(assessmentResults)
    setIsComplete(true)
    setShowResults(true)

    trackConversionFunnel('assessment_completed', {
      variant,
      context,
      score: assessmentResults.score,
      tier: assessmentResults.tier,
      answers_count: Object.keys(answers).length
    })

    if (onComplete) {
      onComplete(assessmentResults)
    }
  }

  const calculateResults = (): AssessmentResults => {
    let score = 0
    let maxScore = 0

    // Calculate weighted score
    getCurrentQuestions().forEach(question => {
      const answer = answers[question.id]
      maxScore += question.weight * 10

      if (answer) {
        switch (question.type) {
          case 'scale':
            score += (answer as number) * question.weight
            break
          case 'single':
            // Score based on answer content (simplified scoring)
            const singleScore = getAnswerScore(question.id, answer as string)
            score += singleScore * question.weight
            break
          case 'multiple':
            const multiScore = (answer as string[]).length * 2
            score += Math.min(multiScore, 10) * question.weight
            break
        }
      }
    })

    const percentageScore = Math.round((score / maxScore) * 100)
    const tier = percentageScore >= 70 ? 'enterprise' : percentageScore >= 40 ? 'professional' : 'starter'

    return {
      score: percentageScore,
      tier,
      recommendations: generateRecommendations(tier, answers),
      priorityDirectories: getPriorityDirectories(answers),
      estimatedImpact: getEstimatedImpact(tier, answers)
    }
  }

  const getAnswerScore = (questionId: string, answer: string): number => {
    // Simplified scoring based on business maturity and opportunity
    const scoringRules: { [key: string]: { [key: string]: number } } = {
      business_age: {
        'Less than 6 months': 3,
        '6 months - 2 years': 5,
        '2 - 5 years': 8,
        '5 - 10 years': 9,
        'More than 10 years': 10
      },
      locations: {
        'Online only (no physical location)': 4,
        'Single location': 7,
        '2-3 locations': 8,
        '4-10 locations': 9,
        'More than 10 locations': 10
      },
      monthly_revenue: {
        'Under $5,000': 3,
        '$5,000 - $25,000': 5,
        '$25,000 - $100,000': 7,
        '$100,000 - $500,000': 9,
        'Over $500,000': 10
      },
      marketing_budget: {
        'Under $500': 3,
        '$500 - $2,000': 6,
        '$2,000 - $10,000': 8,
        '$10,000 - $50,000': 9,
        'Over $50,000': 10
      }
    }

    return scoringRules[questionId]?.[answer] || 5
  }

  const generateRecommendations = (tier: string, answers: { [key: string]: any }): Recommendation[] => {
    const recommendations: Recommendation[] = []

    if (tier === 'starter') {
      recommendations.push(
        {
          title: 'Start with Essential Directories',
          description: 'Focus on Google My Business, Yelp, and Facebook Business first',
          priority: 'high',
          category: 'foundation',
          directoryCount: 15
        },
        {
          title: 'Establish Consistent NAP',
          description: 'Ensure your Name, Address, Phone are consistent across all platforms',
          priority: 'high',
          category: 'consistency'
        },
        {
          title: 'Basic Local SEO Setup',
          description: 'Optimize for local search with proper business categorization',
          priority: 'medium',
          category: 'seo'
        }
      )
    } else if (tier === 'professional') {
      recommendations.push(
        {
          title: 'Expand Directory Presence',
          description: 'Add industry-specific and regional directories to your portfolio',
          priority: 'high',
          category: 'expansion',
          directoryCount: 50
        },
        {
          title: 'Reputation Management',
          description: 'Actively monitor and respond to reviews across all platforms',
          priority: 'high',
          category: 'reputation'
        },
        {
          title: 'Citation Building',
          description: 'Build authoritative citations to improve local search rankings',
          priority: 'medium',
          category: 'seo'
        }
      )
    } else {
      recommendations.push(
        {
          title: 'Comprehensive Directory Strategy',
          description: 'Submit to 100+ directories for maximum visibility and authority',
          priority: 'high',
          category: 'advanced',
          directoryCount: 100
        },
        {
          title: 'Multi-Location Optimization',
          description: 'Optimize each location for local search with location-specific listings',
          priority: 'high',
          category: 'multi-location'
        },
        {
          title: 'Competitive Analysis',
          description: 'Monitor competitor directory presence and identify opportunities',
          priority: 'medium',
          category: 'competitive'
        }
      )
    }

    return recommendations
  }

  const getPriorityDirectories = (answers: { [key: string]: any }): string[] => {
    const businessType = answers.business_type as string
    const locations = answers.locations as string

    // Simplified directory matching
    const directories = ['Google My Business', 'Yelp', 'Facebook Business']

    if (businessType?.includes('Restaurant')) {
      directories.push('Zomato', 'OpenTable', 'TripAdvisor')
    } else if (businessType?.includes('Healthcare')) {
      directories.push('Healthgrades', 'WebMD', 'Vitals')
    } else if (businessType?.includes('Professional')) {
      directories.push('LinkedIn', 'Better Business Bureau', 'Angie\'s List')
    }

    return directories.slice(0, 6)
  }

  const getEstimatedImpact = (tier: string, answers: { [key: string]: any }): AssessmentResults['estimatedImpact'] => {
    const currentVisibility = answers.current_visibility as number || 5

    const impacts = {
      starter: {
        timeToResults: '2-4 weeks',
        expectedLiftPercent: Math.max(20, 50 - currentVisibility * 3),
        monthlyLeadIncrease: '15-30'
      },
      professional: {
        timeToResults: '1-2 weeks',
        expectedLiftPercent: Math.max(30, 60 - currentVisibility * 2),
        monthlyLeadIncrease: '25-50'
      },
      enterprise: {
        timeToResults: '1-2 weeks',
        expectedLiftPercent: Math.max(40, 70 - currentVisibility * 2),
        monthlyLeadIncrease: '50-100+'
      }
    }

    return impacts[tier as keyof typeof impacts]
  }

  const isAnswerComplete = (): boolean => {
    const answer = answers[currentQuestion.id]
    if (!answer) return false

    if (currentQuestion.type === 'multiple') {
      return (answer as string[]).length > 0
    }
    if (currentQuestion.type === 'scale') {
      return (answer as number) >= 1 && (answer as number) <= 10
    }
    return !!answer
  }

  const renderQuestion = () => {
    const answer = answers[currentQuestion.id]

    switch (currentQuestion.type) {
      case 'single':
        return (
          <div className="space-y-3">
            {currentQuestion.options!.map((option, index) => (
              <label
                key={index}
                className="flex items-center p-4 bg-secondary-800/50 rounded-lg cursor-pointer hover:bg-secondary-800/70 transition-colors"
              >
                <input
                  type="radio"
                  name={currentQuestion.id}
                  value={option}
                  checked={answer === option}
                  onChange={(e) => handleAnswer(e.target.value)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${
                  answer === option ? 'border-volt-500 bg-volt-500' : 'border-secondary-600'
                }`}>
                  {answer === option && (
                    <div className="w-2 h-2 bg-secondary-900 rounded-full" />
                  )}
                </div>
                <span className="text-secondary-300">{option}</span>
              </label>
            ))}
          </div>
        )

      case 'multiple':
        return (
          <div className="space-y-3">
            {currentQuestion.options!.map((option, index) => {
              const selectedOptions = (answer as string[]) || []
              const isSelected = selectedOptions.includes(option)
              
              return (
                <label
                  key={index}
                  className="flex items-center p-4 bg-secondary-800/50 rounded-lg cursor-pointer hover:bg-secondary-800/70 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      const newSelections = e.target.checked
                        ? [...selectedOptions, option]
                        : selectedOptions.filter(item => item !== option)
                      handleAnswer(newSelections)
                    }}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 ${
                    isSelected ? 'border-volt-500 bg-volt-500' : 'border-secondary-600'
                  }`}>
                    {isSelected && <CheckCircle size={14} className="text-secondary-900" />}
                  </div>
                  <span className="text-secondary-300">{option}</span>
                </label>
              )
            })}
          </div>
        )

      case 'scale':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              {[...Array(10)].map((_, index) => {
                const value = index + 1
                return (
                  <button
                    key={value}
                    onClick={() => handleAnswer(value)}
                    className={`w-10 h-10 rounded-full font-medium transition-colors ${
                      answer === value
                        ? 'bg-volt-500 text-secondary-900'
                        : 'bg-secondary-800/50 text-secondary-300 hover:bg-secondary-800/70'
                    }`}
                  >
                    {value}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-between text-sm text-secondary-400">
              <span>Very Poor</span>
              <span>Excellent</span>
            </div>
            {currentQuestion.helpText && (
              <p className="text-sm text-secondary-400 text-center">
                {currentQuestion.helpText}
              </p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  const renderResults = () => {
    if (!results) return null

    const getTierColor = (tier: string) => {
      switch (tier) {
        case 'starter': return 'text-volt-400'
        case 'professional': return 'text-blue-400'
        case 'enterprise': return 'text-purple-400'
        default: return 'text-secondary-300'
      }
    }

    const getTierBadge = (tier: string) => {
      switch (tier) {
        case 'starter': return 'bg-volt-500/20 text-volt-400'
        case 'professional': return 'bg-blue-500/20 text-blue-400'
        case 'enterprise': return 'bg-purple-500/20 text-purple-400'
        default: return 'bg-secondary-500/20 text-secondary-300'
      }
    }

    return (
      <div className="space-y-6">
        {/* Score Section */}
        <div className="text-center bg-gradient-to-r from-volt-500/10 to-volt-400/10 rounded-lg p-6 border border-volt-500/20">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-volt-500 to-volt-600 rounded-full mb-4">
            <span className="text-2xl font-bold text-secondary-900">{results.score}</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Assessment Complete!</h3>
          <div className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${getTierBadge(results.tier)}`}>
            {results.tier.charAt(0).toUpperCase() + results.tier.slice(1)} Tier
          </div>
        </div>

        {/* Impact Projection */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-secondary-800/50 rounded-lg p-4 text-center">
            <TrendingUp className="mx-auto text-success-400 mb-2" size={24} />
            <div className="text-lg font-bold text-success-400">
              {results.estimatedImpact.expectedLiftPercent}%
            </div>
            <div className="text-sm text-secondary-300">Expected Lift</div>
          </div>
          <div className="bg-secondary-800/50 rounded-lg p-4 text-center">
            <Users className="mx-auto text-volt-400 mb-2" size={24} />
            <div className="text-lg font-bold text-volt-400">
              {results.estimatedImpact.monthlyLeadIncrease}
            </div>
            <div className="text-sm text-secondary-300">Monthly Leads</div>
          </div>
          <div className="bg-secondary-800/50 rounded-lg p-4 text-center">
            <Target className="mx-auto text-blue-400 mb-2" size={24} />
            <div className="text-lg font-bold text-blue-400">
              {results.estimatedImpact.timeToResults}
            </div>
            <div className="text-sm text-secondary-300">Time to Results</div>
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <h4 className="text-lg font-bold text-white mb-4 flex items-center">
            <Lightbulb className="mr-2 text-volt-400" size={20} />
            Personalized Recommendations
          </h4>
          <div className="space-y-3">
            {results.recommendations.map((rec, index) => (
              <div
                key={index}
                className="flex items-start p-4 bg-secondary-800/50 rounded-lg"
              >
                <div className={`p-2 rounded-lg mr-4 ${
                  rec.priority === 'high' ? 'bg-danger-500/20 text-danger-400' :
                  rec.priority === 'medium' ? 'bg-volt-500/20 text-volt-400' :
                  'bg-secondary-500/20 text-secondary-300'
                }`}>
                  <Star size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-medium text-white">{rec.title}</h5>
                    {rec.directoryCount && (
                      <span className="text-xs px-2 py-1 bg-volt-500/20 text-volt-400 rounded">
                        {rec.directoryCount} directories
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-secondary-300">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Directories */}
        <div>
          <h4 className="text-lg font-bold text-white mb-4 flex items-center">
            <MapPin className="mr-2 text-volt-400" size={20} />
            Priority Directories for Your Business
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {results.priorityDirectories.map((directory, index) => (
              <div key={index} className="bg-secondary-800/50 rounded-lg p-3 text-center">
                <span className="text-sm text-secondary-300">{directory}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-volt-500/10 to-volt-400/10 rounded-lg p-6 border border-volt-500/20">
          <h4 className="text-xl font-bold text-white mb-3">
            Ready to Implement Your Strategy?
          </h4>
          <p className="text-secondary-300 mb-4">
            DirectoryBolt can automate all these recommendations and get you listed in 
            {results.recommendations.find(r => r.directoryCount)?.directoryCount || 50}+ directories
          </p>
          <button
            onClick={() => {
              trackConversionFunnel('assessment_cta_clicked', {
                context,
                tier: results.tier,
                score: results.score
              })
            }}
            className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-8 py-3 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105"
          >
            Get Started with DirectoryBolt
          </button>
          <p className="text-xs text-secondary-400 mt-3">
            Free analysis • No credit card required
          </p>
        </div>
      </div>
    )
  }

  if (showResults) {
    return (
      <div className="bg-gradient-to-br from-secondary-800 to-secondary-900 rounded-xl p-6 border border-secondary-700 max-w-4xl mx-auto">
        {renderResults()}
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-secondary-800 to-secondary-900 rounded-xl p-6 border border-secondary-700 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-white mb-2">
          Business Assessment
        </h3>
        <p className="text-secondary-300">
          Get personalized directory recommendations for your business
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-secondary-400 mb-2">
          <span>Question {currentStep + 1} of {getCurrentQuestions().length}</span>
          <span>{Math.round(((currentStep + 1) / getCurrentQuestions().length) * 100)}% Complete</span>
        </div>
        <div className="w-full bg-secondary-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-volt-500 to-volt-400 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / getCurrentQuestions().length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-8">
        <h4 className="text-xl font-semibold text-white mb-6">
          {currentQuestion.question}
        </h4>
        {renderQuestion()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 0}
          className="flex items-center px-4 py-2 bg-secondary-700 text-white rounded-lg hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={18} className="mr-1" />
          Previous
        </button>

        <span className="text-secondary-400 text-sm">
          {currentStep + 1} / {getCurrentQuestions().length}
        </span>

        <button
          onClick={handleNext}
          disabled={!isAnswerComplete()}
          className="flex items-center px-6 py-2 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-semibold rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {currentStep === getCurrentQuestions().length - 1 ? 'Complete Assessment' : 'Next'}
          <ChevronRight size={18} className="ml-1" />
        </button>
      </div>
    </div>
  )
}