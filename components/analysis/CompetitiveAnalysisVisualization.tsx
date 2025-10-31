'use client'
import React, { useState, useMemo } from 'react'

// Competitive Analysis Insights Visualization - Phase 2.3 DirectoryBolt AI-Enhanced plan
// Advanced visualization of competitor data and market positioning

interface Competitor {
  name: string
  similarities: string[]
  directoryPresence: string[]
  marketAdvantages: string[]
  estimatedDirectoryCount: number
  marketShare: number
  strengthScore: number
}

interface MarketGap {
  opportunity: string
  impact: 'high' | 'medium' | 'low'
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedValue: number
  description: string
}

interface CompetitiveAnalysisData {
  competitors: Competitor[]
  marketGaps: MarketGap[]
  positioningAdvice: string
  marketSize: number
  yourPosition: {
    rank: number
    score: number
    advantages: string[]
    weaknesses: string[]
  }
  directoryLandscape: {
    totalDirectories: number
    competitorCoverage: number
    yourCoverage: number
    untappedOpportunities: number
  }
}

interface Props {
  data: CompetitiveAnalysisData
  userTier: 'free' | 'professional' | 'enterprise'
  onUpgrade?: () => void
}

export function CompetitiveAnalysisVisualization({ data, userTier, onUpgrade }: Props) {
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null)
  const [activeView, setActiveView] = useState<'overview' | 'gaps' | 'positioning' | 'directories'>('overview')

  const tierLimits = useMemo(() => {
    switch (userTier) {
      case 'free': return { competitors: 2, gaps: 3, insights: 1 }
      case 'professional': return { competitors: 8, gaps: 10, insights: 5 }
      case 'enterprise': return { competitors: 20, gaps: 25, insights: 15 }
      default: return { competitors: 2, gaps: 3, insights: 1 }
    }
  }, [userTier])

  const visibleCompetitors = data.competitors.slice(0, tierLimits.competitors)
  const visibleGaps = data.marketGaps.slice(0, tierLimits.gaps)
  const hiddenCompetitors = Math.max(0, data.competitors.length - tierLimits.competitors)
  const hiddenGaps = Math.max(0, data.marketGaps.length - tierLimits.gaps)

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-success-500/20 text-success-300 border-success-500/30'
      case 'medium': return 'bg-volt-500/20 text-volt-300 border-volt-500/30'
      case 'low': return 'bg-secondary-500/20 text-secondary-300 border-secondary-500/30'
      default: return 'bg-secondary-500/20 text-secondary-300 border-secondary-500/30'
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-success-400'
      case 'medium': return 'text-volt-400'
      case 'hard': return 'text-danger-400'
      default: return 'text-secondary-400'
    }
  }

  const CompetitorCard = ({ competitor, index }: { competitor: Competitor; index: number }) => (
    <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-danger-500/30 p-6 hover:shadow-lg hover:shadow-danger-500/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-danger-500/20 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🏢</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{competitor.name}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-secondary-300">Market Rank: #{index + 2}</span>
              <div className="w-2 h-2 bg-secondary-600 rounded-full"></div>
              <span className="text-sm text-danger-300">Strength: {competitor.strengthScore}/100</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setSelectedCompetitor(selectedCompetitor?.name === competitor.name ? null : competitor)}
          className="text-volt-400 hover:text-volt-300 transition-colors"
        >
          {selectedCompetitor?.name === competitor.name ? '−' : '+'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-danger-400">{competitor.estimatedDirectoryCount}</div>
          <div className="text-xs text-secondary-400">Directories</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-volt-400">{competitor.marketShare}%</div>
          <div className="text-xs text-secondary-400">Market Share</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-success-400">{competitor.directoryPresence.length}</div>
          <div className="text-xs text-secondary-400">Known Listings</div>
        </div>
      </div>

      {selectedCompetitor?.name === competitor.name && (
        <div className="space-y-4 border-t border-secondary-700 pt-4">
          <div>
            <h4 className="font-semibold text-danger-400 mb-2">Similarities to You:</h4>
            <div className="space-y-1">
              {competitor.similarities.map((similarity, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-danger-400 mt-1">•</span>
                  <span className="text-sm text-secondary-300">{similarity}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-volt-400 mb-2">Directory Presence:</h4>
            <div className="flex flex-wrap gap-2">
              {competitor.directoryPresence.map((directory, idx) => (
                <span key={idx} className="px-2 py-1 bg-volt-500/20 text-volt-300 text-xs rounded border border-volt-500/30">
                  {directory}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-success-400 mb-2">Their Advantages:</h4>
            <div className="space-y-1">
              {competitor.marketAdvantages.map((advantage, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-success-400 mt-1">⭐</span>
                  <span className="text-sm text-secondary-300">{advantage}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const MarketGapCard = ({ gap, index }: { gap: MarketGap; index: number }) => (
    <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-success-500/30 p-6 hover:shadow-lg hover:shadow-success-500/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-success-500/20 rounded-lg flex items-center justify-center">
            <span className="text-lg">💡</span>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-white text-lg mb-2">{gap.opportunity}</h4>
            <p className="text-sm text-secondary-300 mb-3">{gap.description}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-success-400">${gap.estimatedValue.toLocaleString()}</div>
          <div className="text-xs text-secondary-400">Est. Value</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getImpactColor(gap.impact)}`}>
            {gap.impact} Impact
          </span>
          <span className={`text-sm font-semibold ${getDifficultyColor(gap.difficulty)}`}>
            {gap.difficulty} to exploit
          </span>
        </div>
        <div className="text-success-400 text-2xl">
          {gap.impact === 'high' ? '🚀' : gap.impact === 'medium' ? '⚡' : '💡'}
        </div>
      </div>
    </div>
  )

  const DirectoryLandscapeView = () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-white">Directory Landscape Analysis</h3>
      
      {/* Coverage Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-success-500/20 to-success-600/10 rounded-xl border border-success-500/30 p-6">
          <div className="text-center">
            <div className="text-4xl font-black text-success-400 mb-2">{data.directoryLandscape.yourCoverage}</div>
            <div className="text-sm text-success-300 font-medium">Your Directory Coverage</div>
            <div className="text-xs text-secondary-400 mt-1">
              {Math.round((data.directoryLandscape.yourCoverage / data.directoryLandscape.totalDirectories) * 100)}% of total market
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-danger-500/20 to-danger-600/10 rounded-xl border border-danger-500/30 p-6">
          <div className="text-center">
            <div className="text-4xl font-black text-danger-400 mb-2">{data.directoryLandscape.competitorCoverage}</div>
            <div className="text-sm text-danger-300 font-medium">Avg. Competitor Coverage</div>
            <div className="text-xs text-secondary-400 mt-1">
              {Math.round((data.directoryLandscape.competitorCoverage / data.directoryLandscape.totalDirectories) * 100)}% of total market
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-volt-500/20 to-volt-600/10 rounded-xl border border-volt-500/30 p-6">
          <div className="text-center">
            <div className="text-4xl font-black text-volt-400 mb-2">{data.directoryLandscape.untappedOpportunities}</div>
            <div className="text-sm text-volt-300 font-medium">Untapped Opportunities</div>
            <div className="text-xs text-secondary-400 mt-1">
              Directories with low competition
            </div>
          </div>
        </div>
      </div>

      {/* Visual Directory Coverage */}
      <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6">
        <h4 className="text-lg font-bold text-white mb-4">Market Coverage Visualization</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary-300">Your Coverage</span>
            <span className="text-sm text-success-400 font-bold">{data.directoryLandscape.yourCoverage} directories</span>
          </div>
          <div className="w-full bg-secondary-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-success-500 to-success-400 h-3 rounded-full transition-all duration-1000"
              style={{ width: `${(data.directoryLandscape.yourCoverage / data.directoryLandscape.totalDirectories) * 100}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary-300">Competitor Average</span>
            <span className="text-sm text-danger-400 font-bold">{data.directoryLandscape.competitorCoverage} directories</span>
          </div>
          <div className="w-full bg-secondary-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-danger-500 to-danger-400 h-3 rounded-full transition-all duration-1000"
              style={{ width: `${(data.directoryLandscape.competitorCoverage / data.directoryLandscape.totalDirectories) * 100}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary-300">Total Market</span>
            <span className="text-sm text-volt-400 font-bold">{data.directoryLandscape.totalDirectories} directories</span>
          </div>
          <div className="w-full bg-secondary-700 rounded-full h-3">
            <div className="bg-gradient-to-r from-volt-500 to-volt-400 h-3 rounded-full w-full"></div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 p-1 bg-secondary-800/50 rounded-xl">
        {[
          { id: 'overview', label: 'Competitor Overview', icon: '🏢' },
          { id: 'gaps', label: 'Market Gaps', icon: '💡' },
          { id: 'positioning', label: 'Strategic Positioning', icon: '🎯' },
          { id: 'directories', label: 'Directory Landscape', icon: '📊' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
              activeView === tab.id
                ? 'bg-volt-500/20 text-volt-400 border border-volt-500/30'
                : 'text-secondary-300 hover:text-white hover:bg-secondary-700/50'
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white">Competitive Landscape</h2>
              <p className="text-secondary-300 mt-1">
                AI-powered analysis of {data.competitors.length} key competitors in your market
              </p>
            </div>
          </div>

          <div className="grid gap-6">
            {visibleCompetitors.map((competitor, index) => (
              <CompetitorCard key={competitor.name} competitor={competitor} index={index} />
            ))}

            {hiddenCompetitors > 0 && (
              <div className="bg-gradient-to-r from-danger-500/10 to-danger-600/10 rounded-xl border border-danger-500/30 p-6 text-center">
                <div className="text-4xl mb-4">🔒</div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {hiddenCompetitors} More Competitor Analysis
                </h3>
                <p className="text-secondary-200 mb-4">
                  Unlock complete competitive intelligence and market positioning insights
                </p>
                {onUpgrade && (
                  <button
                    onClick={onUpgrade}
                    className="bg-gradient-to-r from-danger-500 to-danger-600 text-white font-bold py-3 px-6 rounded-xl hover:from-danger-400 hover:to-danger-500 transition-all duration-300 transform hover:scale-105"
                  >
                    Upgrade for Full Analysis
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'gaps' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white">Market Opportunities</h2>
            <p className="text-secondary-300 mt-1">
              Identified gaps in the market that you can exploit for competitive advantage
            </p>
          </div>

          <div className="grid gap-4">
            {visibleGaps.map((gap, index) => (
              <MarketGapCard key={index} gap={gap} index={index} />
            ))}

            {hiddenGaps > 0 && (
              <div className="bg-gradient-to-r from-success-500/10 to-success-600/10 rounded-xl border border-success-500/30 p-6 text-center">
                <div className="text-4xl mb-4">💰</div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {hiddenGaps} More Market Opportunities
                </h3>
                <p className="text-secondary-200 mb-4">
                  Discover additional high-value opportunities worth ${data.marketGaps.reduce((sum, gap) => sum + gap.estimatedValue, 0).toLocaleString()}+
                </p>
                {onUpgrade && (
                  <button
                    onClick={onUpgrade}
                    className="bg-gradient-to-r from-success-500 to-success-600 text-white font-bold py-3 px-6 rounded-xl hover:from-success-400 hover:to-success-500 transition-all duration-300 transform hover:scale-105"
                  >
                    Unlock All Opportunities
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'positioning' && (
        <div className="space-y-6">
          <h2 className="text-2xl md:text-3xl font-black text-white">Strategic Positioning</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-secondary-800/50 rounded-xl border border-success-500/30 p-6">
              <h3 className="text-xl font-bold text-success-400 mb-4">Your Competitive Advantages</h3>
              <div className="space-y-3">
                {data.yourPosition.advantages.slice(0, tierLimits.insights).map((advantage, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="text-success-400 text-lg">⭐</span>
                    <span className="text-secondary-200">{advantage}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6">
              <h3 className="text-xl font-bold text-volt-400 mb-4">Areas for Improvement</h3>
              <div className="space-y-3">
                {data.yourPosition.weaknesses.slice(0, tierLimits.insights).map((weakness, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="text-volt-400 text-lg">⚠️</span>
                    <span className="text-secondary-200">{weakness}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-volt-500/10 to-volt-600/10 rounded-xl border border-volt-500/30 p-6">
            <h3 className="text-xl font-bold text-volt-400 mb-4">AI Strategic Recommendation</h3>
            <p className="text-secondary-200 leading-relaxed">{data.positioningAdvice}</p>
          </div>
        </div>
      )}

      {activeView === 'directories' && <DirectoryLandscapeView />}
    </div>
  )
}