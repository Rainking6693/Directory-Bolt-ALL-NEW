/**
 * Queue Item Card Component
 * Individual queue item display with actions and progress
 * Phase 2.2 Implementation
 */

'use client'

import React, { useState } from 'react'
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  ArrowPathIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import { QueueItemCardProps } from '../../lib/types/queue.types'
import { useQueueProgress } from '../../lib/hooks/useQueue'
import ProgressIndicator from './ProgressIndicator'

const QueueItemCard: React.FC<QueueItemCardProps & {
  selected?: boolean
  onSelect?: (selected: boolean) => void
}> = ({
  item,
  showActions = true,
  showProgress = true,
  selected = false,
  onSelect,
  onProcess,
  onPause,
  onResume,
  onCancel,
  onViewDetails
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const { progress, eta } = useQueueProgress(item.customerId)

  // Status styling
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          bg: 'bg-volt-100',
          text: 'text-volt-800',
          icon: ClockIcon,
          border: 'border-volt-200'
        }
      case 'in-progress':
        return {
          bg: 'bg-blue-100',
          text: 'text-blue-800',
          icon: PlayIcon,
          border: 'border-blue-200'
        }
      case 'completed':
        return {
          bg: 'bg-green-100',
          text: 'text-green-800',
          icon: CheckCircleIcon,
          border: 'border-green-200'
        }
      case 'failed':
        return {
          bg: 'bg-red-100',
          text: 'text-red-800',
          icon: XCircleIcon,
          border: 'border-red-200'
        }
      case 'paused':
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          icon: PauseIcon,
          border: 'border-gray-200'
        }
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          icon: ClockIcon,
          border: 'border-gray-200'
        }
    }
  }

  // Package type styling
  const getPackageStyles = (packageType: string) => {
    switch (packageType.toLowerCase()) {
      case 'starter':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'growth':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'pro':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'subscription':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const statusStyle = getStatusStyles(item.submissionStatus)
  const StatusIcon = statusStyle.icon
  
  const handleAction = async (action: () => Promise<void> | void) => {
    setIsProcessing(true)
    try {
      await action()
    } catch (error) {
      console.error('Action failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border-2 transition-all duration-200 ${
      selected ? 'border-blue-300 shadow-md' : 'border-gray-200 hover:border-gray-300'
    }`}>
      {/* Main Card Content */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          {/* Left Section - Business Info */}
          <div className="flex items-start space-x-4 flex-1">
            {/* Selection Checkbox */}
            {onSelect && (
              <div className="flex items-start pt-1">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => onSelect(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex-1">
              {/* Business Name and Status */}
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {item.businessName}
                </h3>
                
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {item.submissionStatus.replace('-', ' ')}
                </div>

                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPackageStyles(item.packageType)}`}>
                  {item.packageType.toUpperCase()}
                </div>
              </div>

              {/* Business Details */}
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Customer ID:</span> {item.customerId}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {item.businessData.businessEmail}
                </div>
                <div>
                  <span className="font-medium">Website:</span> 
                  <a href={item.businessData.businessUrl} target="_blank" rel="noopener noreferrer" 
                     className="ml-1 text-blue-600 hover:text-blue-800">
                    {item.businessData.businessUrl}
                  </a>
                </div>
                <div>
                  <span className="font-medium">Category:</span> {item.businessData.businessCategory}
                </div>
              </div>

              {/* Queue Metadata */}
              <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Priority:</span>
                  <span className={`ml-1 ${item.priority > 75 ? 'text-red-600' : item.priority > 50 ? 'text-volt-600' : 'text-green-600'}`}>
                    {item.priority}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Directories:</span>
                  <span className="ml-1 text-gray-900">{item.directoryLimit}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Created:</span>
                  <span className="ml-1 text-gray-900">{formatDate(item.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Section - Actions */}
          {showActions && (
            <div className="flex items-center space-x-2 ml-4">
              {/* View Details */}
              {onViewDetails && (
                <button
                  onClick={() => onViewDetails(item.customerId)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="h-5 w-5" />
                </button>
              )}

              {/* Action Buttons based on status */}
              {item.submissionStatus === 'pending' && onProcess && (
                <button
                  onClick={() => handleAction(() => onProcess(item.customerId))}
                  disabled={isProcessing}
                  className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors text-sm flex items-center"
                  title="Process Now"
                >
                  <PlayIcon className="h-4 w-4 mr-1" />
                  Process
                </button>
              )}

              {item.submissionStatus === 'in-progress' && onPause && (
                <button
                  onClick={() => handleAction(() => onPause(item.customerId))}
                  disabled={isProcessing}
                  className="px-3 py-1 bg-volt-600 text-white rounded-md hover:bg-volt-700 disabled:opacity-50 transition-colors text-sm flex items-center"
                  title="Pause Processing"
                >
                  <PauseIcon className="h-4 w-4 mr-1" />
                  Pause
                </button>
              )}

              {item.submissionStatus === 'paused' && onResume && (
                <button
                  onClick={() => handleAction(() => onResume(item.customerId))}
                  disabled={isProcessing}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm flex items-center"
                  title="Resume Processing"
                >
                  <PlayIcon className="h-4 w-4 mr-1" />
                  Resume
                </button>
              )}

              {(item.submissionStatus === 'failed') && onCancel && (
                <button
                  onClick={() => handleAction(() => onCancel(item.customerId))}
                  disabled={isProcessing}
                  className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors text-sm flex items-center"
                  title="Retry"
                >
                  <ArrowPathIcon className="h-4 w-4 mr-1" />
                  Retry
                </button>
              )}

              {onCancel && item.submissionStatus !== 'completed' && item.submissionStatus !== 'failed' && (
                <button
                  onClick={() => handleAction(() => onCancel(item.customerId))}
                  disabled={isProcessing}
                  className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors text-sm flex items-center"
                  title="Cancel"
                >
                  <StopIcon className="h-4 w-4 mr-1" />
                  Cancel
                </button>
              )}

              {/* Expand/Collapse Button */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-5 w-5" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Progress Bar (always visible for in-progress items) */}
        {showProgress && item.submissionStatus === 'in-progress' && progress && (
          <div className="mt-4">
            <ProgressIndicator 
              progress={progress} 
              showSteps={false}
              compact={true}
            />
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="space-y-4">
            {/* Processing Metadata */}
            {item.processingMetadata && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Processing Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Progress:</span>
                    <span className="ml-1">{item.processingMetadata.progressPercentage}%</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Processed:</span>
                    <span className="ml-1">{item.processingMetadata.directoriesProcessed}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Remaining:</span>
                    <span className="ml-1">{item.processingMetadata.directoriesRemaining}</span>
                  </div>
                  {item.processingMetadata.retryCount > 0 && (
                    <div>
                      <span className="font-medium text-gray-700">Retries:</span>
                      <span className="ml-1">{item.processingMetadata.retryCount}</span>
                    </div>
                  )}
                </div>

                {item.processingMetadata.currentDirectoryName && (
                  <div className="mt-2">
                    <span className="font-medium text-gray-700">Current Directory:</span>
                    <span className="ml-1">{item.processingMetadata.currentDirectoryName}</span>
                  </div>
                )}

                {item.processingMetadata.processingErrors.length > 0 && (
                  <div className="mt-2">
                    <span className="font-medium text-gray-700 block mb-1">Errors:</span>
                    <div className="space-y-1">
                      {item.processingMetadata.processingErrors.slice(0, 3).map((error, index) => (
                        <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                          {error}
                        </div>
                      ))}
                      {item.processingMetadata.processingErrors.length > 3 && (
                        <div className="text-sm text-gray-500">
                          ... and {item.processingMetadata.processingErrors.length - 3} more errors
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ETA Information */}
            {eta && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Time Estimates</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Est. Start:</span>
                    <span className="ml-1">{formatDate(eta.estimatedStartTime)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Est. Completion:</span>
                    <span className="ml-1">{formatDate(eta.estimatedCompletionTime)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Duration:</span>
                    <span className="ml-1">{formatDuration(eta.estimatedProcessingDuration)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Confidence:</span>
                    <span className="ml-1">{Math.round(eta.confidence * 100)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Full Progress Display */}
            {showProgress && progress && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Detailed Progress</h4>
                <ProgressIndicator 
                  progress={progress} 
                  showSteps={true}
                  showETA={true}
                  compact={false}
                />
              </div>
            )}

            {/* Business Data Details */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Business Information</h4>
              <div className="text-sm text-gray-600 space-y-1">
                {item.businessData.businessDescription && (
                  <div>
                    <span className="font-medium">Description:</span>
                    <p className="mt-1">{item.businessData.businessDescription}</p>
                  </div>
                )}
                {item.businessData.businessPhone && (
                  <div>
                    <span className="font-medium">Phone:</span> {item.businessData.businessPhone}
                  </div>
                )}
                {item.businessData.businessAddress && (
                  <div>
                    <span className="font-medium">Address:</span> {item.businessData.businessAddress}
                  </div>
                )}
                <div>
                  <span className="font-medium">Purchase Date:</span> {formatDate(item.businessData.purchaseDate)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QueueItemCard