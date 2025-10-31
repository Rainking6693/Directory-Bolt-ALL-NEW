'use client'
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'

interface DirectoryOpportunity {
  id: string
  name: string
  domain: string
  category: string
  authority: number // Domain Authority 0-100
  traffic: number // Monthly traffic
  successRate: number // Historical success rate 0-100
  competition: number // Competition level 0-100 (lower is better)
  submissionComplexity: 'easy' | 'medium' | 'complex'
  pricing: 'free' | 'paid' | 'premium'
  requirements: string[]
  estimatedTraffic: number // Monthly referral traffic estimate
  monthlyValue: number // Estimated monthly value in dollars
  timeToApproval: string
  priority: 'high' | 'medium' | 'low'
  roi: {
    paybackDays: number
    annualValue: number
    confidenceScore: number // 0-100
  }
  industryRelevance: number // 0-100
  geographicRelevance: number // 0-100
  submissionStatus?: 'not-started' | 'in-progress' | 'approved' | 'rejected'
}

interface DirectoryOpportunityMatrixProps {
  opportunities: DirectoryOpportunity[]
  userTier: 'free' | 'starter' | 'growth' | 'professional'
  onUpgrade: () => void
  onDirectorySelect: (directory: DirectoryOpportunity) => void
}

export default function DirectoryOpportunityMatrix({
  opportunities,
  userTier,
  onUpgrade,
  onDirectorySelect
}: DirectoryOpportunityMatrixProps) {
  const [sortBy, setSortBy] = useState<'priority' | 'roi' | 'success' | 'competition'>('priority')
  const [filterBy, setFilterBy] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [selectedDirectory, setSelectedDirectory] = useState<DirectoryOpportunity | null>(null)

  const isLocked = (index: number) => {
    if (userTier === 'free') return index >= 5
    if (userTier === 'starter') return index >= 25
    if (userTier === 'growth') return index >= 50
    return false
  }

  // Sort and filter opportunities
  const processedOpportunities = useMemo(() => {
    let filtered = opportunities
    
    if (filterBy !== 'all') {
      filtered = opportunities.filter(opp => opp.priority === filterBy)
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        case 'roi':
          return b.roi.annualValue - a.roi.annualValue
        case 'success':
          return b.successRate - a.successRate
        case 'competition':
          return a.competition - b.competition // Lower competition is better
        default:
          return 0
      }
    })

    return sorted
  }, [opportunities, sortBy, filterBy])

  const getSuccessScoreColor = (score: number) => {
    if (score >= 90) return 'text-success-400 bg-success-500/20 border-success-500/40'
    if (score >= 75) return 'text-volt-400 bg-volt-500/20 border-volt-500/40'
    if (score >= 60) return 'text-orange-400 bg-orange-500/20 border-orange-500/40'
    return 'text-danger-400 bg-danger-500/20 border-danger-500/40'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-success-500 text-white'
      case 'medium': return 'bg-volt-500 text-secondary-900'
      case 'low': return 'bg-orange-500 text-white'
      default: return 'bg-secondary-600 text-white'
    }
  }

  const OpportunityCard = ({ opportunity, index, locked }: {
    opportunity: DirectoryOpportunity
    index: number
    locked: boolean
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`relative bg-gradient-to-br from-secondary-800/90 to-secondary-900/70 rounded-2xl border backdrop-blur-sm transition-all duration-300 ${
        locked
          ? 'border-secondary-600 opacity-60'
          : 'border-secondary-700 hover:border-volt-500/50 hover:shadow-2xl hover:shadow-volt-500/10 cursor-pointer'
      }`}
      onClick={() => !locked && onDirectorySelect(opportunity)}
    >
      {/* Lock Overlay */}
      {locked && (
        <div className="absolute inset-0 bg-gradient-to-br from-secondary-900/90 to-secondary-800/80 rounded-2xl flex items-center justify-center backdrop-blur-sm z-10">
          <div className="text-center">
            <div className="text-3xl mb-2">🔒</div>
            <div className="text-volt-400 font-bold text-sm mb-2">PREMIUM OPPORTUNITY</div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onUpgrade()
              }}
              className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-1 px-3 rounded text-xs hover:from-volt-400 hover:to-volt-500 transition-all duration-300"
            >
              Unlock
            </button>
          </div>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-white text-lg truncate">{opportunity.name}</h3>
              <div className={`px-2 py-1 rounded-full text-xs font-bold ${getPriorityColor(opportunity.priority)}`}>
                {opportunity.priority.toUpperCase()}
              </div>
            </div>
            <div className="text-secondary-400 text-sm">{opportunity.domain}</div>
            <div className="text-secondary-500 text-xs">{opportunity.category}</div>
          </div>
          
          {/* Success Score Circle */}
          <div className="text-center">
            <div className="relative w-16 h-16">
              <svg className="transform -rotate-90 w-full h-full">
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="transparent"
                  className="text-secondary-700"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="transparent"
                  strokeDasharray={`${opportunity.successRate * 2.83} 283`}
                  className={opportunity.successRate >= 90 ? 'text-success-400' : 
                           opportunity.successRate >= 75 ? 'text-volt-400' : 
                           opportunity.successRate >= 60 ? 'text-orange-400' : 'text-danger-400'}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white font-bold text-sm">{opportunity.successRate}%</span>
              </div>
            </div>
            <div className="text-xs text-secondary-400 mt-1">Success Rate</div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-secondary-700/50 rounded-lg p-3 text-center">
            <div className="text-volt-400 font-bold text-lg">${opportunity.monthlyValue * 12}/yr</div>
            <div className="text-secondary-400 text-xs">Annual Value</div>
          </div>
          <div className="bg-secondary-700/50 rounded-lg p-3 text-center">
            <div className="text-success-400 font-bold text-lg">{opportunity.authority}</div>
            <div className="text-secondary-400 text-xs">Domain Authority</div>
          </div>
          <div className="bg-secondary-700/50 rounded-lg p-3 text-center">
            <div className={`font-bold text-lg ${
              opportunity.competition <= 30 ? 'text-success-400' : 
              opportunity.competition <= 60 ? 'text-volt-400' : 'text-danger-400'
            }`}>
              {opportunity.competition}%
            </div>
            <div className="text-secondary-400 text-xs">Competition</div>
          </div>
          <div className="bg-secondary-700/50 rounded-lg p-3 text-center">
            <div className="text-orange-400 font-bold text-lg">{opportunity.timeToApproval}</div>
            <div className="text-secondary-400 text-xs">Time to Approval</div>
          </div>
        </div>

        {/* ROI Indicators */}
        <div className={`rounded-lg p-4 mb-4 border ${getSuccessScoreColor(opportunity.roi.confidenceScore)}`}>
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">ROI Projection</span>
            <span className="text-xs opacity-80">{opportunity.roi.confidenceScore}% confidence</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="opacity-80">Payback Period:</div>
              <div className="font-bold">{opportunity.roi.paybackDays} days</div>
            </div>
            <div>
              <div className="opacity-80">Annual Value:</div>
              <div className="font-bold">${opportunity.roi.annualValue.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Requirements Preview */}
        <div className="mb-4">
          <div className="text-secondary-300 text-sm font-medium mb-2">Requirements:</div>
          <div className="flex flex-wrap gap-1">
            {opportunity.requirements.slice(0, 2).map((req, idx) => (
              <span key={idx} className="text-xs bg-secondary-700/50 text-secondary-300 px-2 py-1 rounded">
                {req}
              </span>
            ))}
            {opportunity.requirements.length > 2 && (
              <span className="text-xs bg-secondary-700/50 text-volt-400 px-2 py-1 rounded">
                +{opportunity.requirements.length - 2} more
              </span>
            )}
          </div>
        </div>

        {/* Action Button */}
        <button
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all duration-300 ${
            opportunity.priority === 'high'
              ? 'bg-gradient-to-r from-success-500 to-success-600 text-white hover:from-success-400 hover:to-success-500'
              : opportunity.priority === 'medium'
                ? 'bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 hover:from-volt-400 hover:to-volt-500'
                : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-400 hover:to-orange-500'
          }`}
        >
          View Details & Submit
        </button>
      </div>
    </motion.div>
  )

  const TableRow = ({ opportunity, index, locked }: {
    opportunity: DirectoryOpportunity
    index: number
    locked: boolean
  }) => (
    <tr 
      className={`border-b border-secondary-700 hover:bg-secondary-800/50 transition-colors duration-200 ${
        locked ? 'opacity-50' : 'cursor-pointer'
      }`}
      onClick={() => !locked && onDirectorySelect(opportunity)}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {locked && <span className="text-volt-400">🔒</span>}
          <div>
            <div className="font-semibold text-white">{opportunity.name}</div>
            <div className="text-secondary-400 text-sm">{opportunity.domain}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className={`px-2 py-1 rounded-full text-xs font-bold inline-block ${getPriorityColor(opportunity.priority)}`}>
          {opportunity.priority.toUpperCase()}
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className="text-white font-semibold">{opportunity.authority}</div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className={`font-semibold ${
          opportunity.successRate >= 90 ? 'text-success-400' : 
          opportunity.successRate >= 75 ? 'text-volt-400' : 
          opportunity.successRate >= 60 ? 'text-orange-400' : 'text-danger-400'
        }`}>
          {opportunity.successRate}%
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className={`font-semibold ${
          opportunity.competition <= 30 ? 'text-success-400' : 
          opportunity.competition <= 60 ? 'text-volt-400' : 'text-danger-400'
        }`}>
          {opportunity.competition}%
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className="text-volt-400 font-semibold">${opportunity.monthlyValue * 12}/yr</div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className="text-orange-400 font-medium">{opportunity.timeToApproval}</div>
      </td>
      <td className="px-6 py-4 text-center">
        <button
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
            opportunity.priority === 'high'
              ? 'bg-success-500 hover:bg-success-400 text-white'
              : opportunity.priority === 'medium'
                ? 'bg-volt-500 hover:bg-volt-400 text-secondary-900'
                : 'bg-orange-500 hover:bg-orange-400 text-white'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            if (!locked) onDirectorySelect(opportunity)
          }}
        >
          {locked ? 'Locked' : 'View'}
        </button>
      </td>
    </tr>
  )

  const totalValue = opportunities.reduce((sum, opp) => sum + opp.monthlyValue, 0)
  const averageSuccessRate = Math.round(opportunities.reduce((sum, opp) => sum + opp.successRate, 0) / opportunities.length)
  const highPriorityCount = opportunities.filter(opp => opp.priority === 'high').length

  return (
    <div className="space-y-8">
      {/* Header with Summary Stats */}
      <div className="bg-gradient-to-r from-volt-500/10 to-success-500/10 rounded-2xl border border-volt-500/30 p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-white mb-4">
            Directory Opportunity Matrix
          </h2>
          <p className="text-secondary-300 text-lg max-w-3xl mx-auto">
            AI-powered analysis of <span className="text-volt-400 font-bold">{opportunities.length} premium directories</span> ranked by success probability, ROI potential, and strategic value for your business.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-success-500/20 border border-success-500/40 rounded-xl p-6 text-center">
            <div className="text-3xl font-black text-success-400 mb-2">{opportunities.length}</div>
            <div className="text-success-300 font-medium">Total Opportunities</div>
            <div className="text-success-200 text-sm mt-1">Identified & Verified</div>
          </div>
          <div className="bg-volt-500/20 border border-volt-500/40 rounded-xl p-6 text-center">
            <div className="text-3xl font-black text-volt-400 mb-2">${totalValue.toLocaleString()}</div>
            <div className="text-volt-300 font-medium">Monthly Value</div>
            <div className="text-volt-200 text-sm mt-1">Conservative Estimate</div>
          </div>
          <div className="bg-orange-500/20 border border-orange-500/40 rounded-xl p-6 text-center">
            <div className="text-3xl font-black text-orange-400 mb-2">{averageSuccessRate}%</div>
            <div className="text-orange-300 font-medium">Avg Success Rate</div>
            <div className="text-orange-200 text-sm mt-1">Based on AI Analysis</div>
          </div>
          <div className="bg-success-500/20 border border-success-500/40 rounded-xl p-6 text-center">
            <div className="text-3xl font-black text-success-400 mb-2">{highPriorityCount}</div>
            <div className="text-success-300 font-medium">High Priority</div>
            <div className="text-success-200 text-sm mt-1">Quick Wins Available</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap gap-4">
          {/* Sort Control */}
          <div className="flex items-center gap-2">
            <span className="text-secondary-400 text-sm">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-secondary-800 border border-secondary-600 rounded-lg px-3 py-2 text-white text-sm focus:border-volt-500 transition-colors"
            >
              <option value="priority">Priority</option>
              <option value="roi">ROI</option>
              <option value="success">Success Rate</option>
              <option value="competition">Competition</option>
            </select>
          </div>

          {/* Filter Control */}
          <div className="flex items-center gap-2">
            <span className="text-secondary-400 text-sm">Filter:</span>
            <div className="flex gap-1">
              {(['all', 'high', 'medium', 'low'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setFilterBy(filter)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    filterBy === filter
                      ? 'bg-volt-500 text-secondary-900'
                      : 'bg-secondary-800 text-secondary-300 hover:bg-secondary-700'
                  }`}
                >
                  {filter === 'all' ? 'All' : `${filter.charAt(0).toUpperCase()}${filter.slice(1)} Priority`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-secondary-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition-all duration-300 ${
              viewMode === 'grid'
                ? 'bg-volt-500 text-secondary-900'
                : 'text-secondary-400 hover:text-white'
            }`}
          >
            <span className="text-sm">📊</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded transition-all duration-300 ${
              viewMode === 'table'
                ? 'bg-volt-500 text-secondary-900'
                : 'text-secondary-400 hover:text-white'
            }`}
          >
            <span className="text-sm">📋</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {processedOpportunities.map((opportunity, index) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              index={index}
              locked={isLocked(index)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-secondary-800/50 rounded-2xl border border-secondary-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary-700/50">
              <tr>
                <th className="text-left px-6 py-4 text-secondary-300 font-semibold">Directory</th>
                <th className="text-center px-6 py-4 text-secondary-300 font-semibold">Priority</th>
                <th className="text-center px-6 py-4 text-secondary-300 font-semibold">Authority</th>
                <th className="text-center px-6 py-4 text-secondary-300 font-semibold">Success Rate</th>
                <th className="text-center px-6 py-4 text-secondary-300 font-semibold">Competition</th>
                <th className="text-center px-6 py-4 text-secondary-300 font-semibold">Monthly Value</th>
                <th className="text-center px-6 py-4 text-secondary-300 font-semibold">Time to Approval</th>
                <th className="text-center px-6 py-4 text-secondary-300 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {processedOpportunities.map((opportunity, index) => (
                <TableRow
                  key={opportunity.id}
                  opportunity={opportunity}
                  index={index}
                  locked={isLocked(index)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Locked Content Indicator */}
      {processedOpportunities.some((_, index) => isLocked(index)) && (
        <div className="bg-gradient-to-r from-volt-500/20 to-danger-500/10 rounded-2xl border-2 border-volt-500/50 p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h3 className="text-2xl font-bold text-white mb-4">
            {userTier === 'free' && `${processedOpportunities.length - 5} Premium Opportunities Locked`}
            {userTier === 'starter' && `${processedOpportunities.length - 25} Additional Opportunities Available`}
            {userTier === 'growth' && `${processedOpportunities.length - 50} Enterprise Opportunities Available`}
          </h3>
          <p className="text-secondary-300 text-lg mb-6 max-w-2xl mx-auto">
            Unlock access to our complete database of premium directories with higher success rates and exclusive opportunities.
          </p>
          <button
            onClick={onUpgrade}
            className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black py-4 px-8 text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-volt-500/50"
          >
            🚀 Upgrade to Access All Opportunities
          </button>
        </div>
      )}
    </div>
  )
}