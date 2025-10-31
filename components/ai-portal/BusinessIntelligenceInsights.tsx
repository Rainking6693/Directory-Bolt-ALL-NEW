'use client'

import { useState, useMemo } from 'react'
import { BusinessIntelligence } from '../../lib/types/business-intelligence'

interface RealTimeMetrics {
  directoryVisibility: number
  searchRankings: { keyword: string; position: number; change: number }[]
  trafficGrowth: number
  leadGeneration: number
  brandMentions: number
}

interface PerformanceMetrics {
  submissionSuccessRate: number
  averageApprovalTime: number
  directoryTrafficContribution: number
  conversionRateImprovement: number
  seoScoreImprovement: number
}

interface CompetitiveData {
  marketPosition: number
  competitorMovement: { competitor: string; change: number }[]
  marketGapOpportunities: string[]
  competitiveAdvantages: string[]
}

interface AIGeneratedInsight {
  id: string
  type: 'opportunity' | 'alert' | 'recommendation' | 'trend'
  title: string
  description: string
  actionItems: string[]
  priority: 'high' | 'medium' | 'low'
  category: 'seo' | 'competitive' | 'directory' | 'market'
  impact: number
  confidence: number
  generatedAt: string
  expiresAt?: string
}

interface AIPortalData {
  businessIntelligence: BusinessIntelligence | null
  lastAnalysisUpdate: string
  realTimeMetrics: RealTimeMetrics
  competitiveData: CompetitiveData
  performanceMetrics: PerformanceMetrics
  insights: AIGeneratedInsight[]
}

interface BusinessIntelligenceInsightsProps {
  data: AIPortalData
  onRefresh: () => void
  isLoading: boolean
}

export function BusinessIntelligenceInsights({
  data,
  onRefresh,
  isLoading
}: BusinessIntelligenceInsightsProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'24h' | '7d' | '30d' | '90d'>('7d')

  const intelligenceScore = useMemo(() => {
    if (!data.businessIntelligence) return 0
    return Math.round((
      data.businessIntelligence.confidence + 
      data.businessIntelligence.qualityScore + 
      data.performanceMetrics.submissionSuccessRate
    ) / 3)
  }, [data.businessIntelligence, data.performanceMetrics])

  const marketOpportunityScore = useMemo(() => {
    if (!data.businessIntelligence) return 0
    return Math.round((
      data.businessIntelligence.successMetrics.visibilityScore +
      data.businessIntelligence.successMetrics.authorityScore +
      data.businessIntelligence.successMetrics.competitiveAdvantage
    ) / 3)
  }, [data.businessIntelligence])

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success-400'
    if (score >= 60) return 'text-warning-400'
    return 'text-danger-400'
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-success-500/10 border-success-500/30 text-success-400'
    if (score >= 60) return 'bg-warning-500/10 border-warning-500/30 text-warning-400'
    return 'bg-danger-500/10 border-danger-500/30 text-danger-400'
  }

  const getTrendIcon = (change: number) => {
    if (change > 0) return '📈'
    if (change < 0) return '📉'
    return '➡️'
  }

  const formatChange = (change: number) => {
    const sign = change > 0 ? '+' : ''
    return `${sign}${change.toFixed(1)}%`
  }

  if (!data.businessIntelligence) {
    return (
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6 text-center">
        <div className="mb-4">
          <span className="text-4xl">🧠</span>
        </div>
        <h3 className="text-lg font-bold text-white mb-2">AI Analysis Pending</h3>
        <p className="text-secondary-400 mb-4">
          Your business intelligence analysis is being processed. This may take a few moments.
        </p>
        <button 
          onClick={onRefresh}
          disabled={isLoading}
          className="btn-primary"
        >
          {isLoading ? 'Processing...' : 'Check Status'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Main Intelligence Overview */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🧠 Real-Time Business Intelligence
          </h2>
          <div className="flex items-center gap-2">
            <select 
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as typeof selectedTimeframe)}
              className="bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-1 text-sm text-white"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </div>

        {/* Key Intelligence Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="text-center">
            <div className={`text-3xl font-black ${getScoreColor(intelligenceScore)} mb-2`}>
              {intelligenceScore}%
            </div>
            <div className="text-sm text-secondary-400">Intelligence Score</div>
            <div className={`inline-block px-2 py-1 rounded text-xs mt-2 border ${getScoreBadgeColor(intelligenceScore)}`}>
              {intelligenceScore >= 80 ? 'Excellent' : intelligenceScore >= 60 ? 'Good' : 'Needs Improvement'}
            </div>
          </div>

          <div className="text-center">
            <div className={`text-3xl font-black ${getScoreColor(marketOpportunityScore)} mb-2`}>
              {marketOpportunityScore}%
            </div>
            <div className="text-sm text-secondary-400">Market Opportunity</div>
            <div className="text-xs text-secondary-500 mt-1">
              {data.businessIntelligence.directoryOpportunities.totalDirectories} directories identified
            </div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-black text-volt-400 mb-2 flex items-center justify-center gap-1">
              {getTrendIcon(data.realTimeMetrics.trafficGrowth)}
              {formatChange(data.realTimeMetrics.trafficGrowth)}
            </div>
            <div className="text-sm text-secondary-400">Traffic Growth</div>
            <div className="text-xs text-secondary-500 mt-1">
              vs. previous {selectedTimeframe}
            </div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-black text-success-400 mb-2">
              {data.realTimeMetrics.leadGeneration}
            </div>
            <div className="text-sm text-secondary-400">New Leads</div>
            <div className="text-xs text-secondary-500 mt-1">
              {formatChange(18.7)} from directories
            </div>
          </div>
        </div>

        {/* Market Position Status */}
        <div className="bg-secondary-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Market Position Analysis</h3>
            <span className="text-xs text-secondary-400">Updated 2 minutes ago</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-secondary-400 mb-1">Current Position</div>
              <div className="text-white font-medium">
                {data.businessIntelligence.marketPositioning.currentPosition}
              </div>
              <div className="text-xs text-volt-400 mt-1">
                Rank #{data.competitiveData.marketPosition} in category
              </div>
            </div>
            
            <div>
              <div className="text-sm text-secondary-400 mb-1">Visibility Score</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-secondary-600 rounded-full h-2">
                  <div 
                    className="bg-volt-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${data.businessIntelligence.successMetrics.visibilityScore}%` }}
                  />
                </div>
                <span className="text-sm text-white font-medium">
                  {data.businessIntelligence.successMetrics.visibilityScore}%
                </span>
              </div>
            </div>
            
            <div>
              <div className="text-sm text-secondary-400 mb-1">Authority Score</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-secondary-600 rounded-full h-2">
                  <div 
                    className="bg-success-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${data.businessIntelligence.successMetrics.authorityScore}%` }}
                  />
                </div>
                <span className="text-sm text-white font-medium">
                  {data.businessIntelligence.successMetrics.authorityScore}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Directory Performance */}
        <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            📁 Directory Performance
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-secondary-700 rounded-lg">
              <div>
                <div className="font-medium text-white">Success Rate</div>
                <div className="text-sm text-secondary-400">Directory submissions</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-success-400">
                  {data.performanceMetrics.submissionSuccessRate}%
                </div>
                <div className="text-xs text-success-400">+5.2% this week</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-secondary-700 rounded-lg">
              <div>
                <div className="font-medium text-white">Avg. Approval Time</div>
                <div className="text-sm text-secondary-400">Days to go live</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-volt-400">
                  {data.performanceMetrics.averageApprovalTime} days
                </div>
                <div className="text-xs text-volt-400">-2.1 days improved</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-secondary-700 rounded-lg">
              <div>
                <div className="font-medium text-white">Traffic Contribution</div>
                <div className="text-sm text-secondary-400">From directories</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-volt-400">
                  {data.performanceMetrics.directoryTrafficContribution}%
                </div>
                <div className="text-xs text-success-400">+8.3% growth</div>
              </div>
            </div>
          </div>
        </div>

        {/* SEO Intelligence */}
        <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            🎯 SEO Intelligence
          </h3>

          <div className="space-y-4">
            <div className="p-3 bg-secondary-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-white">Overall SEO Score</span>
                <span className="text-xl font-bold text-success-400">
                  {data.businessIntelligence.seoAnalysis.currentScore}%
                </span>
              </div>
              <div className="flex-1 bg-secondary-600 rounded-full h-2">
                <div 
                  className="bg-success-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${data.businessIntelligence.seoAnalysis.currentScore}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-secondary-700 rounded-lg">
                <div className="text-sm text-secondary-400 mb-1">Technical SEO</div>
                <div className="text-lg font-bold text-white">
                  {data.businessIntelligence.seoAnalysis.technicalSEO.pageSpeed}%
                </div>
              </div>
              <div className="p-3 bg-secondary-700 rounded-lg">
                <div className="text-sm text-secondary-400 mb-1">Content SEO</div>
                <div className="text-lg font-bold text-white">
                  {data.businessIntelligence.seoAnalysis.contentSEO.titleOptimization}%
                </div>
              </div>
            </div>

            {/* Top Keyword Performance */}
            <div>
              <div className="text-sm font-medium text-secondary-400 mb-2">Top Keywords</div>
              <div className="space-y-2">
                {data.realTimeMetrics.searchRankings.slice(0, 3).map((ranking, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-white">{ranking.keyword}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-secondary-400">#{ranking.position}</span>
                      <span className={`text-xs ${ranking.change > 0 ? 'text-success-400' : ranking.change < 0 ? 'text-danger-400' : 'text-secondary-400'}`}>
                        {ranking.change > 0 ? '↑' : ranking.change < 0 ? '↓' : '→'} {Math.abs(ranking.change)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Competitive Intelligence Summary */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          ⚔️ Competitive Intelligence
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-semibold text-white mb-3">Market Gaps</h4>
            <div className="space-y-2">
              {data.competitiveData.marketGapOpportunities.slice(0, 3).map((gap, index) => (
                <div key={index} className="text-sm text-secondary-300 bg-secondary-700 rounded-lg p-3">
                  {gap}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">Competitive Advantages</h4>
            <div className="space-y-2">
              {data.competitiveData.competitiveAdvantages.slice(0, 3).map((advantage, index) => (
                <div key={index} className="text-sm text-success-300 bg-success-500/10 rounded-lg p-3 border border-success-500/20">
                  ✓ {advantage}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">Competitor Movement</h4>
            <div className="space-y-2">
              {data.competitiveData.competitorMovement.map((movement, index) => (
                <div key={index} className="flex items-center justify-between text-sm bg-secondary-700 rounded-lg p-3">
                  <span className="text-white">{movement.competitor}</span>
                  <span className={`font-medium ${movement.change > 0 ? 'text-danger-400' : movement.change < 0 ? 'text-success-400' : 'text-secondary-400'}`}>
                    {movement.change > 0 ? '↑' : movement.change < 0 ? '↓' : '→'} {Math.abs(movement.change)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-volt-500/10 to-volt-400/10 border border-volt-500/30 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          ⚡ Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          <button className="bg-volt-500 text-secondary-900 px-4 py-2 rounded-lg font-medium text-sm hover:bg-volt-400 transition-colors">
            🔄 Refresh Analysis
          </button>
          <button className="bg-secondary-700 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-secondary-600 transition-colors">
            📊 Generate Report
          </button>
          <button className="bg-secondary-700 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-secondary-600 transition-colors">
            📈 View Trends
          </button>
          <button className="bg-secondary-700 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-secondary-600 transition-colors">
            🎯 Optimize Strategy
          </button>
        </div>
      </div>
    </div>
  )
}

export default BusinessIntelligenceInsights