// 🌐 WEBSOCKET SERVER
// Real-time communication server for DirectoryBolt

import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { logger } from '../utils/logger'

export interface WebSocketMessage {
  type: 'dashboard_update' | 'queue_update' | 'submission_update' | 'heartbeat' | 'auth'
  payload: any
  timestamp: string
  clientId?: string
}

export interface AuthenticatedClient {
  ws: WebSocket
  clientId: string
  userId?: string
  userTier?: string
  isAuthenticated: boolean
  isStaff: boolean
  lastHeartbeat: number
  channels: Set<string>
}

export class DirectoryBoltWebSocketServer {
  private wss: WebSocketServer | null = null
  private clients: Map<string, AuthenticatedClient> = new Map()
  private channels: Map<string, Set<string>> = new Map() // channel -> clientIds
  private heartbeatInterval: NodeJS.Timeout | null = null
  private isInitialized = false

  constructor(private port: number = 3001) {}

  async initialize(): Promise<void> {
    try {
      // Create WebSocket server
      this.wss = new WebSocketServer({ 
        port: this.port,
        perMessageDeflate: true,
        maxPayload: 16 * 1024, // 16KB max message size
      })

      this.setupWebSocketHandlers()
      this.startHeartbeatMonitoring()
      this.isInitialized = true

      logger.info(`WebSocket server initialized on port ${this.port}`)
    } catch (error) {
      logger.error('Failed to initialize WebSocket server', {}, error as Error)
      throw error
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.wss) return

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = this.generateClientId()
      
      const client: AuthenticatedClient = {
        ws,
        clientId,
        isAuthenticated: false,
        isStaff: false,
        lastHeartbeat: Date.now(),
        channels: new Set()
      }

      this.clients.set(clientId, client)
      logger.info(`New WebSocket connection: ${clientId}`)

      // Send initial connection message
      this.sendToClient(clientId, {
        type: 'auth',
        payload: { 
          clientId, 
          message: 'Connection established. Please authenticate.',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      })

      // Handle messages from client
      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString())
          this.handleClientMessage(clientId, message)
        } catch (error) {
          logger.warn(`Invalid message from client ${clientId}`, { error })
          this.sendError(clientId, 'Invalid message format')
        }
      })

      // Handle client disconnect
      ws.on('close', () => {
        this.handleClientDisconnect(clientId)
      })

      // Handle errors
      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}`, {}, error)
        this.handleClientDisconnect(clientId)
      })
    })

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', {}, error)
    })
  }

  private handleClientMessage(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId)
    if (!client) return

    // Update heartbeat
    client.lastHeartbeat = Date.now()

    switch (message.type) {
      case 'auth':
        this.handleAuthentication(clientId, message.payload)
        break

      case 'heartbeat':
        this.sendToClient(clientId, {
          type: 'heartbeat',
          payload: { timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString()
        })
        break

      default:
        if (!client.isAuthenticated) {
          this.sendError(clientId, 'Authentication required')
          return
        }
        
        // Handle authenticated messages
        this.handleAuthenticatedMessage(clientId, message)
        break
    }
  }

  private handleAuthentication(clientId: string, payload: any): void {
    const client = this.clients.get(clientId)
    if (!client) return

    // Validate authentication token/credentials
    const { token, userId, userTier } = payload

    // In production, validate the token against your auth system
    const isValidToken = this.validateAuthToken(token)
    
    if (isValidToken) {
      client.isAuthenticated = true
      client.userId = userId
      client.userTier = userTier
      client.isStaff = this.checkStaffPermissions(userId)

      // Subscribe to appropriate channels based on user type
      this.subscribeToDefaultChannels(clientId)

      this.sendToClient(clientId, {
        type: 'auth',
        payload: { 
          success: true, 
          message: 'Authentication successful',
          userId,
          channels: Array.from(client.channels)
        },
        timestamp: new Date().toISOString()
      })

      logger.info(`Client ${clientId} authenticated as ${userId}`)
    } else {
      this.sendError(clientId, 'Invalid authentication token')
      // Close connection after failed auth
      setTimeout(() => client.ws.close(), 1000)
    }
  }

  private handleAuthenticatedMessage(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId)
    if (!client || !client.isAuthenticated) return

    switch (message.type) {
      case 'dashboard_update':
        // Request dashboard data update
        this.handleDashboardUpdateRequest(clientId, message.payload)
        break

      case 'queue_update':
        // Queue status update request
        this.handleQueueUpdateRequest(clientId, message.payload)
        break

      default:
        logger.warn(`Unknown message type: ${message.type} from client ${clientId}`)
        break
    }
  }

  private handleDashboardUpdateRequest(clientId: string, payload: any): void {
    const client = this.clients.get(clientId)
    if (!client) return

    // Subscribe to dashboard updates for this user
    const channelName = `dashboard:${client.userId}`
    this.subscribeClientToChannel(clientId, channelName)

    // Send current dashboard data if available
    this.sendDashboardUpdate(clientId, payload)
  }

  private handleQueueUpdateRequest(clientId: string, payload: any): void {
    const client = this.clients.get(clientId)
    if (!client) return

    if (client.isStaff) {
      // Staff can subscribe to all queue updates
      this.subscribeClientToChannel(clientId, 'queue:all')
    } else {
      // Regular users only get their own queue updates
      this.subscribeClientToChannel(clientId, `queue:${client.userId}`)
    }
  }

  private subscribeToDefaultChannels(clientId: string): void {
    const client = this.clients.get(clientId)
    if (!client) return

    if (client.isStaff) {
      // Staff get broader access
      this.subscribeClientToChannel(clientId, 'staff:notifications')
      this.subscribeClientToChannel(clientId, 'system:alerts')
    } else {
      // Regular users get personal channels
      this.subscribeClientToChannel(clientId, `user:${client.userId}`)
      this.subscribeClientToChannel(clientId, 'general:announcements')
    }
  }

  private subscribeClientToChannel(clientId: string, channelName: string): void {
    const client = this.clients.get(clientId)
    if (!client) return

    client.channels.add(channelName)
    
    if (!this.channels.has(channelName)) {
      this.channels.set(channelName, new Set())
    }
    this.channels.get(channelName)!.add(clientId)

    logger.info(`Client ${clientId} subscribed to channel ${channelName}`)
  }

  private unsubscribeClientFromChannel(clientId: string, channelName: string): void {
    const client = this.clients.get(clientId)
    if (!client) return

    client.channels.delete(channelName)
    
    const channelClients = this.channels.get(channelName)
    if (channelClients) {
      channelClients.delete(clientId)
      if (channelClients.size === 0) {
        this.channels.delete(channelName)
      }
    }
  }

  private handleClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId)
    if (!client) return

    // Unsubscribe from all channels
    Array.from(client.channels).forEach(channel => {
      this.unsubscribeClientFromChannel(clientId, channel)
    })

    this.clients.delete(clientId)
    logger.info(`Client ${clientId} disconnected`)
  }

  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now()
      const timeout = 30000 // 30 seconds

      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastHeartbeat > timeout) {
          logger.warn(`Client ${clientId} heartbeat timeout, disconnecting`)
          client.ws.close()
          this.handleClientDisconnect(clientId)
        }
      }
    }, 15000) // Check every 15 seconds
  }

  // Public methods for broadcasting updates

  public broadcastDashboardUpdate(userId: string, data: any): void {
    const channelName = `dashboard:${userId}`
    this.broadcastToChannel(channelName, {
      type: 'dashboard_update',
      payload: data,
      timestamp: new Date().toISOString()
    })
  }

  public broadcastQueueUpdate(data: any, targetUserId?: string): void {
    const channelName = targetUserId ? `queue:${targetUserId}` : 'queue:all'
    this.broadcastToChannel(channelName, {
      type: 'queue_update',
      payload: data,
      timestamp: new Date().toISOString()
    })
  }

  public broadcastSubmissionUpdate(userId: string, data: any): void {
    const channelName = `user:${userId}`
    this.broadcastToChannel(channelName, {
      type: 'submission_update',
      payload: data,
      timestamp: new Date().toISOString()
    })
  }

  public broadcastStaffNotification(data: any): void {
    this.broadcastToChannel('staff:notifications', {
      type: 'dashboard_update',
      payload: data,
      timestamp: new Date().toISOString()
    })
  }

  private broadcastToChannel(channelName: string, message: WebSocketMessage): void {
    const clientIds = this.channels.get(channelName)
    if (!clientIds) return

    let successCount = 0
    let failedCount = 0

    for (const clientId of clientIds) {
      if (this.sendToClient(clientId, message)) {
        successCount++
      } else {
        failedCount++
      }
    }

    if (successCount > 0) {
      logger.info(`Broadcast to channel ${channelName}: ${successCount} successful, ${failedCount} failed`)
    }
  }

  private sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId)
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false
    }

    try {
      client.ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      logger.error(`Failed to send message to client ${clientId}`, {}, error as Error)
      return false
    }
  }

  private sendError(clientId: string, errorMessage: string): void {
    this.sendToClient(clientId, {
      type: 'dashboard_update',
      payload: { error: errorMessage },
      timestamp: new Date().toISOString()
    })
  }

  private async sendDashboardUpdate(clientId: string, payload: any): Promise<void> {
    // In a real implementation, fetch current dashboard data
    // For now, send a placeholder
    this.sendToClient(clientId, {
      type: 'dashboard_update',
      payload: {
        message: 'Dashboard update requested',
        data: payload
      },
      timestamp: new Date().toISOString()
    })
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private validateAuthToken(token: string): boolean {
    // In production, validate against your auth system
    // For now, accept any non-empty token
    return Boolean(token && token.length > 0)
  }

  private checkStaffPermissions(userId: string): boolean {
    // In production, check against your user permissions system
    // For now, basic check
    return userId?.includes('staff') || userId?.includes('admin')
  }

  public getStats(): {
    totalConnections: number
    authenticatedClients: number
    channels: number
    totalChannelSubscriptions: number
  } {
    const authenticatedClients = Array.from(this.clients.values())
      .filter(client => client.isAuthenticated).length

    const totalChannelSubscriptions = Array.from(this.channels.values())
      .reduce((sum, clientSet) => sum + clientSet.size, 0)

    return {
      totalConnections: this.clients.size,
      authenticatedClients,
      channels: this.channels.size,
      totalChannelSubscriptions
    }
  }

  public async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close()
    }

    if (this.wss) {
      this.wss.close()
    }

    this.isInitialized = false
    logger.info('WebSocket server shut down')
  }
}

// Export singleton instance
export const webSocketServer = new DirectoryBoltWebSocketServer()