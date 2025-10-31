'use client'

import { useState, useMemo } from 'react'
import { SEOAnalysis } from '../../lib/types/business-intelligence'

interface SEOImprovement {
  keyword: string
  position: number
  change: number
}

interface SEOImprovementMonitorProps {
  seoData?: SEOAnalysis
  improvements: SEOImprovement[]
  className?: string
}

interface SEOOpportunity {
  id: string
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
  category: 'technical' | 'content' | 'local' | 'backlinks'
  estimatedTrafficIncrease: number
  priority: number
  actionItems: string[]
  timeframe: string
}

interface SEOMetricTrend {
  metric: string
  current: number
  previous: number
  change: number
  trend: 'up' | 'down' | 'stable'
  target: number
}

export function SEOImprovementMonitor({
  seoData,
  improvements,
  className = ''
}: SEOImprovementMonitorProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d'>('30d')
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'technical' | 'content' | 'local' | 'backlinks'>('all')

  // Mock SEO opportunities based on analysis
  const seoOpportunities: SEOOpportunity[] = useMemo(() => [
    {
      id: '1',
      title: 'Optimize Page Loading Speed',
      description: 'Core Web Vitals show room for improvement. Reducing page load time by 1-2 seconds could boost rankings.',
      impact: 'high',
      effort: 'medium',
      category: 'technical',
      estimatedTrafficIncrease: 15,
      priority: 95,
      actionItems: [
        'Compress images using modern formats (WebP, AVIF)',
        'Minimize CSS and JavaScript files',
        'Implement lazy loading for below-the-fold content',
        'Optimize server response times'
      ],
      timeframe: '2-4 weeks'
    },
    {
      id: '2',
      title: 'Expand Long-Tail Content Strategy',
      description: 'AI analysis identified 47 high-opportunity long-tail keywords with low competition.',
      impact: 'high',
      effort: 'medium',
      category: 'content',
      estimatedTrafficIncrease: 25,
      priority: 88,
      actionItems: [
        'Create comprehensive guides for identified keywords',
        'Optimize existing pages for long-tail variations',
        'Develop FAQ sections addressing specific queries',
        'Build topic clusters around main keywords'
      ],
      timeframe: '6-8 weeks'
    },
    {
      id: '3',
      title: 'Improve Local SEO Citations',
      description: 'NAP consistency across directories needs attention. 12 listings have inconsistent information.',
      impact: 'medium',
      effort: 'low',
      category: 'local',
      estimatedTrafficIncrease: 8,
      priority: 82,
      actionItems: [
        'Audit all directory listings for NAP consistency',
        'Update incorrect business information',
        'Claim unclaimed business listings',
        'Add business to relevant local directories'
      ],
      timeframe: '1-2 weeks'
    },
    {
      id: '4',
      title: 'Build Authority Through Link Building',
      description: 'Competitor gap analysis shows opportunities for high-quality backlinks from industry sites.',
      impact: 'high',
      effort: 'high',
      category: 'backlinks',
      estimatedTrafficIncrease: 22,
      priority: 79,
      actionItems: [
        'Develop linkable assets (research studies, tools)',
        'Guest posting on industry publications',
        'Build relationships with industry influencers',
        'Monitor and replicate competitor backlink strategies'
      ],
      timeframe: '3-6 months'
    },
    {
      id: '5',
      title: 'Enhance Schema Markup Coverage',
      description: 'Only 35% of pages have proper structured data. Adding schema could improve rich snippets.',
      impact: 'medium',
      effort: 'low',
      category: 'technical',
      estimatedTrafficIncrease: 12,
      priority: 75,
      actionItems: [
        'Implement Organization schema sitewide',
        'Add Product/Service schema to relevant pages',
        'Include Review schema for testimonials',
        'Set up FAQ schema for support content'
      ],
      timeframe: '2-3 weeks'
    }
  ], [])

  // Mock SEO metric trends
  const seoMetricTrends: SEOMetricTrend[] = useMemo(() => [
    {
      metric: 'Overall SEO Score',
      current: seoData?.currentScore || 78,
      previous: 72,
      change: 6,
      trend: 'up',
      target: 85
    },
    {
      metric: 'Page Speed Score',
      current: seoData?.technicalSEO.pageSpeed || 85,
      previous: 79,
      change: 6,
      trend: 'up',
      target: 90
    },
    {
      metric: 'Content Optimization',
      current: seoData?.contentSEO.titleOptimization || 82,
      previous: 78,
      change: 4,
      trend: 'up',
      target: 90
    },
    {
      metric: 'Local SEO Score',
      current: seoData?.localSEO.napConsistency || 95,
      previous: 91,
      change: 4,
      trend: 'up',
      target: 98
    },
    {
      metric: 'Domain Authority',
      current: seoData?.backlinkAnalysis.domainAuthority || 68,
      previous: 65,
      change: 3,
      trend: 'up',
      target: 75
    }
  ], [seoData])

  const filteredOpportunities = useMemo(() => {
    let filtered = seoOpportunities
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(opp => opp.category === selectedCategory)
    }
    
    return filtered.sort((a, b) => b.priority - a.priority)
  }, [seoOpportunities, selectedCategory])

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-success-400 bg-success-500/10 border-success-500/20'
      case 'medium': return 'text-warning-400 bg-warning-500/10 border-warning-500/20'
      case 'low': return 'text-secondary-400 bg-secondary-700 border-secondary-600'
      default: return 'text-secondary-400 bg-secondary-700 border-secondary-600'
    }
  }

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-success-400'
      case 'medium': return 'text-warning-400'
      case 'high': return 'text-danger-400'
      default: return 'text-secondary-400'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'technical': return '⚙️'
      case 'content': return '📝'
      case 'local': return '📍'
      case 'backlinks': return '🔗'
      default: return '🔍'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '📈'
      case 'down': return '📉'
      default: return '➡️'
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-success-400'
      case 'down': return 'text-danger-400'
      default: return 'text-secondary-400'
    }
  }

  if (!seoData) {
    return (
      <div className={`bg-secondary-800 rounded-xl border border-secondary-700 p-6 text-center ${className}`}>
        <div className="mb-4">
          <span className="text-4xl">🔍</span>
        </div>
        <h3 className="text-lg font-bold text-white mb-2">SEO Analysis Pending</h3>
        <p className="text-secondary-400">
          SEO monitoring will be available once your initial analysis is complete.
        </p>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* SEO Score Overview */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            🔍 SEO Improvement Monitor
          </h3>
          
          <select 
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value as typeof selectedTimeframe)}
            className="bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-1 text-sm text-white"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>

        {/* SEO Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {seoMetricTrends.map((trend, index) => (
            <div key={index} className="bg-secondary-700 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <span className={`text-xl font-bold ${getTrendColor(trend.trend)}`}>
                  {trend.current}
                </span>
                <span className={`text-sm ${getTrendColor(trend.trend)}`}>
                  {getTrendIcon(trend.trend)}
                </span>
              </div>
              <div className="text-sm text-secondary-400 mb-1">{trend.metric}</div>
              <div className={`text-xs font-medium ${getTrendColor(trend.trend)}`}>
                {trend.change > 0 ? '+' : ''}{trend.change} points
              </div>
              <div className="mt-2">
                <div className="w-full bg-secondary-600 rounded-full h-1.5">
                  <div 
                    className="bg-volt-400 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${(trend.current / trend.target) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-secondary-500 mt-1">Target: {trend.target}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Keyword Rankings Improvement */}
        <div className="bg-secondary-700 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Keyword Ranking Improvements</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {improvements.slice(0, 6).map((improvement, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-secondary-600 rounded-lg">
                <div>
                  <div className="font-medium text-white text-sm">{improvement.keyword}</div>
                  <div className="text-xs text-secondary-400">Position #{improvement.position}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${improvement.change > 0 ? 'text-success-400' : improvement.change < 0 ? 'text-danger-400' : 'text-secondary-400'}`}>
                    {improvement.change > 0 ? '↑' : improvement.change < 0 ? '↓' : '→'} {Math.abs(improvement.change)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SEO Opportunities */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">AI-Identified SEO Opportunities</h3>
          
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as typeof selectedCategory)}
            className="bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All Categories</option>
            <option value="technical">Technical SEO</option>
            <option value="content">Content SEO</option>
            <option value="local">Local SEO</option>
            <option value="backlinks">Link Building</option>
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOpportunities.map((opportunity) => (
            <div key={opportunity.id} className="bg-secondary-700 rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getCategoryIcon(opportunity.category)}</span>
                  <div>
                    <h4 className="font-semibold text-white">{opportunity.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded border ${getImpactColor(opportunity.impact)}`}>
                        {opportunity.impact.toUpperCase()} IMPACT
                      </span>
                      <span className={`text-xs ${getEffortColor(opportunity.effort)}`}>
                        {opportunity.effort} effort
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-success-400">
                    +{opportunity.estimatedTrafficIncrease}%
                  </div>
                  <div className="text-xs text-secondary-400">traffic</div>
                </div>
              </div>

              <p className="text-sm text-secondary-300 mb-4">{opportunity.description}</p>

              <div className="space-y-2 mb-4">
                <div className="text-xs font-medium text-secondary-400 uppercase tracking-wide">
                  Action Items:
                </div>
                <div className="space-y-1">
                  {opportunity.actionItems.slice(0, 2).map((item, index) => (
                    <div key={index} className="text-sm text-secondary-300 flex items-start gap-2">
                      <span className="text-volt-400 mt-1">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                  {opportunity.actionItems.length > 2 && (
                    <div className="text-xs text-secondary-400">
                      +{opportunity.actionItems.length - 2} more actions
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-secondary-600">
                <div className="text-xs text-secondary-400">
                  Timeline: {opportunity.timeframe}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-secondary-400">Priority:</div>
                  <div className="w-16 bg-secondary-600 rounded-full h-1.5">
                    <div 
                      className="bg-volt-400 h-1.5 rounded-full"
                      style={{ width: `${opportunity.priority}%` }}
                    />
                  </div>
                  <div className="text-xs font-medium text-white">{opportunity.priority}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Technical SEO Health */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
        <h3 className="text-lg font-bold text-white mb-4">Technical SEO Health</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-success-500/10 rounded-full flex items-center justify-center">
              <span className="text-2xl">🔒</span>
            </div>
            <div className="font-semibold text-white mb-1">SSL Certificate</div>
            <div className={`text-sm ${seoData.technicalSEO.sslCertificate ? 'text-success-400' : 'text-danger-400'}`}>
              {seoData.technicalSEO.sslCertificate ? 'Secured' : 'Missing'}
            </div>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-success-500/10 rounded-full flex items-center justify-center">
              <span className="text-2xl">📱</span>
            </div>
            <div className="font-semibold text-white mb-1">Mobile Optimized</div>
            <div className={`text-sm ${seoData.technicalSEO.mobileOptimized ? 'text-success-400' : 'text-danger-400'}`}>
              {seoData.technicalSEO.mobileOptimized ? 'Optimized' : 'Needs Work'}
            </div>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-warning-500/10 rounded-full flex items-center justify-center">
              <span className="text-2xl">🗺️</span>
            </div>
            <div className="font-semibold text-white mb-1">XML Sitemap</div>
            <div className={`text-sm ${seoData.technicalSEO.xmlSitemap ? 'text-success-400' : 'text-warning-400'}`}>
              {seoData.technicalSEO.xmlSitemap ? 'Present' : 'Missing'}
            </div>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-volt-500/10 rounded-full flex items-center justify-center">
              <span className="text-2xl">🏷️</span>
            </div>
            <div className="font-semibold text-white mb-1">Schema Markup</div>
            <div className="text-sm text-volt-400">
              {seoData.technicalSEO.schemaMarkup}% Coverage
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-secondary-700 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-white">Overall Technical Health</span>
            <span className="text-xl font-bold text-success-400">
              {Math.round((
                (seoData.technicalSEO.sslCertificate ? 25 : 0) +
                (seoData.technicalSEO.mobileOptimized ? 25 : 0) +
                (seoData.technicalSEO.xmlSitemap ? 25 : 0) +
                (seoData.technicalSEO.schemaMarkup * 0.25)
              ))}%
            </span>
          </div>
          <div className="w-full bg-secondary-600 rounded-full h-2">
            <div 
              className="bg-success-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((
                (seoData.technicalSEO.sslCertificate ? 25 : 0) +
                (seoData.technicalSEO.mobileOptimized ? 25 : 0) +
                (seoData.technicalSEO.xmlSitemap ? 25 : 0) +
                (seoData.technicalSEO.schemaMarkup * 0.25)
              ))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-volt-500/10 to-volt-400/10 border border-volt-500/30 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Quick SEO Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button className="bg-volt-500 text-secondary-900 px-4 py-2 rounded-lg font-medium text-sm hover:bg-volt-400 transition-colors">
            🔄 Run SEO Audit
          </button>
          <button className="bg-secondary-700 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-secondary-600 transition-colors">
            📊 View Keyword Rankings
          </button>
          <button className="bg-secondary-700 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-secondary-600 transition-colors">
            🔗 Check Backlinks
          </button>
          <button className="bg-secondary-700 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-secondary-600 transition-colors">
            📈 Track Competitors
          </button>
        </div>
      </div>
    </div>
  )
}

export default SEOImprovementMonitor