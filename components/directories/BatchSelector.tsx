'use client'

import { useState } from 'react'

interface SelectionStats {
  totalDirectories: number
  highDADirectories: number
  freeDirectories: number
  totalTraffic: number
  totalCost: number
  averageApprovalTime: number
}

interface BatchSelectorProps {
  selectedCount: number
  totalCount: number
  isAllSelected: boolean
  onSelectAll: () => void
  onClearAll: () => void
  selectionStats: SelectionStats
}

const PRESET_SELECTIONS = [
  {
    id: 'starter-pack',
    name: 'Starter Pack',
    description: 'High-DA free directories perfect for beginners',
    icon: '🚀',
    color: 'bg-green-600',
    criteria: {
      minDA: 70,
      maxPrice: 0,
      maxCount: 10,
      difficulty: 'Easy'
    }
  },
  {
    id: 'high-authority',
    name: 'Authority Boost',
    description: 'Premium directories with DA 80+ for maximum impact',
    icon: '⚡',
    color: 'bg-volt-500',
    criteria: {
      minDA: 80,
      maxCount: 25
    }
  },
  {
    id: 'local-business',
    name: 'Local Focus',
    description: 'Best directories for local business visibility',
    icon: '📍',
    color: 'bg-blue-600',
    criteria: {
      category: 'local_business',
      maxCount: 20
    }
  },
  {
    id: 'tech-startup',
    name: 'Tech Startup',
    description: 'Curated for technology companies and startups',
    icon: '💻',
    color: 'bg-purple-600',
    criteria: {
      categories: ['tech_startups', 'saas'],
      maxCount: 30
    }
  },
  {
    id: 'comprehensive',
    name: 'Full Coverage',
    description: 'Complete directory coverage across all categories',
    icon: '🎯',
    color: 'bg-orange-600',
    criteria: {
      minDA: 50,
      maxCount: 100
    }
  }
]

export function BatchSelector({
  selectedCount,
  totalCount,
  isAllSelected,
  onSelectAll,
  onClearAll,
  selectionStats
}: BatchSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showPresets, setShowPresets] = useState(false)

  const formatTraffic = (traffic: number) => {
    if (traffic >= 1000000) return `${(traffic / 1000000).toFixed(1)}M`
    if (traffic >= 1000) return `${Math.round(traffic / 1000)}K`
    return traffic.toString()
  }

  const formatCost = (cost: number) => {
    if (cost === 0) return 'FREE'
    return `$${(cost / 100).toLocaleString()}`
  }

  const getSelectionColor = () => {
    if (selectedCount === 0) return 'text-secondary-400'
    if (selectedCount < 10) return 'text-green-400'
    if (selectedCount < 25) return 'text-volt-400'
    if (selectedCount < 50) return 'text-orange-400'
    return 'text-red-400'
  }

  const getSelectionRecommendation = () => {
    if (selectedCount === 0) return 'Select directories to get started'
    if (selectedCount < 5) return 'Consider selecting more directories for better coverage'
    if (selectedCount <= 15) return 'Good selection for focused campaign'
    if (selectedCount <= 30) return 'Comprehensive coverage - excellent choice'
    if (selectedCount <= 50) return 'Extensive reach - perfect for growth stage'
    return 'Maximum coverage - ideal for established businesses'
  }

  return (
    <div className="relative">
      {/* Main Batch Selector Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-4 py-2 bg-secondary-800 border border-secondary-600 rounded-lg hover:border-volt-400 transition-colors"
        >
          <span className={`font-bold ${getSelectionColor()}`}>
            {selectedCount}
          </span>
          <span className="text-secondary-300">selected</span>
          <svg 
            className={`w-4 h-4 text-secondary-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSelectAll}
            disabled={isAllSelected}
            className="px-3 py-2 text-sm bg-volt-500 text-secondary-900 rounded-lg hover:bg-volt-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAllSelected ? 'All Selected' : 'Select All'}
          </button>
          
          {selectedCount > 0 && (
            <button
              onClick={onClearAll}
              className="px-3 py-2 text-sm text-secondary-300 hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Preset Selector Toggle */}
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="px-3 py-2 text-sm bg-secondary-700 text-white rounded-lg hover:bg-secondary-600 transition-colors"
        >
          Quick Select
        </button>
      </div>

      {/* Expanded Selection Details */}
      {isExpanded && (
        <div className="absolute top-full left-0 right-0 mt-2 p-6 bg-secondary-800 border border-secondary-600 rounded-xl shadow-2xl z-50 min-w-96">
          <div className="space-y-4">
            {/* Selection Overview */}
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-white">Selection Summary</h4>
              <span className="text-sm text-secondary-400">
                {selectedCount} of {totalCount} directories
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-secondary-300">Coverage</span>
                <span className={getSelectionColor()}>
                  {((selectedCount / totalCount) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-secondary-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-volt-500 to-volt-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((selectedCount / totalCount) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-secondary-400">
                {getSelectionRecommendation()}
              </p>
            </div>

            {/* Selection Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-secondary-900/50 rounded-lg">
                <div className="text-lg font-bold text-success-400">
                  {selectionStats.highDADirectories}
                </div>
                <div className="text-xs text-secondary-500">High DA (80+)</div>
              </div>
              
              <div className="text-center p-3 bg-secondary-900/50 rounded-lg">
                <div className="text-lg font-bold text-green-400">
                  {selectionStats.freeDirectories}
                </div>
                <div className="text-xs text-secondary-500">Free Submissions</div>
              </div>
              
              <div className="text-center p-3 bg-secondary-900/50 rounded-lg">
                <div className="text-lg font-bold text-volt-400">
                  {formatTraffic(selectionStats.totalTraffic)}
                </div>
                <div className="text-xs text-secondary-500">Monthly Traffic</div>
              </div>
              
              <div className="text-center p-3 bg-secondary-900/50 rounded-lg">
                <div className="text-lg font-bold text-orange-400">
                  {formatCost(selectionStats.totalCost)}
                </div>
                <div className="text-xs text-secondary-500">Total Fees</div>
              </div>
            </div>

            {/* Estimated Timeline */}
            {selectedCount > 0 && (
              <div className="p-4 bg-volt-900/20 border border-volt-500/30 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-volt-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-secondary-900" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-volt-400">Estimated Timeline</div>
                    <div className="text-sm text-secondary-300">
                      Average approval: {Math.round(selectionStats.averageApprovalTime)} days
                    </div>
                  </div>
                </div>
                <div className="text-xs text-secondary-400">
                  Most submissions will be processed within 1-2 weeks. Some premium directories may take longer.
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-secondary-700">
              <button
                onClick={() => setIsExpanded(false)}
                className="text-secondary-400 hover:text-white transition-colors"
              >
                Close
              </button>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    onClearAll()
                    setIsExpanded(false)
                  }}
                  className="px-4 py-2 text-secondary-300 hover:text-white transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="px-6 py-2 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold rounded-lg hover:from-volt-400 hover:to-volt-500 transition-colors"
                >
                  Continue with Selection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preset Selection Modal */}
      {showPresets && (
        <div className="absolute top-full left-0 right-0 mt-2 p-6 bg-secondary-800 border border-secondary-600 rounded-xl shadow-2xl z-50 min-w-96">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-white">Quick Selection Presets</h4>
              <button
                onClick={() => setShowPresets(false)}
                className="text-secondary-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid gap-3">
              {PRESET_SELECTIONS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    // TODO: Implement preset selection logic
                    setShowPresets(false)
                  }}
                  className="flex items-center gap-4 p-4 bg-secondary-700/50 rounded-lg hover:bg-secondary-700 transition-colors text-left"
                >
                  <div className={`w-10 h-10 ${preset.color} rounded-lg flex items-center justify-center text-white font-bold`}>
                    {preset.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white">{preset.name}</div>
                    <div className="text-sm text-secondary-400">{preset.description}</div>
                  </div>
                  <div className="text-volt-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            <div className="pt-4 border-t border-secondary-700">
              <button
                onClick={() => setShowPresets(false)}
                className="w-full px-4 py-2 text-secondary-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Hint */}
      {selectedCount > 0 && (
        <div className="absolute -bottom-8 left-0 text-xs text-secondary-500">
          Press Ctrl+A to select all, Escape to clear selection
        </div>
      )}
    </div>
  )
}