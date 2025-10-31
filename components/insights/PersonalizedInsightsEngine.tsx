'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface PersonalizedInsight {
  id: string
  type: 'tip' | 'warning' | 'success' | 'info' | 'opportunity'
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    href?: string
  }
  priority: 'low' | 'medium' | 'high' | 'critical'
  category: 'performance' | 'optimization' | 'growth' | 'maintenance' | 'marketing'
  relevanceScore: number
  basedOn: string[]
  createdAt: string
  expiresAt?: string
  dismissed?: boolean
  acted?: boolean
}

export interface UsagePattern {
  userId: string
  features: Record<string, number>
  timeSpent: Record<string, number>
  goals: string[]
  challenges: string[]
  preferences: Record<string, any>
  businessMetrics: {
    industry: string
    size: 'small' | 'medium' | 'large'
    growth: 'startup' | 'growing' | 'established'
    location: string
    targets: string[]
  }
}

interface PersonalizedInsightsEngineProps {
  userId: string
  userTier: string
  usagePattern: UsagePattern
  onInsightAction?: (insight: PersonalizedInsight) => void
  className?: string
}

export default function PersonalizedInsightsEngine({
  userId,
  userTier,
  usagePattern,
  onInsightAction,
  className = ''
}: PersonalizedInsightsEngineProps) {
  const [insights, setInsights] = useState<PersonalizedInsight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | PersonalizedInsight['category']>('all')

  useEffect(() => {
    generateInsights()
  }, [userId, usagePattern])

  const generateInsights = async () => {
    setIsLoading(true)
    try {
      // In production, this would call an API that uses ML/AI to generate insights
      const generatedInsights = await generatePersonalizedInsights(userId, userTier, usagePattern)
      setInsights(generatedInsights)
    } catch (error) {
      console.error('Failed to generate insights:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const dismissInsight = (insightId: string) => {
    setInsights(prev => prev.map(insight => 
      insight.id === insightId ? { ...insight, dismissed: true } : insight
    ))
  }

  const markAsActed = (insightId: string) => {
    setInsights(prev => prev.map(insight => 
      insight.id === insightId ? { ...insight, acted: true } : insight
    ))
  }

  const handleInsightAction = (insight: PersonalizedInsight) => {
    if (insight.action?.onClick) {
      insight.action.onClick()
    }
    markAsActed(insight.id)
    onInsightAction?.(insight)
  }

  const filteredInsights = insights.filter(insight => {
    if (insight.dismissed) return false
    if (filter === 'all') return true
    return insight.category === filter
  })

  const sortedInsights = filteredInsights.sort((a, b) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority] - priorityOrder[a.priority] || b.relevanceScore - a.relevanceScore
  })

  const getInsightIcon = (type: PersonalizedInsight['type']) => {
    switch (type) {
      case 'tip': return '💡'
      case 'warning': return '⚠️'
      case 'success': return '✅'
      case 'info': return 'ℹ️'
      case 'opportunity': return '🚀'
      default: return '📋'
    }
  }

  const getInsightColor = (type: PersonalizedInsight['type']) => {
    switch (type) {
      case 'tip': return 'border-blue-500/30 bg-blue-500/10'
      case 'warning': return 'border-orange-500/30 bg-orange-500/10'
      case 'success': return 'border-green-500/30 bg-green-500/10'
      case 'info': return 'border-gray-500/30 bg-gray-500/10'
      case 'opportunity': return 'border-volt-500/30 bg-volt-500/10'
      default: return 'border-secondary-600 bg-secondary-700/50'
    }
  }

  const getPriorityColor = (priority: PersonalizedInsight['priority']) => {
    switch (priority) {
      case 'critical': return 'text-red-400'
      case 'high': return 'text-orange-400'
      case 'medium': return 'text-volt-400'
      case 'low': return 'text-green-400'
      default: return 'text-secondary-400'
    }
  }

  if (isLoading) {
    return (
      <div className={`${className} space-y-4`}>
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-secondary-800 rounded-lg h-24" />
        ))}
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🧠 Personalized Insights
          </h2>
          <p className="text-secondary-400 text-sm">
            AI-powered recommendations based on your usage patterns
          </p>
        </div>

        <button
          onClick={generateInsights}
          className="px-4 py-2 bg-volt-500/20 text-volt-400 rounded-lg hover:bg-volt-500/30 transition-colors text-sm font-medium"
        >
          Refresh Insights
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['all', 'performance', 'optimization', 'growth', 'maintenance', 'marketing'].map(category => (
          <button
            key={category}
            onClick={() => setFilter(category as any)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === category
                ? 'bg-volt-500/20 text-volt-400'
                : 'text-secondary-400 hover:text-secondary-300 hover:bg-secondary-700'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Insights List */}
      <div className="space-y-4">
        <AnimatePresence>
          {sortedInsights.map(insight => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className={`border rounded-lg p-4 ${getInsightColor(insight.type)}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-2xl">{getInsightIcon(insight.type)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{insight.title}</h3>
                      <span className={`text-xs font-medium ${getPriorityColor(insight.priority)}`}>
                        {insight.priority.toUpperCase()}
                      </span>
                      {insight.acted && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                          ✓ Acted
                        </span>
                      )}
                    </div>
                    <p className="text-secondary-300 text-sm leading-relaxed">
                      {insight.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => setExpandedInsight(
                      expandedInsight === insight.id ? null : insight.id
                    )}
                    className="text-secondary-400 hover:text-secondary-300 p-1"
                    title="View Details"
                  >
                    {expandedInsight === insight.id ? '▼' : '▶'}
                  </button>
                  <button
                    onClick={() => dismissInsight(insight.id)}
                    className="text-secondary-400 hover:text-red-400 p-1"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {expandedInsight === insight.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-secondary-600/50 pt-3 mt-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <h4 className="font-medium text-white mb-2">Based On:</h4>
                        <ul className="text-secondary-300 space-y-1">
                          {insight.basedOn.map((factor, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-volt-400 rounded-full" />
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-white mb-2">Details:</h4>
                        <div className="text-secondary-300 space-y-1">
                          <div>Category: <span className="capitalize">{insight.category}</span></div>
                          <div>Relevance: {Math.round(insight.relevanceScore * 100)}%</div>
                          <div>Created: {new Date(insight.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action */}
              {insight.action && !insight.acted && (
                <div className="mt-4 pt-3 border-t border-secondary-600/50">
                  <button
                    onClick={() => handleInsightAction(insight)}
                    className="bg-volt-500 hover:bg-volt-400 text-secondary-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {insight.action.label}
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {sortedInsights.length === 0 && (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">🎯</span>
            <h3 className="text-lg font-semibold text-white mb-2">
              You're doing great!
            </h3>
            <p className="text-secondary-400">
              No urgent insights at the moment. Keep up the good work!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Mock insight generation function (would be replaced with AI/ML service)
async function generatePersonalizedInsights(
  userId: string, 
  userTier: string, 
  usagePattern: UsagePattern
): Promise<PersonalizedInsight[]> {
  const insights: PersonalizedInsight[] = []

  // Performance insights
  if (usagePattern.businessMetrics.growth === 'startup') {
    insights.push({
      id: 'startup-optimization',
      type: 'opportunity',
      title: 'Optimize for Startup Growth',
      description: 'As a startup, focus on local directories first to build immediate presence and credibility in your area.',
      priority: 'high',
      category: 'growth',
      relevanceScore: 0.9,
      basedOn: ['Business size: startup', 'Industry analysis', 'Local market focus'],
      createdAt: new Date().toISOString(),
      action: {
        label: 'View Local Directory Strategy',
        onClick: () => console.log('Navigate to local directory strategy')
      }
    })
  }

  // Feature usage insights
  const seoToolsUsage = usagePattern.features['seo-tools'] || 0
  if (userTier !== 'starter' && seoToolsUsage < 3) {
    insights.push({
      id: 'underused-seo-tools',
      type: 'tip',
      title: 'You\'re Missing SEO Opportunities',
      description: 'Your plan includes powerful SEO tools that you haven\'t explored yet. These can significantly boost your search rankings.',
      priority: 'medium',
      category: 'optimization',
      relevanceScore: 0.8,
      basedOn: ['Low SEO tools usage', 'Professional/Enterprise tier', 'Available features'],
      createdAt: new Date().toISOString(),
      action: {
        label: 'Explore SEO Tools',
        onClick: () => console.log('Navigate to SEO tools')
      }
    })
  }

  // Industry-specific insights
  if (usagePattern.businessMetrics.industry === 'Technology') {
    insights.push({
      id: 'tech-industry-directories',
      type: 'info',
      title: 'Tech-Specific Directory Recommendations',
      description: 'Based on your technology focus, consider submitting to specialized tech directories like AngelList, Product Hunt, and Crunchbase.',
      priority: 'medium',
      category: 'marketing',
      relevanceScore: 0.7,
      basedOn: ['Technology industry', 'Industry best practices', 'Competitive analysis'],
      createdAt: new Date().toISOString(),
      action: {
        label: 'View Tech Directories',
        onClick: () => console.log('Show tech-specific directories')
      }
    })
  }

  // Maintenance insights
  const lastActivity = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
  insights.push({
    id: 'profile-update-reminder',
    type: 'warning',
    title: 'Profile Information Needs Update',
    description: 'Your business profile hasn\'t been updated in over 6 months. Fresh information improves directory approval rates.',
    priority: 'low',
    category: 'maintenance',
    relevanceScore: 0.6,
    basedOn: ['Profile last updated', 'Directory approval patterns', 'Best practices'],
    createdAt: new Date().toISOString(),
    action: {
      label: 'Update Profile',
      onClick: () => console.log('Navigate to profile editor')
    }
  })

  // Goal-based insights
  if (usagePattern.goals.includes('increase-visibility')) {
    insights.push({
      id: 'visibility-boost-strategy',
      type: 'opportunity',
      title: 'Accelerate Your Visibility Goals',
      description: 'You can increase visibility 40% faster by focusing on high-traffic directories in your industry first.',
      priority: 'high',
      category: 'growth',
      relevanceScore: 0.9,
      basedOn: ['Visibility goals', 'Industry analysis', 'Directory traffic data'],
      createdAt: new Date().toISOString(),
      action: {
        label: 'See Recommended Directories',
        onClick: () => console.log('Show high-traffic directories')
      }
    })
  }

  return insights
}