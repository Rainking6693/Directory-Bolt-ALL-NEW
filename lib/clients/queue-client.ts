/**
 * Queue Processing API Client
 * Comprehensive TypeScript client for all queue endpoints
 * Phase 2.2 Implementation
 */

import {
  QueueItem,
  QueueStats,
  QueueProcessingResult,
  QueueUpdate,
  BatchOperation,
  GetQueueRequest,
  GetQueueResponse,
  ProcessQueueRequest,
  ProcessQueueResponse,
  QueueOperation,
  QueueOperationResponse,
  CreateBatchRequest,
  BatchOperationResponse,
  ExtensionQueueSubmission,
  ExtensionSubmissionResponse,
  QueueError,
  QueueErrorResponse,
  QueueAPIConfig,
  ProgressIndicator,
  ETACalculation,
  UserNotification,
  WebSocketMessage
} from '../types/queue.types'

export class QueueAPIClient {
  private config: QueueAPIConfig
  private ws: WebSocket | null = null
  private wsReconnectTimer: NodeJS.Timeout | null = null
  private wsReconnectAttempts = 0
  private maxWsReconnectAttempts = 5
  private wsEventListeners: Map<string, ((data: any) => void)[]> = new Map()

  constructor(config: QueueAPIConfig) {
    this.config = {
      ...config,
      timeout: config.timeout ?? 30000,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      enableWebSocket: config.enableWebSocket ?? true,
      enablePolling: config.enablePolling ?? false,
      pollingInterval: config.pollingInterval ?? 5000
    }
  }

  /**
   * QUEUE MANAGEMENT ENDPOINTS
   */

  // Get queue items with filtering and pagination
  async getQueue(params: GetQueueRequest = {}): Promise<GetQueueResponse> {
    try {
      const queryParams = new URLSearchParams()
      
      if (params.status) queryParams.append('status', params.status)
      if (params.limit) queryParams.append('limit', params.limit.toString())
      if (params.offset) queryParams.append('offset', params.offset.toString())
      if (params.sortBy) queryParams.append('sortBy', params.sortBy)
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)
      if (params.packageType?.length) {
        params.packageType.forEach(type => queryParams.append('packageType[]', type))
      }
      if (params.dateRange) {
        queryParams.append('dateFrom', params.dateRange.from)
        queryParams.append('dateTo', params.dateRange.to)
      }

      const response = await this.makeRequest<GetQueueResponse>(
        'GET',
        `/api/queue?${queryParams.toString()}`
      )

      return response
    } catch (error) {
      throw this.handleError('GET_QUEUE_FAILED', 'Failed to fetch queue', error)
    }
  }

  // Get queue statistics
  async getQueueStats(): Promise<QueueStats> {
    try {
      const response = await this.makeRequest<{ data: QueueStats }>('GET', '/api/queue/stats')
      return response.data
    } catch (error) {
      throw this.handleError('GET_STATS_FAILED', 'Failed to fetch queue stats', error)
    }
  }

  // Get specific queue item by customer ID
  async getQueueItem(customerId: string): Promise<QueueItem> {
    try {
      const response = await this.makeRequest<{ data: QueueItem }>('GET', `/api/queue/${customerId}`)
      return response.data
    } catch (error) {
      throw this.handleError('GET_ITEM_FAILED', `Failed to fetch queue item for ${customerId}`, error)
    }
  }

  /**
   * QUEUE PROCESSING ENDPOINTS
   */

  // Start queue processing
  async startQueueProcessing(params: ProcessQueueRequest = {}): Promise<ProcessQueueResponse> {
    try {
      const response = await this.makeRequest<ProcessQueueResponse>(
        'POST',
        '/api/queue/process',
        params
      )
      return response
    } catch (error) {
      throw this.handleError('START_PROCESSING_FAILED', 'Failed to start queue processing', error)
    }
  }

  // Process specific customer
  async processCustomer(customerId: string): Promise<QueueProcessingResult> {
    try {
      const response = await this.makeRequest<{ data: QueueProcessingResult }>(
        'POST',
        `/api/queue/process/${customerId}`
      )
      return response.data
    } catch (error) {
      throw this.handleError('PROCESS_CUSTOMER_FAILED', `Failed to process customer ${customerId}`, error)
    }
  }

  // Stop queue processing
  async stopQueueProcessing(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest<{ success: boolean; message: string }>(
        'POST',
        '/api/queue/stop'
      )
      return response
    } catch (error) {
      throw this.handleError('STOP_PROCESSING_FAILED', 'Failed to stop queue processing', error)
    }
  }

  /**
   * QUEUE OPERATIONS
   */

  // Pause customer processing
  async pauseCustomer(customerId: string, reason?: string): Promise<QueueOperationResponse> {
    return this.performQueueOperation({
      type: 'pause',
      customerId,
      reason
    })
  }

  // Resume customer processing
  async resumeCustomer(customerId: string, reason?: string): Promise<QueueOperationResponse> {
    return this.performQueueOperation({
      type: 'resume',
      customerId,
      reason
    })
  }

  // Cancel customer processing
  async cancelCustomer(customerId: string, reason?: string): Promise<QueueOperationResponse> {
    return this.performQueueOperation({
      type: 'cancel',
      customerId,
      reason
    })
  }

  // Retry customer processing
  async retryCustomer(customerId: string, reason?: string): Promise<QueueOperationResponse> {
    return this.performQueueOperation({
      type: 'retry',
      customerId,
      reason
    })
  }

  // Change customer priority
  async prioritizeCustomer(customerId: string, priority: 'high' | 'low'): Promise<QueueOperationResponse> {
    return this.performQueueOperation({
      type: priority === 'high' ? 'prioritize' : 'deprioritize',
      customerId
    })
  }

  // Generic queue operation handler
  private async performQueueOperation(operation: QueueOperation): Promise<QueueOperationResponse> {
    try {
      const response = await this.makeRequest<QueueOperationResponse>(
        'POST',
        '/api/queue/operations',
        operation
      )
      return response
    } catch (error) {
      throw this.handleError(
        'OPERATION_FAILED',
        `Failed to ${operation.type} customer ${operation.customerId}`,
        error
      )
    }
  }

  /**
   * BATCH OPERATIONS
   */

  // Create batch operation
  async createBatch(request: CreateBatchRequest): Promise<BatchOperation> {
    try {
      const response = await this.makeRequest<BatchOperationResponse>(
        'POST',
        '/api/queue/batch',
        request
      )
      return response.data
    } catch (error) {
      throw this.handleError('CREATE_BATCH_FAILED', 'Failed to create batch operation', error)
    }
  }

  // Get batch operation status
  async getBatch(batchId: string): Promise<BatchOperation> {
    try {
      const response = await this.makeRequest<{ data: BatchOperation }>('GET', `/api/queue/batch/${batchId}`)
      return response.data
    } catch (error) {
      throw this.handleError('GET_BATCH_FAILED', `Failed to fetch batch ${batchId}`, error)
    }
  }

  // Get all batches
  async getBatches(status?: string): Promise<BatchOperation[]> {
    try {
      const queryParams = status ? `?status=${status}` : ''
      const response = await this.makeRequest<{ data: BatchOperation[] }>('GET', `/api/queue/batches${queryParams}`)
      return response.data
    } catch (error) {
      throw this.handleError('GET_BATCHES_FAILED', 'Failed to fetch batches', error)
    }
  }

  // Cancel batch operation
  async cancelBatch(batchId: string): Promise<BatchOperation> {
    try {
      const response = await this.makeRequest<{ data: BatchOperation }>(
        'POST',
        `/api/queue/batch/${batchId}/cancel`
      )
      return response.data
    } catch (error) {
      throw this.handleError('CANCEL_BATCH_FAILED', `Failed to cancel batch ${batchId}`, error)
    }
  }

  /**
   * EXTENSION API ENDPOINTS
   */

  // Submit from Chrome extension
  async submitFromExtension(submission: ExtensionQueueSubmission): Promise<ExtensionSubmissionResponse> {
    try {
      const response = await this.makeRequest<ExtensionSubmissionResponse>(
        'POST',
        '/api/extension/submit',
        submission,
        {
          'X-API-Key': submission.apiKey
        }
      )
      return response
    } catch (error) {
      throw this.handleError('EXTENSION_SUBMIT_FAILED', 'Failed to submit from extension', error)
    }
  }

  // Get extension status
  async getExtensionStatus(trackingId: string, apiKey: string): Promise<{
    customerId: string
    status: string
    progress: ProgressIndicator
    eta: ETACalculation
  }> {
    try {
      const response = await this.makeRequest<{
        data: {
          customerId: string
          status: string
          progress: ProgressIndicator
          eta: ETACalculation
        }
      }>(
        'GET',
        `/api/extension/status/${trackingId}`,
        undefined,
        {
          'X-API-Key': apiKey
        }
      )
      return response.data
    } catch (error) {
      throw this.handleError('EXTENSION_STATUS_FAILED', 'Failed to get extension status', error)
    }
  }

  /**
   * PROGRESS AND NOTIFICATIONS
   */

  // Get progress for customer
  async getProgress(customerId: string): Promise<ProgressIndicator> {
    try {
      const response = await this.makeRequest<{ data: ProgressIndicator }>('GET', `/api/queue/progress/${customerId}`)
      return response.data
    } catch (error) {
      throw this.handleError('GET_PROGRESS_FAILED', `Failed to get progress for ${customerId}`, error)
    }
  }

  // Get ETA calculation
  async getETA(customerId: string): Promise<ETACalculation> {
    try {
      const response = await this.makeRequest<{ data: ETACalculation }>('GET', `/api/queue/eta/${customerId}`)
      return response.data
    } catch (error) {
      throw this.handleError('GET_ETA_FAILED', `Failed to get ETA for ${customerId}`, error)
    }
  }

  // Get user notifications
  async getNotifications(customerId?: string): Promise<UserNotification[]> {
    try {
      const endpoint = customerId ? `/api/notifications/${customerId}` : '/api/notifications'
      const response = await this.makeRequest<{ data: UserNotification[] }>('GET', endpoint)
      return response.data
    } catch (error) {
      throw this.handleError('GET_NOTIFICATIONS_FAILED', 'Failed to get notifications', error)
    }
  }

  // Mark notification as read
  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      await this.makeRequest('POST', `/api/notifications/${notificationId}/read`)
    } catch (error) {
      throw this.handleError('MARK_READ_FAILED', 'Failed to mark notification as read', error)
    }
  }

  /**
   * WEBSOCKET REAL-TIME UPDATES
   */

  // Connect to WebSocket for real-time updates
  connectWebSocket(): void {
    if (!this.config.enableWebSocket || this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const wsUrl = this.config.websocketUrl || this.config.baseUrl.replace('http', 'ws') + '/ws'
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('Queue WebSocket connected')
        this.wsReconnectAttempts = 0
        
        // Authenticate WebSocket connection
        this.ws?.send(JSON.stringify({
          type: 'auth',
          payload: { apiKey: this.config.apiKey }
        }))
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.handleWebSocketMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('Queue WebSocket disconnected')
        this.ws = null
        this.scheduleWebSocketReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('Queue WebSocket error:', error)
        this.emit('error', { error: 'WebSocket connection error' })
      }

    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      this.scheduleWebSocketReconnect()
    }
  }

  // Disconnect WebSocket
  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer)
      this.wsReconnectTimer = null
    }
  }

  // Handle WebSocket messages
  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'queue_update':
        this.emit('queueUpdate', message.payload as QueueUpdate)
        break
      case 'batch_update':
        this.emit('batchUpdate', message.payload as BatchOperation)
        break
      case 'stats_update':
        this.emit('statsUpdate', message.payload as QueueStats)
        break
      case 'error':
        this.emit('error', message.payload)
        break
      case 'heartbeat':
        // Handle heartbeat
        break
      default:
        console.warn('Unknown WebSocket message type:', message.type)
    }
  }

  // Schedule WebSocket reconnection
  private scheduleWebSocketReconnect(): void {
    if (this.wsReconnectAttempts >= this.maxWsReconnectAttempts) {
      console.error('Max WebSocket reconnection attempts reached')
      return
    }

    const delay = Math.pow(2, this.wsReconnectAttempts) * 1000 // Exponential backoff
    this.wsReconnectAttempts++

    this.wsReconnectTimer = setTimeout(() => {
      console.log(`Attempting WebSocket reconnection (${this.wsReconnectAttempts}/${this.maxWsReconnectAttempts})`)
      this.connectWebSocket()
    }, delay)
  }

  /**
   * EVENT SYSTEM
   */

  // Add event listener
  on(event: string, callback: (data: any) => void): void {
    if (!this.wsEventListeners.has(event)) {
      this.wsEventListeners.set(event, [])
    }
    this.wsEventListeners.get(event)!.push(callback)
  }

  // Remove event listener
  off(event: string, callback: (data: any) => void): void {
    const listeners = this.wsEventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  // Emit event to listeners
  private emit(event: string, data: any): void {
    const listeners = this.wsEventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error('Event listener error:', error)
        }
      })
    }
  }

  /**
   * UTILITY METHODS
   */

  // Make HTTP request with retry logic
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    headers: Record<string, string> = {}
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const url = `${this.config.baseUrl}${endpoint}`
        const requestInit: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            ...headers
          },
          signal: AbortSignal.timeout(this.config.timeout)
        }

        if (data && method !== 'GET') {
          requestInit.body = JSON.stringify(data)
        }

        const response = await fetch(url, requestInit)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`)
        }

        return await response.json()

      } catch (error) {
        lastError = error as Error
        
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempt)
        }
      }
    }

    throw lastError
  }

  // Handle and format errors
  private handleError(code: string, message: string, originalError: any): QueueError {
    return {
      code,
      message,
      timestamp: new Date().toISOString(),
      context: {
        originalError: originalError?.message || String(originalError)
      },
      severity: 'high'
    }
  }

  // Utility delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Check if WebSocket is connected
  isWebSocketConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  // Get connection status
  getConnectionStatus(): {
    http: 'connected' | 'disconnected'
    websocket: 'connected' | 'disconnected' | 'connecting'
  } {
    return {
      http: 'connected', // Always connected for HTTP
      websocket: this.ws?.readyState === WebSocket.OPEN ? 'connected' :
                this.ws?.readyState === WebSocket.CONNECTING ? 'connecting' : 'disconnected'
    }
  }
}

// Export factory function for creating client instances
export function createQueueClient(config: QueueAPIConfig): QueueAPIClient {
  return new QueueAPIClient(config)
}

// Export default configuration helper
export function getDefaultQueueConfig(baseUrl: string, apiKey: string): QueueAPIConfig {
  return {
    baseUrl,
    apiKey,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    enableWebSocket: true,
    websocketUrl: baseUrl.replace('http', 'ws') + '/ws',
    enablePolling: false,
    pollingInterval: 5000
  }
}