/**
 * React Hooks for Queue Management
 * Real-time updates, caching, and state management
 * Phase 2.2 Implementation
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { 
  QueueItem, 
  QueueStats, 
  QueueUpdate, 
  QueueProcessingResult, 
  BatchOperation, 
  GetQueueRequest, 
  QueueError,
  ProgressIndicator,
  ETACalculation,
  UserNotification,
  UseQueueReturn,
  UseQueueUpdatesReturn
} from '../types/queue.types'
import { QueueAPIClient, createQueueClient, getDefaultQueueConfig } from '../clients/queue-client'

// Custom hook for queue management
export function useQueue(
  initialParams: GetQueueRequest = {},
  config?: {
    autoRefresh?: boolean
    refreshInterval?: number
    enableRealTime?: boolean
  }
): UseQueueReturn {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<QueueError | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const clientRef = useRef<QueueAPIClient | null>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  const {
    autoRefresh = true,
    refreshInterval = 5000,
    enableRealTime = true
  } = config || {}

  // Initialize API client
  useEffect(() => {
    if (!clientRef.current) {
      const queueConfig = getDefaultQueueConfig(
        process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
        process.env.NEXT_PUBLIC_API_KEY || ''
      )
      queueConfig.enableWebSocket = enableRealTime
      clientRef.current = createQueueClient(queueConfig)
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnectWebSocket()
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [enableRealTime])

  // Set up real-time updates
  useEffect(() => {
    if (!enableRealTime || !clientRef.current) return

    const client = clientRef.current

    const handleQueueUpdate = (update: QueueUpdate) => {
      setQueue(prevQueue => {
        const updatedQueue = [...prevQueue]
        const index = updatedQueue.findIndex(item => item.customerId === update.customerId)
        
        if (index !== -1) {
          const item = { ...updatedQueue[index] }
          
          if (update.data.newStatus) {
            item.submissionStatus = update.data.newStatus as any
          }
          
          if (update.data.progress !== undefined && item.processingMetadata) {
            item.processingMetadata.progressPercentage = update.data.progress
          }
          
          if (update.data.directoriesProcessed !== undefined && item.processingMetadata) {
            item.processingMetadata.directoriesProcessed = update.data.directoriesProcessed
          }
          
          if (update.data.estimatedTimeRemaining && item.processingMetadata) {
            item.processingMetadata.estimatedTimeRemaining = update.data.estimatedTimeRemaining
          }
          
          item.updatedAt = update.timestamp
          updatedQueue[index] = item
        }
        
        return updatedQueue
      })
    }

    const handleStatsUpdate = (newStats: QueueStats) => {
      setStats(newStats)
    }

    const handleError = (errorData: { error: string }) => {
      setError({
        code: 'WEBSOCKET_ERROR',
        message: errorData.error,
        timestamp: new Date().toISOString(),
        severity: 'medium'
      })
    }

    client.on('queueUpdate', handleQueueUpdate)
    client.on('statsUpdate', handleStatsUpdate)
    client.on('error', handleError)
    client.connectWebSocket()

    return () => {
      client.off('queueUpdate', handleQueueUpdate)
      client.off('statsUpdate', handleStatsUpdate)
      client.off('error', handleError)
      client.disconnectWebSocket()
    }
  }, [enableRealTime])

  // Fetch queue data
  const fetchQueue = useCallback(async () => {
    if (!clientRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await clientRef.current.getQueue(initialParams)
      setQueue(response.data.items)
      setStats(response.data.stats)
      setLastFetch(new Date())

    } catch (err) {
      const queueError = err as QueueError
      setError(queueError)
      console.error('Failed to fetch queue:', queueError)
    } finally {
      setIsLoading(false)
    }
  }, [initialParams])

  // Set up auto refresh
  useEffect(() => {
    if (autoRefresh && !enableRealTime) {
      refreshTimerRef.current = setInterval(fetchQueue, refreshInterval)
      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current)
        }
      }
    }

    return () => {}
  }, [autoRefresh, enableRealTime, refreshInterval, fetchQueue])

  // Initial fetch
  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // Queue operations
  const processCustomer = useCallback(async (customerId: string): Promise<QueueProcessingResult> => {
    if (!clientRef.current) {
      throw new Error('Queue client not initialized')
    }

    try {
      const result = await clientRef.current.processCustomer(customerId)
      
      // Update local state optimistically
      setQueue(prevQueue => 
        prevQueue.map(item => 
          item.customerId === customerId 
            ? { ...item, submissionStatus: 'in-progress', updatedAt: new Date().toISOString() }
            : item
        )
      )
      
      return result
    } catch (error) {
      throw error
    }
  }, [])

  const pauseCustomer = useCallback(async (customerId: string): Promise<void> => {
    if (!clientRef.current) {
      throw new Error('Queue client not initialized')
    }

    try {
      await clientRef.current.pauseCustomer(customerId)
      
      // Update local state
      setQueue(prevQueue => 
        prevQueue.map(item => 
          item.customerId === customerId 
            ? { ...item, submissionStatus: 'paused', updatedAt: new Date().toISOString() }
            : item
        )
      )
    } catch (error) {
      throw error
    }
  }, [])

  const resumeCustomer = useCallback(async (customerId: string): Promise<void> => {
    if (!clientRef.current) {
      throw new Error('Queue client not initialized')
    }

    try {
      await clientRef.current.resumeCustomer(customerId)
      
      // Update local state
      setQueue(prevQueue => 
        prevQueue.map(item => 
          item.customerId === customerId 
            ? { ...item, submissionStatus: 'pending', updatedAt: new Date().toISOString() }
            : item
        )
      )
    } catch (error) {
      throw error
    }
  }, [])

  const cancelCustomer = useCallback(async (customerId: string): Promise<void> => {
    if (!clientRef.current) {
      throw new Error('Queue client not initialized')
    }

    try {
      await clientRef.current.cancelCustomer(customerId)
      
      // Remove from local state or mark as cancelled
      setQueue(prevQueue => 
        prevQueue.filter(item => item.customerId !== customerId)
      )
    } catch (error) {
      throw error
    }
  }, [])

  return {
    queue,
    stats,
    isLoading,
    error,
    refetch: fetchQueue,
    processCustomer,
    pauseCustomer,
    resumeCustomer,
    cancelCustomer
  }
}

// Hook for real-time queue updates
export function useQueueUpdates(): UseQueueUpdatesReturn {
  const [updates, setUpdates] = useState<QueueUpdate[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const clientRef = useRef<QueueAPIClient | null>(null)

  const connect = useCallback(() => {
    if (!clientRef.current) {
      const config = getDefaultQueueConfig(
        process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
        process.env.NEXT_PUBLIC_API_KEY || ''
      )
      clientRef.current = createQueueClient(config)
    }

    const client = clientRef.current

    const handleQueueUpdate = (update: QueueUpdate) => {
      setUpdates(prev => {
        const newUpdates = [update, ...prev.slice(0, 49)] // Keep last 50 updates
        return newUpdates
      })
      setLastUpdate(update.timestamp)
    }

    const handleConnection = () => {
      setIsConnected(true)
      setConnectionError(null)
    }

    const handleDisconnection = () => {
      setIsConnected(false)
    }

    const handleError = (error: { error: string }) => {
      setConnectionError(error.error)
      setIsConnected(false)
    }

    client.on('queueUpdate', handleQueueUpdate)
    client.on('error', handleError)
    client.connectWebSocket()

    // Check connection status periodically
    const checkConnection = () => {
      const status = client.getConnectionStatus()
      setIsConnected(status.websocket === 'connected')
    }
    
    const connectionCheckInterval = setInterval(checkConnection, 1000)

    return () => {
      clearInterval(connectionCheckInterval)
      client.off('queueUpdate', handleQueueUpdate)
      client.off('error', handleError)
      client.disconnectWebSocket()
    }
  }, [])

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnectWebSocket()
      setIsConnected(false)
    }
  }, [])

  useEffect(() => {
    const cleanup = connect()
    return cleanup
  }, [connect])

  return {
    updates,
    isConnected,
    lastUpdate,
    connectionError,
    connect,
    disconnect
  }
}

// Hook for queue progress tracking
export function useQueueProgress(customerId: string) {
  const [progress, setProgress] = useState<ProgressIndicator | null>(null)
  const [eta, setETA] = useState<ETACalculation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<QueueError | null>(null)

  const clientRef = useRef<QueueAPIClient | null>(null)

  useEffect(() => {
    if (!clientRef.current) {
      const config = getDefaultQueueConfig(
        process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
        process.env.NEXT_PUBLIC_API_KEY || ''
      )
      clientRef.current = createQueueClient(config)
    }
  }, [])

  const fetchProgress = useCallback(async () => {
    if (!clientRef.current || !customerId) return

    try {
      setIsLoading(true)
      setError(null)

      const [progressData, etaData] = await Promise.allSettled([
        clientRef.current.getProgress(customerId),
        clientRef.current.getETA(customerId)
      ])

      if (progressData.status === 'fulfilled') {
        setProgress(progressData.value)
      }

      if (etaData.status === 'fulfilled') {
        setETA(etaData.value)
      }

    } catch (err) {
      setError(err as QueueError)
    } finally {
      setIsLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    fetchProgress()
    
    // Refresh progress every 10 seconds
    const interval = setInterval(fetchProgress, 10000)
    return () => clearInterval(interval)
  }, [fetchProgress])

  return {
    progress,
    eta,
    isLoading,
    error,
    refetch: fetchProgress
  }
}

// Hook for batch operations
export function useBatchOperations() {
  const [batches, setBatches] = useState<BatchOperation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<QueueError | null>(null)

  const clientRef = useRef<QueueAPIClient | null>(null)

  useEffect(() => {
    if (!clientRef.current) {
      const config = getDefaultQueueConfig(
        process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
        process.env.NEXT_PUBLIC_API_KEY || ''
      )
      clientRef.current = createQueueClient(config)
    }
  }, [])

  const fetchBatches = useCallback(async () => {
    if (!clientRef.current) return

    try {
      setIsLoading(true)
      setError(null)
      const batchData = await clientRef.current.getBatches()
      setBatches(batchData)
    } catch (err) {
      setError(err as QueueError)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createBatch = useCallback(async (customerIds: string[], operation: 'process' | 'retry' | 'cancel') => {
    if (!clientRef.current) {
      throw new Error('Client not initialized')
    }

    try {
      const batch = await clientRef.current.createBatch({
        customerIds,
        operation
      })
      
      setBatches(prev => [batch, ...prev])
      return batch
    } catch (error) {
      throw error
    }
  }, [])

  const cancelBatch = useCallback(async (batchId: string) => {
    if (!clientRef.current) {
      throw new Error('Client not initialized')
    }

    try {
      const cancelledBatch = await clientRef.current.cancelBatch(batchId)
      setBatches(prev => 
        prev.map(batch => 
          batch.id === batchId ? cancelledBatch : batch
        )
      )
      return cancelledBatch
    } catch (error) {
      throw error
    }
  }, [])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  return {
    batches,
    isLoading,
    error,
    refetch: fetchBatches,
    createBatch,
    cancelBatch
  }
}

// Hook for notifications
export function useQueueNotifications(customerId?: string) {
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<QueueError | null>(null)

  const clientRef = useRef<QueueAPIClient | null>(null)

  useEffect(() => {
    if (!clientRef.current) {
      const config = getDefaultQueueConfig(
        process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
        process.env.NEXT_PUBLIC_API_KEY || ''
      )
      clientRef.current = createQueueClient(config)
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    if (!clientRef.current) return

    try {
      setIsLoading(true)
      setError(null)
      const notificationData = await clientRef.current.getNotifications(customerId)
      setNotifications(notificationData)
    } catch (err) {
      setError(err as QueueError)
    } finally {
      setIsLoading(false)
    }
  }, [customerId])

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!clientRef.current) return

    try {
      await clientRef.current.markNotificationRead(notificationId)
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      )
    } catch (err) {
      setError(err as QueueError)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    
    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read).length, 
    [notifications]
  )

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch: fetchNotifications,
    markAsRead
  }
}