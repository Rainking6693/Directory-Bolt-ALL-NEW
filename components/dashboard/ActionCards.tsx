'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { ActionCard } from '../../types/dashboard'

interface ActionCardsProps {
  actions: ActionCard[]
  className?: string
  maxItems?: number
}

export function ActionCards({ actions, className = '', maxItems = 6 }: ActionCardsProps) {
  const sortedActions = useMemo(() => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return actions
      .filter(action => action.status !== 'completed')
      .sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        }
        // Secondary sort by due date if priorities are equal
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        }
        return 0
      })
      .slice(0, maxItems)
  }, [actions, maxItems])

  const getActionIcon = (type: ActionCard['type']) => {
    switch (type) {
      case 'verification': return '🔍'
      case 'approval': return '✅'
      case 'update': return '📝'
      case 'payment': return '💳'
      default: return '📋'
    }
  }

  const getPriorityStyles = (priority: ActionCard['priority']) => {
    switch (priority) {
      case 'high':
        return {
          border: 'border-danger-500/30',
          background: 'bg-danger-500/5',
          badge: 'bg-danger-500/20 text-danger-400 border-danger-500/30'
        }
      case 'medium':
        return {
          border: 'border-volt-500/30',
          background: 'bg-volt-500/5',
          badge: 'bg-volt-500/20 text-volt-400 border-volt-500/30'
        }
      case 'low':
        return {
          border: 'border-secondary-600',
          background: 'bg-secondary-800/50',
          badge: 'bg-secondary-600/50 text-secondary-300 border-secondary-500/30'
        }
      default:
        return {
          border: 'border-secondary-600',
          background: 'bg-secondary-800/50',
          badge: 'bg-secondary-600/50 text-secondary-300 border-secondary-500/30'
        }
    }
  }

  const getStatusStyles = (status: ActionCard['status']) => {
    switch (status) {
      case 'in_progress':
        return 'bg-volt-500/20 text-volt-400 border-volt-500/30'
      case 'pending':
        return 'bg-secondary-600/50 text-secondary-300 border-secondary-500/30'
      default:
        return 'bg-secondary-600/50 text-secondary-300 border-secondary-500/30'
    }
  }

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} days`
    } else if (diffDays === 0) {
      return 'Due today'
    } else if (diffDays === 1) {
      return 'Due tomorrow'
    } else {
      return `Due in ${diffDays} days`
    }
  }

  if (sortedActions.length === 0) {
    return (
      <div className={`bg-secondary-800 rounded-xl p-6 border border-secondary-700 ${className}`}>
        <div className="text-center">
          <span className="text-4xl mb-3 block">✨</span>
          <h3 className="text-lg font-bold text-white mb-2">All caught up!</h3>
          <p className="text-secondary-300">
            No pending actions at the moment. Great job staying on top of your directory submissions!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-secondary-800 rounded-xl p-6 border border-secondary-700 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          ⚡ Action Required
        </h3>
        <span className="text-sm text-secondary-400">
          {sortedActions.length} pending
        </span>
      </div>

      <div className="space-y-4">
        {sortedActions.map((action) => {
          const priorityStyles = getPriorityStyles(action.priority)
          const isOverdue = action.dueDate && new Date(action.dueDate) < new Date()
          
          return (
            <div
              key={action.id}
              className={`rounded-lg border p-4 transition-all duration-300 hover:scale-[1.02] ${
                priorityStyles.border
              } ${priorityStyles.background} ${
                isOverdue ? 'ring-1 ring-danger-500/50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getActionIcon(action.type)}</span>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-semibold text-white text-sm leading-tight">
                      {action.title}
                    </h4>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${priorityStyles.badge}`}>
                        {action.priority.toUpperCase()}
                      </span>
                      {action.status === 'in_progress' && (
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusStyles(action.status)}`}>
                          IN PROGRESS
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-secondary-300 text-xs mb-3 leading-relaxed">
                    {action.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      {action.directoryName && (
                        <p className="text-volt-400 text-xs font-medium">
                          📁 {action.directoryName}
                        </p>
                      )}
                      {action.dueDate && (
                        <p className={`text-xs font-medium ${
                          isOverdue ? 'text-danger-400' : 'text-secondary-400'
                        }`}>
                          ⏰ {formatDueDate(action.dueDate)}
                        </p>
                      )}
                    </div>
                    
                    <Link
                      href={action.actionUrl}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-volt-500 hover:bg-volt-400 text-secondary-900 font-bold text-xs rounded-lg transition-all duration-300 hover:scale-105 min-h-[36px] min-w-[36px] touch-manipulation"
                      aria-label={`${action.actionText} for ${action.title}`}
                    >
                      <span>{action.actionText}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {actions.length > maxItems && (
        <div className="mt-4 pt-4 border-t border-secondary-700">
          <Link 
            href="/dashboard/actions"
            className="text-volt-400 hover:text-volt-300 text-sm font-medium flex items-center gap-1 transition-colors"
          >
            View all {actions.length} actions →
          </Link>
        </div>
      )}
    </div>
  )
}

export default ActionCards