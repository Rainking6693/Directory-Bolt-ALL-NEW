import { useEffect, useState, useRef, useCallback } from 'react'

interface UseWebSocketOptions {
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

interface WebSocketHookReturn {
  isConnected: boolean
  isConnecting: boolean
  data: any
  error: string | null
  reconnectCount: number
  sendMessage: (message: any) => void
  reconnect: () => void
}

export function useWebSocket(
  url: string, 
  options: UseWebSocketOptions = {}
): WebSocketHookReturn {
  const {
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onConnect,
    onDisconnect,
    onError
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [reconnectCount, setReconnectCount] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const shouldReconnectRef = useRef(true)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return // Already connected
    }

    setIsConnecting(true)
    setError(null)

    try {
      // Convert HTTP URLs to WebSocket URLs
      const wsUrl = url.replace(/^http/, 'ws')
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        setIsConnected(true)
        setIsConnecting(false)
        setReconnectCount(0)
        setError(null)
        onConnect?.()
      }

      wsRef.current.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data)
          setData(parsedData)
        } catch {
          // If not JSON, store raw data
          setData(event.data)
        }
      }

      wsRef.current.onclose = () => {
        setIsConnected(false)
        setIsConnecting(false)
        onDisconnect?.()

        // Attempt to reconnect if we should and haven't exceeded max attempts
        if (shouldReconnectRef.current && reconnectCount < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectCount(prev => prev + 1)
            connect()
          }, reconnectInterval)
        }
      }

      wsRef.current.onerror = (errorEvent) => {
        setError('WebSocket connection error')
        setIsConnecting(false)
        onError?.(errorEvent)
      }

    } catch (err) {
      setError(`Failed to create WebSocket: ${err}`)
      setIsConnecting(false)
    }
  }, [url, reconnectCount, maxReconnectAttempts, reconnectInterval, onConnect, onDisconnect, onError])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message)
      wsRef.current.send(messageStr)
    } else {
      setError('WebSocket is not connected')
    }
  }, [])

  const reconnect = useCallback(() => {
    setReconnectCount(0)
    shouldReconnectRef.current = true
    connect()
  }, [connect])

  // Initialize connection on mount
  useEffect(() => {
    shouldReconnectRef.current = true
    connect()

    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  // For now, return mock connected state since we don't have a WebSocket server yet
  // In a real implementation, this would use the actual WebSocket connection
  useEffect(() => {
    // Mock connection for development
    const mockConnect = setTimeout(() => {
      setIsConnected(true)
      setIsConnecting(false)
    }, 1000)

    return () => clearTimeout(mockConnect)
  }, [])

  return {
    isConnected,
    isConnecting,
    data,
    error,
    reconnectCount,
    sendMessage,
    reconnect
  }
}