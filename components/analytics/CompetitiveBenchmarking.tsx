import React, { useState } from 'react'
import { LoadingState } from '../ui/LoadingState'
import { ErrorBoundary } from '../ui/ErrorBoundary'

interface CompetitiveBenchmarkingProps {
  userTier: 'professional' | 'enterprise'
  onAnalysisComplete?: (results: BenchmarkResult) => void
  className?: string
}

interface BenchmarkResult {
  targetWebsite: string
  industry: string
  overallScore: number
  ranking: number
  totalCompetitorsAnalyzed: number
  benchmarkSummary: {
    strengths: string[]
    weaknesses: string[]
    opportunities: string[]
    threats: string[]
  }
  competitorComparison: CompetitorBenchmark[]
  industryAverages: IndustryBenchmarks
  recommendations: RecommendationCategory[]
  analysisDate: string
  nextReviewDate: string
}

interface CompetitorBenchmark {
  domain: string
  companyName: string
  overallScore: number
  marketPosition: 'leader' | 'challenger' | 'follower' | 'niche'
  metrics: {
    trafficScore: number
    contentScore: number
    technicalScore: number
    backlinkScore: number
    socialScore: number
  }
  keyStrengths: string[]
  contentStrategy: {
    publishingFrequency: string
    averageContentLength: number
    topContentTypes: string[]
    keywordStrategy: string
  }
  technicalSEO: {
    pageSpeed: number
    mobileOptimization: number
    coreWebVitals: number
    indexability: number
  }
  differentiators: string[]
}

interface IndustryBenchmarks {
  averageTrafficScore: number
  averageContentScore: number
  averageTechnicalScore: number
  averageBacklinkScore: number
  industryLeaders: string[]
  emergingTrends: string[]
  commonPainPoints: string[]
  opportunityAreas: string[]
}

interface RecommendationCategory {
  category: 'content' | 'technical' | 'backlinks' | 'user-experience' | 'strategy'
  priority: 'critical' | 'high' | 'medium' | 'low'
  recommendations: DetailedRecommendation[]
}

interface DetailedRecommendation {
  title: string
  description: string
  implementation: string
  estimatedImpact: 'high' | 'medium' | 'low'
  timeToImplement: string
  resourcesRequired: string[]
  competitors: string[]
  successMetrics: string[]
}

export default function CompetitiveBenchmarking({ 
  userTier, 
  onAnalysisComplete, 
  className = '' 
}: CompetitiveBenchmarkingProps) {
  const [targetWebsite, setTargetWebsite] = useState('')
  const [industry, setIndustry] = useState('')
  const [competitors, setCompetitors] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<BenchmarkResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analysisOptions, setAnalysisOptions] = useState({
    benchmarkingDepth: userTier === 'enterprise' ? 'comprehensive' : 'advanced',
    includeTrafficEstimates: true,
    includeContentStrategy: true,
    includeTechnicalSEO: true,
    includeBacklinkAnalysis: userTier === 'enterprise'
  })

  const handleAnalyze = async () => {
    if (!targetWebsite.trim() || !industry.trim()) {
      setError('Please enter both website URL and industry')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setResults(null)

    try {
      const competitorsList = competitors
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0)

      const response = await fetch('/api/ai/competitive-benchmarking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetWebsite,
          industry,
          competitors: competitorsList,
          userTier,
          ...analysisOptions
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Benchmarking failed')
      }

      if (data.success) {
        setResults(data.data)
        onAnalysisComplete?.(data.data)
      } else {
        throw new Error(data.error || 'Benchmarking failed')
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benchmarking analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-volt-600'
    return 'text-red-600'
  }

  const getPositionBadgeColor = (position: string) => {
    switch (position) {
      case 'leader': return 'bg-green-100 text-green-800'
      case 'challenger': return 'bg-blue-100 text-blue-800'
      case 'follower': return 'bg-volt-100 text-volt-800'
      case 'niche': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-volt-100 text-volt-800 border-volt-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'high': return '🚀'
      case 'medium': return '📈'
      case 'low': return '📊'
      default: return '📋'
    }
  }

  return (
    <ErrorBoundary>
      <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                📊 <span>Competitive Benchmarking</span>
              </h2>
              <p className="text-gray-600 mt-2">
                Analyze your competitive position and identify strategic opportunities
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                userTier === 'enterprise' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {userTier === 'enterprise' ? 'Enterprise' : 'Professional'}
              </span>
            </div>
          </div>
        </div>

        {/* Analysis Form */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input Fields */}
            <div className="space-y-4">
              <div>
                <label htmlFor="target-website" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Website URL *
                </label>
                <input
                  id="target-website"
                  type="url"
                  value={targetWebsite}
                  onChange={(e) => setTargetWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isAnalyzing}
                />
              </div>

              <div>
                <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
                  Industry/Market *
                </label>
                <input
                  id="industry"
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g., SaaS, E-commerce, Digital Marketing"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isAnalyzing}
                />
              </div>

              <div>
                <label htmlFor="competitors" className="block text-sm font-medium text-gray-700 mb-2">
                  Known Competitors (Optional)
                </label>
                <textarea
                  id="competitors"
                  value={competitors}
                  onChange={(e) => setCompetitors(e.target.value)}
                  placeholder="competitor1.com, competitor2.com, competitor3.com"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isAnalyzing}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Separate multiple competitors with commas. Leave blank for auto-discovery.
                </p>
              </div>
            </div>

            {/* Analysis Options */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Analysis Options</h3>
              
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={analysisOptions.includeTrafficEstimates}
                    onChange={(e) => setAnalysisOptions(prev => ({
                      ...prev,
                      includeTrafficEstimates: e.target.checked
                    }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isAnalyzing}
                  />
                  <span className="ml-2 text-sm text-gray-700">Include Traffic Estimates</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={analysisOptions.includeContentStrategy}
                    onChange={(e) => setAnalysisOptions(prev => ({
                      ...prev,
                      includeContentStrategy: e.target.checked
                    }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isAnalyzing}
                  />
                  <span className="ml-2 text-sm text-gray-700">Content Strategy Analysis</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={analysisOptions.includeTechnicalSEO}
                    onChange={(e) => setAnalysisOptions(prev => ({
                      ...prev,
                      includeTechnicalSEO: e.target.checked
                    }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isAnalyzing}
                  />
                  <span className="ml-2 text-sm text-gray-700">Technical SEO Metrics</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={analysisOptions.includeBacklinkAnalysis}
                    onChange={(e) => setAnalysisOptions(prev => ({
                      ...prev,
                      includeBacklinkAnalysis: e.target.checked
                    }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isAnalyzing || userTier !== 'enterprise'}
                  />
                  <span className={`ml-2 text-sm ${userTier === 'enterprise' ? 'text-gray-700' : 'text-gray-400'}`}>
                    Backlink Analysis {userTier !== 'enterprise' && '(Enterprise Only)'}
                  </span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Analysis Depth
                  </label>
                  <select
                    value={analysisOptions.benchmarkingDepth}
                    onChange={(e) => setAnalysisOptions(prev => ({
                      ...prev,
                      benchmarkingDepth: e.target.value as 'basic' | 'advanced' | 'comprehensive'
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isAnalyzing}
                  >
                    <option value="basic">Basic Analysis</option>
                    <option value="advanced">Advanced Analysis</option>
                    {userTier === 'enterprise' && (
                      <option value="comprehensive">Comprehensive Analysis</option>
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !targetWebsite.trim() || !industry.trim()}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Analyzing Competitors...
                </>
              ) : (
                <>
                  📊 Start Competitive Analysis
                </>
              )}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-red-600">⚠️</span>
                <p className="text-red-700 font-medium">Analysis Failed</p>
              </div>
              <p className="text-red-600 mt-1">{error}</p>
            </div>
          )}
        </div>

        {/* Results Display */}
        {results && (
          <div className="border-t border-gray-200">
            {/* Overall Summary */}
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(results.overallScore)}`}>
                    {results.overallScore}/100
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Overall Score</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    #{results.ranking}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Market Ranking</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {results.totalCompetitorsAnalyzed}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Competitors Analyzed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {results.recommendations.length}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Recommendations</div>
                </div>
              </div>
            </div>

            {/* SWOT Analysis */}
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">🎯 SWOT Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-2">💪 Strengths</h4>
                    <ul className="space-y-1">
                      {results.benchmarkSummary.strengths.map((strength, index) => (
                        <li key={index} className="text-green-700 text-sm flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">🎯 Opportunities</h4>
                    <ul className="space-y-1">
                      {results.benchmarkSummary.opportunities.map((opportunity, index) => (
                        <li key={index} className="text-blue-700 text-sm flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          {opportunity}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-800 mb-2">⚠️ Weaknesses</h4>
                    <ul className="space-y-1">
                      {results.benchmarkSummary.weaknesses.map((weakness, index) => (
                        <li key={index} className="text-red-700 text-sm flex items-start gap-2">
                          <span className="text-red-500 mt-1">•</span>
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-volt-50 p-4 rounded-lg border border-volt-200">
                    <h4 className="font-semibold text-volt-800 mb-2">⚡ Threats</h4>
                    <ul className="space-y-1">
                      {results.benchmarkSummary.threats.map((threat, index) => (
                        <li key={index} className="text-volt-700 text-sm flex items-start gap-2">
                          <span className="text-volt-500 mt-1">•</span>
                          {threat}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Competitor Comparison */}
            <div className="p-6 border-t border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4">🏆 Competitor Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Competitor</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Score</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Position</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Traffic</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Content</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Technical</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Key Strengths</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {results.competitorComparison.slice(0, 5).map((competitor, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium text-gray-900">{competitor.companyName}</div>
                            <div className="text-sm text-gray-500">{competitor.domain}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${getScoreColor(competitor.overallScore)}`}>
                            {competitor.overallScore}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPositionBadgeColor(competitor.marketPosition)}`}>
                            {competitor.marketPosition}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${getScoreColor(competitor.metrics.trafficScore)}`}>
                            {competitor.metrics.trafficScore}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${getScoreColor(competitor.metrics.contentScore)}`}>
                            {competitor.metrics.contentScore}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${getScoreColor(competitor.metrics.technicalScore)}`}>
                            {competitor.metrics.technicalScore}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {competitor.keyStrengths.slice(0, 2).map((strength, i) => (
                              <div key={i} className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                {strength}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Strategic Recommendations */}
            <div className="p-6 border-t border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4">🚀 Strategic Recommendations</h3>
              <div className="space-y-6">
                {results.recommendations.map((category, categoryIndex) => (
                  <div key={categoryIndex} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-gray-800 capitalize">
                        {category.category} Strategy
                      </h4>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(category.priority)}`}>
                        {category.priority} Priority
                      </span>
                    </div>
                    
                    <div className="grid gap-4">
                      {category.recommendations.map((rec, recIndex) => (
                        <div key={recIndex} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="flex items-start justify-between mb-3">
                            <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                              {getImpactIcon(rec.estimatedImpact)}
                              {rec.title}
                            </h5>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                                {rec.timeToImplement}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${rec.estimatedImpact === 'high' ? 'bg-green-100 text-green-800' : rec.estimatedImpact === 'medium' ? 'bg-volt-100 text-volt-800' : 'bg-blue-100 text-blue-800'}`}>
                                {rec.estimatedImpact} impact
                              </span>
                            </div>
                          </div>
                          
                          <p className="text-gray-700 mb-3">{rec.description}</p>
                          
                          <div className="bg-white p-3 rounded border border-gray-200 mb-3">
                            <h6 className="font-medium text-gray-800 mb-2">Implementation Guide:</h6>
                            <p className="text-sm text-gray-600">{rec.implementation}</p>
                          </div>
                          
                          <div className="flex flex-wrap gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Resources:</span>
                              <span className="text-gray-600 ml-2">{rec.resourcesRequired.join(', ')}</span>
                            </div>
                            
                            <div>
                              <span className="font-medium text-gray-700">Success Metrics:</span>
                              <span className="text-gray-600 ml-2">{rec.successMetrics.join(', ')}</span>
                            </div>
                          </div>
                          
                          {rec.competitors.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <span className="text-xs text-gray-500">
                                Leading competitors: {rec.competitors.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}