'use client'

import { useState, useMemo } from 'react'
import { BusinessIntelligence } from '../../lib/types/business-intelligence'

interface CompetitiveData {
  marketPosition: number
  competitorMovement: { competitor: string; change: number }[]
  marketGapOpportunities: string[]
  competitiveAdvantages: string[]
}

interface CompetitorInsight {
  id: string
  competitor: string
  change: 'up' | 'down' | 'stable'
  impact: 'high' | 'medium' | 'low'
  description: string
  actionRequired: string
  lastUpdated: string
}

interface CompetitivePositioningTrackerProps {
  competitiveData: CompetitiveData
  businessIntelligence: BusinessIntelligence | null
  onRefresh: () => void
}

export function CompetitivePositioningTracker({
  competitiveData,
  businessIntelligence,
  onRefresh
}: CompetitivePositioningTrackerProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d'>('30d')
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'threats'>('overview')

  // Generate mock competitor insights for demonstration
  const competitorInsights: CompetitorInsight[] = useMemo(() => [
    {
      id: '1',
      competitor: 'CompetitorA',
      change: 'up',
      impact: 'high',
      description: 'Launched new feature set targeting enterprise customers. Improved search rankings for 12 key terms.',
      actionRequired: 'Review feature parity and accelerate product roadmap',
      lastUpdated: '2 hours ago'
    },
    {
      id: '2',
      competitor: 'CompetitorB',
      change: 'down',
      impact: 'medium',
      description: 'Recent pricing changes led to customer churn. Market share decreased 3.2%.',
      actionRequired: 'Consider competitive pricing strategy',
      lastUpdated: '5 hours ago'
    },
    {
      id: '3',
      competitor: 'CompetitorC',
      change: 'stable',
      impact: 'low',
      description: 'Maintaining current market position. No significant changes in strategy.',
      actionRequired: 'Monitor for new initiatives',
      lastUpdated: '1 day ago'
    }
  ], [])

  const marketPositionTrend = useMemo(() => {
    // Mock trend data - in reality would come from analytics
    return [
      { period: '7d ago', position: 6, score: 65 },
      { period: '30d ago', position: 5, score: 68 },
      { period: '60d ago', position: 4, score: 72 },
      { period: 'Current', position: competitiveData.marketPosition, score: 75 }
    ]
  }, [competitiveData.marketPosition])

  const competitiveStrengths = useMemo(() => {
    if (!businessIntelligence) return []
    return [
      { strength: 'Technology Innovation', score: 92, trend: 'up' },
      { strength: 'Customer Support', score: 88, trend: 'stable' },
      { strength: 'Market Presence', score: 74, trend: 'up' },
      { strength: 'Pricing Strategy', score: 67, trend: 'down' },
      { strength: 'Brand Recognition', score: 71, trend: 'up' }
    ]
  }, [businessIntelligence])

  const directoryCompetitiveAnalysis = useMemo(() => {
    return [
      { directory: 'G2', yourRanking: 3, competitorRanking: 1, opportunity: 'High', action: 'Increase reviews' },
      { directory: 'Capterra', yourRanking: 2, competitorRanking: 4, opportunity: 'Medium', action: 'Maintain position' },
      { directory: 'TrustPilot', yourRanking: 5, competitorRanking: 2, opportunity: 'High', action: 'Improve rating' },
      { directory: 'Software Advice', yourRanking: 4, competitorRanking: 3, opportunity: 'Medium', action: 'Optimize listing' }
    ]
  }, [])

  const getChangeIcon = (change: string) => {
    switch (change) {
      case 'up': return '📈'
      case 'down': return '📉'
      default: return '➡️'
    }
  }

  const getChangeColor = (change: string) => {
    switch (change) {
      case 'up': return 'text-success-400'
      case 'down': return 'text-danger-400'
      default: return 'text-secondary-400'
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-danger-500/10 border-danger-500/30 text-danger-400'
      case 'medium': return 'bg-warning-500/10 border-warning-500/30 text-warning-400'
      default: return 'bg-secondary-700 border-secondary-600 text-secondary-400'
    }
  }

  const getOpportunityColor = (opportunity: string) => {
    switch (opportunity) {
      case 'High': return 'text-success-400 bg-success-500/10'
      case 'Medium': return 'text-warning-400 bg-warning-500/10'
      default: return 'text-secondary-400 bg-secondary-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
              🎯 Competitive Positioning Tracker
            </h2>
            <p className="text-secondary-400">
              Real-time competitive intelligence and market positioning analysis
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <select 
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as typeof selectedTimeframe)}
              className="bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
            
            <div className="flex bg-secondary-700 rounded-lg p-1">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'detailed', label: 'Detailed' },
                { key: 'threats', label: 'Threats' }
              ].map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => setViewMode(mode.key as typeof viewMode)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    viewMode === mode.key
                      ? 'bg-volt-500 text-secondary-900'
                      : 'text-secondary-400 hover:text-secondary-300'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Current Market Position */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-black text-volt-400 mb-2">
              #{competitiveData.marketPosition}
            </div>
            <div className="text-sm text-secondary-400 mb-1">Market Rank</div>
            <div className="text-xs text-success-400">↑ 2 positions</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-black text-success-400 mb-2">
              75%
            </div>
            <div className="text-sm text-secondary-400 mb-1">Competitive Score</div>
            <div className="text-xs text-success-400">+5.2% this month</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-black text-warning-400 mb-2">
              {competitiveData.competitiveAdvantages.length}
            </div>
            <div className="text-sm text-secondary-400 mb-1">Key Advantages</div>
            <div className="text-xs text-secondary-400">vs. top competitors</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-black text-volt-400 mb-2">
              {competitiveData.marketGapOpportunities.length}
            </div>
            <div className="text-sm text-secondary-400 mb-1">Market Gaps</div>
            <div className="text-xs text-volt-400">Opportunities identified</div>
          </div>
        </div>
      </div>

      {viewMode === 'overview' && (
        <>
          {/* Market Position Trend */}
          <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Market Position Trend</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {marketPositionTrend.map((point, index) => (
                <div key={index} className="text-center p-4 bg-secondary-700 rounded-lg">
                  <div className="text-2xl font-bold text-volt-400 mb-1">#{point.position}</div>
                  <div className="text-sm text-secondary-400 mb-2">{point.period}</div>
                  <div className="w-full bg-secondary-600 rounded-full h-2">
                    <div 
                      className="bg-volt-400 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${point.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Competitive Advantages vs Weaknesses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                💪 Competitive Strengths
              </h3>
              <div className="space-y-4">
                {competitiveStrengths.map((strength, index) => (
                  <div key={index} className="bg-secondary-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white">{strength.strength}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${getChangeColor(strength.trend)}`}>
                          {getChangeIcon(strength.trend)}
                        </span>
                        <span className="text-lg font-bold text-volt-400">{strength.score}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-secondary-600 rounded-full h-2">
                      <div 
                        className="bg-volt-400 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${strength.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                🎯 Market Opportunities
              </h3>
              <div className="space-y-3">
                {competitiveData.marketGapOpportunities.map((gap, index) => (
                  <div key={index} className="bg-success-500/10 border border-success-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-success-400 mt-1">💡</span>
                      <div>
                        <p className="text-white text-sm font-medium mb-1">{gap}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-success-500 text-white px-2 py-1 rounded">
                            High Priority
                          </span>
                          <span className="text-xs text-success-400">
                            Est. Impact: +15% market share
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {viewMode === 'detailed' && (
        <>
          {/* Directory Competitive Analysis */}
          <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              📊 Directory Competitive Analysis
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-secondary-700">
                    <th className="text-left py-3 px-4 text-secondary-400 font-medium">Directory</th>
                    <th className="text-center py-3 px-4 text-secondary-400 font-medium">Your Rank</th>
                    <th className="text-center py-3 px-4 text-secondary-400 font-medium">Top Competitor</th>
                    <th className="text-center py-3 px-4 text-secondary-400 font-medium">Opportunity</th>
                    <th className="text-left py-3 px-4 text-secondary-400 font-medium">Recommended Action</th>
                  </tr>
                </thead>
                <tbody>
                  {directoryCompetitiveAnalysis.map((row, index) => (
                    <tr key={index} className="border-b border-secondary-700/50">
                      <td className="py-4 px-4">
                        <span className="font-medium text-white">{row.directory}</span>
                      </td>
                      <td className="text-center py-4 px-4">
                        <span className="bg-volt-500/10 text-volt-400 px-2 py-1 rounded text-sm">
                          #{row.yourRanking}
                        </span>
                      </td>
                      <td className="text-center py-4 px-4">
                        <span className="bg-danger-500/10 text-danger-400 px-2 py-1 rounded text-sm">
                          #{row.competitorRanking}
                        </span>
                      </td>
                      <td className="text-center py-4 px-4">
                        <span className={`px-2 py-1 rounded text-sm ${getOpportunityColor(row.opportunity)}`}>
                          {row.opportunity}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-secondary-300">
                        {row.action}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Competitive Strengths Detail */}
          <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Detailed Competitive Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-white mb-3">Your Advantages</h4>
                <div className="space-y-2">
                  {competitiveData.competitiveAdvantages.map((advantage, index) => (
                    <div key={index} className="bg-success-500/10 border border-success-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-success-400">✅</span>
                        <span className="text-sm text-white">{advantage}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Competitor Movements</h4>
                <div className="space-y-2">
                  {competitiveData.competitorMovement.map((movement, index) => (
                    <div key={index} className="bg-secondary-700 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white">{movement.competitor}</span>
                        <div className="flex items-center gap-1">
                          <span className={`${getChangeColor(movement.change > 0 ? 'up' : movement.change < 0 ? 'down' : 'stable')}`}>
                            {getChangeIcon(movement.change > 0 ? 'up' : movement.change < 0 ? 'down' : 'stable')}
                          </span>
                          <span className="text-sm text-secondary-400">
                            {Math.abs(movement.change)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Market Intelligence</h4>
                <div className="space-y-3">
                  <div className="bg-volt-500/10 border border-volt-500/30 rounded-lg p-3">
                    <div className="text-sm font-medium text-white mb-1">Market Share Growth</div>
                    <div className="text-volt-400 font-bold">+2.3%</div>
                    <div className="text-xs text-secondary-400">vs. last quarter</div>
                  </div>
                  <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-3">
                    <div className="text-sm font-medium text-white mb-1">Competitive Pressure</div>
                    <div className="text-warning-400 font-bold">Medium</div>
                    <div className="text-xs text-secondary-400">2 new entrants</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {viewMode === 'threats' && (
        <>
          {/* Competitor Insights & Threats */}
          <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              🚨 Competitive Threats & Insights
            </h3>
            <div className="space-y-4">
              {competitorInsights.map((insight) => (
                <div key={insight.id} className={`rounded-lg border p-4 ${getImpactColor(insight.impact)}`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getChangeIcon(insight.change)}</span>
                      <div>
                        <h4 className="font-semibold text-white">{insight.competitor}</h4>
                        <span className="text-xs px-2 py-1 rounded bg-secondary-700 text-secondary-300">
                          {insight.impact.toUpperCase()} IMPACT
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-secondary-400">{insight.lastUpdated}</span>
                  </div>
                  
                  <p className="text-sm text-secondary-300 mb-3">{insight.description}</p>
                  
                  <div className="bg-secondary-700 rounded-lg p-3">
                    <div className="text-xs font-medium text-secondary-400 mb-1">RECOMMENDED ACTION:</div>
                    <div className="text-sm text-white">{insight.actionRequired}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alert Settings */}
          <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Competitive Alert Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-white mb-3">Monitor These Competitors</h4>
                <div className="space-y-2">
                  {['CompetitorA', 'CompetitorB', 'CompetitorC', 'NewEntrant'].map((competitor, index) => (
                    <div key={index} className="flex items-center justify-between bg-secondary-700 rounded-lg p-3">
                      <span className="text-white">{competitor}</span>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-sm text-secondary-400">Active</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Alert Triggers</h4>
                <div className="space-y-3">
                  <div className="bg-secondary-700 rounded-lg p-3">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" defaultChecked />
                      <div>
                        <div className="text-sm font-medium text-white">Ranking Changes</div>
                        <div className="text-xs text-secondary-400">Alert when competitors move ±3 positions</div>
                      </div>
                    </label>
                  </div>
                  <div className="bg-secondary-700 rounded-lg p-3">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" defaultChecked />
                      <div>
                        <div className="text-sm font-medium text-white">New Directory Listings</div>
                        <div className="text-xs text-secondary-400">Monitor competitor directory presence</div>
                      </div>
                    </label>
                  </div>
                  <div className="bg-secondary-700 rounded-lg p-3">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" />
                      <div>
                        <div className="text-sm font-medium text-white">Pricing Changes</div>
                        <div className="text-xs text-secondary-400">Track competitor pricing updates</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Action Panel */}
      <div className="bg-gradient-to-r from-volt-500/10 to-volt-400/10 border border-volt-500/30 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Take Action on Competitive Intelligence</h3>
            <p className="text-secondary-400 text-sm mt-1">
              Use these insights to improve your market position
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onRefresh}
              className="bg-volt-500 text-secondary-900 px-4 py-2 rounded-lg font-medium text-sm hover:bg-volt-400 transition-colors"
            >
              🔄 Refresh Data
            </button>
            <button className="bg-secondary-700 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-secondary-600 transition-colors">
              📊 Export Report
            </button>
            <button className="bg-secondary-700 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-secondary-600 transition-colors">
              ⚙️ Configure Alerts
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompetitivePositioningTracker