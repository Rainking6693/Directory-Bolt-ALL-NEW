'use client'

import { useState, useMemo } from 'react'

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
  actionTaken?: string
  actionedAt?: string
}

interface WeeklyReport {
  id: string
  title: string
  generatedAt: string
  keyInsights: string[]
  actionItemsCompleted: number
  totalActionItems: number
  impactScore: number
  sections: {
    competitive: string[]
    performance: string[]
    opportunities: string[]
    risks: string[]
  }
}

interface ActionableInsightsSystemProps {
  insights: AIGeneratedInsight[]
  onInsightAction: (insight: AIGeneratedInsight, action: string) => void
  onGenerateReport: () => void
}

export function ActionableInsightsSystem({
  insights,
  onInsightAction,
  onGenerateReport
}: ActionableInsightsSystemProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'seo' | 'competitive' | 'directory' | 'market'>('all')
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [viewMode, setViewMode] = useState<'insights' | 'reports' | 'alerts'>('insights')

  // Generate weekly reports for demonstration
  const weeklyReports: WeeklyReport[] = useMemo(() => [
    {
      id: '1',
      title: 'Weekly AI Business Report - Week of Nov 26',
      generatedAt: '2024-11-26T09:00:00Z',
      keyInsights: [
        'Directory submission success rate improved 12% this week',
        'Competitor movement detected in G2 rankings',
        'SEO score increased 8 points due to technical improvements',
        'New market opportunity identified in enterprise segment'
      ],
      actionItemsCompleted: 8,
      totalActionItems: 12,
      impactScore: 87,
      sections: {
        competitive: [
          'CompetitorA launched new pricing model, creating opportunity gap',
          'Industry trend toward AI integration accelerating',
          'Market consolidation creating partnership opportunities'
        ],
        performance: [
          'G2 ranking improved from #4 to #3 in category',
          'Yelp conversion rate increased 23% after listing optimization',
          'Overall directory traffic grew 18% week-over-week'
        ],
        opportunities: [
          'TrustPilot submission window optimal for next 2 weeks',
          'Content gap analysis reveals 15 high-value keywords',
          'Local SEO improvements could drive 25% more leads'
        ],
        risks: [
          'Competitor pricing pressure in mid-market segment',
          'Directory algorithm updates may affect current rankings',
          'Customer review velocity declining on key platforms'
        ]
      }
    },
    {
      id: '2',
      title: 'Weekly AI Business Report - Week of Nov 19',
      generatedAt: '2024-11-19T09:00:00Z',
      keyInsights: [
        'Strong performance across review platforms this week',
        'Technical SEO improvements showing ranking impact',
        'New directory approval accelerating traffic growth',
        'Market sentiment analysis indicates positive trend'
      ],
      actionItemsCompleted: 10,
      totalActionItems: 14,
      impactScore: 82,
      sections: {
        competitive: [
          'Market leader showing signs of customer satisfaction decline',
          'New entrant positioning aggressively in pricing',
          'Industry moving toward subscription-based models'
        ],
        performance: [
          'Capterra listing achieved featured status',
          'Google My Business reviews up 34% this week',
          'Directory referral conversion rate at all-time high'
        ],
        opportunities: [
          'Enterprise directory submissions show high success probability',
          'Video content strategy could enhance directory presence',
          'Partnership opportunities with complementary tools'
        ],
        risks: [
          'Increased competition in core keyword rankings',
          'Seasonal downturn approaching for B2B searches',
          'Key customer segments showing price sensitivity'
        ]
      }
    }
  ], [])

  const filteredInsights = useMemo(() => {
    let filtered = insights

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(insight => insight.category === selectedCategory)
    }

    if (selectedPriority !== 'all') {
      filtered = filtered.filter(insight => insight.priority === selectedPriority)
    }

    return filtered.sort((a, b) => {
      // Sort by priority first, then by impact
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      
      if (priorityDiff !== 0) return priorityDiff
      return b.impact - a.impact
    })
  }, [insights, selectedCategory, selectedPriority])

  const criticalAlerts = useMemo(() => 
    insights.filter(i => i.type === 'alert' && i.priority === 'high')
  , [insights])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return '💡'
      case 'alert': return '🚨'
      case 'recommendation': return '💭'
      case 'trend': return '📊'
      default: return '📋'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'opportunity': return 'text-success-400 bg-success-500/10 border-success-500/20'
      case 'alert': return 'text-danger-400 bg-danger-500/10 border-danger-500/20'
      case 'recommendation': return 'text-volt-400 bg-volt-500/10 border-volt-500/20'
      case 'trend': return 'text-warning-400 bg-warning-500/10 border-warning-500/20'
      default: return 'text-secondary-400 bg-secondary-700 border-secondary-600'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-danger-400'
      case 'medium': return 'text-warning-400'
      case 'low': return 'text-success-400'
      default: return 'text-secondary-400'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'seo': return '🔍'
      case 'competitive': return '⚔️'
      case 'directory': return '📁'
      case 'market': return '📈'
      default: return '📋'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return `${Math.floor(days / 7)}w ago`
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
              💡 Actionable Insights System
            </h2>
            <p className="text-secondary-400">
              AI-powered business intelligence with actionable recommendations and automated reporting
            </p>
          </div>
          
          <button
            onClick={onGenerateReport}
            className="bg-volt-500 text-secondary-900 px-6 py-2 rounded-lg font-medium hover:bg-volt-400 transition-colors flex items-center gap-2"
          >
            🤖 Generate New Report
          </button>
        </div>

        {/* View Mode Navigation */}
        <div className="flex bg-secondary-700 rounded-lg p-1 mb-4">
          {[
            { key: 'insights', label: 'Live Insights', icon: '💡', count: filteredInsights.length },
            { key: 'reports', label: 'Weekly Reports', icon: '📊', count: weeklyReports.length },
            { key: 'alerts', label: 'Critical Alerts', icon: '🚨', count: criticalAlerts.length }
          ].map((mode) => (
            <button
              key={mode.key}
              onClick={() => setViewMode(mode.key as typeof viewMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded font-medium text-sm transition-colors flex-1 justify-center ${
                viewMode === mode.key
                  ? 'bg-volt-500 text-secondary-900'
                  : 'text-secondary-400 hover:text-secondary-300 hover:bg-secondary-600'
              }`}
            >
              <span>{mode.icon}</span>
              <span className="hidden md:inline">{mode.label}</span>
              {mode.count > 0 && (
                <span className="bg-secondary-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {mode.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters for Insights View */}
        {viewMode === 'insights' && (
          <div className="flex items-center gap-4">
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as typeof selectedCategory)}
              className="bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="all">All Categories</option>
              <option value="seo">SEO Insights</option>
              <option value="competitive">Competitive</option>
              <option value="directory">Directory</option>
              <option value="market">Market Trends</option>
            </select>
            
            <select 
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as typeof selectedPriority)}
              className="bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        )}
      </div>

      {/* Content based on selected view */}
      {viewMode === 'insights' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredInsights.map((insight) => (
            <div key={insight.id} className={`rounded-lg border p-5 ${getTypeColor(insight.type)}`}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getTypeIcon(insight.type)}</span>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{insight.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(insight.priority)} bg-opacity-20`}>
                        {insight.priority.toUpperCase()} PRIORITY
                      </span>
                      <span className="flex items-center gap-1 text-xs text-secondary-400">
                        {getCategoryIcon(insight.category)} {insight.category}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold text-white">{insight.impact}%</div>
                  <div className="text-xs text-secondary-400">Impact</div>
                </div>
              </div>

              <p className="text-sm text-secondary-300 mb-4">{insight.description}</p>

              <div className="space-y-3 mb-4">
                <div className="text-xs font-medium text-secondary-400 uppercase tracking-wide">
                  Action Items:
                </div>
                <div className="space-y-2">
                  {insight.actionItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 text-sm">
                      <div className="w-5 h-5 bg-secondary-600 rounded border flex items-center justify-center mt-0.5">
                        <input 
                          type="checkbox" 
                          className="w-3 h-3 rounded border-secondary-500"
                          onChange={(e) => {
                            if (e.target.checked) {
                              onInsightAction(insight, `completed-action-${index}`)
                            }
                          }}
                        />
                      </div>
                      <span className="text-secondary-300 flex-1">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-secondary-600">
                <div className="flex items-center gap-4 text-xs text-secondary-400">
                  <span>Generated {formatTimeAgo(insight.generatedAt)}</span>
                  <span>Confidence: {insight.confidence}%</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {!insight.actionTaken && (
                    <>
                      <button
                        onClick={() => onInsightAction(insight, 'dismissed')}
                        className="text-xs bg-secondary-600 text-secondary-300 px-3 py-1 rounded hover:bg-secondary-500 transition-colors"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => onInsightAction(insight, 'acted-upon')}
                        className="text-xs bg-volt-500 text-secondary-900 px-3 py-1 rounded hover:bg-volt-400 transition-colors"
                      >
                        Act Now
                      </button>
                    </>
                  )}
                  {insight.actionTaken && (
                    <span className="text-xs text-success-400 px-3 py-1 bg-success-500/10 rounded">
                      ✓ {insight.actionTaken}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {filteredInsights.length === 0 && (
            <div className="col-span-2 text-center py-12 text-secondary-400">
              <span className="text-6xl mb-4 block">🤖</span>
              <h3 className="text-lg font-bold text-white mb-2">No Insights Found</h3>
              <p>Try adjusting your filters or check back later for new AI-generated insights.</p>
            </div>
          )}
        </div>
      )}

      {viewMode === 'reports' && (
        <div className="space-y-6">
          {weeklyReports.map((report) => (
            <div key={report.id} className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">{report.title}</h3>
                  <p className="text-secondary-400 text-sm">
                    Generated {formatTimeAgo(report.generatedAt)}
                  </p>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-volt-400 mb-1">{report.impactScore}</div>
                  <div className="text-xs text-secondary-400">Impact Score</div>
                </div>
              </div>

              {/* Report Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-secondary-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-success-400 mb-1">
                    {report.actionItemsCompleted}
                  </div>
                  <div className="text-sm text-secondary-400 mb-1">Actions Completed</div>
                  <div className="text-xs text-secondary-500">
                    of {report.totalActionItems} total
                  </div>
                </div>

                <div className="bg-secondary-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-volt-400 mb-1">
                    {report.keyInsights.length}
                  </div>
                  <div className="text-sm text-secondary-400 mb-1">Key Insights</div>
                  <div className="text-xs text-secondary-500">
                    AI-generated findings
                  </div>
                </div>

                <div className="bg-secondary-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-warning-400 mb-1">
                    {Math.round((report.actionItemsCompleted / report.totalActionItems) * 100)}%
                  </div>
                  <div className="text-sm text-secondary-400 mb-1">Completion Rate</div>
                  <div className="text-xs text-secondary-500">
                    Weekly progress
                  </div>
                </div>
              </div>

              {/* Key Insights */}
              <div className="mb-6">
                <h4 className="font-semibold text-white mb-3">📊 Key Insights This Week</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {report.keyInsights.map((insight, index) => (
                    <div key={index} className="bg-volt-500/10 border border-volt-500/20 rounded-lg p-3">
                      <div className="text-sm text-secondary-300 flex items-start gap-2">
                        <span className="text-volt-400 mt-1">•</span>
                        <span>{insight}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-secondary-700 rounded-lg p-4">
                    <h5 className="font-medium text-success-400 mb-3 flex items-center gap-2">
                      📈 Performance Highlights
                    </h5>
                    <div className="space-y-2">
                      {report.sections.performance.slice(0, 3).map((item, index) => (
                        <div key={index} className="text-sm text-secondary-300 flex items-start gap-2">
                          <span className="text-success-400 mt-1">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-secondary-700 rounded-lg p-4">
                    <h5 className="font-medium text-volt-400 mb-3 flex items-center gap-2">
                      💡 New Opportunities
                    </h5>
                    <div className="space-y-2">
                      {report.sections.opportunities.slice(0, 3).map((item, index) => (
                        <div key={index} className="text-sm text-secondary-300 flex items-start gap-2">
                          <span className="text-volt-400 mt-1">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-secondary-700 rounded-lg p-4">
                    <h5 className="font-medium text-warning-400 mb-3 flex items-center gap-2">
                      ⚔️ Competitive Intelligence
                    </h5>
                    <div className="space-y-2">
                      {report.sections.competitive.slice(0, 3).map((item, index) => (
                        <div key={index} className="text-sm text-secondary-300 flex items-start gap-2">
                          <span className="text-warning-400 mt-1">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-secondary-700 rounded-lg p-4">
                    <h5 className="font-medium text-danger-400 mb-3 flex items-center gap-2">
                      ⚠️ Risk Factors
                    </h5>
                    <div className="space-y-2">
                      {report.sections.risks.slice(0, 3).map((item, index) => (
                        <div key={index} className="text-sm text-secondary-300 flex items-start gap-2">
                          <span className="text-danger-400 mt-1">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Report Actions */}
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-secondary-700">
                <button className="bg-secondary-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-secondary-600 transition-colors">
                  📊 View Full Report
                </button>
                <button className="bg-secondary-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-secondary-600 transition-colors">
                  📧 Email Report
                </button>
                <button className="bg-secondary-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-secondary-600 transition-colors">
                  📤 Export PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'alerts' && (
        <div className="space-y-4">
          {criticalAlerts.length > 0 ? (
            criticalAlerts.map((alert) => (
              <div key={alert.id} className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">🚨</span>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-danger-400 text-lg mb-1">{alert.title}</h3>
                        <span className="text-xs bg-danger-500 text-white px-2 py-1 rounded uppercase tracking-wide">
                          CRITICAL ALERT
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-white">{alert.impact}%</div>
                        <div className="text-xs text-secondary-400">Impact</div>
                      </div>
                    </div>

                    <p className="text-secondary-300 mb-4">{alert.description}</p>

                    <div className="space-y-2 mb-4">
                      <div className="text-sm font-medium text-danger-400">Immediate Actions Required:</div>
                      {alert.actionItems.map((item, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-danger-400 mt-1">•</span>
                          <span className="text-secondary-300">{item}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-danger-500/20">
                      <span className="text-xs text-secondary-400">
                        Alert generated {formatTimeAgo(alert.generatedAt)}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onInsightAction(alert, 'acknowledged')}
                          className="bg-danger-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-danger-400 transition-colors"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={() => onInsightAction(alert, 'resolved')}
                          className="bg-success-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-success-400 transition-colors"
                        >
                          Mark Resolved
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-secondary-400">
              <span className="text-6xl mb-4 block">✅</span>
              <h3 className="text-lg font-bold text-white mb-2">No Critical Alerts</h3>
              <p>All systems are operating normally. Great job staying on top of your business intelligence!</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ActionableInsightsSystem