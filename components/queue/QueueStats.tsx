/**
 * Queue Statistics Component
 * Visual dashboard for queue metrics and KPIs
 * Phase 2.2 Implementation
 */

'use client'

import React from 'react'
import {
  ClockIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChartBarIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  PauseIcon
} from '@heroicons/react/24/outline'
import { QueueStats } from '../../lib/types/queue.types'

interface QueueStatsProps {
  stats: QueueStats
  className?: string
}

const QueueStatsComponent: React.FC<QueueStatsProps> = ({ stats, className = '' }) => {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${Math.round(mins)}m`
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const getProgressPercentage = (current: number, goal: number) => {
    return goal > 0 ? Math.min((current / goal) * 100, 100) : 0
  }

  const statCards = [
    {
      title: 'Pending',
      value: formatNumber(stats.totalPending),
      icon: ClockIcon,
      color: 'text-volt-600',
      bgColor: 'bg-volt-50',
      borderColor: 'border-volt-200',
      description: 'Awaiting processing'
    },
    {
      title: 'In Progress',
      value: formatNumber(stats.totalInProgress),
      icon: PlayIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      description: 'Currently processing'
    },
    {
      title: 'Completed',
      value: formatNumber(stats.totalCompleted),
      icon: CheckCircleIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      description: 'Successfully processed'
    },
    {
      title: 'Failed',
      value: formatNumber(stats.totalFailed),
      icon: XCircleIcon,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      description: 'Processing failed'
    },
    {
      title: 'Paused',
      value: formatNumber(stats.totalPaused),
      icon: PauseIcon,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      description: 'Temporarily paused'
    }
  ]

  const performanceMetrics = [
    {
      title: 'Success Rate',
      value: formatPercentage(stats.successRate),
      color: stats.successRate > 0.9 ? 'text-green-600' : stats.successRate > 0.7 ? 'text-volt-600' : 'text-red-600',
      trend: 'up' // This would come from historical comparison
    },
    {
      title: 'Avg Processing Time',
      value: formatTime(stats.averageProcessingTime),
      color: 'text-blue-600',
      trend: 'stable'
    },
    {
      title: 'Avg Wait Time',
      value: formatTime(stats.averageWaitTime),
      color: stats.averageWaitTime > 120 ? 'text-red-600' : stats.averageWaitTime > 60 ? 'text-volt-600' : 'text-green-600',
      trend: 'down'
    },
    {
      title: 'Queue Depth',
      value: formatNumber(stats.queueDepth),
      color: stats.queueDepth > 100 ? 'text-red-600' : stats.queueDepth > 50 ? 'text-volt-600' : 'text-green-600',
      trend: 'stable'
    }
  ]

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
      case 'down':
        return <ArrowTrendingUpIcon className="h-4 w-4 text-red-500 transform rotate-180" />
      default:
        return <div className="h-4 w-4 bg-gray-300 rounded-full" />
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.title}
              className={`p-6 rounded-lg border-2 ${stat.bgColor} ${stat.borderColor} transition-all duration-200 hover:shadow-md`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className={`text-3xl font-bold ${stat.color} mt-2`}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                </div>
                <Icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Performance Metrics & Today's Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Metrics */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center mb-4">
            <ChartBarIcon className="h-5 w-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Performance Metrics</h3>
          </div>
          
          <div className="space-y-4">
            {performanceMetrics.map((metric, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-700">{metric.title}</span>
                  <div className="ml-2">
                    {getTrendIcon(metric.trend)}
                  </div>
                </div>
                <span className={`text-lg font-semibold ${metric.color}`}>
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Progress */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center mb-4">
            <UsersIcon className="h-5 w-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Today's Progress</h3>
          </div>
          
          <div className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Daily Goal Progress</span>
                <span className="text-sm text-gray-600">
                  {formatNumber(stats.todaysProcessed)} / {formatNumber(stats.todaysGoal)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    getProgressPercentage(stats.todaysProcessed, stats.todaysGoal) >= 100
                      ? 'bg-green-500'
                      : getProgressPercentage(stats.todaysProcessed, stats.todaysGoal) >= 75
                      ? 'bg-blue-500'
                      : getProgressPercentage(stats.todaysProcessed, stats.todaysGoal) >= 50
                      ? 'bg-volt-500'
                      : 'bg-red-500'
                  }`}
                  style={{
                    width: `${getProgressPercentage(stats.todaysProcessed, stats.todaysGoal)}%`
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>{formatPercentage(getProgressPercentage(stats.todaysProcessed, stats.todaysGoal) / 100)}</span>
                <span>{formatNumber(stats.todaysGoal)}</span>
              </div>
            </div>

            {/* Today's Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-md border border-green-200">
                <div className="text-2xl font-bold text-green-600">{formatNumber(stats.todaysProcessed)}</div>
                <div className="text-sm text-green-700">Processed Today</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-md border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">{formatNumber(stats.currentThroughput)}</div>
                <div className="text-sm text-blue-700">Per Hour</div>
              </div>
            </div>

            {/* Peak Hours */}
            {stats.peakHours && stats.peakHours.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Peak Processing Hours</h4>
                <div className="flex flex-wrap gap-1">
                  {stats.peakHours.slice(0, 3).map((peak, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {peak.hour}:00 ({peak.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alert Conditions */}
      {(stats.queueDepth > 100 || stats.averageWaitTime > 120 || stats.successRate < 0.8) && (
        <div className="bg-volt-50 border border-volt-200 rounded-lg p-4">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="h-5 w-5 text-volt-600 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-semibold text-volt-800">Performance Alerts</h4>
              <div className="mt-2 space-y-1">
                {stats.queueDepth > 100 && (
                  <p className="text-sm text-volt-700">
                    • High queue depth detected ({stats.queueDepth} items) - consider increasing processing capacity
                  </p>
                )}
                {stats.averageWaitTime > 120 && (
                  <p className="text-sm text-volt-700">
                    • Extended wait times ({formatTime(stats.averageWaitTime)}) - customers may experience delays
                  </p>
                )}
                {stats.successRate < 0.8 && (
                  <p className="text-sm text-volt-700">
                    • Low success rate ({formatPercentage(stats.successRate)}) - review failed submissions
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QueueStatsComponent