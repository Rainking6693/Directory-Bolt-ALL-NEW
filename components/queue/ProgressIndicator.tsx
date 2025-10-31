/**
 * Progress Indicator Component
 * Detailed progress tracking with steps and ETA
 * Phase 2.2 Implementation
 */

'use client'

import React from 'react'
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import { ProgressIndicatorProps } from '../../lib/types/queue.types'

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  showSteps = true,
  showETA = true,
  compact = false
}) => {
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString()
  }

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'in-progress':
        return <PlayIcon className="h-5 w-5 text-blue-500" />
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />
    }
  }

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 border-green-300 text-green-800'
      case 'in-progress':
        return 'bg-blue-100 border-blue-300 text-blue-800'
      case 'failed':
        return 'bg-red-100 border-red-300 text-red-800'
      default:
        return 'bg-gray-100 border-gray-300 text-gray-600'
    }
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Compact Progress Bar */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">{progress.currentStep}</span>
          <span className="text-gray-600">
            {progress.completedSteps} of {progress.totalSteps} ({Math.round(progress.percentage)}%)
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        
        {showETA && progress.estimatedTimeRemaining > 0 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>ETA: {formatTime(progress.estimatedTimeRemaining)}</span>
            <span>Last updated: {formatDateTime(progress.lastUpdateTime)}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with overall progress */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Processing Progress</h4>
          <p className="text-sm text-gray-600">Customer ID: {progress.customerId}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">{Math.round(progress.percentage)}%</div>
          <div className="text-sm text-gray-600">
            {progress.completedSteps} of {progress.totalSteps} steps
          </div>
        </div>
      </div>

      {/* Main Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div
          className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
          style={{ width: `${progress.percentage}%` }}
        >
          {progress.percentage > 20 && (
            <span className="text-white text-xs font-semibold">
              {Math.round(progress.percentage)}%
            </span>
          )}
        </div>
      </div>

      {/* Current Step Highlight */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center">
          <PlayIcon className="h-5 w-5 text-blue-600 mr-2" />
          <div className="flex-1">
            <div className="font-medium text-blue-900">Current Step</div>
            <div className="text-blue-700">{progress.currentStep}</div>
          </div>
          {showETA && progress.estimatedTimeRemaining > 0 && (
            <div className="text-right text-sm">
              <div className="text-blue-600 font-medium">
                ~{formatTime(progress.estimatedTimeRemaining)} remaining
              </div>
              <div className="text-blue-500">
                Updated {formatDateTime(progress.lastUpdateTime)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Steps */}
      {showSteps && (
        <div className="space-y-2">
          <h5 className="font-medium text-gray-900 mb-3">Step Details</h5>
          {progress.stepDetails.map((step, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getStepColor(step.status)} transition-all duration-200`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {getStepIcon(step.status)}
                  <div className="ml-3">
                    <div className="font-medium">{step.stepName}</div>
                    {step.duration && (
                      <div className="text-sm opacity-75">
                        Duration: {formatTime(step.duration)}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-sm">
                  {step.status === 'in-progress' && (
                    <div className="flex items-center">
                      <div className="animate-pulse h-2 w-2 bg-current rounded-full mr-2" />
                      In Progress
                    </div>
                  )}
                  {step.status === 'completed' && step.endTime && (
                    <div>Completed {formatDateTime(step.endTime)}</div>
                  )}
                  {step.status === 'failed' && (
                    <div className="flex items-center">
                      <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                      Failed
                    </div>
                  )}
                  {step.status === 'pending' && (
                    <div className="text-opacity-75">Pending</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-200">
        <div className="text-center">
          <div className="text-lg font-semibold text-green-600">
            {progress.stepDetails.filter(s => s.status === 'completed').length}
          </div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-blue-600">
            {progress.stepDetails.filter(s => s.status === 'in-progress').length}
          </div>
          <div className="text-sm text-gray-600">In Progress</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-red-600">
            {progress.stepDetails.filter(s => s.status === 'failed').length}
          </div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
      </div>
    </div>
  )
}

export default ProgressIndicator