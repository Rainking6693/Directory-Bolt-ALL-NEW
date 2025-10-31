'use client'
import { useState, useEffect, useMemo } from 'react'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { LoadingState } from '../ui/LoadingState'
import SMSVerificationForm from './SMSVerificationForm'
import DocumentUploader from './DocumentUploader'
import EmailVerificationChecker from './EmailVerificationChecker'
import PhoneCallScheduler from './PhoneCallScheduler'
import { 
  PendingAction,
  VerificationFormData,
  Notification
} from '../../types/dashboard'

interface VerificationActionCenterProps {
  userId: string
  onActionUpdate?: (actionId: string, status: string) => void
  className?: string
}

// Mock data generator for development/demo purposes
const generateMockActions = (userId: string): PendingAction[] => {
  return [
    {
      id: 'action_1',
      type: 'sms',
      directory: 'Industry Directory XYZ',
      directoryId: '5',
      instructions: 'Please verify your business phone number by entering the SMS code we send to your registered phone number.',
      deadline: '2024-01-25T23:59:59Z',
      priority: 'high',
      status: 'pending',
      createdAt: '2024-01-20T09:00:00Z',
      estimatedTimeMinutes: 5,
      attempts: 0,
      maxAttempts: 3,
      metadata: {
        phoneNumber: '+1 (555) 123-4567'
      }
    },
    {
      id: 'action_2',
      type: 'document',
      directory: 'Better Business Bureau',
      directoryId: '3',
      instructions: 'Upload business license and tax ID documentation to verify your business registration.',
      deadline: '2024-01-28T23:59:59Z',
      priority: 'high',
      status: 'pending',
      createdAt: '2024-01-21T14:30:00Z',
      estimatedTimeMinutes: 15,
      attempts: 0,
      maxAttempts: 5,
      metadata: {
        documentTypes: ['Business License', 'Tax ID Certificate', 'Certificate of Incorporation']
      }
    },
    {
      id: 'action_3',
      type: 'email',
      directory: 'Local Chamber of Commerce',
      directoryId: '4',
      instructions: 'Check your email inbox and click the verification link to confirm your business email address.',
      priority: 'medium',
      status: 'pending',
      createdAt: '2024-01-22T11:45:00Z',
      estimatedTimeMinutes: 3,
      attempts: 1,
      maxAttempts: 3,
      metadata: {
        email: 'info@acme-corp.com'
      }
    },
    {
      id: 'action_4',
      type: 'phone_call',
      directory: 'Regional Business Network',
      directoryId: '6',
      instructions: 'Schedule a phone call with our verification team to confirm your business details and services.',
      priority: 'medium',
      status: 'pending',
      createdAt: '2024-01-23T08:15:00Z',
      estimatedTimeMinutes: 20,
      attempts: 0,
      maxAttempts: 1,
      metadata: {
        phoneNumber: '+1 (555) 123-4567'
      }
    },
    {
      id: 'action_5',
      type: 'sms',
      directory: 'Healthcare Directory Plus',
      directoryId: '7',
      instructions: 'Complete SMS verification for your secondary business location contact number.',
      deadline: '2024-01-30T23:59:59Z',
      priority: 'low',
      status: 'completed',
      createdAt: '2024-01-19T16:20:00Z',
      updatedAt: '2024-01-20T09:45:00Z',
      estimatedTimeMinutes: 5,
      attempts: 1,
      maxAttempts: 3,
      metadata: {
        phoneNumber: '+1 (555) 987-6543',
        smsCode: 'verified'
      }
    }
  ]
}

// Priority weight for sorting
const priorityWeight = {
  'high': 3,
  'medium': 2,
  'low': 1
}

// Status weight for sorting (pending/in_progress first)
const statusWeight = {
  'pending': 4,
  'in_progress': 3,
  'failed': 2,
  'completed': 1
}

export function VerificationActionCenter({ 
  userId, 
  onActionUpdate, 
  className = '' 
}: VerificationActionCenterProps) {
  const [actions, setActions] = useState<PendingAction[]>(generateMockActions(userId))
  const [selectedAction, setSelectedAction] = useState<PendingAction | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all')
  const [sortBy, setSortBy] = useState<'priority' | 'deadline' | 'created'>('priority')

  // Sort and filter actions
  const filteredActions = useMemo(() => {
    let filtered = actions

    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(action => action.status === filter)
    }

    // Sort actions
    return filtered.sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority]
        if (priorityDiff !== 0) return priorityDiff
        // Secondary sort by status
        return statusWeight[b.status] - statusWeight[a.status]
      } else if (sortBy === 'deadline') {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      } else { // created
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })
  }, [actions, filter, sortBy])

  const stats = useMemo(() => {
    const total = actions.length
    const pending = actions.filter(a => a.status === 'pending').length
    const inProgress = actions.filter(a => a.status === 'in_progress').length
    const completed = actions.filter(a => a.status === 'completed').length
    const failed = actions.filter(a => a.status === 'failed').length
    const highPriority = actions.filter(a => a.priority === 'high' && a.status !== 'completed').length

    return { total, pending, inProgress, completed, failed, highPriority }
  }, [actions])

  const handleActionSubmit = async (formData: VerificationFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Update action status
      setActions(prev => prev.map(action => 
        action.id === formData.actionId
          ? { 
              ...action, 
              status: 'completed',
              updatedAt: new Date().toISOString(),
              attempts: (action.attempts || 0) + 1
            }
          : action
      ))

      setSelectedAction(null)
      onActionUpdate?.(formData.actionId, 'completed')
    } catch (err) {
      setError('Failed to submit verification. Please try again.')
      
      // Update failed status
      setActions(prev => prev.map(action => 
        action.id === formData.actionId
          ? { 
              ...action, 
              status: 'failed',
              updatedAt: new Date().toISOString(),
              attempts: (action.attempts || 0) + 1
            }
          : action
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartAction = (action: PendingAction) => {
    // Mark as in progress
    setActions(prev => prev.map(a => 
      a.id === action.id
        ? { ...a, status: 'in_progress', updatedAt: new Date().toISOString() }
        : a
    ))
    setSelectedAction(action)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-danger-400 bg-danger-500/20 border-danger-500/30'
      case 'medium': return 'text-warning-400 bg-warning-500/20 border-warning-500/30'
      case 'low': return 'text-success-400 bg-success-500/20 border-success-500/30'
      default: return 'text-secondary-400 bg-secondary-500/20 border-secondary-500/30'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳'
      case 'in_progress': return '🔄'
      case 'completed': return '✅'
      case 'failed': return '❌'
      default: return '❓'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sms': return '📱'
      case 'email': return '📧'
      case 'document': return '📄'
      case 'phone_call': return '📞'
      default: return '❓'
    }
  }

  const formatTimeEstimate = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`
  }

  const renderVerificationForm = () => {
    if (!selectedAction) return null

    const commonProps = {
      action: selectedAction,
      onSubmit: handleActionSubmit,
      onCancel: () => setSelectedAction(null),
      isLoading
    }

    switch (selectedAction.type) {
      case 'sms':
        return <SMSVerificationForm {...commonProps} />
      case 'document':
        return <DocumentUploader {...commonProps} />
      case 'email':
        return <EmailVerificationChecker {...commonProps} />
      case 'phone_call':
        return <PhoneCallScheduler {...commonProps} />
      default:
        return null
    }
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen bg-secondary-900 ${className}`}>
        {/* Header */}
        <header className="bg-secondary-800 border-b border-secondary-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-white flex items-center gap-3">
                  ✅ Verification Actions
                  {stats.highPriority > 0 && (
                    <span className="text-base lg:text-lg font-normal px-2 py-1 bg-danger-500/20 text-danger-400 rounded-lg border border-danger-500/30">
                      {stats.highPriority} urgent
                    </span>
                  )}
                </h1>
                <p className="text-secondary-400 mt-2">
                  Complete these actions to get your directory listings approved faster
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                {/* Filter Controls */}
                <select 
                  value={filter} 
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                  className="input-field"
                >
                  <option value="all">All Actions</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>

                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="input-field"
                >
                  <option value="priority">Sort by Priority</option>
                  <option value="deadline">Sort by Deadline</option>
                  <option value="created">Sort by Created</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        {/* Stats Overview */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-secondary-400 text-sm">Total</p>
              </div>
            </div>
            
            <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-warning-400">{stats.pending}</p>
                <p className="text-secondary-400 text-sm">Pending</p>
              </div>
            </div>
            
            <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-volt-400">{stats.inProgress}</p>
                <p className="text-secondary-400 text-sm">In Progress</p>
              </div>
            </div>
            
            <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-success-400">{stats.completed}</p>
                <p className="text-secondary-400 text-sm">Completed</p>
              </div>
            </div>
            
            <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-danger-400">{stats.failed}</p>
                <p className="text-secondary-400 text-sm">Failed</p>
              </div>
            </div>
          </div>

          {/* Actions List */}
          <div className="space-y-4">
            {filteredActions.length === 0 ? (
              <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-8 text-center">
                <span className="text-6xl block mb-4">🎉</span>
                <h3 className="text-xl font-bold text-white mb-2">No Actions Required</h3>
                <p className="text-secondary-400">
                  {filter === 'all' 
                    ? "Great! You don't have any pending verification actions right now."
                    : `No ${filter} actions found.`
                  }
                </p>
              </div>
            ) : (
              filteredActions.map((action) => (
                <div 
                  key={action.id}
                  className="bg-secondary-800 rounded-xl border border-secondary-700 p-6 hover:bg-secondary-700/50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{getTypeIcon(action.type)}</div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-white truncate">
                            {action.directory}
                          </h3>
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getPriorityColor(action.priority)}`}>
                            {action.priority}
                          </span>
                          <span className="text-xl">{getStatusIcon(action.status)}</span>
                        </div>
                        
                        <p className="text-secondary-300 text-sm leading-relaxed mb-3">
                          {action.instructions}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-secondary-400">
                          <span className="flex items-center gap-1">
                            ⏱️ {formatTimeEstimate(action.estimatedTimeMinutes)}
                          </span>
                          
                          {action.deadline && (
                            <span className="flex items-center gap-1">
                              📅 Due {new Date(action.deadline).toLocaleDateString()}
                            </span>
                          )}
                          
                          {action.attempts !== undefined && action.maxAttempts && (
                            <span className="flex items-center gap-1">
                              🔁 {action.attempts}/{action.maxAttempts} attempts
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {action.status === 'pending' && (
                        <button
                          onClick={() => handleStartAction(action)}
                          className="btn-primary"
                        >
                          Start Verification
                        </button>
                      )}
                      
                      {action.status === 'in_progress' && (
                        <button
                          onClick={() => setSelectedAction(action)}
                          className="btn-secondary"
                        >
                          Continue
                        </button>
                      )}
                      
                      {action.status === 'failed' && action.attempts! < action.maxAttempts! && (
                        <button
                          onClick={() => handleStartAction(action)}
                          className="btn-warning"
                        >
                          Retry
                        </button>
                      )}
                      
                      {action.status === 'completed' && (
                        <span className="text-success-400 font-medium">Completed</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Verification Form Modal */}
        {selectedAction && (
          <div className="fixed inset-0 bg-secondary-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-secondary-800 rounded-xl border border-secondary-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {renderVerificationForm()}
            </div>
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div className="fixed bottom-4 right-4 bg-danger-500/90 backdrop-blur-sm text-white px-6 py-4 rounded-lg shadow-2xl z-50 max-w-md">
            <div className="flex items-start gap-3">
              <span className="text-xl">❌</span>
              <div>
                <h4 className="font-bold mb-1">Error</h4>
                <p className="text-sm">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-white/80 hover:text-white ml-auto"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default VerificationActionCenter