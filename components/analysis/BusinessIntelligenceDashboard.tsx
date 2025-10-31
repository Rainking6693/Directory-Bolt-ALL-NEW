'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface AnalysisData {
  businessIntelligence: {
    industry: string
    marketPosition: string
    competitiveAdvantage: string[]
    businessSize: 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
    marketFit: number // 0-100
    brandMaturity: number // 0-100
  }
  financialProjections: {
    conservative: { monthly: number; annual: number }
    realistic: { monthly: number; annual: number }
    optimistic: { monthly: number; annual: number }
    roiTimeframe: string
    paybackPeriod: number // in days
  }
  directoryOpportunities: {
    total: number
    highPriority: number
    mediumPriority: number
    lowPriority: number
    successProbability: number // 0-100
    estimatedValue: number
  }
  competitiveAnalysis: {
    marketGaps: string[]
    positioningAdvantages: string[]
    competitorCount: number
    marketSaturation: number // 0-100
    differentiationScore: number // 0-100
  }
  seoAnalysis: {
    technicalScore: number // 0-100
    contentScore: number // 0-100
    authorityScore: number // 0-100
    recommendations: string[]
    quickWins: string[]
  }
}

interface BusinessIntelligenceDashboardProps {
  data: AnalysisData
  userTier: 'free' | 'starter' | 'growth' | 'professional'
  onUpgrade: () => void
}

export default function BusinessIntelligenceDashboard({ 
  data, 
  userTier, 
  onUpgrade 
}: BusinessIntelligenceDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [isAnimating, setIsAnimating] = useState(false)
  
  const isLocked = (feature: string) => {
    const featureMap = {
      'competitive': userTier === 'free',
      'projections': userTier === 'free',
      'seo': userTier === 'free',
      'export': userTier === 'free' || userTier === 'starter'
    }
    return featureMap[feature as keyof typeof featureMap] || false
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success-400 bg-success-500/10 border-success-500/30'
    if (score >= 60) return 'text-volt-400 bg-volt-500/10 border-volt-500/30'
    if (score >= 40) return 'text-orange-400 bg-orange-500/10 border-orange-500/30'
    return 'text-danger-400 bg-danger-500/10 border-danger-500/30'
  }

  const ExecutiveSummaryCard = ({ title, value, subtitle, trend, locked = false }: {
    title: string
    value: string | number
    subtitle: string
    trend?: 'up' | 'down' | 'stable'
    locked?: boolean
  }) => (
    <motion.div
      whileHover={{ scale: locked ? 1 : 1.02 }}
      className={`relative bg-gradient-to-br from-secondary-800/90 to-secondary-900/70 rounded-2xl p-6 border backdrop-blur-sm ${
        locked ? 'border-secondary-600' : 'border-secondary-700 hover:border-volt-500/50'
      } transition-all duration-300`}
    >
      {locked && (
        <div className="absolute inset-0 bg-gradient-to-br from-secondary-900/80 to-secondary-800/60 rounded-2xl flex items-center justify-center backdrop-blur-sm z-10">
          <div className="text-center">
            <div className="text-4xl mb-2">🔒</div>
            <div className="text-volt-400 font-bold text-sm mb-2">PREMIUM INSIGHT</div>
            <button
              onClick={onUpgrade}
              className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-2 px-4 rounded-lg text-xs hover:from-volt-400 hover:to-volt-500 transition-all duration-300"
            >
              Unlock Now
            </button>
          </div>
        </div>
      )}
      
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-secondary-300 text-sm font-medium uppercase tracking-wide">
          {title}
        </h3>
        {trend && !locked && (
          <div className={`flex items-center gap-1 text-xs ${
            trend === 'up' ? 'text-success-400' : trend === 'down' ? 'text-danger-400' : 'text-secondary-400'
          }`}>
            {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
          </div>
        )}
      </div>
      
      <div className="mb-2">
        <div className={`text-3xl font-black ${locked ? 'text-secondary-500' : 'text-white'} mb-1`}>
          {locked ? '•••' : value}
        </div>
        <div className={`text-sm ${locked ? 'text-secondary-500' : 'text-secondary-400'}`}>
          {locked ? 'Premium feature' : subtitle}
        </div>
      </div>
    </motion.div>
  )

  const ScoreCircle = ({ score, label, size = 'md', locked = false }: {
    score: number
    label: string
    size?: 'sm' | 'md' | 'lg'
    locked?: boolean
  }) => {
    const sizeClasses = {
      sm: 'w-16 h-16 text-sm',
      md: 'w-20 h-20 text-base',
      lg: 'w-24 h-24 text-lg'
    }

    return (
      <div className="text-center">
        <div className={`relative ${sizeClasses[size]} mx-auto mb-2`}>
          <svg className="transform -rotate-90 w-full h-full">
            <circle
              cx="50%"
              cy="50%"
              r="40%"
              stroke="currentColor"
              strokeWidth="3"
              fill="transparent"
              className="text-secondary-700"
            />
            {!locked && (
              <circle
                cx="50%"
                cy="50%"
                r="40%"
                stroke="currentColor"
                strokeWidth="3"
                fill="transparent"
                strokeDasharray={`${score * 2.51} 251`}
                className={score >= 80 ? 'text-success-400' : score >= 60 ? 'text-volt-400' : score >= 40 ? 'text-orange-400' : 'text-danger-400'}
                strokeLinecap="round"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-bold ${locked ? 'text-secondary-500' : 'text-white'}`}>
              {locked ? '•••' : `${score}%`}
            </span>
          </div>
        </div>
        <div className={`text-xs font-medium ${locked ? 'text-secondary-500' : 'text-secondary-300'}`}>
          {label}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header with Value Proposition */}
      <div className="bg-gradient-to-r from-volt-500/10 to-volt-600/5 rounded-2xl border border-volt-500/30 p-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-4xl">🎯</span>
          <h1 className="text-3xl font-black text-white">
            Business Intelligence Analysis
          </h1>
        </div>
        <p className="text-secondary-300 text-lg mb-6 max-w-3xl mx-auto">
          Professional-grade business insights that typically cost $2,600+ from consulting firms. 
          <span className="text-volt-400 font-bold"> Now available in minutes, not weeks.</span>
        </p>
        
        {userTier === 'free' && (
          <div className="bg-gradient-to-r from-danger-500/10 to-volt-500/10 rounded-xl border border-volt-500/50 p-4 max-w-2xl mx-auto">
            <p className="text-sm text-secondary-300 mb-3">
              You're seeing a preview. <span className="text-volt-400 font-bold">Unlock complete analysis</span> with detailed recommendations, financial projections, and actionable insights.
            </p>
            <button
              onClick={onUpgrade}
              className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-2 px-6 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105"
            >
              Upgrade for Full Analysis
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 justify-center">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'opportunities', label: 'Opportunities', icon: '🎯' },
          { id: 'competitive', label: 'Competitive', icon: '⚔️', locked: isLocked('competitive') },
          { id: 'projections', label: 'Projections', icon: '📈', locked: isLocked('projections') },
          { id: 'seo', label: 'SEO Audit', icon: '🔍', locked: isLocked('seo') }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => !tab.locked && setActiveTab(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
              activeTab === tab.id
                ? 'bg-volt-500 text-secondary-900'
                : tab.locked
                  ? 'bg-secondary-800 text-secondary-500 cursor-not-allowed'
                  : 'bg-secondary-800 text-secondary-300 hover:bg-secondary-700 hover:text-white'
            }`}
          >
            {tab.locked && (
              <span className="absolute -top-1 -right-1 text-xs">🔒</span>
            )}
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Executive Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <ExecutiveSummaryCard
                title="Business Classification"
                value={data.businessIntelligence.industry}
                subtitle="AI-identified industry"
                trend="stable"
              />
              <ExecutiveSummaryCard
                title="Market Position"
                value={data.businessIntelligence.marketPosition}
                subtitle="Competitive positioning"
                trend="up"
              />
              <ExecutiveSummaryCard
                title="Directory Opportunities"
                value={data.directoryOpportunities.total}
                subtitle="Listings identified"
                trend="up"
              />
              <ExecutiveSummaryCard
                title="Success Probability"
                value={`${data.directoryOpportunities.successProbability}%`}
                subtitle="Approval likelihood"
                trend="up"
                locked={isLocked('competitive')}
              />
            </div>

            {/* Business Intelligence Overview */}
            <div className="bg-secondary-800/50 rounded-2xl border border-secondary-700 p-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <span>🎯</span>
                Business Intelligence Summary
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Business Profile */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-volt-400 mb-4">Business Profile</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Industry:</span>
                        <span className="text-white font-medium">{data.businessIntelligence.industry}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Size Category:</span>
                        <span className="text-white font-medium capitalize">{data.businessIntelligence.businessSize}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Market Position:</span>
                        <span className="text-white font-medium">{data.businessIntelligence.marketPosition}</span>
                      </div>
                    </div>
                  </div>

                  {/* Competitive Advantages */}
                  <div>
                    <h3 className="text-lg font-semibold text-volt-400 mb-4">Competitive Advantages</h3>
                    <div className="space-y-2">
                      {data.businessIntelligence.competitiveAdvantage.slice(0, 3).map((advantage, index) => (
                        <div key={index} className="flex items-start gap-3 text-sm">
                          <span className="text-success-400 flex-shrink-0 mt-1">✓</span>
                          <span className="text-secondary-200">{advantage}</span>
                        </div>
                      ))}
                      {data.businessIntelligence.competitiveAdvantage.length > 3 && isLocked('competitive') && (
                        <button
                          onClick={onUpgrade}
                          className="text-volt-400 hover:text-volt-300 text-sm font-medium transition-colors"
                        >
                          + {data.businessIntelligence.competitiveAdvantage.length - 3} more advantages (Premium)
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Performance Scores */}
                <div>
                  <h3 className="text-lg font-semibold text-volt-400 mb-6">Performance Scores</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <ScoreCircle
                      score={data.businessIntelligence.marketFit}
                      label="Market Fit"
                      size="lg"
                    />
                    <ScoreCircle
                      score={data.businessIntelligence.brandMaturity}
                      label="Brand Maturity"
                      size="lg"
                    />
                    <ScoreCircle
                      score={data.seoAnalysis.technicalScore}
                      label="Technical SEO"
                      size="md"
                      locked={isLocked('seo')}
                    />
                    <ScoreCircle
                      score={data.competitiveAnalysis.differentiationScore}
                      label="Differentiation"
                      size="md"
                      locked={isLocked('competitive')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'opportunities' && (
          <div className="space-y-8">
            {/* Opportunity Summary */}
            <div className="bg-gradient-to-r from-success-500/10 to-volt-500/10 rounded-2xl border border-volt-500/30 p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-white mb-4">
                  Directory Opportunity Matrix
                </h2>
                <p className="text-secondary-300 text-lg max-w-2xl mx-auto">
                  <span className="text-volt-400 font-bold">{data.directoryOpportunities.total} premium directories</span> identified with high success probability for your business profile.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-black text-success-400 mb-2">
                    {data.directoryOpportunities.highPriority}
                  </div>
                  <div className="text-success-300 font-semibold mb-1">High Priority</div>
                  <div className="text-secondary-400 text-sm">90-95% success rate</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-volt-400 mb-2">
                    {data.directoryOpportunities.mediumPriority}
                  </div>
                  <div className="text-volt-300 font-semibold mb-1">Medium Priority</div>
                  <div className="text-secondary-400 text-sm">75-85% success rate</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-orange-400 mb-2">
                    {data.directoryOpportunities.lowPriority}
                  </div>
                  <div className="text-orange-300 font-semibold mb-1">Strategic</div>
                  <div className="text-secondary-400 text-sm">60-70% success rate</div>
                </div>
              </div>
            </div>

            {/* Financial Impact */}
            <div className="bg-secondary-800/50 rounded-2xl border border-secondary-700 p-8">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <span>💰</span>
                Estimated Financial Impact
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className="text-3xl font-black text-success-400 mb-2">
                    ${data.directoryOpportunities.estimatedValue.toLocaleString()}
                  </div>
                  <div className="text-secondary-300 text-sm mb-4">
                    Conservative monthly revenue estimate from listings
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-secondary-400">Per-directory average:</span>
                      <span className="text-white font-medium">
                        ${Math.round(data.directoryOpportunities.estimatedValue / data.directoryOpportunities.total)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-400">Annual projection:</span>
                      <span className="text-success-400 font-bold">
                        ${(data.directoryOpportunities.estimatedValue * 12).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-400">ROI timeframe:</span>
                      <span className="text-volt-400 font-medium">2-4 weeks</span>
                    </div>
                  </div>
                </div>

                <div className="bg-volt-500/10 rounded-xl border border-volt-500/30 p-6">
                  <h4 className="text-lg font-semibold text-volt-400 mb-4">Success Factors</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <span className="text-success-400 flex-shrink-0 mt-1">✓</span>
                      <span className="text-secondary-200">High-authority directories (DA 60+)</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-success-400 flex-shrink-0 mt-1">✓</span>
                      <span className="text-secondary-200">Industry-specific targeting</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-success-400 flex-shrink-0 mt-1">✓</span>
                      <span className="text-secondary-200">Geographic relevance match</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-success-400 flex-shrink-0 mt-1">✓</span>
                      <span className="text-secondary-200">Low competition directories</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Premium Feature Promotion */}
      {userTier === 'free' && (
        <div className="bg-gradient-to-r from-volt-500/20 to-danger-500/10 rounded-2xl border-2 border-volt-500/50 p-8 text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-3xl font-black text-white mb-4">
            This is just the beginning...
          </h2>
          <p className="text-secondary-300 text-lg mb-6 max-w-2xl mx-auto">
            Unlock complete competitive analysis, financial projections, SEO audit, and actionable recommendations worth $2,600+ in consulting value.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-secondary-800/50 rounded-xl p-4">
              <div className="text-2xl font-bold text-volt-400 mb-2">5x</div>
              <div className="text-sm text-secondary-300">More detailed insights</div>
            </div>
            <div className="bg-secondary-800/50 rounded-xl p-4">
              <div className="text-2xl font-bold text-success-400 mb-2">100+</div>
              <div className="text-sm text-secondary-300">Actionable recommendations</div>
            </div>
            <div className="bg-secondary-800/50 rounded-xl p-4">
              <div className="text-2xl font-bold text-danger-400 mb-2">$2,600</div>
              <div className="text-sm text-secondary-300">Consulting value included</div>
            </div>
          </div>

          <button
            onClick={onUpgrade}
            className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black py-4 px-8 text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-volt-500/50"
          >
            🎯 Unlock Complete Analysis - From $299 ONE-TIME
          </button>
        </div>
      )}
    </div>
  )
}