'use client'

import React, { useState, useEffect, useMemo } from 'react'
// @ts-ignore - using JS service with ambient declaration
import { createSupabaseService } from '../../lib/services/supabase'
import { 
  ChartBarIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

interface CustomerStats {
  totalCustomers: number
  activeCustomers: number
  pendingCustomers: number
  completedCustomers: number
  failedCustomers: number
  todaysRegistrations: number
}

interface RealtimeUpdate {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: any
  timestamp: string
}

interface SupabaseRealTimeDashboardProps {
  refreshInterval?: number
  enableRealtime?: boolean
}

export const SupabaseRealTimeDashboard: React.FC<SupabaseRealTimeDashboardProps> = ({
  refreshInterval = 30000,
  enableRealtime = true
}) => {
  const [stats, setStats] = useState<CustomerStats>({
    totalCustomers: 0,
    activeCustomers: 0,
    pendingCustomers: 0,
    completedCustomers: 0,
    failedCustomers: 0,
    todaysRegistrations: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [realtimeUpdates, setRealtimeUpdates] = useState<RealtimeUpdate[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

  // Initialize Supabase service
  const [supabaseService] = useState(() => createSupabaseService())

  // Fetch customer statistics
  const fetchStats = async () => {
    try {
      setError(null)
      await supabaseService.initialize()
      
      const result = await supabaseService.getAllCustomers(1000)
      
      if (result.success) {
        const customers = result.customers as Array<{
          created?: string
          status?: string
        }>
        const today = new Date().toISOString().split('T')[0]
        
        const todaysCustomers = customers.filter(customer => 
          customer.created && customer.created.startsWith(today)
        )
        
        const newStats: CustomerStats = {
          totalCustomers: customers.length,
          activeCustomers: customers.filter(c => c.status === 'active').length,
          pendingCustomers: customers.filter(c => c.status === 'pending').length,
          completedCustomers: customers.filter(c => c.status === 'completed').length,
          failedCustomers: customers.filter(c => c.status === 'failed').length,
          todaysRegistrations: todaysCustomers.length
        }
        
        setStats(newStats)
        setLastUpdate(new Date())
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats')
      console.error('Dashboard stats error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Set up real-time subscriptions
  useEffect(() => {
    if (!enableRealtime) return

    let subscription: any = null

    const setupRealtime = async () => {
      try {
        setConnectionStatus('connecting')
        await supabaseService.initialize()
        
        subscription = supabaseService.subscribeToCustomers((payload: any) => {
          const update: RealtimeUpdate = {
            type: payload.eventType,
            table: payload.table,
            record: payload.new || payload.old,
            timestamp: new Date().toISOString()
          }
          
          // Add to recent updates (keep last 10)
          setRealtimeUpdates(prev => [update, ...prev.slice(0, 9)])
          
          // Update stats based on the change
          setStats(prevStats => {
            let newStats = { ...prevStats }
            
            if (payload.eventType === 'INSERT') {
              newStats.totalCustomers += 1
              if (payload.new.status === 'active') newStats.activeCustomers += 1
              if (payload.new.status === 'pending') newStats.pendingCustomers += 1
              if (payload.new.status === 'completed') newStats.completedCustomers += 1
              if (payload.new.status === 'failed') newStats.failedCustomers += 1
              
              // Check if created today
              const today = new Date().toISOString().split('T')[0]
              if (payload.new.created_at && payload.new.created_at.startsWith(today)) {
                newStats.todaysRegistrations += 1
              }
            } else if (payload.eventType === 'UPDATE') {
              const oldStatus = payload.old.status
              const newStatus = payload.new.status
              
              if (oldStatus !== newStatus) {
                // Decrement old status count
                if (oldStatus === 'active') newStats.activeCustomers -= 1
                if (oldStatus === 'pending') newStats.pendingCustomers -= 1
                if (oldStatus === 'completed') newStats.completedCustomers -= 1
                if (oldStatus === 'failed') newStats.failedCustomers -= 1
                
                // Increment new status count
                if (newStatus === 'active') newStats.activeCustomers += 1
                if (newStatus === 'pending') newStats.pendingCustomers += 1
                if (newStatus === 'completed') newStats.completedCustomers += 1
                if (newStatus === 'failed') newStats.failedCustomers += 1
              }
            } else if (payload.eventType === 'DELETE') {
              newStats.totalCustomers -= 1
              if (payload.old.status === 'active') newStats.activeCustomers -= 1
              if (payload.old.status === 'pending') newStats.pendingCustomers -= 1
              if (payload.old.status === 'completed') newStats.completedCustomers -= 1
              if (payload.old.status === 'failed') newStats.failedCustomers -= 1
            }
            
            return newStats
          })
          
          setLastUpdate(new Date())
        })
        
        setConnectionStatus('connected')
      } catch (err) {
        console.error('Real-time subscription error:', err)
        setConnectionStatus('disconnected')
        setError('Real-time connection failed')
      }
    }

    setupRealtime()

    return () => {
      if (subscription) {
        supabaseService.unsubscribe(subscription)
      }
      setConnectionStatus('disconnected')
    }
  }, [enableRealtime, supabaseService])

  // Set up periodic refresh (fallback for when real-time is disabled)
  useEffect(() => {
    fetchStats()
    
    if (!enableRealtime && refreshInterval > 0) {
      const interval = setInterval(fetchStats, refreshInterval)
      return () => clearInterval(interval)
    }

    return () => {}
  }, [enableRealtime, refreshInterval])

  // Calculate dashboard metrics
  const metrics = useMemo(() => {
    const { totalCustomers, activeCustomers, completedCustomers, failedCustomers } = stats
    const successRate = totalCustomers > 0 ? (completedCustomers / totalCustomers) * 100 : 0
    const activeRate = totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0
    
    return {
      successRate: Math.round(successRate),
      activeRate: Math.round(activeRate),
      totalProcessed: completedCustomers + failedCustomers,
      conversionFunnel: {
        registered: totalCustomers,
        active: activeCustomers,
        completed: completedCustomers
      }
    }
  }, [stats])

  const handleManualRefresh = () => {
    setIsLoading(true)
    fetchStats()
  }

  if (error && stats.totalCustomers === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
          <h3 className="text-lg font-medium text-red-800">Dashboard Error</h3>
        </div>
        <p className="mt-2 text-red-700">{error}</p>
        <button
          onClick={handleManualRefresh}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Real-Time Dashboard</h2>
          <p className="text-gray-600 mt-1">
            Last updated: {lastUpdate.toLocaleTimeString()}
            {enableRealtime && (
              <span className={`ml-3 inline-flex items-center px-2 py-1 text-xs rounded-full ${
                connectionStatus === 'connected' 
                  ? 'bg-green-100 text-green-800' 
                  : connectionStatus === 'connecting'
                  ? 'bg-volt-100 text-volt-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                <span className={`w-2 h-2 rounded-full mr-1 ${
                  connectionStatus === 'connected' ? 'bg-green-500' :
                  connectionStatus === 'connecting' ? 'bg-volt-500' : 'bg-red-500'
                }`}></span>
                {connectionStatus === 'connected' ? 'Live' : 
                 connectionStatus === 'connecting' ? 'Connecting' : 'Offline'}
              </span>
            )}
          </p>
        </div>
        
        <button
          onClick={handleManualRefresh}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
        >
          <ArrowPathIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center">
            <UserGroupIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCustomers.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm text-gray-500">
              +{stats.todaysRegistrations} today
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center">
            <ClockIcon className="h-8 w-8 text-volt-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active/Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {(stats.activeCustomers + stats.pendingCustomers).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-between text-sm text-gray-500">
            <span>Active: {stats.activeCustomers}</span>
            <span>Pending: {stats.pendingCustomers}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center">
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedCustomers.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm text-green-600">
              {metrics.successRate}% success rate
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.failedCustomers.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center">
            <ChartBarIcon className="h-8 w-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Processed</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.totalProcessed.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center text-white font-bold">
              %
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Rate</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.activeRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Real-time Updates */}
      {enableRealtime && realtimeUpdates.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Recent Updates
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {realtimeUpdates.map((update, index) => (
              <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
                <div className="flex items-center">
                  <span className={`px-2 py-1 text-xs rounded-full mr-3 ${
                    update.type === 'INSERT' ? 'bg-green-100 text-green-800' :
                    update.type === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {update.type}
                  </span>
                  <span className="text-sm text-gray-700">
                    Customer {update.record?.customer_id || 'Unknown'} - Status: {update.record?.status || 'Unknown'}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(update.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-volt-50 border border-volt-200 rounded-lg p-4">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-volt-400 mr-2" />
            <span className="text-volt-800">{error}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default SupabaseRealTimeDashboard