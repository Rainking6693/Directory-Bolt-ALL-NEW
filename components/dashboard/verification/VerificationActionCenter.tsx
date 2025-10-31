'use client'
import { useState, useEffect } from 'react'
import { VerificationAction, VerificationStats } from '../../../types/dashboard'
import VerificationActionCard from './VerificationActionCard'
import { VerificationStats as StatsDisplay } from './VerificationStatsDisplay'
import { ErrorBoundary } from '../../ui/ErrorBoundary'

interface VerificationActionCenterProps {
  actions: VerificationAction[]
  stats: VerificationStats
  onActionUpdate?: (actionId: string, status: VerificationAction['status']) => void
  className?: string
}

export function VerificationActionCenter({
  actions,
  stats,
  onActionUpdate,
  className = ''
}: VerificationActionCenterProps) {
  const [filter, setFilter] = useState<'all' | 'urgent' | 'pending' | 'in_progress'>('all')
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'estimatedTime'>('priority')

  const filteredActions = actions.filter(action => {
    if (filter === 'all') return action.status !== 'completed'
    if (filter === 'urgent') return action.priority === 'high' && action.status !== 'completed'
    if (filter === 'pending') return action.status === 'pending'
    if (filter === 'in_progress') return action.status === 'in_progress'
    return true
  })

  const sortedActions = [...filteredActions].sort((a, b) => {
    if (sortBy === 'priority') {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }
    }
    
    if (sortBy === 'dueDate' && a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    }
    
    if (sortBy === 'estimatedTime' && a.estimatedTime && b.estimatedTime) {
      return a.estimatedTime - b.estimatedTime
    }
    
    return 0
  })

  return (
    <ErrorBoundary>
      <div className={`space-y-8 ${className}`}>
        {/* Header Section */}
        <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-white flex items-center gap-3">
                🔍 Verification Actions
              </h1>
              <p className="text-secondary-400 mt-2">
                Complete verification steps to activate your directory listings
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-secondary-700/50 rounded-lg px-3 py-2">
                <span className="text-danger-400 font-bold text-lg">{stats.urgentActions}</span>
                <span className="text-secondary-300 text-sm">Urgent</span>
              </div>
              <div className="flex items-center gap-2 bg-secondary-700/50 rounded-lg px-3 py-2">
                <span className="text-volt-400 font-bold text-lg">{stats.pendingActions}</span>
                <span className="text-secondary-300 text-sm">Pending</span>
              </div>
            </div>
          </div>

          {/* Filters and Controls */}
          <div className="mt-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All Actions', count: filteredActions.length },
                { key: 'urgent', label: 'Urgent', count: stats.urgentActions },
                { key: 'pending', label: 'Pending', count: stats.pendingActions },
                { key: 'in_progress', label: 'In Progress', count: actions.filter(a => a.status === 'in_progress').length }
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as typeof filter)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === key
                      ? 'bg-volt-500 text-secondary-900'
                      : 'bg-secondary-700/50 text-secondary-300 hover:bg-secondary-700 hover:text-secondary-200'
                  }`}
                >
                  <span>{label}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    filter === key
                      ? 'bg-secondary-800 text-volt-400'
                      : 'bg-secondary-600 text-secondary-300'
                  }`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="sort-select" className="text-secondary-400 text-sm">Sort by:</label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-secondary-700 text-secondary-200 text-sm rounded-lg px-3 py-2 border border-secondary-600 focus:ring-2 focus:ring-volt-500 focus:border-volt-500"
              >
                <option value="priority">Priority</option>
                <option value="dueDate">Due Date</option>
                <option value="estimatedTime">Time Required</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <StatsDisplay stats={stats} />

        {/* Action Cards Grid */}
        <div className="space-y-4">
          {sortedActions.length === 0 ? (
            <div className="bg-secondary-800 rounded-xl p-8 border border-secondary-700 text-center">
              <span className="text-4xl mb-4 block">✨</span>
              <h3 className="text-lg font-bold text-white mb-2">All Set!</h3>
              <p className="text-secondary-400">
                {filter === 'all' 
                  ? "No pending verification actions. Your directory listings are on track!"
                  : `No ${filter} verification actions at the moment.`
                }
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {sortedActions.map((action) => (
                <VerificationActionCard
                  key={action.id}
                  action={action}
                  onStatusUpdate={(status) => onActionUpdate?.(action.id, status)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bulk Actions (when multiple actions are available) */}
        {sortedActions.length > 1 && (
          <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              ⚡ Bulk Actions
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  // Handle bulk completion for document uploads
                  const documentActions = sortedActions.filter(a => a.verificationType === 'document' && a.status === 'pending')
                  if (documentActions.length > 0) {
                    // Navigate to bulk document upload
                    window.location.href = '/dashboard/actions/bulk-upload'
                  }
                }}
                className="btn-secondary text-sm"
              >
                📄 Upload All Documents
              </button>
              <button
                onClick={() => {
                  // Handle bulk phone call scheduling
                  const phoneActions = sortedActions.filter(a => a.verificationType === 'phone_call' && a.status === 'pending')
                  if (phoneActions.length > 0) {
                    window.location.href = '/dashboard/actions/bulk-schedule'
                  }
                }}
                className="btn-secondary text-sm"
              >
                📞 Schedule All Calls
              </button>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default VerificationActionCenter