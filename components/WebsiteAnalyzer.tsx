'use client'
import { useState, useEffect } from 'react'
import { useWebsiteAnalysis } from '../lib/hooks/useApiCall'
import { ErrorDisplay } from './ui/ErrorDisplay'
import { LoadingState } from './ui/LoadingState'
import { SuccessState } from './ui/SuccessState'
import { AnalysisResultsDisplay } from './analysis/AnalysisResultsDisplay'
import { ErrorBoundary } from './ui/ErrorBoundary'

interface WebsiteAnalyzerProps {
  onNext: () => void
}

interface AnalysisResult {
  title: string
  description: string
  seoScore: number
  currentListings: number
  missedOpportunities: number
  competitorAdvantage: number
  potentialLeads: number
  visibility: number
  issues: Array<{
    type: 'critical' | 'warning' | 'info'
    title: string
    description: string
    impact: string
    priority?: number
  }>
  recommendations: Array<{
    action: string
    impact: string
    effort: 'low' | 'medium' | 'high'
  }>
  directoryOpportunities: Array<{
    name: string
    authority: number
    estimatedTraffic: number
    submissionDifficulty: string
    cost?: number
  }>
}

export function WebsiteAnalyzer({ onNext }: WebsiteAnalyzerProps) {
  const [website, setWebsite] = useState('')
  const [showResults, setShowResults] = useState(false)
  const { data: results, loading: isAnalyzing, error, analyzeWebsite, retry, reset } = useWebsiteAnalysis()

  const analysisSteps = [
    'Validating website URL...',
    'Scanning your website...',
    'Checking directory listings...',
    'Analyzing competitor presence...',
    'Calculating missed opportunities...',
    'Generating optimization report...'
  ]

  const handleAnalyze = async () => {
    if (!website.trim()) return

    reset()
    setShowResults(false)

    try {
      const result = await analyzeWebsite(website.trim(), {
        deep: false,
        includeCompetitors: true,
        checkDirectories: true
      })
      
      if (result) {
        setShowResults(true)
      }
    } catch (error) {
      // Error is handled by the hook
      console.error('Analysis failed:', error)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleAnalyze()
  }

  const handleRetry = () => {
    retry()
    // Since retry doesn't re-call the function, we need to call analyze again
    handleAnalyze()
  }

  const handleStartOver = () => {
    reset()
    setShowResults(false)
    setWebsite('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="max-w-4xl mx-auto text-center">
        {/* Header */}
        <div className="mb-12 animate-slide-down">
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600">
              🔍 Website Analysis
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-secondary-300">
            See exactly where you&apos;re losing customers to competitors
          </p>
        </div>

        {!isAnalyzing && !results && !error && (
          <div className="animate-zoom-in">
            {/* URL Input Form */}
            <form onSubmit={handleSubmit} className="mb-8">
              <div className="bg-secondary-800 p-8 rounded-2xl border border-secondary-700 backdrop-blur-sm">
                <div className="mb-6">
                  <label className="block text-lg font-semibold text-secondary-200 mb-4">
                    Enter your website URL for instant analysis:
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://yourwebsite.com"
                      className="w-full px-6 py-4 bg-secondary-900 border-2 border-secondary-600 rounded-xl text-white text-lg focus:border-volt-500 focus:outline-none transition-all duration-300"
                      required
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-volt-500">
                      🌐
                    </div>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={!website.trim() || isAnalyzing}
                  className="group relative px-8 py-4 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-volt-500/50 disabled:opacity-50 disabled:cursor-not-allowed animate-glow"
                >
                  <span className="relative z-10">⚡ Analyze My Website FREE</span>
                </button>
              </div>
            </form>

            {/* Trust Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-secondary-800/50 p-6 rounded-xl border border-secondary-700">
                <div className="text-3xl mb-3">🔒</div>
                <h3 className="font-bold text-volt-400 mb-2">100% Secure</h3>
                <p className="text-sm text-secondary-400">We never store your data or spam you</p>
              </div>
              
              <div className="bg-secondary-800/50 p-6 rounded-xl border border-secondary-700">
                <div className="text-3xl mb-3">⚡</div>
                <h3 className="font-bold text-volt-400 mb-2">Instant Results</h3>
                <p className="text-sm text-secondary-400">Complete analysis in under 30 seconds</p>
              </div>
              
              <div className="bg-secondary-800/50 p-6 rounded-xl border border-secondary-700">
                <div className="text-3xl mb-3">🎯</div>
                <h3 className="font-bold text-volt-400 mb-2">Action Plan Included</h3>
                <p className="text-sm text-secondary-400">Get specific steps to dominate your market</p>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Progress */}
        {isAnalyzing && (
          <div className="animate-zoom-in">
            <LoadingState
              message="Analyzing Your Website"
              submessage="We're checking hundreds of directories to give you comprehensive results"
              steps={analysisSteps}
              currentStep={Math.min(Math.floor(Date.now() / 2000) % analysisSteps.length, analysisSteps.length - 1)}
              showProgress={false}
              size="lg"
              variant="spinner"
              estimatedTime={60}
              className="bg-secondary-800 rounded-2xl border border-secondary-700 backdrop-blur-sm"
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="animate-slide-up">
            <ErrorDisplay
              error={error}
              onRetry={handleRetry}
              onDismiss={handleStartOver}
              className="mb-8"
            />
          </div>
        )}

        {/* Analysis Results */}
        {results && showResults && (
          <ErrorBoundary>
            <div className="animate-slide-up">
              <AnalysisResultsDisplay 
                data={results}
                onUpgrade={onNext}
              />
              
              {/* Solution CTA */}
              <div className="mt-8 bg-gradient-to-r from-volt-500/20 to-volt-600/20 p-6 md:p-8 rounded-xl border border-volt-500/50 backdrop-blur-sm">
                <h3 className="text-xl md:text-2xl font-bold text-volt-400 mb-4">
                  ⚡ Ready to Fix These Issues?
                </h3>
                <p className="text-base md:text-lg text-secondary-200 mb-6">
                  We&apos;ll list your business in 480+ directories and fix all these problems automatically
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <button 
                    onClick={onNext}
                    className="w-full sm:w-auto group relative px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black text-base md:text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-volt-500/50 animate-glow"
                  >
                    <span className="relative z-10">🚀 Show Me The Directories</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      reset()
                      setShowResults(false)
                      setWebsite('')
                    }}
                    className="w-full sm:w-auto px-6 py-3 border-2 border-volt-500 text-volt-500 font-bold rounded-xl hover:bg-volt-500 hover:text-secondary-900 transform hover:scale-105 transition-all duration-300"
                  >
                    🔄 Analyze Another Site
                  </button>
                </div>
              </div>
            </div>
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}