'use client'
import { useState, useMemo } from 'react'

const DIFFICULTY_CONFIG = {
  easy: {
    color: 'text-success-400 bg-success-400/10',
    icon: '🟢',
    label: 'Easy'
  },
  medium: {
    color: 'text-volt-400 bg-volt-400/10',
    icon: '🟡',
    label: 'Medium'
  },
  hard: {
    color: 'text-danger-400 bg-danger-400/10',
    icon: '🔴',
    label: 'Hard'
  }
}

export default function SubmissionQueue({
  selectedDirectories = [],
  onRemoveDirectory = () => {},
  onStartSubmission = () => {},
  onClearQueue = () => {},
  isSubmitting = false,
  userTier = 'starter',
  creditCost = 1
}) {
  const [sortBy, setSortBy] = useState('authority') // authority, name, difficulty, category
  const [showCostBreakdown, setShowCostBreakdown] = useState(false)
  const [submissionPriority, setSubmissionPriority] = useState('recommended') // recommended, authority, easy_first

  // Sort selected directories
  const sortedDirectories = useMemo(() => {
    const sorted = [...selectedDirectories]

    switch (sortBy) {
      case 'authority':
        sorted.sort((a, b) => b.authority - a.authority)
        break
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'difficulty':
        const difficultyOrder = { easy: 1, medium: 2, hard: 3 }
        sorted.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty])
        break
      case 'category':
        sorted.sort((a, b) => a.category.localeCompare(b.category))
        break
    }

    return sorted
  }, [selectedDirectories, sortBy])

  // Calculate submission stats
  const stats = useMemo(() => {
    const total = selectedDirectories.length
    const totalCredits = total * creditCost
    const freeDirectories = selectedDirectories.filter(dir => dir.price === 0).length
    const paidDirectories = selectedDirectories.filter(dir => dir.price > 0).length
    const totalFees = selectedDirectories.reduce((sum, dir) => sum + (dir.price || 0), 0)
    
    const byDifficulty = {
      easy: selectedDirectories.filter(dir => dir.difficulty === 'easy').length,
      medium: selectedDirectories.filter(dir => dir.difficulty === 'medium').length,
      hard: selectedDirectories.filter(dir => dir.difficulty === 'hard').length
    }

    const byCategory = {}
    selectedDirectories.forEach(dir => {
      byCategory[dir.category] = (byCategory[dir.category] || 0) + 1
    })

    const avgAuthority = total > 0 ? 
      Math.round(selectedDirectories.reduce((sum, dir) => sum + dir.authority, 0) / total) : 0

    const estimatedTraffic = selectedDirectories.reduce((sum, dir) => sum + (dir.estimatedTraffic || 0), 0)

    return {
      total,
      totalCredits,
      totalFees,
      freeDirectories,
      paidDirectories,
      byDifficulty,
      byCategory,
      avgAuthority,
      estimatedTraffic
    }
  }, [selectedDirectories, creditCost])

  const getRecommendedOrder = () => {
    // Recommended submission order: High authority easy/medium first, then hard directories
    return [...selectedDirectories].sort((a, b) => {
      // Primary: Easy/Medium with high authority first
      if (a.difficulty !== 'hard' && b.difficulty === 'hard') return -1
      if (a.difficulty === 'hard' && b.difficulty !== 'hard') return 1
      
      // Secondary: Authority score
      return b.authority - a.authority
    })
  }

  if (selectedDirectories.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-xl font-bold text-white mb-2">
          No Directories Selected
        </h3>
        <p className="text-secondary-300">
          Select directories from the grid above to build your submission queue.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Queue Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-white mb-2">
              Submission Queue
            </h2>
            <p className="text-secondary-300">
              {stats.total} directories ready for submission
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-volt-400">
              {stats.totalCredits} credits
            </div>
            {stats.totalFees > 0 && (
              <div className="text-sm text-secondary-300">
                + ${stats.totalFees} in fees
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-secondary-900/50 rounded-lg p-4 text-center">
            <div className="text-volt-400 font-bold text-lg">{stats.avgAuthority}</div>
            <div className="text-xs text-secondary-400">Avg Authority</div>
          </div>
          <div className="bg-secondary-900/50 rounded-lg p-4 text-center">
            <div className="text-success-400 font-bold text-lg">{stats.freeDirectories}</div>
            <div className="text-xs text-secondary-400">Free</div>
          </div>
          <div className="bg-secondary-900/50 rounded-lg p-4 text-center">
            <div className="text-orange-400 font-bold text-lg">{stats.paidDirectories}</div>
            <div className="text-xs text-secondary-400">Paid</div>
          </div>
          <div className="bg-secondary-900/50 rounded-lg p-4 text-center">
            <div className="text-purple-400 font-bold text-lg">
              {stats.estimatedTraffic >= 1000 ? `${Math.floor(stats.estimatedTraffic / 1000)}K` : stats.estimatedTraffic}
            </div>
            <div className="text-xs text-secondary-400">Est. Traffic/mo</div>
          </div>
        </div>

        {/* Difficulty Breakdown */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4 text-sm">
            {Object.entries(stats.byDifficulty).map(([difficulty, count]) => {
              if (count === 0) return null
              const config = DIFFICULTY_CONFIG[difficulty]
              return (
                <div key={difficulty} className={`flex items-center gap-2 px-3 py-1 rounded-full ${config.color}`}>
                  <span>{config.icon}</span>
                  <span className="font-medium">{count} {config.label}</span>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => setShowCostBreakdown(!showCostBreakdown)}
            className="text-sm text-volt-400 hover:text-volt-300 transition-colors"
          >
            {showCostBreakdown ? 'Hide' : 'Show'} Cost Breakdown
          </button>
        </div>

        {/* Cost Breakdown */}
        {showCostBreakdown && (
          <div className="bg-secondary-900/50 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-bold text-white mb-3">Cost Breakdown</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary-300">{stats.total} directory submissions × {creditCost} credit</span>
                <span className="text-white">{stats.totalCredits} credits</span>
              </div>
              {stats.totalFees > 0 && (
                <div className="flex justify-between">
                  <span className="text-secondary-300">Directory submission fees</span>
                  <span className="text-orange-400">${stats.totalFees}</span>
                </div>
              )}
              <div className="border-t border-secondary-700 pt-2 mt-3">
                <div className="flex justify-between font-bold">
                  <span className="text-white">Total Cost</span>
                  <span className="text-volt-400">
                    {stats.totalCredits} credits{stats.totalFees > 0 ? ` + $${stats.totalFees}` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={onStartSubmission}
            disabled={isSubmitting}
            className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 ${
              isSubmitting
                ? 'bg-secondary-700 text-secondary-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 hover:from-volt-400 hover:to-volt-500 shadow-2xl hover:shadow-volt-500/50'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
                Submitting...
              </div>
            ) : (
              <>🚀 Start Bulk Submission ({stats.total})</>
            )}
          </button>

          <button
            onClick={onClearQueue}
            disabled={isSubmitting}
            className="px-6 py-4 border-2 border-secondary-600 text-secondary-300 font-bold rounded-xl hover:border-secondary-500 hover:text-white transition-all duration-300"
          >
            Clear Queue
          </button>
        </div>
      </div>

      {/* Queue Controls */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Queue Management</h3>
            <p className="text-secondary-400 text-sm">Organize and prioritize your submissions</p>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-field w-auto py-2 text-sm"
            >
              <option value="authority">Sort by Authority</option>
              <option value="name">Sort by Name</option>
              <option value="difficulty">Sort by Difficulty</option>
              <option value="category">Sort by Category</option>
            </select>
          </div>
        </div>

        {/* Submission Order Recommendations */}
        <div className="bg-volt-500/5 border border-volt-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-volt-400 text-xl">💡</div>
            <div>
              <div className="text-sm font-bold text-volt-400 mb-2">Recommended Submission Strategy</div>
              <div className="text-xs text-secondary-300 space-y-1">
                <div>• Start with <strong>high-authority easy directories</strong> for quick wins</div>
                <div>• Submit to <strong>medium difficulty</strong> directories next</div>
                <div>• Save <strong>hard directories</strong> for last (higher rejection risk)</div>
                <div>• Consider spacing submissions over time to avoid appearing spammy</div>
              </div>
            </div>
          </div>
        </div>

        {/* Directory List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {sortedDirectories.map((directory, index) => (
            <div
              key={directory.id}
              className="flex items-center gap-4 p-4 bg-secondary-900/50 rounded-lg hover:bg-secondary-900/70 transition-colors"
            >
              {/* Order Number */}
              <div className="text-secondary-400 font-bold text-sm w-8">
                #{index + 1}
              </div>

              {/* Directory Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-bold text-white truncate">{directory.name}</h4>
                  <div className={`text-xs px-2 py-1 rounded-full ${DIFFICULTY_CONFIG[directory.difficulty].color}`}>
                    {DIFFICULTY_CONFIG[directory.difficulty].icon} {DIFFICULTY_CONFIG[directory.difficulty].label}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-secondary-400">
                  <span>{directory.category}</span>
                  <span>DA {directory.authority}</span>
                  <span>{directory.timeToApproval}</span>
                  {directory.price > 0 && <span className="text-orange-400">${directory.price} fee</span>}
                </div>
              </div>

              {/* Remove Button */}
              <button
                onClick={() => onRemoveDirectory(directory)}
                disabled={isSubmitting}
                className="p-2 text-secondary-400 hover:text-danger-400 transition-colors rounded-lg hover:bg-danger-400/10 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Remove from queue"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}