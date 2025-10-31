import React, { useState, useEffect, useCallback } from 'react'
import { useWebSocket } from '../../lib/hooks/useWebSocket'
import { LoadingState } from '../ui/LoadingState'
import { ErrorBoundary } from '../ui/ErrorBoundary'

interface RealTimeDashboardProps {
  userId: string
  userTier: string
  className?: string
}

interface DashboardData {
  stats: {
    totalDirectories: number
    liveDirectories: number
    pendingDirectories: number
    rejectedDirectories: number
    completionRate: number
    estimatedTraffic: number
    estimatedLeads: number
  }
  recentActivity: ActivityItem[]
  processingStatus: {
    isProcessing: boolean
    currentStep?: string
    progress?: number
    eta?: string
  }
  notifications: NotificationItem[]
}

interface ActivityItem {
  id: string
  type: 'submission' | 'approval' | 'rejection' | 'processing'
  directoryName: string
  timestamp: string
  message: string
  status: 'success' | 'warning' | 'error' | 'info'
}

interface NotificationItem {
  id: string
  type: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
  timestamp: string
  read: boolean
}

export default function RealTimeDashboard({ 
  userId, 
  userTier, 
  className = '' 
}: RealTimeDashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)

  // WebSocket connection with real-time updates
  const {
    isConnected,
    isConnecting,
    error: wsError,
    lastMessage,
    requestDashboardUpdate,
    subscribe
  } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
    autoConnect: true,
    onConnect: () => {
      console.log('WebSocket connected - requesting dashboard data')
      requestDashboardUpdate({ userId, userTier })
    },
    onMessage: (message) => {
      console.log('Received WebSocket message:', message.type)
    }
  })

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return

    switch (lastMessage.type) {
      case 'dashboard_update':
        handleDashboardUpdate(lastMessage.payload)
        break
      
      case 'submission_update':
        handleSubmissionUpdate(lastMessage.payload)
        break
      
      case 'queue_update':
        handleQueueUpdate(lastMessage.payload)
        break

      default:
        console.log('Unhandled message type:', lastMessage.type)
        break
    }
  }, [lastMessage])

  const handleDashboardUpdate = useCallback((payload: any) => {
    if (payload.error) {
      console.error('Dashboard update error:', payload.error)
      return
    }

    if (payload.dashboardData) {
      setDashboardData(payload.dashboardData)
      setLastUpdateTime(new Date())
      setIsInitialLoading(false)
    }
  }, [])

  const handleSubmissionUpdate = useCallback((payload: any) => {
    setDashboardData(prev => {
      if (!prev) return prev

      // Update stats based on submission status change
      const updatedStats = { ...prev.stats }
      
      if (payload.status === 'live') {
        updatedStats.liveDirectories += 1
        updatedStats.pendingDirectories = Math.max(0, updatedStats.pendingDirectories - 1)
      } else if (payload.status === 'rejected') {
        updatedStats.rejectedDirectories += 1
        updatedStats.pendingDirectories = Math.max(0, updatedStats.pendingDirectories - 1)
      }

      updatedStats.completionRate = updatedStats.totalDirectories > 0 
        ? (updatedStats.liveDirectories / updatedStats.totalDirectories) * 100 
        : 0

      // Add to recent activity
      const newActivity: ActivityItem = {
        id: `activity_${Date.now()}`,
        type: payload.status === 'live' ? 'approval' : 'rejection',
        directoryName: payload.directoryName,
        timestamp: new Date().toISOString(),
        message: payload.status === 'live' 
          ? `Successfully listed on ${payload.directoryName}`
          : `Submission to ${payload.directoryName} was rejected`,
        status: payload.status === 'live' ? 'success' : 'error'
      }

      return {
        ...prev,
        stats: updatedStats,
        recentActivity: [newActivity, ...prev.recentActivity.slice(0, 9)] // Keep last 10
      }
    })

    setLastUpdateTime(new Date())
  }, [])

  const handleQueueUpdate = useCallback((payload: any) => {
    setDashboardData(prev => {
      if (!prev) return prev

      return {
        ...prev,
        processingStatus: {
          isProcessing: payload.isProcessing,
          currentStep: payload.currentStep,
          progress: payload.progress,
          eta: payload.eta
        }
      }
    })

    setLastUpdateTime(new Date())
  }, [])

  // Subscribe to user-specific updates when connected
  useEffect(() => {
    if (isConnected) {
      subscribe(`user:${userId}`)
      subscribe(`dashboard:${userId}`)
    }
  }, [isConnected, userId, subscribe])

  // Fallback to HTTP polling if WebSocket fails
  useEffect(() => {
    if (wsError && !isConnected && !isConnecting) {
      console.warn('WebSocket failed, falling back to HTTP polling')
      // Implement HTTP polling fallback here
    }

    return () => {}
  }, [wsError, isConnected, isConnecting])

  const fetchDashboardDataHttp = async () => {
    try {
      const response = await fetch(`/api/customer/dashboard-data?customerId=${userId}`)
      const data = await response.json()
      
      if (data.success) {
        setDashboardData(data.dashboardData)
        setLastUpdateTime(new Date())
        setIsInitialLoading(false)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    }
  }

  const getConnectionStatusColor = () => {
    if (isConnected) return 'bg-green-500'
    if (isConnecting) return 'bg-volt-500 animate-pulse'
    return 'bg-red-500'
  }

  const getConnectionStatusText = () => {
    if (isConnected) return 'Live'
    if (isConnecting) return 'Connecting...'
    return 'Offline'
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now.getTime() - time.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  const getActivityIcon = (type: string, status: string) => {
    switch (type) {
      case 'approval':
        return '✅'
      case 'rejection':
        return '❌'
      case 'submission':
        return '📤'
      case 'processing':
        return '⚙️'
      default:
        return '📋'
    }
  }

  const getActivityStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50'
      case 'error':
        return 'text-red-600 bg-red-50'
      case 'warning':
        return 'text-volt-600 bg-volt-50'
      case 'info':
        return 'text-blue-600 bg-blue-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  if (isInitialLoading) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${className}`}>
        <LoadingState message="Loading your dashboard..." variant="spinner" size="lg" />
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium">Dashboard Unavailable</h3>
          <p className="text-sm mt-2">Unable to load dashboard data. Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
        {/* Header with Connection Status */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Real-Time Dashboard</h2>
              <p className="text-gray-600 mt-1">Live updates from your directory submissions</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`}></div>
                <span className="text-sm text-gray-600">{getConnectionStatusText()}</span>
              </div>
              {lastUpdateTime && (
                <div className="text-xs text-gray-500">
                  Updated {formatTimeAgo(lastUpdateTime.toISOString())}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{dashboardData.stats.totalDirectories}</div>
              <div className="text-sm text-gray-600">Total Directories</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{dashboardData.stats.liveDirectories}</div>
              <div className="text-sm text-gray-600">Live Listings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-volt-600">{dashboardData.stats.pendingDirectories}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{Math.round(dashboardData.stats.completionRate)}%</div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
          </div>

          {/* Progress Section */}
          {dashboardData.processingStatus.isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-blue-900">Processing in Progress</h3>
                <span className="text-sm text-blue-700">
                  {dashboardData.processingStatus.progress}% Complete
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${dashboardData.processingStatus.progress || 0}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-blue-700">
                <span>{dashboardData.processingStatus.currentStep}</span>
                {dashboardData.processingStatus.eta && (
                  <span>ETA: {dashboardData.processingStatus.eta}</span>
                )}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {dashboardData.recentActivity.length > 0 ? (
                dashboardData.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-2 bg-white rounded border">
                    <div className="text-lg">{getActivityIcon(activity.type, activity.status)}</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{activity.message}</div>
                      <div className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${getActivityStatusColor(activity.status)}`}>
                      {activity.status}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-4">
                  <div className="text-2xl mb-2">📋</div>
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </div>

          {/* WebSocket Debug Info (development only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-4 bg-gray-100 rounded text-xs text-gray-600">
              <div>WebSocket Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
              <div>Last Message: {lastMessage ? lastMessage.type : 'None'}</div>
              {wsError && <div className="text-red-600">Error: {wsError}</div>}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}