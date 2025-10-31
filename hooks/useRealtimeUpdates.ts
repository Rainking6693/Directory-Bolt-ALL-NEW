'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { WebSocketMessage, SubmissionUpdate } from '../lib/types/directory'

interface UseRealtimeUpdatesReturn {
  isConnected: boolean
  lastUpdate: Date | null
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error'
  sendMessage: (message: any) => void
  subscribe: (eventType: string, callback: (data: any) => void) => () => void
}

const WS_URL = process.env.NODE_ENV === 'production' 
  ? 'wss://api.directorybolt.com/ws' 
  : 'ws://localhost:3001/ws'

const RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 1000 // Start with 1 second
const MAX_RECONNECT_DELAY = 30000 // Max 30 seconds
const HEARTBEAT_INTERVAL = 30000 // 30 seconds

export function useRealtimeUpdates(enabled: boolean = true): UseRealtimeUpdatesReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectDelay = useRef(RECONNECT_DELAY)
  const eventListeners = useRef<Map<string, Set<(data: any) => void>>>(new Map())

  // Clean up function
  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current)
      heartbeatTimeoutRef.current = null
    }
  }, [])

  // Send heartbeat to keep connection alive
  const sendHeartbeat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }))
      
      heartbeatTimeoutRef.current = setTimeout(sendHeartbeat, HEARTBEAT_INTERVAL)
    }
  }, [])

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      setConnectionState('connecting')
      
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setConnectionState('connected')
        reconnectAttempts.current = 0
        reconnectDelay.current = RECONNECT_DELAY
        
        // Start heartbeat
        sendHeartbeat()
        
        // Send authentication if needed
        // ws.send(JSON.stringify({ type: 'auth', token: getAuthToken() }))
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setLastUpdate(new Date())
          
          // Handle different message types
          switch (message.type) {
            case 'submission_update':
              const submissionUpdate = message.payload as SubmissionUpdate
              console.log('Submission update:', submissionUpdate)
              
              // Notify subscribers
              const submissionListeners = eventListeners.current.get('submission_update')
              submissionListeners?.forEach(callback => callback(submissionUpdate))
              break
              
            case 'directory_update':
              console.log('Directory update:', message.payload)
              
              const directoryListeners = eventListeners.current.get('directory_update')
              directoryListeners?.forEach(callback => callback(message.payload))
              break
              
            case 'progress_update':
              console.log('Progress update:', message.payload)
              
              const progressListeners = eventListeners.current.get('progress_update')
              progressListeners?.forEach(callback => callback(message.payload))
              break
              
            default:
              console.log('Unknown message type:', message.type)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        setIsConnected(false)
        setConnectionState('disconnected')
        
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current)
          heartbeatTimeoutRef.current = null
        }

        // Attempt to reconnect if not a normal closure and still enabled
        if (enabled && event.code !== 1000 && reconnectAttempts.current < RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY)
          
          console.log(`Attempting to reconnect in ${reconnectDelay.current}ms (attempt ${reconnectAttempts.current}/${RECONNECT_ATTEMPTS})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectDelay.current)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setConnectionState('error')
      }

    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      setConnectionState('error')
    }
  }, [enabled, sendHeartbeat])

  // Send message through WebSocket
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('Cannot send message: WebSocket not connected')
    }
  }, [])

  // Subscribe to specific event types
  const subscribe = useCallback((eventType: string, callback: (data: any) => void) => {
    if (!eventListeners.current.has(eventType)) {
      eventListeners.current.set(eventType, new Set())
    }
    
    const listeners = eventListeners.current.get(eventType)!
    listeners.add(callback)
    
    // Return unsubscribe function
    return () => {
      listeners.delete(callback)
      if (listeners.size === 0) {
        eventListeners.current.delete(eventType)
      }
    }
  }, [])

  // Connect when enabled
  useEffect(() => {
    if (enabled) {
      connect()
    } else {
      cleanup()
      setIsConnected(false)
      setConnectionState('disconnected')
    }

    return cleanup
  }, [enabled, connect, cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, we might want to reduce heartbeat frequency
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current)
          heartbeatTimeoutRef.current = null
        }
      } else {
        // Page is visible again, resume normal heartbeat
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          sendHeartbeat()
        } else if (enabled && !isConnected) {
          // Try to reconnect if we're not connected
          connect()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [enabled, isConnected, connect, sendHeartbeat])

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network online, attempting to reconnect WebSocket')
      if (enabled && !isConnected) {
        reconnectAttempts.current = 0 // Reset attempts when back online
        connect()
      }
    }

    const handleOffline = () => {
      console.log('Network offline, WebSocket will disconnect')
      setConnectionState('disconnected')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [enabled, isConnected, connect])

  return {
    isConnected,
    lastUpdate,
    connectionState,
    sendMessage,
    subscribe
  }
}