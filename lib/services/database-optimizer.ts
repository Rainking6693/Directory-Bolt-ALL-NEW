import { createClient, SupabaseClient } from '@supabase/supabase-js'
// import { Redis } from 'ioredis' // Install with: npm install ioredis @types/ioredis

// For now, we'll use a simple in-memory cache instead of Redis
class SimpleCache {
  private cache = new Map<string, { data: any; expires: number }>()
  
  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key)
    if (!item) return null
    
    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }
    
    return JSON.stringify(item.data)
  }
  
  async setex(key: string, ttl: number, value: string): Promise<void> {
    this.cache.set(key, {
      data: JSON.parse(value),
      expires: Date.now() + (ttl * 1000)
    })
  }
  
  async del(...keys: string[]): Promise<void> {
    keys.forEach(key => this.cache.delete(key))
  }
  
  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'))
    return Array.from(this.cache.keys()).filter(key => regex.test(key))
  }
  
  async flushdb(): Promise<void> {
    this.cache.clear()
  }
  
  async quit(): Promise<void> {
    this.cache.clear()
  }
  
  on(event: string, callback: (error: any) => void): void {
    // Simple implementation - no actual events
  }
}

interface DatabaseConfig {
  writeUrl: string
  readUrl?: string
  serviceRoleKey: string
  redisUrl?: string
}

interface QueryOptions {
  useReadReplica?: boolean
  cacheKey?: string
  cacheTtl?: number // seconds
  bypassCache?: boolean
}

interface CacheMetrics {
  hits: number
  misses: number
  hitRate: number
  totalQueries: number
}

export class DatabaseOptimizer {
  private writeClient: SupabaseClient
  private readClient: SupabaseClient
  private redis?: SimpleCache
  private cacheMetrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalQueries: 0
  }

  constructor(config: DatabaseConfig) {
    // Primary database connection (write operations)
    this.writeClient = createClient(config.writeUrl, config.serviceRoleKey)
    
    // Read replica connection (if available)
    this.readClient = config.readUrl 
      ? createClient(config.readUrl, config.serviceRoleKey)
      : this.writeClient
    
    // Simple cache connection
    if (config.redisUrl) {
      this.redis = new SimpleCache()
      
      this.redis.on('error', (error: any) => {
        console.error('Cache connection error:', error)
      })
    }
  }

  /**
   * Execute a query with automatic read/write routing and caching
   */
  async query<T = any>(
    table: string,
    operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert',
    queryBuilder: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>,
    options: QueryOptions = {}
  ): Promise<{ data: T | null; error: any; fromCache?: boolean }> {
    const { useReadReplica = operation === 'select', cacheKey, cacheTtl = 300, bypassCache = false } = options
    
    this.cacheMetrics.totalQueries++

    // Check cache first for read operations
    if (operation === 'select' && cacheKey && this.redis && !bypassCache) {
      try {
        const cached = await this.redis.get(cacheKey)
        if (cached) {
          this.cacheMetrics.hits++
          this.updateCacheHitRate()
          return { 
            data: JSON.parse(cached), 
            error: null, 
            fromCache: true 
          }
        }
      } catch (error) {
        console.warn('Cache read error:', error)
      }
    }

    // Select appropriate database client
    const client = useReadReplica ? this.readClient : this.writeClient
    
    try {
      const result = await queryBuilder(client)
      
      // Cache successful read operations
      if (operation === 'select' && result.data && cacheKey && this.redis && !result.error) {
        try {
          await this.redis.setex(cacheKey, cacheTtl, JSON.stringify(result.data))
        } catch (error) {
          console.warn('Cache write error:', error)
        }
      }

      // Invalidate related cache entries for write operations
      if (operation !== 'select' && this.redis) {
        await this.invalidateCache(table, operation)
      }

      if (operation === 'select') {
        this.cacheMetrics.misses++
        this.updateCacheHitRate()
      }

      return { ...result, fromCache: false }

    } catch (error) {
      console.error(`Database ${operation} error:`, error)
      return { data: null, error }
    }
  }

  /**
   * Optimized user submission summary query
   */
  async getUserSubmissionSummary(userId: string, useCache = true): Promise<any> {
    const cacheKey = `user_summary:${userId}`
    
    return this.query(
      'mv_user_submission_summary',
      'select',
      async (client) => {
        return client
          .from('mv_user_submission_summary')
          .select('*')
          .eq('user_id', userId)
          .single()
      },
      { 
        useReadReplica: true, 
        ...(useCache && { cacheKey }), 
        cacheTtl: 600 // 10 minutes
      }
    )
  }

  /**
   * Optimized directory performance analytics
   */
  async getDirectoryPerformance(category?: string, useCache = true): Promise<any> {
    const cacheKey = category ? `directory_performance:${category}` : 'directory_performance:all'
    
    return this.query(
      'mv_directory_performance',
      'select',
      async (client) => {
        let query = client
          .from('mv_directory_performance')
          .select('*')
          .order('success_rate', { ascending: false })

        if (category) {
          query = query.eq('category', category)
        }

        return query
      },
      { 
        useReadReplica: true, 
        ...(useCache && { cacheKey }), 
        cacheTtl: 900 // 15 minutes
      }
    )
  }

  /**
   * Optimized user dashboard data
   */
  async getUserDashboardData(userId: string, useCache = true): Promise<any> {
    const cacheKey = `dashboard:${userId}`
    
    return this.query(
      'submissions',
      'select',
      async (client) => {
        const [submissions, recentActivity, credits] = await Promise.all([
          client
            .from('submissions')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(50),
          
          client
            .from('submissions')
            .select('id, status, directory_id, created_at, directories(name)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10),
          
          client
            .from('profiles')
            .select('credits_remaining')
            .eq('id', userId)
            .single()
        ])

        return {
          data: {
            submissions: submissions.data || [],
            recentActivity: recentActivity.data || [],
            credits: credits.data?.credits_remaining || 0
          },
          error: submissions.error || recentActivity.error || credits.error
        }
      },
      { 
        useReadReplica: true, 
        ...(useCache && { cacheKey }), 
        cacheTtl: 300 // 5 minutes
      }
    )
  }

  /**
   * Batch insert submissions with optimized performance
   */
  async batchInsertSubmissions(submissions: any[]): Promise<any> {
    // Use batch insert for better performance
    const batchSize = 100
    const results = []

    for (let i = 0; i < submissions.length; i += batchSize) {
      const batch = submissions.slice(i, i + batchSize)
      
      const result = await this.query(
        'submissions',
        'insert',
        async (client) => {
          return client
            .from('submissions')
            .insert(batch)
        },
        { useReadReplica: false }
      )

      results.push(result)
    }

    return results
  }

  /**
   * Refresh materialized views
   */
  async refreshMaterializedViews(): Promise<void> {
    try {
      await Promise.all([
        this.writeClient.rpc('refresh_materialized_view', { view_name: 'mv_user_submission_summary' }),
        this.writeClient.rpc('refresh_materialized_view', { view_name: 'mv_directory_performance' })
      ])
      
      // Clear related cache entries
      if (this.redis) {
        const keys = await this.redis.keys('user_summary:*')
        if (keys.length > 0) {
          await this.redis.del(...keys)
        }
        
        const perfKeys = await this.redis.keys('directory_performance:*')
        if (perfKeys.length > 0) {
          await this.redis.del(...perfKeys)
        }
      }
    } catch (error) {
      console.error('Failed to refresh materialized views:', error)
    }
  }

  /**
   * Perform database cleanup and optimization
   */
  async performMaintenance(): Promise<void> {
    try {
      // Run cleanup function
      await this.writeClient.rpc('cleanup_old_data')
      
      // Clear old cache entries
      if (this.redis) {
        await this.redis.flushdb()
      }
      
      console.log('Database maintenance completed successfully')
    } catch (error) {
      console.error('Database maintenance failed:', error)
      throw error
    }
  }

  /**
   * Get database health metrics
   */
  async getHealthMetrics(): Promise<any> {
    return this.query(
      'database_health_metrics',
      'select',
      async (client) => {
        return client
          .from('database_health_metrics')
          .select('*')
      },
      { 
        useReadReplica: true, 
        cacheKey: 'db_health', 
        cacheTtl: 60 // 1 minute
      }
    )
  }

  /**
   * Get cache performance metrics
   */
  getCacheMetrics(): CacheMetrics {
    return { ...this.cacheMetrics }
  }

  /**
   * Invalidate cache entries related to a table operation
   */
  private async invalidateCache(table: string, operation: string): Promise<void> {
    if (!this.redis) return

    try {
      const patterns = this.getCacheInvalidationPatterns(table, operation)
      
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern)
        if (keys.length > 0) {
          await this.redis.del(...keys)
        }
      }
    } catch (error) {
      console.warn('Cache invalidation error:', error)
    }
  }

  /**
   * Get cache invalidation patterns for different table operations
   */
  private getCacheInvalidationPatterns(table: string, operation: string): string[] {
    const patterns: string[] = []

    switch (table) {
      case 'submissions':
        patterns.push('user_summary:*', 'dashboard:*', 'directory_performance:*')
        break
      case 'profiles':
        patterns.push('user_summary:*', 'dashboard:*')
        break
      case 'directories':
        patterns.push('directory_performance:*')
        break
      default:
        // Generic invalidation
        patterns.push(`${table}:*`)
    }

    return patterns
  }

  /**
   * Update cache hit rate calculation
   */
  private updateCacheHitRate(): void {
    this.cacheMetrics.hitRate = this.cacheMetrics.totalQueries > 0 
      ? (this.cacheMetrics.hits / this.cacheMetrics.totalQueries) * 100 
      : 0
  }

  /**
   * Close database and cache connections
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
    }
  }
}

// Create singleton instance
const dbConfig = {
  writeUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ...(process.env.SUPABASE_READ_REPLICA_URL && { readUrl: process.env.SUPABASE_READ_REPLICA_URL }),
  ...(process.env.REDIS_URL && { redisUrl: process.env.REDIS_URL })
}

export const databaseOptimizer = new DatabaseOptimizer(dbConfig)

// Example usage in API routes:
/*
// Instead of direct Supabase client usage:
const { data, error } = await supabase
  .from('submissions')
  .select('*')
  .eq('user_id', userId)

// Use optimized version:
const { data, error, fromCache } = await databaseOptimizer.getUserSubmissionSummary(userId)
*/
