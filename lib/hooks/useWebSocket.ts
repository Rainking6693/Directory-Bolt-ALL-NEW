import { useEffect, useRef, useState, useCallback } from 'react'
import { logger } from '../utils/logger'

export interface WebSocketMessage {
  type: string
  payload: any
  timestamp: string
  clientId?: string
}

export interface WebSocketHookConfig {
  url?: string
  autoConnect?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
  heartbeatInterval?: number
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  onMessage?: (message: WebSocketMessage) => void
}

export interface WebSocketState {
  isConnected: boolean
  isConnecting: boolean
  connectionAttempts: number
  lastMessage: WebSocketMessage | null
  error: string | null
}

export function useWebSocket(config: WebSocketHookConfig = {}) {
  const {
    url = 'ws://localhost:3001',
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
    heartbeatInterval = 30000,
    onConnect,
    onDisconnect,
    onError,
    onMessage
  } = config

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    connectionAttempts: 0,
    lastMessage: null,
    error: null
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageQueueRef = useRef<WebSocketMessage[]>([])
  const isAuthenticated = useRef(false)
  const clientId = useRef<string | null>(null)

  // Clear timeouts helper
  const clearTimeouts = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current)
      heartbeatTimeoutRef.current = null
    }
  }, [])

  // Send heartbeat
  const sendHeartbeat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isAuthenticated.current) {
      send({
        type: 'heartbeat',
        payload: { timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString()
      })
    }
  }, [])

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatInterval > 0) {
      heartbeatTimeoutRef.current = setInterval(sendHeartbeat, heartbeatInterval)
    }
  }, [heartbeatInterval, sendHeartbeat])

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current)
      heartbeatTimeoutRef.current = null
    }
  }, [])

  // Handle WebSocket message
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data)
      
      setState(prev => ({ ...prev, lastMessage: message, error: null }))

      // Handle authentication response
      if (message.type === 'auth') {
        if (message.payload.success) {
          isAuthenticated.current = true
          clientId.current = message.payload.clientId
          startHeartbeat()
          
          // Send queued messages
          while (messageQueueRef.current.length > 0) {
            const queuedMessage = messageQueueRef.current.shift()
            if (queuedMessage && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify(queuedMessage))
            }
          }
        } else {
          setState(prev => ({ 
            ...prev, 
            error: message.payload.message || 'Authentication failed' 
          }))
        }
      }

      // Call user-provided message handler
      onMessage?.(message)

    } catch (error) {
      logger.error('Failed to parse WebSocket message', {}, error as Error)
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to parse message from server' 
      }))
    }
  }, [onMessage, startHeartbeat])

  // Handle WebSocket connection open
  const handleOpen = useCallback(() => {
    setState(prev => ({
      ...prev,
      isConnected: true,
      isConnecting: false,
      connectionAttempts: 0,
      error: null
    }))

    // Authenticate with the server
    const authToken = localStorage.getItem('authToken') || 'demo-token'
    const userId = localStorage.getItem('userId') || 'demo-user'
    const userTier = localStorage.getItem('userTier') || 'starter'

    send({
      type: 'auth',
      payload: { token: authToken, userId, userTier },
      timestamp: new Date().toISOString()
    })

    onConnect?.()
    logger.info('WebSocket connected')
  }, [onConnect])

  // Handle WebSocket connection close
  const handleClose = useCallback((event: CloseEvent) => {
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false
    }))

    isAuthenticated.current = false
    clientId.current = null
    stopHeartbeat()
    onDisconnect?.()

    // Attempt reconnection if not a clean close
    if (!event.wasClean && state.connectionAttempts < reconnectAttempts) {
      const delay = reconnectDelay * Math.pow(2, state.connectionAttempts) // Exponential backoff
      
      setState(prev => ({
        ...prev,
        connectionAttempts: prev.connectionAttempts + 1
      }))

      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, delay)

      logger.info(`WebSocket disconnected, attempting reconnection in ${delay}ms`)
    } else {
      logger.info('WebSocket disconnected')
    }
  }, [state.connectionAttempts, reconnectAttempts, reconnectDelay, onDisconnect, stopHeartbeat])

  // Handle WebSocket error
  const handleError = useCallback((event: Event) => {
    setState(prev => ({
      ...prev,
      error: 'WebSocket connection error',
      isConnecting: false
    }))

    onError?.(event)
    logger.error('WebSocket error', {}, event as any)
  }, [onError])

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return // Already connected
    }

    clearTimeouts()

    setState(prev => ({
      ...prev,
      isConnecting: true,
      error: null
    }))

    try {
      wsRef.current = new WebSocket(url)
      wsRef.current.onopen = handleOpen
      wsRef.current.onclose = handleClose
      wsRef.current.onerror = handleError
      wsRef.current.onmessage = handleMessage
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: 'Failed to create WebSocket connection'
      }))
      logger.error('Failed to create WebSocket', {}, error as Error)
    }
  }, [url, handleOpen, handleClose, handleError, handleMessage, clearTimeouts])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    clearTimeouts()
    stopHeartbeat()
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      connectionAttempts: 0
    }))

    isAuthenticated.current = false
    clientId.current = null
    messageQueueRef.current = []
  }, [clearTimeouts, stopHeartbeat])

  // Send message
  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (isAuthenticated.current || message.type === 'auth') {
        wsRef.current.send(JSON.stringify(message))
      } else {
        // Queue message until authenticated
        messageQueueRef.current.push(message)
      }
    } else {
      // Queue message until connected
      messageQueueRef.current.push(message)
      
      // Auto-connect if not connected
      if (!state.isConnecting && !state.isConnected) {
        connect()
      }
    }
  }, [state.isConnected, state.isConnecting, connect])

  // Subscribe to a channel
  const subscribe = useCallback((channelName: string) => {
    send({
      type: 'subscribe',
      payload: { channel: channelName },
      timestamp: new Date().toISOString()
    })
  }, [send])

  // Unsubscribe from a channel
  const unsubscribe = useCallback((channelName: string) => {
    send({
      type: 'unsubscribe',
      payload: { channel: channelName },
      timestamp: new Date().toISOString()
    })
  }, [send])

  // Request dashboard update
  const requestDashboardUpdate = useCallback((params: any = {}) => {
    send({
      type: 'dashboard_update',
      payload: params,
      timestamp: new Date().toISOString()
    })
  }, [send])

  // Request queue update
  const requestQueueUpdate = useCallback((params: any = {}) => {
    send({
      type: 'queue_update',
      payload: params,
      timestamp: new Date().toISOString()
    })
  }, [send])

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect]) // Only run on mount and unmount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeouts()
      stopHeartbeat()
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [clearTimeouts, stopHeartbeat])

  return {
    // State
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    connectionAttempts: state.connectionAttempts,
    lastMessage: state.lastMessage,
    error: state.error,
    clientId: clientId.current,
    isAuthenticated: isAuthenticated.current,

    // Actions
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe,
    requestDashboardUpdate,
    requestQueueUpdate,

    // Getters
    getReadyState: () => wsRef.current?.readyState ?? WebSocket.CLOSED,
    getQueueLength: () => messageQueueRef.current.length
  }
}