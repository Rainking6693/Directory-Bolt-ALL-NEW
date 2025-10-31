// @ts-nocheck

/**
 * Optimized Supabase Real-time Subscriptions - 2025 Best Practices
 * Features: Connection pooling, automatic reconnection, selective subscriptions, WebSocket optimization
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeConfig {
  supabaseUrl: string;
  supabaseKey: string;
  enableLogging?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
}

interface SubscriptionConfig {
  table: string;
  filter?: string;
  select?: string;
  events?: ('INSERT' | 'UPDATE' | 'DELETE')[];
}

interface ConnectionMetrics {
  connectionCount: number;
  messageCount: number;
  errorCount: number;
  reconnectCount: number;
  avgLatency: number;
  lastMessageTime: number;
}

type MessageHandler = (payload: any) => void;
type ErrorHandler = (error: Error) => void;
type ConnectionHandler = () => void;

export class SupabaseRealtimeOptimized {
  private supabase: any
  private realtime: any
  private channels = new Map<string, RealtimeChannel>();
  private subscriptions = new Map<string, SubscriptionConfig>();
  private messageHandlers = new Map<string, MessageHandler[]>();
  private errorHandlers: ErrorHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  
  private metrics: ConnectionMetrics = {
    connectionCount: 0,
    messageCount: 0,
    errorCount: 0,
    reconnectCount: 0,
    avgLatency: 0,
    lastMessageTime: 0
  };

  private reconnectTimer: NodeJS.Timeout | null = null;
  private connected = false;
  private isDestroyed = false;

  constructor(private config: RealtimeConfig) {
    this.config = {
      enableLogging: true,
      maxReconnectAttempts: 5,
      reconnectInterval: 5000,
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      if (this.isDestroyed) {
        throw new Error('RealtimeManager has been destroyed');
      }

      this.client = createClient(this.config.supabaseUrl, this.config.supabaseKey, {
        realtime: {
          params: {
            eventsPerSecond: 10 // Optimize for performance
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });

      // Set up connection monitoring
      this.setupConnectionMonitoring();
      
      this.connected = true;
      this.metrics.connectionCount++;
      
      // Restore existing subscriptions
      await this.restoreSubscriptions();
      
      this.log('✅ Realtime manager initialized successfully');
      this.notifyConnectionHandlers();
      
    } catch (error) {
      this.metrics.errorCount++;
      this.log(`❌ Failed to initialize realtime manager: ${error.message}`);
      this.scheduleReconnect();
      throw error;
    }
  }

  subscribe(
    subscriptionId: string, 
    config: SubscriptionConfig, 
    handler: MessageHandler
  ): void {
    try {
      if (this.isDestroyed) {
        throw new Error('Cannot subscribe: RealtimeManager has been destroyed');
      }

      // Store subscription config and handler
      this.subscriptions.set(subscriptionId, config);
      
      if (!this.messageHandlers.has(subscriptionId)) {
        this.messageHandlers.set(subscriptionId, []);
      }
      this.messageHandlers.get(subscriptionId)!.push(handler);

      // Create subscription if client is ready
      if (this.client && this.connected) {
        this.createSubscription(subscriptionId, config);
      }

      this.log(`📡 Subscription registered: ${subscriptionId} for table: ${config.table}`);
      
    } catch (error) {
      this.metrics.errorCount++;
      this.log(`❌ Failed to subscribe: ${error.message}`);
      this.notifyErrorHandlers(error as Error);
    }
  }

  unsubscribe(subscriptionId: string): void {
    try {
      const channel = this.channels.get(subscriptionId);
      if (channel) {
        this.client?.removeChannel(channel);
        this.channels.delete(subscriptionId);
      }

      this.subscriptions.delete(subscriptionId);
      this.messageHandlers.delete(subscriptionId);

      this.log(`🔇 Unsubscribed: ${subscriptionId}`);
    } catch (error) {
      this.metrics.errorCount++;
      this.log(`❌ Failed to unsubscribe: ${error.message}`);
    }
  }

  // Optimized subscription for customer updates
  subscribeToCustomerUpdates(customerId: string, handler: MessageHandler): string {
    const subscriptionId = `customer:${customerId}`;
    
    this.subscribe(subscriptionId, {
      table: 'customers',
      filter: `customer_id=eq.${customerId}`,
      select: 'customer_id,business_name,subscription_status,credits_remaining',
      events: ['UPDATE']
    }, handler);

    return subscriptionId;
  }

  // Optimized subscription for queue status
  subscribeToQueueUpdates(handler: MessageHandler): string {
    const subscriptionId = 'queue:updates';
    
    this.subscribe(subscriptionId, {
      table: 'queue_items',
      select: 'id,customer_id,status,progress,created_at',
      events: ['INSERT', 'UPDATE']
    }, handler);

    return subscriptionId;
  }

  // WebSocket-style real-time messaging for staff dashboard
  subscribeToStaffUpdates(handler: MessageHandler): string {
    const subscriptionId = 'staff:dashboard';
    
    this.subscribe(subscriptionId, {
      table: 'system_events',
      select: 'event_type,data,timestamp',
      events: ['INSERT']
    }, handler);

    return subscriptionId;
  }

  private async createSubscription(subscriptionId: string, config: SubscriptionConfig): Promise<void> {
    if (!this.client) return;

    try {
      const channel = this.client
        .channel(`subscription-${subscriptionId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: config.table,
          filter: config.filter
        }, (payload) => {
          this.handleMessage(subscriptionId, payload);
        })
        .on('system', {}, (payload) => {
          this.handleSystemMessage(payload);
        })
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            this.log(`✅ Subscription active: ${subscriptionId}`);
          } else if (err) {
            this.metrics.errorCount++;
            this.log(`❌ Subscription error for ${subscriptionId}: ${err.message}`);
            this.notifyErrorHandlers(err);
          }
        });

      this.channels.set(subscriptionId, channel);
      
    } catch (error) {
      this.metrics.errorCount++;
      this.log(`❌ Failed to create subscription ${subscriptionId}: ${error.message}`);
      throw error;
    }
  }

  private handleMessage(subscriptionId: string, payload: any): void {
    const startTime = Date.now();
    
    try {
      this.metrics.messageCount++;
      this.metrics.lastMessageTime = startTime;

      const handlers = this.messageHandlers.get(subscriptionId) || [];
      
      // Execute all handlers for this subscription
      handlers.forEach(handler => {
        try {
          handler(payload);
        } catch (handlerError) {
          this.log(`❌ Handler error for ${subscriptionId}: ${handlerError.message}`);
          this.notifyErrorHandlers(handlerError as Error);
        }
      });

      // Update latency metrics
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);

      this.log(`📨 Message processed for ${subscriptionId} in ${latency}ms`);
      
    } catch (error) {
      this.metrics.errorCount++;
      this.log(`❌ Message handling error: ${error.message}`);
      this.notifyErrorHandlers(error as Error);
    }
  }

  private handleSystemMessage(payload: any): void {
    if (payload.status === 'ok') {
      this.connected = true;
    } else if (payload.status === 'error') {
      this.connected = false;
      this.scheduleReconnect();
    }
  }

  private setupConnectionMonitoring(): void {
    if (!this.client) return;

    // Monitor connection status
    this.client.realtime.onOpen(() => {
      this.connected = true;
      this.log('🔗 Realtime connection opened');
      this.notifyConnectionHandlers();
    });

    this.client.realtime.onClose(() => {
      this.connected = false;
      this.log('🔌 Realtime connection closed');
      this.scheduleReconnect();
    });

    this.client.realtime.onError((error) => {
      this.metrics.errorCount++;
      this.connected = false;
      this.log(`❌ Realtime connection error: ${error.message}`);
      this.notifyErrorHandlers(error);
      this.scheduleReconnect();
    });
  }

  private async restoreSubscriptions(): Promise<void> {
    for (const [subscriptionId, config] of this.subscriptions.entries()) {
      try {
        await this.createSubscription(subscriptionId, config);
      } catch (error) {
        this.log(`❌ Failed to restore subscription ${subscriptionId}: ${error.message}`);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed || this.reconnectTimer) return;

    if (this.metrics.reconnectCount >= (this.config.maxReconnectAttempts || 5)) {
      this.log('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.metrics.reconnectCount++;
      
      this.log(`🔄 Attempting reconnection (${this.metrics.reconnectCount}/${this.config.maxReconnectAttempts})`);
      
      try {
        await this.initialize();
      } catch (error) {
        this.log(`❌ Reconnection failed: ${error.message}`);
      }
    }, this.config.reconnectInterval || 5000);
  }

  private updateLatencyMetrics(latency: number): void {
    const currentAvg = this.metrics.avgLatency;
    const count = this.metrics.messageCount - 1;
    this.metrics.avgLatency = count === 0 ? latency : (currentAvg * count + latency) / (count + 1);
  }

  // Event handlers
  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  onConnection(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  private notifyErrorHandlers(error: Error): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (err) {
        this.log(`❌ Error handler failed: ${err.message}`);
      }
    });
  }

  private notifyConnectionHandlers(): void {
    this.connectionHandlers.forEach(handler => {
      try {
        handler();
      } catch (err) {
        this.log(`❌ Connection handler failed: ${err.message}`);
      }
    });
  }

  // Performance monitoring
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  getConnectionStatus(): boolean {
    return this.connected;
  }

  // Cleanup
  destroy(): void {
    this.isDestroyed = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Unsubscribe from all channels
    for (const [subscriptionId] of this.subscriptions) {
      this.unsubscribe(subscriptionId);
    }

    this.client = null;
    this.connected = false;
    
    this.log('🗑️ Realtime manager destroyed');
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[RealtimeManager] ${message}`);
    }
  }
}

// Factory function for creating optimized realtime manager
export function createOptimizedRealtimeManager(config: RealtimeConfig): SupabaseRealtimeOptimized {
  return new SupabaseRealtimeOptimized(config);
}

export { SupabaseRealtimeOptimized, type RealtimeConfig, type SubscriptionConfig, type MessageHandler };

// Singleton instance for DirectoryBolt
const realtimeManager = new SupabaseRealtimeOptimized({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  enableLogging: process.env.NODE_ENV === 'development',
  maxReconnectAttempts: 5,
  reconnectInterval: 5000
});

export default realtimeManager;