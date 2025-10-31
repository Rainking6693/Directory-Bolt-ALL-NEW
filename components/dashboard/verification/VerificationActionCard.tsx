'use client'
import { useState } from 'react'
import { VerificationAction } from '../../../types/dashboard'
import { SMSVerificationForm } from './forms/SMSVerificationForm'
import { EmailVerificationDisplay } from './forms/EmailVerificationDisplay'
import { DocumentUploadInterface } from './forms/DocumentUploadInterface'
import { PhoneCallScheduler } from './forms/PhoneCallScheduler'

interface VerificationActionCardProps {
  action: VerificationAction
  onStatusUpdate?: (status: VerificationAction['status']) => void
  className?: string
}

export function VerificationActionCard({
  action,
  onStatusUpdate,
  className = ''
}: VerificationActionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const getVerificationIcon = (type: VerificationAction['verificationType']) => {
    switch (type) {
      case 'sms': return '📱'
      case 'email': return '📧'
      case 'document': return '📄'
      case 'phone_call': return '📞'
      case 'identity': return '🆔'
      default: return '🔍'
    }
  }

  const getVerificationLabel = (type: VerificationAction['verificationType']) => {
    switch (type) {
      case 'sms': return 'SMS Verification'
      case 'email': return 'Email Verification'
      case 'document': return 'Document Upload'
      case 'phone_call': return 'Phone Verification'
      case 'identity': return 'Identity Verification'
      default: return 'Verification'
    }
  }

  const getPriorityStyles = (priority: VerificationAction['priority']) => {
    switch (priority) {
      case 'high':
        return {
          border: 'border-danger-500/30',
          background: 'bg-danger-500/5',
          badge: 'bg-danger-500/20 text-danger-400 border-danger-500/30',
          glow: 'shadow-danger-500/20'
        }
      case 'medium':
        return {
          border: 'border-volt-500/30',
          background: 'bg-volt-500/5',
          badge: 'bg-volt-500/20 text-volt-400 border-volt-500/30',
          glow: 'shadow-yellow-500/20'
        }
      case 'low':
        return {
          border: 'border-secondary-600',
          background: 'bg-secondary-800/50',
          badge: 'bg-secondary-600/50 text-secondary-300 border-secondary-500/30',
          glow: 'shadow-secondary-500/10'
        }
      default:
        return {
          border: 'border-secondary-600',
          background: 'bg-secondary-800/50',
          badge: 'bg-secondary-600/50 text-secondary-300 border-secondary-500/30',
          glow: 'shadow-secondary-500/10'
        }
    }
  }

  const getStatusStyles = (status: VerificationAction['status']) => {
    switch (status) {
      case 'in_progress':
        return 'bg-volt-500/20 text-volt-400 border-volt-500/30'
      case 'pending':
        return 'bg-secondary-600/50 text-secondary-300 border-secondary-500/30'
      case 'completed':
        return 'bg-success-500/20 text-success-400 border-success-500/30'
      default:
        return 'bg-secondary-600/50 text-secondary-300 border-secondary-500/30'
    }
  }

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`
    } else if (diffDays === 0) {
      return 'Due today'
    } else if (diffDays === 1) {
      return 'Due tomorrow'
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} days`
    } else {
      return date.toLocaleDateString()
    }
  }

  const formatEstimatedTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min${minutes !== 1 ? 's' : ''}`
    } else {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      if (remainingMinutes === 0) {
        return `${hours} hr${hours !== 1 ? 's' : ''}`
      } else {
        return `${hours}h ${remainingMinutes}m`
      }
    }
  }

  const priorityStyles = getPriorityStyles(action.priority)
  const isOverdue = action.dueDate && new Date(action.dueDate) < new Date()

  const handleActionClick = async () => {
    if (action.verificationType === 'email') {
      // For email verification, just expand to show status
      setIsExpanded(!isExpanded)
      return
    }

    setIsExpanded(!isExpanded)
    
    if (!isExpanded && action.status === 'pending') {
      setIsProcessing(true)
      onStatusUpdate?.('in_progress')
      
      // Simulate starting the verification process
      setTimeout(() => {
        setIsProcessing(false)
      }, 1000)
    }
  }

  const renderVerificationInterface = () => {
    if (!isExpanded) return null

    switch (action.verificationType) {
      case 'sms':
        return (
          <SMSVerificationForm
            action={action}
            onComplete={() => {
              onStatusUpdate?.('completed')
              setIsExpanded(false)
            }}
            onCancel={() => setIsExpanded(false)}
          />
        )
      case 'email':
        return (
          <EmailVerificationDisplay
            action={action}
            onResend={() => {
              // Handle email resend
              console.log('Resending email verification')
            }}
          />
        )
      case 'document':
        return (
          <DocumentUploadInterface
            action={action}
            onUploadComplete={() => {
              onStatusUpdate?.('completed')
              setIsExpanded(false)
            }}
            onCancel={() => setIsExpanded(false)}
          />
        )
      case 'phone_call':
        return (
          <PhoneCallScheduler
            action={action}
            onScheduled={() => {
              onStatusUpdate?.('in_progress')
              setIsExpanded(false)
            }}
            onCancel={() => setIsExpanded(false)}
          />
        )
      default:
        return (
          <div className="mt-4 p-4 bg-secondary-700/30 rounded-lg">
            <p className="text-secondary-300">
              This verification type is not yet supported in the interface. 
              Please follow the link to complete this action externally.
            </p>
          </div>
        )
    }
  }

  return (
    <div
      className={`rounded-xl border p-6 transition-all duration-300 hover:scale-[1.01] ${
        priorityStyles.border
      } ${priorityStyles.background} ${
        isOverdue ? 'ring-1 ring-danger-500/50' : ''
      } ${isExpanded ? `shadow-2xl ${priorityStyles.glow}` : 'shadow-lg'} ${className}`}
    >
      {/* Card Header */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <span className="text-3xl">{getVerificationIcon(action.verificationType)}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h3 className="font-bold text-white text-lg leading-tight mb-1">
                {action.title}
              </h3>
              <p className="text-volt-400 text-sm font-medium">
                {getVerificationLabel(action.verificationType)} • {action.directoryName}
              </p>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${priorityStyles.badge}`}>
                {action.priority.toUpperCase()} PRIORITY
              </span>
              {action.status !== 'pending' && (
                <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${getStatusStyles(action.status)}`}>
                  {action.status.replace('_', ' ').toUpperCase()}
                </span>
              )}
            </div>
          </div>
          
          <p className="text-secondary-300 text-sm mb-4 leading-relaxed">
            {action.description}
          </p>
          
          {/* Action Metadata */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            {action.dueDate && (
              <div className="flex items-center gap-2">
                <span className="text-lg">⏰</span>
                <span className={`text-sm font-medium ${
                  isOverdue ? 'text-danger-400' : 'text-secondary-400'
                }`}>
                  {formatDueDate(action.dueDate)}
                </span>
              </div>
            )}
            
            {action.estimatedTime && (
              <div className="flex items-center gap-2">
                <span className="text-lg">⏱️</span>
                <span className="text-secondary-400 text-sm">
                  Est. {formatEstimatedTime(action.estimatedTime)}
                </span>
              </div>
            )}
            
            {action.requiresUpload && (
              <div className="flex items-center gap-2">
                <span className="text-lg">📎</span>
                <span className="text-secondary-400 text-sm">
                  File upload required
                </span>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleActionClick}
              disabled={isProcessing}
              className={`inline-flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-lg transition-all duration-300 hover:scale-105 min-h-[44px] touch-manipulation ${
                isProcessing
                  ? 'bg-secondary-600 text-secondary-400 cursor-not-allowed'
                  : isExpanded
                  ? 'bg-secondary-600 hover:bg-secondary-500 text-secondary-200'
                  : 'bg-volt-500 hover:bg-volt-400 text-secondary-900'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
                  <span>Starting...</span>
                </>
              ) : isExpanded ? (
                <>
                  <span>▲</span>
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <span>Start Verification</span>
                  <span aria-hidden="true">→</span>
                </>
              )}
            </button>
            
            {action.actionUrl && !isExpanded && (
              <a
                href={action.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 border border-secondary-500 text-secondary-300 hover:text-secondary-200 hover:border-secondary-400 font-medium text-sm rounded-lg transition-all duration-300 min-h-[44px] touch-manipulation"
              >
                <span>External Link</span>
                <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Verification Interface */}
      {renderVerificationInterface()}
    </div>
  )
}

export default VerificationActionCard