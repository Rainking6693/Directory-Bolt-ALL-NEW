'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Directory } from '../../lib/types/directory'

interface BusinessAnalysis {
  businessType: string
  industry: string
  targetAudience: string
  location?: string
  businessModel: 'B2B' | 'B2C' | 'B2B2C'
  stage: 'startup' | 'growth' | 'established'
  budget: 'low' | 'medium' | 'high'
  goals: string[]
}

interface RecommendationEngineProps {
  businessAnalysis: BusinessAnalysis
  directories: Directory[]
  selectedDirectories: string[]
  onRecommendationSelect: (directoryId: string) => void
}

interface Recommendation {
  directory: Directory
  score: number
  reasons: string[]
  priority: 'high' | 'medium' | 'low'
  category: 'essential' | 'recommended' | 'optional'
}

const INDUSTRY_CATEGORY_MAPPING = {
  'technology': ['tech_startups', 'saas', 'ai_tools'],
  'healthcare': ['healthcare'],
  'finance': ['finance'],
  'legal': ['legal'],
  'education': ['education'],
  'retail': ['ecommerce', 'local_business'],
  'restaurant': ['restaurants', 'local_business'],
  'real_estate': ['real_estate'],
  'automotive': ['automotive'],
  'professional_services': ['professional_services'],
  'non_profit': ['non_profit'],
  'entertainment': ['content_media'],
  'social': ['social_media']
}

const STAGE_PRIORITY_MAPPING = {
  'startup': {
    preferFree: true,
    maxPrice: 5000, // $50
    preferEasy: true,
    minDA: 60
  },
  'growth': {
    preferFree: false,
    maxPrice: 25000, // $250
    preferEasy: false,
    minDA: 70
  },
  'established': {
    preferFree: false,
    maxPrice: 100000, // $1000
    preferEasy: false,
    minDA: 80
  }
}

export function RecommendationEngine({
  businessAnalysis,
  directories,
  selectedDirectories,
  onRecommendationSelect
}: RecommendationEngineProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<'essential' | 'recommended' | 'optional'>('essential')

  const recommendations = useMemo(() => {
    const stagePrefs = STAGE_PRIORITY_MAPPING[businessAnalysis.stage]
    const industryCategories = INDUSTRY_CATEGORY_MAPPING[businessAnalysis.industry.toLowerCase() as keyof typeof INDUSTRY_CATEGORY_MAPPING] || ['business_general']
    
    const scoredDirectories: Recommendation[] = directories.map(directory => {
      let score = 0
      const reasons: string[] = []

      // Category relevance (40 points max)
      if (industryCategories.includes(directory.category)) {
        score += 40
        reasons.push(`Perfect match for ${businessAnalysis.industry} industry`)
      } else if (directory.category === 'business_general') {
        score += 20
        reasons.push('Universal business directory')
      }

      // Domain Authority bonus (20 points max)
      if (directory.domain_authority >= stagePrefs.minDA) {
        score += Math.min(20, (directory.domain_authority - 50) / 2.5)
        if (directory.domain_authority >= 90) {
          reasons.push('Premium high-authority platform')
        } else if (directory.domain_authority >= 80) {
          reasons.push('High-authority directory')
        }
      }

      // Price consideration (15 points max)
      const directoryPrice = directory.submission_fee || 0
      if (directoryPrice === 0) {
        score += 15
        reasons.push('Free submission')
      } else if (directoryPrice <= stagePrefs.maxPrice) {
        score += Math.max(5, 15 - (directoryPrice / stagePrefs.maxPrice) * 10)
        if (directoryPrice <= 2500) {
          reasons.push('Affordable pricing')
        }
      } else {
        score -= 10
        reasons.push('Premium pricing - consider if budget allows')
      }

      // Difficulty consideration (10 points max)
      if (stagePrefs.preferEasy && directory.difficulty === 'Easy') {
        score += 10
        reasons.push('Easy submission process')
      } else if (directory.difficulty === 'Medium') {
        score += 5
        reasons.push('Moderate submission requirements')
      }

      // Business model alignment (10 points max)
      if (businessAnalysis.businessModel === 'B2B' && directory.category.includes('professional')) {
        score += 10
        reasons.push('Ideal for B2B businesses')
      } else if (businessAnalysis.businessModel === 'B2C' && directory.category === 'local_business') {
        score += 10
        reasons.push('Great for consumer-facing businesses')
      }

      // Location relevance (5 points max)
      if (businessAnalysis.location && directory.category === 'local_business') {
        score += 5
        reasons.push('Important for local visibility')
      }

      // Penalize if already selected
      if (selectedDirectories.includes(directory.id)) {
        score -= 20
        reasons.push('Already selected')
      }

      // Determine priority and category
      let priority: 'high' | 'medium' | 'low' = 'low'
      let category: 'essential' | 'recommended' | 'optional' = 'optional'

      if (score >= 70) {
        priority = 'high'
        category = 'essential'
      } else if (score >= 50) {
        priority = 'medium'
        category = 'recommended'
      } else if (score >= 30) {
        priority = 'low'
        category = 'optional'
      }

      return {
        directory,
        score,
        reasons,
        priority,
        category
      }
    })

    // Sort by score and return top recommendations
    return scoredDirectories
      .filter(rec => rec.score >= 20) // Only show decent matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 50) // Limit recommendations
  }, [businessAnalysis, directories, selectedDirectories])

  const categorizedRecommendations = useMemo(() => {
    return {
      essential: recommendations.filter(r => r.category === 'essential').slice(0, 10),
      recommended: recommendations.filter(r => r.category === 'recommended').slice(0, 15),
      optional: recommendations.filter(r => r.category === 'optional').slice(0, 25)
    }
  }, [recommendations])

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400'
    if (score >= 50) return 'text-volt-400'
    if (score >= 30) return 'text-orange-400'
    return 'text-red-400'
  }

  const getPriorityIcon = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return '🚀'
      case 'medium': return '⭐'
      case 'low': return '💡'
    }
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-secondary-800/50 rounded-xl p-6 border border-secondary-700">
        <div className="text-center">
          <div className="text-secondary-400 mb-2">No recommendations available</div>
          <p className="text-sm text-secondary-500">
            Provide business analysis to get personalized directory recommendations
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-volt-900/20 to-volt-800/10 rounded-xl p-6 border border-volt-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-volt-500 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-secondary-900" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-volt-400">Smart Recommendations</h3>
            <p className="text-sm text-secondary-400">
              Tailored for {businessAnalysis.industry} • {businessAnalysis.stage} stage
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-volt-400 hover:text-volt-300 transition-colors"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-6">
          {/* Category Tabs */}
          <div className="flex bg-secondary-800/50 rounded-lg p-1">
            {[
              { key: 'essential', label: 'Essential', count: categorizedRecommendations.essential.length },
              { key: 'recommended', label: 'Recommended', count: categorizedRecommendations.recommended.length },
              { key: 'optional', label: 'Optional', count: categorizedRecommendations.optional.length }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedCategory(tab.key as any)}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  selectedCategory === tab.key
                    ? 'bg-volt-500 text-secondary-900'
                    : 'text-secondary-300 hover:text-white'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Business Analysis Summary */}
          <div className="p-4 bg-secondary-800/30 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-secondary-500">Industry:</span>
                <div className="font-medium text-white capitalize">{businessAnalysis.industry}</div>
              </div>
              <div>
                <span className="text-secondary-500">Stage:</span>
                <div className="font-medium text-white capitalize">{businessAnalysis.stage}</div>
              </div>
              <div>
                <span className="text-secondary-500">Model:</span>
                <div className="font-medium text-white">{businessAnalysis.businessModel}</div>
              </div>
              <div>
                <span className="text-secondary-500">Budget:</span>
                <div className="font-medium text-white capitalize">{businessAnalysis.budget}</div>
              </div>
            </div>
          </div>

          {/* Recommendations List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {categorizedRecommendations[selectedCategory].map((recommendation, index) => (
              <div
                key={recommendation.directory.id}
                className={`flex items-center gap-4 p-4 bg-secondary-800/50 rounded-lg border transition-all duration-300 hover:bg-secondary-700/50 ${
                  selectedDirectories.includes(recommendation.directory.id)
                    ? 'border-volt-500/50 bg-volt-900/20'
                    : 'border-secondary-600 hover:border-secondary-500'
                }`}
              >
                {/* Priority & Score */}
                <div className="flex flex-col items-center">
                  <span className="text-lg">{getPriorityIcon(recommendation.priority)}</span>
                  <span className={`text-xs font-bold ${getScoreColor(recommendation.score)}`}>
                    {Math.round(recommendation.score)}%
                  </span>
                </div>

                {/* Directory Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-white truncate">{recommendation.directory.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-secondary-700 text-xs rounded">
                        DA {recommendation.directory.domain_authority}
                      </span>
                      {(recommendation.directory.submission_fee || 0) === 0 && (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded font-bold">
                          FREE
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-secondary-400 mb-2 capitalize">
                    {recommendation.directory.category.replace(/_/g, ' ')}
                  </div>
                  
                  <div className="space-y-1">
                    {recommendation.reasons.slice(0, 2).map((reason, idx) => (
                      <div key={idx} className="text-xs text-secondary-300 flex items-center gap-2">
                        <div className="w-1 h-1 bg-volt-500 rounded-full"></div>
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => onRecommendationSelect(recommendation.directory.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDirectories.includes(recommendation.directory.id)
                      ? 'bg-volt-500 text-secondary-900'
                      : 'bg-secondary-700 text-white hover:bg-secondary-600'
                  }`}
                >
                  {selectedDirectories.includes(recommendation.directory.id) ? 'Selected' : 'Select'}
                </button>
              </div>
            ))}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-secondary-600">
            <div className="text-sm text-secondary-400">
              Showing {categorizedRecommendations[selectedCategory].length} {selectedCategory} recommendations
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  categorizedRecommendations[selectedCategory]
                    .filter(r => !selectedDirectories.includes(r.directory.id))
                    .forEach(r => onRecommendationSelect(r.directory.id))
                }}
                className="px-4 py-2 bg-volt-500 text-secondary-900 rounded-lg hover:bg-volt-400 transition-colors text-sm font-medium"
              >
                Select All {selectedCategory}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}