// Optimized Database Queries and Connection Management
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServerConfig } from '../server/supabaseEnv'

class DatabaseManager {
  private static instance: DatabaseManager
  private client: SupabaseClient
  private queryCache = new Map()
  private connectionPool: SupabaseClient[] = []

  private constructor() {
    const { url: supabaseUrl, serviceRoleKey: supabaseServiceKey } = getSupabaseServerConfig()

    this.client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'X-Client-Info': 'directorybolt-api'
        }
      }
    })
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  getClient(): SupabaseClient {
    return this.client
  }

  // Optimized customer queries with proper indexing
  async getCustomerByEmail(email: string) {
    const cacheKey = `customer:email:${email}`
    
    if (this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey)
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minute cache
        return cached.data
      }
    }

    const { data, error } = await this.client
      .from('customers')
      .select(`
        id,
        customer_id,
        email,
        business_name,
        package_type,
        status,
        directories_submitted,
        failed_directories,
        created_at,
        updated_at
      `)
      .eq('email', email)
      .single()

    if (!error && data) {
      this.queryCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      })
    }

    return { data, error }
  }

  // Batch operations for better performance
  async getCustomerQueueStatus(customerIds: string[]) {
    const { data, error } = await this.client
      .from('queue_history')
      .select(`
        customer_id,
        status,
        directories_allocated,
        directories_processed,
        directories_failed,
        priority_level,
        estimated_completion,
        created_at
      `)
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false })

    return { data, error }
  }

  // Optimized queue processing queries
  async getNextPriorityCustomers(limit: number = 10) {
    const { data, error } = await this.client
      .from('queue_history')
      .select(`
        customer_id,
        package_type,
        priority_level,
        directories_allocated,
        directories_processed,
        status
      `)
      .eq('status', 'pending')
      .order('priority_level', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit)

    return { data, error }
  }

  // Bulk update operations
  async bulkUpdateSubmissionStatus(updates: Array<{
    customer_id: string
    directories_submitted: number
    directories_failed: number
    status: string
  }>) {
    const promises = updates.map(update => 
      this.client
        .from('customers')
        .update({
          directories_submitted: update.directories_submitted,
          failed_directories: update.directories_failed,
          status: update.status,
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', update.customer_id)
    )

    const results = await Promise.allSettled(promises)
    return results
  }

  // Analytics queries with proper aggregation
  async getSystemMetrics(timeRange: '1h' | '24h' | '7d' = '24h') {
    const timeMap = {
      '1h': 1,
      '24h': 24,
      '7d': 24 * 7
    }

    const hoursAgo = timeMap[timeRange]
    const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()

    const { data, error } = await this.client
      .from('analytics_events')
      .select('event_type, event_name, created_at')
      .gte('created_at', startTime)

    if (error) return { data: null, error }

    // Process metrics
    const metrics = data.reduce((acc, event) => {
      const type = event.event_type
      if (!acc[type]) acc[type] = 0
      acc[type]++
      return acc
    }, {} as Record<string, number>)

    return { data: metrics, error: null }
  }

  // Clear cache for specific patterns
  clearCache(pattern?: string) {
    if (pattern) {
      for (const key of this.queryCache.keys()) {
        if (key.includes(pattern)) {
          this.queryCache.delete(key)
        }
      }
    } else {
      this.queryCache.clear()
    }
  }

  // Health check
  async healthCheck() {
    try {
      const { data, error } = await this.client
        .from('customers')
        .select('count')
        .limit(1)

      return !error
    } catch {
      return false
    }
  }
}

// Optimized database indexes (SQL to run in Supabase)
export const RECOMMENDED_INDEXES = `
-- Performance indexes for customer operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email_active ON customers(email) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_package_status ON customers(package_type, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- Queue optimization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_queue_priority_status ON queue_history(priority_level, status, created_at) WHERE status = 'pending';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_queue_customer_status ON queue_history(customer_id, status);

-- Analytics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_type_time ON analytics_events(event_type, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_customer ON analytics_events(customer_id, created_at DESC);

-- Notifications index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_customer_unread ON customer_notifications(customer_id, read, created_at DESC);

-- Batch operations index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_operations_status ON batch_operations(status, created_at DESC);
`

export const dbManager = DatabaseManager.getInstance()
export default DatabaseManager

