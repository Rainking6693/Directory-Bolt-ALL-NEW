'use client'
import { useState, useEffect } from 'react'
import { sampleAnalyses, SampleAnalysisData } from '../../lib/data/sample-analysis-data'

interface AnalysisStep {
  id: string
  title: string
  description: string
  duration: number
  icon: string
  status: 'pending' | 'analyzing' | 'complete'
}

const analysisSteps: AnalysisStep[] = [
  {
    id: 'website-scan',
    title: 'Website Analysis',
    description: 'Scanning website content, structure, and business information...',
    duration: 2000,
    icon: '🔍',
    status: 'pending'
  },
  {
    id: 'business-profile',
    title: 'Business Profile Creation',
    description: 'AI extracting business category, target audience, and key features...',
    duration: 1500,
    icon: '🏢',
    status: 'pending'
  },
  {
    id: 'market-analysis',
    title: 'Market Analysis',
    description: 'Analyzing competitive landscape and market positioning...',
    duration: 2500,
    icon: '📊',
    status: 'pending'
  },
  {
    id: 'directory-matching',
    title: 'Directory Matching',
    description: 'Identifying optimal directories and calculating success probabilities...',
    duration: 3000,
    icon: '🎯',
    status: 'pending'
  },
  {
    id: 'optimization',
    title: 'Content Optimization',
    description: 'Creating optimized descriptions and submission strategies...',
    duration: 2000,
    icon: '✨',
    status: 'pending'
  },
  {
    id: 'insights-generation',
    title: 'Strategic Insights',
    description: 'Generating business insights and success recommendations...',
    duration: 1800,
    icon: '💡',
    status: 'pending'
  }
]

interface InteractiveAnalysisPreviewProps {
  businessType?: 'localRestaurant' | 'saasCompany' | 'ecommerce' | 'professionalServices'
  onComplete?: (analysis: SampleAnalysisData) => void
  autoStart?: boolean
  className?: string
}

export default function InteractiveAnalysisPreview({
  businessType = 'localRestaurant',
  onComplete,
  autoStart = false,
  className = ''
}: InteractiveAnalysisPreviewProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [steps, setSteps] = useState<AnalysisStep[]>(analysisSteps.map(step => ({ ...step, status: 'pending' })))
  const [progress, setProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<SampleAnalysisData | null>(null)

  // Auto-start functionality
  useEffect(() => {
    if (autoStart && !isRunning && !isComplete) {
      startAnalysis()
    }
  }, [autoStart])

  const startAnalysis = async () => {
    setIsRunning(true)
    setCurrentStep(0)
    setProgress(0)
    setIsComplete(false)
    setAnalysisResult(null)

    // Reset all steps
    setSteps(analysisSteps.map(step => ({ ...step, status: 'pending' })))

    // Run through each step
    for (let i = 0; i < analysisSteps.length; i++) {
      // Set current step to analyzing
      setCurrentStep(i)
      setSteps(prevSteps => 
        prevSteps.map((step, index) => ({
          ...step,
          status: index === i ? 'analyzing' : index < i ? 'complete' : 'pending'
        }))
      )

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, analysisSteps[i].duration))

      // Update progress
      setProgress(((i + 1) / analysisSteps.length) * 100)

      // Mark step as complete
      setSteps(prevSteps =>
        prevSteps.map((step, index) => ({
          ...step,
          status: index <= i ? 'complete' : 'pending'
        }))
      )
    }

    // Complete the analysis
    setCurrentStep(-1)
    setIsRunning(false)
    setIsComplete(true)
    
    // Set the result based on business type
    const result = sampleAnalyses[businessType]
    setAnalysisResult(result)
    
    if (onComplete) {
      onComplete(result)
    }
  }

  const resetAnalysis = () => {
    setIsRunning(false)
    setCurrentStep(-1)
    setSteps(analysisSteps.map(step => ({ ...step, status: 'pending' })))
    setProgress(0)
    setIsComplete(false)
    setAnalysisResult(null)
  }

  return (
    <div className={`bg-secondary-900 rounded-2xl p-8 border border-secondary-700 ${className}`}>
      {/* Header */}
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-white mb-2">
          AI Analysis Demo
        </h3>
        <p className="text-secondary-300 mb-6">
          Watch our AI analyze a business in real-time and generate comprehensive directory recommendations
        </p>
        
        {!isRunning && !isComplete && (
          <button
            onClick={startAnalysis}
            className="btn-primary text-lg px-8 py-3"
          >
            🚀 Start AI Analysis Demo
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {(isRunning || isComplete) && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-secondary-300">Analysis Progress</span>
            <span className="text-sm text-volt-400 font-semibold">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-secondary-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-volt-400 to-volt-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Analysis Steps */}
      <div className="space-y-4 mb-8">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-500 ${
              step.status === 'analyzing'
                ? 'bg-volt-500/10 border-volt-500/50 shadow-lg'
                : step.status === 'complete'
                ? 'bg-success-500/10 border-success-500/30'
                : 'bg-secondary-800/50 border-secondary-600'
            }`}
          >
            {/* Icon */}
            <div className={`text-2xl flex-shrink-0 ${
              step.status === 'analyzing' ? 'animate-bounce' : ''
            }`}>
              {step.status === 'complete' ? '✅' : 
               step.status === 'analyzing' ? step.icon : 
               '⭕'}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold mb-1 ${
                step.status === 'analyzing' ? 'text-volt-300' :
                step.status === 'complete' ? 'text-success-300' :
                'text-secondary-300'
              }`}>
                {step.title}
              </h4>
              <p className={`text-sm ${
                step.status === 'analyzing' ? 'text-volt-200' :
                step.status === 'complete' ? 'text-success-200' :
                'text-secondary-400'
              }`}>
                {step.status === 'analyzing' ? step.description :
                 step.status === 'complete' ? 'Analysis completed successfully' :
                 'Waiting to start...'}
              </p>
              
              {/* Animated dots for analyzing state */}
              {step.status === 'analyzing' && (
                <div className="flex items-center gap-1 mt-2">
                  <div className="w-2 h-2 bg-volt-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-volt-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                  <div className="w-2 h-2 bg-volt-400 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                </div>
              )}
            </div>

            {/* Status Indicator */}
            <div className={`text-right text-xs font-medium ${
              step.status === 'analyzing' ? 'text-volt-400' :
              step.status === 'complete' ? 'text-success-400' :
              'text-secondary-500'
            }`}>
              {step.status === 'analyzing' ? 'ANALYZING' :
               step.status === 'complete' ? 'COMPLETE' :
               'PENDING'}
            </div>
          </div>
        ))}
      </div>

      {/* Completion State */}
      {isComplete && analysisResult && (
        <div className="border-t border-secondary-700 pt-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎉</div>
            <h4 className="text-2xl font-bold text-success-300 mb-2">
              Analysis Complete!
            </h4>
            <p className="text-secondary-300 mb-6">
              Your comprehensive AI analysis is ready with personalized recommendations
            </p>
          </div>

          {/* Quick Results Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-secondary-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-volt-400 mb-1">
                {analysisResult.recommendations.length}
              </div>
              <div className="text-sm text-secondary-300">
                Directory Recommendations
              </div>
            </div>
            <div className="bg-secondary-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-success-400 mb-1">
                {analysisResult.confidence}%
              </div>
              <div className="text-sm text-secondary-300">
                Analysis Confidence
              </div>
            </div>
            <div className="bg-secondary-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-info-400 mb-1">
                ${analysisResult.projectedResults.revenueProjection.toLocaleString()}
              </div>
              <div className="text-sm text-secondary-300">
                Revenue Potential
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => window.open('#', '_blank')}
              className="btn-primary px-6 py-3"
            >
              🎯 Get My Real Analysis
            </button>
            <button
              onClick={resetAnalysis}
              className="btn-secondary px-6 py-3"
            >
              🔄 Run Demo Again
            </button>
          </div>
        </div>
      )}

      {/* Value Proposition Footer */}
      <div className="mt-8 p-6 bg-gradient-to-r from-volt-500/10 to-success-500/10 rounded-xl border border-volt-500/20">
        <div className="text-center">
          <h5 className="text-lg font-semibold text-white mb-2">
            This is just a demo. Real analysis includes:
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-secondary-300">
            <div className="flex items-center gap-2">
              <span className="text-volt-400">✓</span>
              Live website scanning and analysis
            </div>
            <div className="flex items-center gap-2">
              <span className="text-volt-400">✓</span>
              Competitor research and positioning
            </div>
            <div className="flex items-center gap-2">
              <span className="text-volt-400">✓</span>
              Custom optimization for each directory
            </div>
            <div className="flex items-center gap-2">
              <span className="text-volt-400">✓</span>
              Success probability calculations
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}