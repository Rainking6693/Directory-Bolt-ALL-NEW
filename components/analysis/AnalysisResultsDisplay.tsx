'use client'
import { useState } from 'react'
import { ErrorBoundary } from '../ui/ErrorBoundary'

interface AnalysisData {
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

interface Props {
  data: AnalysisData
  onUpgrade?: () => void
}

export function AnalysisResultsDisplay({ data, onUpgrade }: Props) {
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null)
  const [expandedRecommendation, setExpandedRecommendation] = useState<number | null>(null)

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'critical': return '🔥'
      case 'warning': return '⚠️'
      default: return 'ℹ️'
    }
  }

  const getEffortIcon = (effort: string) => {
    switch (effort) {
      case 'low': return '🎯'
      case 'medium': return '⚡'
      default: return '🚀'
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-success-500/20 text-success-300'
      case 'medium': return 'bg-volt-500/20 text-volt-300'
      default: return 'bg-danger-500/20 text-danger-300'
    }
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 md:space-y-8">
        {/* Key Metrics - Mobile Optimized */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-gradient-to-br from-success-900/30 to-success-800/20 p-3 md:p-4 rounded-xl border border-success-500/30">
            <div className="text-xl md:text-2xl font-bold text-success-400">{Math.round(data.seoScore || 0)}%</div>
            <div className="text-xs md:text-sm text-secondary-400">SEO Score</div>
          </div>
          
          <div className="bg-gradient-to-br from-volt-900/30 to-volt-800/20 p-3 md:p-4 rounded-xl border border-volt-500/30">
            <div className="text-xl md:text-2xl font-bold text-volt-400">{Math.round(data.visibility || 0)}%</div>
            <div className="text-xs md:text-sm text-secondary-400">Visibility</div>
          </div>
          
          <div className="bg-gradient-to-br from-danger-900/30 to-danger-800/20 p-3 md:p-4 rounded-xl border border-danger-500/30">
            <div className="text-xl md:text-2xl font-bold text-danger-400">{data.missedOpportunities}</div>
            <div className="text-xs md:text-sm text-secondary-400">Missed Opps</div>
          </div>
          
          <div className="bg-gradient-to-br from-success-900/30 to-success-800/20 p-3 md:p-4 rounded-xl border border-success-500/30">
            <div className="text-xl md:text-2xl font-bold text-success-400">{(data.potentialLeads || 0).toLocaleString()}</div>
            <div className="text-xs md:text-sm text-secondary-400">Pot. Leads</div>
          </div>
        </div>

        {/* Issues and Recommendations - Mobile Stacked */}
        <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">
          {/* Issues */}
          {data.issues && data.issues.length > 0 && (
            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-danger-500/30 p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-bold text-danger-400 mb-4 flex items-center gap-2">
                ⚠️ Issues Found
                <span className="text-sm text-secondary-400">({data.issues.length})</span>
              </h3>
              
              <div className="space-y-3">
                {data.issues.slice(0, 3).map((issue, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border p-3 ${
                      issue.type === 'critical' 
                        ? 'bg-danger-900/20 border-danger-500/30' 
                        : issue.type === 'warning'
                        ? 'bg-volt-900/20 border-volt-500/30'
                        : 'bg-secondary-700/30 border-secondary-600'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedIssue(expandedIssue === index ? null : index)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start gap-2 md:gap-3">
                        <span className="text-base md:text-lg">{getIssueIcon(issue.type)}</span>
                        <div className="flex-1">
                          <h4 className="font-bold text-white text-sm md:text-base">{issue.title}</h4>
                          {expandedIssue === index && (
                            <div className="mt-2 space-y-2">
                              <p className="text-xs md:text-sm text-secondary-300">{issue.description}</p>
                              <div className="text-xs text-volt-300 font-semibold">Impact: {issue.impact}</div>
                            </div>
                          )}
                        </div>
                        <span className="text-secondary-400 text-sm">
                          {expandedIssue === index ? '−' : '+'}
                        </span>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {data.recommendations && data.recommendations.length > 0 && (
            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-success-500/30 p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-bold text-success-400 mb-4 flex items-center gap-2">
                ✅ Action Items
                <span className="text-sm text-secondary-400">({data.recommendations.length})</span>
              </h3>
              
              <div className="space-y-3">
                {data.recommendations.slice(0, 3).map((rec, index) => (
                  <div key={index} className="bg-success-900/20 rounded-lg p-3 border border-success-500/30">
                    <button
                      onClick={() => setExpandedRecommendation(expandedRecommendation === index ? null : index)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start gap-2 md:gap-3">
                        <span className={`text-base md:text-lg ${
                          rec.effort === 'low' ? 'text-success-400' :
                          rec.effort === 'medium' ? 'text-volt-400' :
                          'text-danger-400'
                        }`}>
                          {getEffortIcon(rec.effort)}
                        </span>
                        <div className="flex-1">
                          <h4 className="font-bold text-white text-sm md:text-base">{rec.action}</h4>
                          {expandedRecommendation === index && (
                            <div className="mt-2 space-y-2">
                              <p className="text-xs md:text-sm text-secondary-300">{rec.impact}</p>
                              <span className="text-xs text-volt-300 font-semibold">Effort: {rec.effort}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-secondary-400 text-sm">
                          {expandedRecommendation === index ? '−' : '+'}
                        </span>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Directory Opportunities - Mobile Optimized */}
        {data.directoryOpportunities && data.directoryOpportunities.length > 0 && (
          <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-volt-500/30 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h3 className="text-lg md:text-xl font-bold text-volt-400 flex items-center gap-2">
                🎯 Directory Opportunities
                <span className="text-sm text-secondary-400">({data.directoryOpportunities.length})</span>
              </h3>
              {onUpgrade && (
                <button
                  onClick={onUpgrade}
                  className="text-sm bg-volt-500/20 hover:bg-volt-500/30 text-volt-400 px-3 py-1 rounded-full border border-volt-500/30 transition-all"
                >
                  View All
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {data.directoryOpportunities.slice(0, 5).map((dir, index) => (
                <div key={index} className="bg-volt-900/20 rounded-lg p-3 md:p-4 border border-volt-500/30">
                  {/* Mobile Layout */}
                  <div className="block md:hidden space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-white text-sm">{index + 1}. {dir.name}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${getDifficultyColor(dir.submissionDifficulty)}`}>
                            {dir.submissionDifficulty || 'Medium'}
                          </span>
                          <span className="px-2 py-1 bg-volt-500/20 text-volt-300 rounded text-xs font-bold">
                            {dir.authority || 0}/100
                          </span>
                          {dir.cost !== undefined && (
                            <span className="px-2 py-1 bg-secondary-700/50 text-secondary-300 rounded text-xs font-bold">
                              {dir.cost === 0 ? 'FREE' : `$${dir.cost}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                        (dir.cost === 0 || dir.cost === undefined)
                          ? 'bg-success-500/20 text-success-400' 
                          : 'bg-volt-500/20 text-volt-400'
                      }`}>
                        {(dir.cost === 0 || dir.cost === undefined) ? '🎯' : '💎'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-secondary-400">Traffic:</span>
                        <div className="text-white font-semibold">{(dir.estimatedTraffic || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-secondary-400">Authority:</span>
                        <div className="text-white font-semibold">{dir.authority || 0}/100</div>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h4 className="font-bold text-white">{index + 1}. {dir.name}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getDifficultyColor(dir.submissionDifficulty)}`}>
                          {dir.submissionDifficulty || 'Medium'}
                        </span>
                        <span className="px-2 py-1 bg-volt-500/20 text-volt-300 rounded text-xs font-bold">
                          Authority: {dir.authority || 0}/100
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-secondary-400">Est. Traffic:</span>
                          <div className="text-white font-semibold">{(dir.estimatedTraffic || 0).toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-secondary-400">Cost:</span>
                          <div className="text-white font-semibold">{(dir.cost === 0 || dir.cost === undefined) ? 'FREE' : `$${dir.cost}`}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                        (dir.cost === 0 || dir.cost === undefined)
                          ? 'bg-success-500/20 text-success-400' 
                          : 'bg-volt-500/20 text-volt-400'
                      }`}>
                        {(dir.cost === 0 || dir.cost === undefined) ? '🎯' : '💎'}
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs ${
                        index < 3 ? 'bg-success-500/20 text-success-400' :
                        index < 6 ? 'bg-volt-500/20 text-volt-400' :
                        'bg-secondary-700/50 text-secondary-400'
                      }`}>
                        {index < 3 ? 'High' : index < 6 ? 'Medium' : 'Low'} Priority
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {data.directoryOpportunities.length > 5 && (
                <div className="text-center pt-4">
                  <p className="text-sm text-volt-400 font-semibold">
                    +{data.directoryOpportunities.length - 5} more opportunities available
                  </p>
                  {onUpgrade && (
                    <button
                      onClick={onUpgrade}
                      className="mt-2 text-sm bg-volt-500/20 hover:bg-volt-500/30 text-volt-400 px-4 py-2 rounded-lg border border-volt-500/30 transition-all"
                    >
                      See All Opportunities
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upgrade CTA - Mobile Optimized */}
        <div className="bg-gradient-to-r from-volt-500/10 to-volt-600/10 rounded-xl border border-volt-500/30 p-4 md:p-6 text-center">
          <div className="text-4xl md:text-6xl mb-4">🚀</div>
          <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
            Want More <span className="text-volt-400">Detailed</span> Results?
          </h3>
          <p className="text-sm md:text-base text-secondary-200 mb-4 md:mb-6">
            Get comprehensive analysis with AI-powered descriptions and success probability scoring
          </p>
          
          {onUpgrade && (
            <button
              onClick={onUpgrade}
              className="w-full sm:w-auto bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-3 px-6 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105"
            >
              Upgrade for Full Analysis
            </button>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}