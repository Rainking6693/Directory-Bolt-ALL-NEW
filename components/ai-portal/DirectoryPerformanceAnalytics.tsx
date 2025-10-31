'use client'

import { useState, useMemo } from 'react'

interface PerformanceMetrics {
  submissionSuccessRate: number
  averageApprovalTime: number
  directoryTrafficContribution: number
  conversionRateImprovement: number
  seoScoreImprovement: number
}

interface RealTimeMetrics {
  directoryVisibility: number
  searchRankings: { keyword: string; position: number; change: number }[]
  trafficGrowth: number
  leadGeneration: number
  brandMentions: number
}

interface DirectoryPerformance {
  id: string
  name: string
  category: string
  status: 'live' | 'pending' | 'submitted' | 'rejected'
  submittedAt: string
  approvedAt?: string
  traffic: number
  leads: number
  ranking: number
  conversionRate: number
  roi: number
  qualityScore: number
  trend: 'up' | 'down' | 'stable'
}

interface DirectoryPerformanceAnalyticsProps {
  performanceMetrics: PerformanceMetrics
  realTimeMetrics: RealTimeMetrics
  className?: string
}

export function DirectoryPerformanceAnalytics({
  performanceMetrics,
  realTimeMetrics,
  className = ''
}: DirectoryPerformanceAnalyticsProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'search' | 'review' | 'industry'>('all')
  const [sortBy, setSortBy] = useState<'traffic' | 'roi' | 'quality' | 'leads'>('roi')

  // Mock directory performance data
  const directoryPerformances: DirectoryPerformance[] = useMemo(() => [
    {
      id: '1',
      name: 'Google My Business',
      category: 'search',
      status: 'live',
      submittedAt: '2024-01-15T10:00:00Z',
      approvedAt: '2024-01-18T14:30:00Z',
      traffic: 12500,
      leads: 85,
      ranking: 1,
      conversionRate: 4.2,
      roi: 485,
      qualityScore: 95,
      trend: 'up'
    },
    {
      id: '2',
      name: 'Yelp Business',
      category: 'review',
      status: 'live',
      submittedAt: '2024-01-20T09:15:00Z',
      approvedAt: '2024-01-25T11:00:00Z',
      traffic: 8750,
      leads: 62,
      ranking: 3,
      conversionRate: 3.8,
      roi: 325,
      qualityScore: 88,
      trend: 'up'
    },
    {
      id: '3',
      name: 'G2',
      category: 'review',
      status: 'live',
      submittedAt: '2024-02-01T14:20:00Z',
      approvedAt: '2024-02-08T16:45:00Z',
      traffic: 15200,
      leads: 127,
      ranking: 2,
      conversionRate: 5.1,
      roi: 672,
      qualityScore: 92,
      trend: 'up'
    },
    {
      id: '4',
      name: 'Capterra',
      category: 'review',
      status: 'live',
      submittedAt: '2024-01-28T11:30:00Z',
      approvedAt: '2024-02-05T10:15:00Z',
      traffic: 6800,
      leads: 48,
      ranking: 4,
      conversionRate: 3.2,
      roi: 245,
      qualityScore: 82,
      trend: 'stable'
    },
    {
      id: '5',
      name: 'TrustPilot',
      category: 'review',
      status: 'pending',
      submittedAt: '2024-02-10T16:00:00Z',
      traffic: 0,
      leads: 0,
      ranking: 0,
      conversionRate: 0,
      roi: 0,
      qualityScore: 0,
      trend: 'stable'
    },
    {
      id: '6',
      name: 'Industry Directory Pro',
      category: 'industry',
      status: 'submitted',
      submittedAt: '2024-02-08T13:45:00Z',
      traffic: 0,
      leads: 0,
      ranking: 0,
      conversionRate: 0,
      roi: 0,
      qualityScore: 0,
      trend: 'stable'
    }
  ], [])

  const filteredDirectories = useMemo(() => {
    let filtered = directoryPerformances
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(dir => dir.category === selectedCategory)
    }
    
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'traffic': return b.traffic - a.traffic
        case 'leads': return b.leads - a.leads
        case 'quality': return b.qualityScore - a.qualityScore
        case 'roi':
        default: return b.roi - a.roi
      }
    })
  }, [directoryPerformances, selectedCategory, sortBy])

  const liveDirectories = directoryPerformances.filter(d => d.status === 'live')
  const totalTraffic = liveDirectories.reduce((sum, d) => sum + d.traffic, 0)
  const totalLeads = liveDirectories.reduce((sum, d) => sum + d.leads, 0)
  const averageROI = liveDirectories.length > 0 
    ? liveDirectories.reduce((sum, d) => sum + d.roi, 0) / liveDirectories.length 
    : 0

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-success-500/10 text-success-400 border-success-500/30'
      case 'pending': return 'bg-warning-500/10 text-warning-400 border-warning-500/30'
      case 'submitted': return 'bg-volt-500/10 text-volt-400 border-volt-500/30'
      case 'rejected': return 'bg-danger-500/10 text-danger-400 border-danger-500/30'
      default: return 'bg-secondary-700 text-secondary-400 border-secondary-600'
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'search': return '🔍'
      case 'review': return '⭐'
      case 'industry': return '🏢'
      default: return '📁'
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Performance Overview */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            📊 Directory Performance Analytics
          </h3>
          
          <div className="flex items-center gap-3">
            <select 
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as typeof selectedTimeframe)}
              className="bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-1 text-sm text-white"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
        </div>

        {/* Key Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-secondary-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-success-400 mb-1">
              {liveDirectories.length}
            </div>
            <div className="text-sm text-secondary-400 mb-2">Live Directories</div>
            <div className="text-xs text-success-400">
              {performanceMetrics.submissionSuccessRate}% success rate
            </div>
          </div>

          <div className="bg-secondary-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-volt-400 mb-1">
              {totalTraffic.toLocaleString()}
            </div>
            <div className="text-sm text-secondary-400 mb-2">Total Traffic</div>
            <div className="text-xs text-volt-400">
              +{realTimeMetrics.trafficGrowth.toFixed(1)}% growth
            </div>
          </div>

          <div className="bg-secondary-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-volt-400 mb-1">
              {totalLeads}
            </div>
            <div className="text-sm text-secondary-400 mb-2">Total Leads</div>
            <div className="text-xs text-volt-400">
              {performanceMetrics.conversionRateImprovement.toFixed(1)}% improvement
            </div>
          </div>

          <div className="bg-secondary-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-success-400 mb-1">
              {averageROI.toFixed(0)}%
            </div>
            <div className="text-sm text-secondary-400 mb-2">Avg ROI</div>
            <div className="text-xs text-success-400">
              vs. {performanceMetrics.averageApprovalTime} day avg
            </div>
          </div>
        </div>

        {/* Performance Distribution Chart */}
        <div className="bg-secondary-700 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Traffic Distribution</h4>
          <div className="space-y-2">
            {liveDirectories.slice(0, 5).map((directory) => {
              const percentage = (directory.traffic / totalTraffic) * 100
              return (
                <div key={directory.id} className="flex items-center gap-3">
                  <div className="w-24 text-sm text-secondary-300 truncate">
                    {directory.name}
                  </div>
                  <div className="flex-1 bg-secondary-600 rounded-full h-2">
                    <div 
                      className="bg-volt-400 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-16 text-sm text-white text-right">
                    {percentage.toFixed(1)}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Directory List with Controls */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold text-white">Directory Performance Details</h3>
          
          <div className="flex items-center gap-3">
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as typeof selectedCategory)}
              className="bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="all">All Categories</option>
              <option value="search">Search Engines</option>
              <option value="review">Review Platforms</option>
              <option value="industry">Industry Specific</option>
            </select>
            
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="roi">Sort by ROI</option>
              <option value="traffic">Sort by Traffic</option>
              <option value="leads">Sort by Leads</option>
              <option value="quality">Sort by Quality</option>
            </select>
          </div>
        </div>

        {/* Directory Performance Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredDirectories.map((directory) => (
            <div key={directory.id} className="bg-secondary-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getCategoryIcon(directory.category)}</span>
                  <div>
                    <h4 className="font-semibold text-white">{directory.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(directory.status)}`}>
                        {directory.status.toUpperCase()}
                      </span>
                      {directory.status === 'live' && (
                        <span className="text-xs text-secondary-400">
                          Rank #{directory.ranking}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {directory.status === 'live' && (
                  <div className="text-right">
                    <div className={`flex items-center gap-1 ${getTrendColor(directory.trend)}`}>
                      <span>{getTrendIcon(directory.trend)}</span>
                      <span className="text-sm font-medium">{directory.roi}% ROI</span>
                    </div>
                  </div>
                )}
              </div>

              {directory.status === 'live' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-secondary-400 mb-1">Traffic</div>
                    <div className="text-lg font-bold text-volt-400">
                      {directory.traffic.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-secondary-400 mb-1">Leads</div>
                    <div className="text-lg font-bold text-success-400">
                      {directory.leads}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-secondary-400 mb-1">Conversion</div>
                    <div className="text-lg font-bold text-white">
                      {directory.conversionRate}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-secondary-400 mb-1">Quality Score</div>
                    <div className="text-lg font-bold text-white">
                      {directory.qualityScore}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-secondary-400">
                    Submitted: {new Date(directory.submittedAt).toLocaleDateString()}
                  </div>
                  {directory.status === 'pending' && (
                    <div className="text-sm text-warning-400">
                      ⏳ Awaiting approval (avg. {performanceMetrics.averageApprovalTime} days)
                    </div>
                  )}
                  {directory.status === 'submitted' && (
                    <div className="text-sm text-volt-400">
                      📝 Under review
                    </div>
                  )}
                </div>
              )}

              {directory.status === 'live' && (
                <div className="mt-4 pt-3 border-t border-secondary-600">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary-400">Performance Score</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-secondary-600 rounded-full h-1.5">
                        <div 
                          className="bg-volt-400 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${directory.qualityScore}%` }}
                        />
                      </div>
                      <span className="text-white font-medium">{directory.qualityScore}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Performance Insights */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          💡 Performance Insights
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-success-500/10 border border-success-500/20 rounded-lg p-4">
              <h4 className="font-semibold text-success-400 mb-2">🎯 Top Performers</h4>
              <p className="text-sm text-secondary-300 mb-3">
                G2 and Google My Business are driving 68% of your directory traffic with exceptional ROI.
              </p>
              <div className="text-xs text-success-400">
                ✅ Consider increasing investment in similar high-authority platforms
              </div>
            </div>

            <div className="bg-warning-500/10 border border-warning-500/20 rounded-lg p-4">
              <h4 className="font-semibold text-warning-400 mb-2">⚠️ Optimization Opportunity</h4>
              <p className="text-sm text-secondary-300 mb-3">
                Capterra shows lower conversion rates (3.2%) compared to category average (4.1%).
              </p>
              <div className="text-xs text-warning-400">
                🔧 Review listing optimization and customer testimonials
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-volt-500/10 border border-volt-500/20 rounded-lg p-4">
              <h4 className="font-semibold text-volt-400 mb-2">📈 Growth Trends</h4>
              <p className="text-sm text-secondary-300 mb-3">
                Directory traffic has grown 23.5% this month, with review platforms leading growth.
              </p>
              <div className="text-xs text-volt-400">
                📊 Focus on review platform optimization for continued growth
              </div>
            </div>

            <div className="bg-secondary-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-2">🔮 Predictions</h4>
              <p className="text-sm text-secondary-300 mb-3">
                Based on current trends, expect 15% traffic increase in next 30 days.
              </p>
              <div className="text-xs text-secondary-400">
                AI-powered forecast based on historical performance
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DirectoryPerformanceAnalytics