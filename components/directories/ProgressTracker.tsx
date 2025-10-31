'use client'

import { useState, useEffect } from 'react'
import { useRealtimeUpdates } from '../../hooks/useRealtimeUpdates'

interface Submission {
  id: string
  directoryId: string
  directoryName: string
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected' | 'failed'
  submittedAt: Date
  approvedAt?: Date
  rejectedAt?: Date
  rejectionReason?: string
  estimatedApprovalTime?: number
  actualApprovalTime?: number
  retryCount: number
  maxRetries: number
}

interface ProgressTrackerProps {
  submissions: Submission[]
  onRetrySubmission?: (submissionId: string) => void
  onViewDetails?: (submission: Submission) => void
  realTimeEnabled?: boolean
}

export function ProgressTracker({
  submissions,
  onRetrySubmission,
  onViewDetails,
  realTimeEnabled = true
}: ProgressTrackerProps) {
  const [selectedStatus, setSelectedStatus] = useState<'all' | Submission['status']>('all')
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'directory'>('date')
  const [isExpanded, setIsExpanded] = useState(true)

  // Real-time updates via WebSocket
  const { isConnected, lastUpdate } = useRealtimeUpdates(realTimeEnabled)

  // Calculate overall progress
  const progress = {
    total: submissions.length,
    pending: submissions.filter(s => s.status === 'pending').length,
    inProgress: submissions.filter(s => s.status === 'in_progress').length,
    submitted: submissions.filter(s => s.status === 'submitted').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
    failed: submissions.filter(s => s.status === 'failed').length,
  }

  const completionRate = progress.total > 0 ? ((progress.approved + progress.rejected) / progress.total) * 100 : 0
  const successRate = (progress.approved + progress.rejected) > 0 ? (progress.approved / (progress.approved + progress.rejected)) * 100 : 0

  // Filter submissions based on selected status
  const filteredSubmissions = submissions.filter(submission => 
    selectedStatus === 'all' || submission.status === selectedStatus
  )

  // Sort submissions
  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      case 'status':
        return a.status.localeCompare(b.status)
      case 'directory':
        return a.directoryName.localeCompare(b.directoryName)
      default:
        return 0
    }
  })

  const getStatusIcon = (status: Submission['status']) => {
    switch (status) {
      case 'pending': return '⏳'
      case 'in_progress': return '🔄'
      case 'submitted': return '📤'
      case 'approved': return '✅'
      case 'rejected': return '❌'
      case 'failed': return '💥'
    }
  }

  const getStatusColor = (status: Submission['status']) => {
    switch (status) {
      case 'pending': return 'text-volt-400 bg-volt-900/20'
      case 'in_progress': return 'text-blue-400 bg-blue-900/20'
      case 'submitted': return 'text-purple-400 bg-purple-900/20'
      case 'approved': return 'text-green-400 bg-green-900/20'
      case 'rejected': return 'text-red-400 bg-red-900/20'
      case 'failed': return 'text-orange-400 bg-orange-900/20'
    }
  }

  const getTimeRemaining = (submission: Submission) => {
    if (!submission.estimatedApprovalTime || submission.status === 'approved' || submission.status === 'rejected') {
      return null
    }

    const submittedTime = new Date(submission.submittedAt).getTime()
    const estimatedComplete = submittedTime + (submission.estimatedApprovalTime * 24 * 60 * 60 * 1000)
    const now = Date.now()
    const remaining = estimatedComplete - now

    if (remaining <= 0) return 'Overdue'

    const days = Math.floor(remaining / (24 * 60 * 60 * 1000))
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))

    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h`
    return '<1h'
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(date))
  }

  if (submissions.length === 0) {
    return (
      <div className="bg-secondary-800/50 rounded-xl p-8 border border-secondary-700 text-center">
        <div className="text-secondary-400 text-xl mb-4">No Active Submissions</div>
        <p className="text-secondary-500">
          Submit to directories to start tracking progress here
        </p>
      </div>
    )
  }

  return (
    <div className="bg-secondary-800/50 rounded-xl border border-secondary-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-secondary-900/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-volt-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-secondary-900" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Submission Progress</h3>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-secondary-400">
                  {progress.total} directories • {Math.round(completionRate)}% complete
                </span>
                {realTimeEnabled && (
                  <span className={`flex items-center gap-1 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                    {isConnected ? 'Live' : 'Offline'}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-volt-400 hover:text-volt-300 transition-colors"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>

        {/* Progress Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-secondary-800/50 rounded-lg">
            <div className="text-2xl font-bold text-volt-400">{progress.total}</div>
            <div className="text-xs text-secondary-500">Total</div>
          </div>
          
          <div className="text-center p-3 bg-secondary-800/50 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{progress.approved}</div>
            <div className="text-xs text-secondary-500">Approved</div>
          </div>
          
          <div className="text-center p-3 bg-secondary-800/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-400">{progress.inProgress + progress.submitted}</div>
            <div className="text-xs text-secondary-500">In Progress</div>
          </div>
          
          <div className="text-center p-3 bg-secondary-800/50 rounded-lg">
            <div className="text-2xl font-bold text-volt-400">{progress.pending}</div>
            <div className="text-xs text-secondary-500">Pending</div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-secondary-300">Overall Progress</span>
            <span className="text-volt-400">{Math.round(completionRate)}%</span>
          </div>
          <div className="w-full bg-secondary-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-volt-500 to-volt-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-secondary-400">
            <span>Success Rate: {Math.round(successRate)}%</span>
            {lastUpdate && (
              <span>Last update: {new Date(lastUpdate).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6">
          {/* Filter and Sort Controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            {/* Status Filter */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All', count: progress.total },
                { key: 'pending', label: 'Pending', count: progress.pending },
                { key: 'in_progress', label: 'In Progress', count: progress.inProgress },
                { key: 'submitted', label: 'Submitted', count: progress.submitted },
                { key: 'approved', label: 'Approved', count: progress.approved },
                { key: 'rejected', label: 'Rejected', count: progress.rejected },
                { key: 'failed', label: 'Failed', count: progress.failed }
              ].filter(status => status.count > 0 || status.key === 'all').map((status) => (
                <button
                  key={status.key}
                  onClick={() => setSelectedStatus(status.key as any)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedStatus === status.key
                      ? 'bg-volt-500 text-secondary-900'
                      : 'bg-secondary-700 text-secondary-300 hover:bg-secondary-600'
                  }`}
                >
                  {status.label} ({status.count})
                </button>
              ))}
            </div>

            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white text-sm focus:outline-none focus:border-volt-500"
            >
              <option value="date">Sort by Date</option>
              <option value="status">Sort by Status</option>
              <option value="directory">Sort by Directory</option>
            </select>
          </div>

          {/* Submissions List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {sortedSubmissions.map((submission) => (
              <div
                key={submission.id}
                className="flex items-center gap-4 p-4 bg-secondary-800/30 rounded-lg hover:bg-secondary-700/30 transition-colors"
              >
                {/* Status */}
                <div className="flex flex-col items-center">
                  <span className="text-2xl">{getStatusIcon(submission.status)}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusColor(submission.status)}`}>
                    {submission.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Directory Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white truncate">{submission.directoryName}</h4>
                  <div className="text-sm text-secondary-400">
                    Submitted {formatDate(submission.submittedAt)}
                  </div>
                  
                  {submission.status === 'rejected' && submission.rejectionReason && (
                    <div className="text-xs text-red-400 mt-1">
                      Reason: {submission.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Time Info */}
                <div className="text-right text-sm">
                  {submission.status === 'approved' && submission.actualApprovalTime ? (
                    <div>
                      <div className="text-green-400 font-medium">
                        Approved in {submission.actualApprovalTime}d
                      </div>
                      <div className="text-secondary-500 text-xs">
                        {formatDate(submission.approvedAt!)}
                      </div>
                    </div>
                  ) : submission.status === 'rejected' && submission.rejectedAt ? (
                    <div>
                      <div className="text-red-400 font-medium">Rejected</div>
                      <div className="text-secondary-500 text-xs">
                        {formatDate(submission.rejectedAt)}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {getTimeRemaining(submission) && (
                        <div className="text-volt-400 font-medium">
                          {getTimeRemaining(submission)} remaining
                        </div>
                      )}
                      {submission.estimatedApprovalTime && (
                        <div className="text-secondary-500 text-xs">
                          Est. {submission.estimatedApprovalTime}d approval
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {submission.status === 'failed' && submission.retryCount < submission.maxRetries && onRetrySubmission && (
                    <button
                      onClick={() => onRetrySubmission(submission.id)}
                      className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-500 transition-colors"
                    >
                      Retry ({submission.retryCount}/{submission.maxRetries})
                    </button>
                  )}
                  
                  {onViewDetails && (
                    <button
                      onClick={() => onViewDetails(submission)}
                      className="px-3 py-1 bg-secondary-600 text-white rounded text-sm hover:bg-secondary-500 transition-colors"
                    >
                      Details
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredSubmissions.length === 0 && (
            <div className="text-center py-8">
              <div className="text-secondary-400">No submissions match the current filter</div>
              <button
                onClick={() => setSelectedStatus('all')}
                className="mt-2 text-volt-400 hover:text-volt-300 transition-colors"
              >
                Show all submissions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}