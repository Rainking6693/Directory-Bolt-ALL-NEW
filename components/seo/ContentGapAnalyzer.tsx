import React, { useState } from 'react'
import { LoadingState } from '../ui/LoadingState'
import { ErrorBoundary } from '../ui/ErrorBoundary'

interface ContentGapAnalysisProps {
  userTier: 'professional' | 'enterprise'
  onAnalysisComplete?: (results: any) => void
  className?: string
}

interface AnalysisResults {
  targetWebsite: string
  competitors: CompetitorContent[]
  contentGaps: ContentGap[]
  blogPostIdeas: BlogPostIdea[]
  faqSuggestions: FAQSuggestion[]
  keywordClusters: KeywordCluster[]
  analysisDate: string
  confidence: number
  processingTime: number
}

interface CompetitorContent {
  domain: string
  name: string
  topPages: ContentPage[]
  contentThemes: string[]
  averageWordCount: number
  publishingFrequency: string
  strongestTopics: string[]
}

interface ContentGap {
  topic: string
  opportunity: string
  priority: 'high' | 'medium' | 'low'
  competitorCoverage: number
  estimatedDifficulty: number
  potentialTraffic: number
  reasoning: string
}

interface BlogPostIdea {
  title: string
  description: string
  targetKeywords: string[]
  estimatedWordCount: number
  contentType: 'how-to' | 'comparison' | 'listicle' | 'case-study' | 'industry-insights'
  priority: 'high' | 'medium' | 'low'
  seoOpportunity: number
}

interface FAQSuggestion {
  question: string
  category: string
  searchVolume: number
  difficulty: number
  reasoning: string
}

interface KeywordCluster {
  clusterName: string
  primaryKeyword: string
  relatedKeywords: string[]
  searchVolume: number
  competitionLevel: 'low' | 'medium' | 'high'
  contentOpportunities: string[]
}

interface ContentPage {
  title: string
  url: string
  wordCount: number
  keywordFocus: string[]
  estimatedTraffic: number
  contentType: 'blog' | 'landing' | 'product' | 'guide' | 'case-study'
}

export default function ContentGapAnalyzer({ 
  userTier, 
  onAnalysisComplete, 
  className = '' 
}: ContentGapAnalysisProps) {
  const [website, setWebsite] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analysisOptions, setAnalysisOptions] = useState({
    includeKeywordClusters: true,
    includeBlogIdeas: true,
    includeFAQs: true,
    analysisDepth: userTier === 'enterprise' ? 'comprehensive' : 'standard'
  })

  const handleAnalyze = async () => {
    if (!website.trim()) {
      setError('Please enter a website URL')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('/api/ai/content-gap-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetWebsite: website,
          userTier,
          ...analysisOptions
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed')
      }

      if (data.success) {
        setResults(data.data)
        onAnalysisComplete?.(data.data)
      } else {
        throw new Error(data.error || 'Analysis failed')
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-volt-100 text-volt-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCompetitionBadgeColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-volt-100 text-volt-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
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
                🔍 <span>SEO Content Gap Analysis</span>
              </h2>
              <p className="text-gray-600 mt-2">
                Analyze competitor content strategies and discover untapped opportunities
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
          <div className="space-y-4">
            <div>
              <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
                Competitor Website URL
              </label>
              <div className="flex gap-3">
                <input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isAnalyzing}
                />
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>
            </div>

            {/* Analysis Options for Enterprise */}
            {userTier === 'enterprise' && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Analysis Options</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={analysisOptions.includeKeywordClusters}
                      onChange={(e) => setAnalysisOptions(prev => ({ 
                        ...prev, 
                        includeKeywordClusters: e.target.checked 
                      }))}
                      className="rounded border-gray-300 text-blue-600 mr-2"
                    />
                    <span className="text-sm text-gray-700">Keyword Clusters</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={analysisOptions.includeBlogIdeas}
                      onChange={(e) => setAnalysisOptions(prev => ({ 
                        ...prev, 
                        includeBlogIdeas: e.target.checked 
                      }))}
                      className="rounded border-gray-300 text-blue-600 mr-2"
                    />
                    <span className="text-sm text-gray-700">Blog Post Ideas</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={analysisOptions.includeFAQs}
                      onChange={(e) => setAnalysisOptions(prev => ({ 
                        ...prev, 
                        includeFAQs: e.target.checked 
                      }))}
                      className="rounded border-gray-300 text-blue-600 mr-2"
                    />
                    <span className="text-sm text-gray-700">FAQ Suggestions</span>
                  </label>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Analysis Depth</label>
                    <select
                      value={analysisOptions.analysisDepth}
                      onChange={(e) => setAnalysisOptions(prev => ({ 
                        ...prev, 
                        analysisDepth: e.target.value as 'standard' | 'comprehensive'
                      }))}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="standard">Standard</option>
                      <option value="comprehensive">Comprehensive</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Loading State */}
          {isAnalyzing && (
            <div className="mt-6">
              <LoadingState 
                message="Analyzing competitor content and identifying gaps..." 
                variant="spinner"
                size="lg"
              />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <span className="text-red-600 text-2xl mr-3">⚠️</span>
                <div>
                  <h3 className="text-red-800 font-medium">Analysis Failed</h3>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="mt-6 space-y-6">
              {/* Analysis Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{results.competitors.length}</div>
                    <div className="text-sm text-gray-600">Competitors Analyzed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{results.contentGaps.length}</div>
                    <div className="text-sm text-gray-600">Content Gaps Found</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{results.blogPostIdeas.length}</div>
                    <div className="text-sm text-gray-600">Blog Ideas Generated</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{results.confidence}%</div>
                    <div className="text-sm text-gray-600">Confidence Score</div>
                  </div>
                </div>
              </div>

              {/* Content Gaps */}
              {results.contentGaps.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">🎯 Content Gap Opportunities</h3>
                  </div>
                  <div className="p-4">
                    <div className="space-y-4">
                      {results.contentGaps.map((gap, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{gap.topic}</h4>
                              <p className="text-gray-600 text-sm mt-1">{gap.opportunity}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadgeColor(gap.priority)}`}>
                              {gap.priority.toUpperCase()}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Competitor Coverage:</span>
                              <span className="ml-1 font-medium">{gap.competitorCoverage}%</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Difficulty:</span>
                              <span className="ml-1 font-medium">{gap.estimatedDifficulty}/100</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Potential Traffic:</span>
                              <span className="ml-1 font-medium">{gap.potentialTraffic.toLocaleString()}/mo</span>
                            </div>
                          </div>
                          <div className="mt-3 text-sm text-gray-600">
                            <strong>Why this matters:</strong> {gap.reasoning}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Blog Post Ideas */}
              {results.blogPostIdeas.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">📝 Blog Post Ideas</h3>
                  </div>
                  <div className="p-4">
                    <div className="space-y-4">
                      {results.blogPostIdeas.map((idea, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-gray-900 flex-1">{idea.title}</h4>
                            <div className="flex gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadgeColor(idea.priority)}`}>
                                {idea.priority.toUpperCase()}
                              </span>
                              <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                                {idea.contentType}
                              </span>
                            </div>
                          </div>
                          <p className="text-gray-600 text-sm mb-3">{idea.description}</p>
                          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                            <div>
                              <span className="text-gray-500">Estimated Length:</span>
                              <span className="ml-1 font-medium">{idea.estimatedWordCount.toLocaleString()} words</span>
                            </div>
                            <div>
                              <span className="text-gray-500">SEO Opportunity:</span>
                              <span className="ml-1 font-medium">{idea.seoOpportunity}/100</span>
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-sm">Target Keywords:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {idea.targetKeywords.map((keyword, kIndex) => (
                                <span key={kIndex} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* FAQ Suggestions */}
              {results.faqSuggestions.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">❓ FAQ Suggestions</h3>
                  </div>
                  <div className="p-4">
                    <div className="space-y-3">
                      {results.faqSuggestions.map((faq, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-gray-900 flex-1">{faq.question}</h4>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {faq.category}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                            <div>
                              <span className="text-gray-500">Search Volume:</span>
                              <span className="ml-1 font-medium">{faq.searchVolume.toLocaleString()}/mo</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Difficulty:</span>
                              <span className="ml-1 font-medium">{faq.difficulty}/100</span>
                            </div>
                          </div>
                          <p className="text-gray-600 text-sm">{faq.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Keyword Clusters */}
              {results.keywordClusters.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">🔑 Keyword Clusters</h3>
                  </div>
                  <div className="p-4">
                    <div className="grid gap-4">
                      {results.keywordClusters.map((cluster, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-medium text-gray-900">{cluster.clusterName}</h4>
                              <p className="text-sm text-gray-600">Primary: <strong>{cluster.primaryKeyword}</strong></p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-500">Search Volume</div>
                              <div className="font-medium">{cluster.searchVolume.toLocaleString()}/mo</div>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getCompetitionBadgeColor(cluster.competitionLevel)}`}>
                                {cluster.competitionLevel} competition
                              </span>
                            </div>
                          </div>
                          <div className="mb-3">
                            <span className="text-gray-500 text-sm">Related Keywords:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {cluster.relatedKeywords.map((keyword, kIndex) => (
                                <span key={kIndex} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-sm">Content Opportunities:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {cluster.contentOpportunities.map((opportunity, oIndex) => (
                                <span key={oIndex} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                  {opportunity}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Export Options */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-md font-medium text-gray-900 mb-3">Export Analysis</h3>
                <div className="flex gap-3">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                    Download PDF Report
                  </button>
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                    Export to CSV
                  </button>
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                    Schedule Follow-up
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}