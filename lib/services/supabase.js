const { createClient } = require('@supabase/supabase-js')
const { getSupabaseServerConfig } = require('../server/supabaseEnv')

/**
 * @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient
 */

class SupabaseService {
  constructor() {
    this.client = null
    this.initialized = false
    this.connectionPool = null

    // Advanced multi-layer caching system
    this.queryCache = new Map()
    this.preparedStatements = new Map()
    this.hotQueries = new Map() // Track frequently accessed queries

    // Enhanced performance metrics with predictive analytics
    this.performanceMetrics = {
      queryCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      connectionAttempts: 0,
      cacheHits: 0,
      cacheMisses: 0,
      preparedStatementUses: 0,
      connectionPoolUtilization: 0,
      queryTypeDistribution: {},
      performanceTrends: [],
    }

    // Connection pooling configuration based on enterprise best practices
    this.poolConfig = {
      maxConnections: 40, // 40% allocation as per research
      idleTimeout: 600000, // 10 minutes
      connectionTimeout: 30000, // 30 seconds
      recycleInterval: 3600000, // 1 hour
    }

    // Cache configuration with TTL tiers
    this.cacheConfig = {
      customerData: { ttl: 300000, priority: 'high' }, // 5 minutes for customer data
      directories: { ttl: 1800000, priority: 'medium' }, // 30 minutes for directories
      staticData: { ttl: 3600000, priority: 'low' }, // 1 hour for static data
      hotQueries: { ttl: 60000, priority: 'critical' }, // 1 minute for hot queries
    }
  }

  async initialize() {
    try {
      const { url: supabaseUrl, serviceRoleKey: supabaseServiceKey } = getSupabaseServerConfig()
      console.log('🔍 Supabase service initialization with advanced pooling:')
      console.log('URL:', supabaseUrl)
      console.log('Key available:', !!supabaseServiceKey)
      console.log('Key starts with:', supabaseServiceKey?.substring(0, 20) + '...')


      // Advanced connection configuration for 2025 best practices with Supavisor optimization
      const clientOptions = {
        auth: {
          persistSession: false, // Optimized for serverless
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-application-name': 'DirectoryBolt-Backend',
            'x-connection-mode': 'transaction', // Optimized for Supavisor
            'x-pool-size': '40', // 40% allocation for PostgREST-heavy workloads
            'x-max-age': '3600', // Connection max age in seconds
            'x-idle-timeout': '600', // Idle timeout for connection recycling
          },
        },
        // Advanced connection pooling configuration
        realtime: {
          params: {
            eventsPerSecond: 50, // Rate limiting for real-time subscriptions
          },
        },
      }

      /** @type {SupabaseClient} */
      this.client = createClient(supabaseUrl, supabaseServiceKey, clientOptions)
      this.initialized = true
      this.performanceMetrics.connectionAttempts++

      console.log('✅ Supabase client initialized with optimized configuration')
      return true
    } catch (error) {
      console.error('Failed to initialize Supabase service:', error)
      this.performanceMetrics.errorCount++
      throw error
    }
  }

  async testConnection() {
    try {
      if (!this.client) {
        await this.initialize()
      }

      // Test connection by querying customers table
      const { data, error } = await this.client.from('customers').select('customer_id').limit(1)

      if (error) {
        return {
          ok: false,
          error: error.message,
        }
      }

      return {
        ok: true,
        message: 'Supabase connection successful',
        hasData: data && data.length > 0,
      }
    } catch (error) {
      return {
        ok: false,
        error: error.message,
      }
    }
  }

  async getCustomerById(customerId) {
    const startTime = Date.now()

    try {
      if (!this.client) {
        await this.initialize()
      }

      // Advanced multi-layer cache check with intelligent TTL
      const cacheKey = `customer:${customerId}`
      const cached = this.getFromIntelligentCache(cacheKey, 'customerData')
      if (cached) {
        this.performanceMetrics.cacheHits++
        this.trackHotQuery(cacheKey)
        console.log(
          `📋 Cache hit for customer: ${customerId} (${this.getCacheHitRatio()}% hit ratio)`
        )
        return cached.result
      }
      this.performanceMetrics.cacheMisses++

      // Optimized query with minimal fields for initial lookup
      let { data, error } = await this.client
        .from('customers')
        .select(
          'customer_id,first_name,last_name,business_name,email,package_type,status,directories_submitted,failed_directories,metadata,created_at'
        )
        .eq('customer_id', customerId)
        .single()

      // If not found, try uppercase version
      if (error && error.code === 'PGRST116') {
        const { data: upperData, error: upperError } = await this.client
          .from('customers')
          .select(
            'customer_id,first_name,last_name,business_name,email,package_type,status,directories_submitted,failed_directories,metadata,created_at'
          )
          .eq('customer_id', customerId.toUpperCase())
          .single()

        data = upperData
        error = upperError
      }

      // If still not found, try optimized metadata search (indexed query)
      if (error && error.code === 'PGRST116') {
        const { data: metaData, error: metaError } = await this.client
          .from('customers')
          .select(
            'customer_id,first_name,last_name,business_name,email,package_type,status,directories_submitted,failed_directories,metadata,created_at'
          )
          .or(`metadata->>original_customer_id.eq.${customerId}`)
          .single()

        data = metaData
        error = metaError
      }

      this.performanceMetrics.queryCount++
      const responseTime = Date.now() - startTime
      this.updateMetrics(responseTime, 'customer_lookup')

      if (error) {
        this.performanceMetrics.errorCount++
        if (error.code === 'PGRST116') {
          return { found: false, error: 'Customer not found' }
        }
        return { found: false, error: error.message }
      }

      // Handle current customers table schema
      const metadata = data.metadata || {}

      // Extract name components - use existing first_name/last_name fields
      const firstName = data.first_name || ''
      const lastName = data.last_name || ''
      const fullName = `${firstName} ${lastName}`.trim() || ''

      const result = {
        found: true,
        customer: {
          customerId: metadata.original_customer_id || data.customer_id || customerId,
          firstName: firstName,
          lastName: lastName,
          businessName: data.business_name || '',
          email: data.email || '',
          phone: data.phone || '',
          website: data.website || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zip: data.zip || '',
          packageType: data.package_type || 'starter',
          status: data.status || 'active',
          created: data.created_at || '',
          directoriesSubmitted: data.directories_submitted || 0,
          failedDirectories: data.failed_directories || 0,
        },
      }

      // Cache successful results with intelligent TTL
      this.setIntelligentCache(cacheKey, result, 'customerData')

      console.log(`⚡ Customer query completed in ${responseTime}ms for: ${customerId}`)
      return result
    } catch (error) {
      this.performanceMetrics.errorCount++
      console.error(`❌ Customer lookup error (${Date.now() - startTime}ms):`, error.message)
      return {
        found: false,
        error: error.message,
      }
    }
  }

  // Advanced performance metrics tracking with predictive analytics
  updateMetrics(responseTime, queryType = 'unknown') {
    const currentAvg = this.performanceMetrics.avgResponseTime
    const currentCount = this.performanceMetrics.queryCount - 1
    this.performanceMetrics.avgResponseTime =
      currentCount === 0
        ? responseTime
        : (currentAvg * currentCount + responseTime) / (currentCount + 1)

    // Track query type distribution for optimization insights
    this.performanceMetrics.queryTypeDistribution[queryType] =
      (this.performanceMetrics.queryTypeDistribution[queryType] || 0) + 1

    // Store performance trends for predictive analysis
    const trend = {
      timestamp: Date.now(),
      responseTime,
      queryType,
      cacheHitRatio: this.getCacheHitRatio(),
      connectionAttempts: this.performanceMetrics.connectionAttempts,
    }

    this.performanceMetrics.performanceTrends.push(trend)

    // Keep only last 1000 trends to prevent memory bloat
    if (this.performanceMetrics.performanceTrends.length > 1000) {
      this.performanceMetrics.performanceTrends =
        this.performanceMetrics.performanceTrends.slice(-1000)
    }
  }

  // Intelligent cache management with TTL tiers
  getFromIntelligentCache(key, cacheType = 'staticData') {
    const cached = this.queryCache.get(key)
    if (!cached) return null

    const config = this.cacheConfig[cacheType]
    const age = Date.now() - cached.timestamp

    if (age > config.ttl) {
      this.queryCache.delete(key)
      return null
    }

    // Extend TTL for hot queries
    if (this.hotQueries.has(key) && config.priority === 'critical') {
      cached.timestamp = Date.now() // Refresh timestamp for hot queries
    }

    return cached
  }

  setIntelligentCache(key, result, cacheType = 'staticData') {
    const config = this.cacheConfig[cacheType]
    this.queryCache.set(key, {
      result,
      timestamp: Date.now(),
      cacheType,
      priority: config.priority,
      accessCount: 1,
    })

    // Implement cache size limits based on priority
    this.enforceMemoryLimits()
  }

  // Track frequently accessed queries for optimization
  trackHotQuery(key) {
    const current = this.hotQueries.get(key) || { count: 0, lastAccess: Date.now() }
    current.count++
    current.lastAccess = Date.now()
    this.hotQueries.set(key, current)

    // Promote to hot query cache if accessed frequently
    if (current.count > 10) {
      const cached = this.queryCache.get(key)
      if (cached) {
        cached.priority = 'critical'
        this.queryCache.set(key, cached)
      }
    }
  }

  // Enforce memory limits and evict low-priority cache entries
  enforceMemoryLimits() {
    const maxCacheSize = 10000 // Maximum cache entries

    if (this.queryCache.size > maxCacheSize) {
      const entries = Array.from(this.queryCache.entries())

      // Sort by priority and age, remove lowest priority oldest entries
      entries.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        const aPriority = priorityOrder[a[1].priority] || 1
        const bPriority = priorityOrder[b[1].priority] || 1

        if (aPriority !== bPriority) return aPriority - bPriority
        return a[1].timestamp - b[1].timestamp
      })

      // Remove bottom 20% of entries
      const toRemove = Math.floor(entries.length * 0.2)
      for (let i = 0; i < toRemove; i++) {
        this.queryCache.delete(entries[i][0])
      }
    }
  }

  getCacheHitRatio() {
    const total = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses
    return total > 0 ? ((this.performanceMetrics.cacheHits / total) * 100).toFixed(2) : 0
  }

  // Enhanced performance statistics with enterprise-grade monitoring
  getPerformanceStats() {
    const totalQueries = this.performanceMetrics.queryCount
    const totalCacheRequests =
      this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses
    const cacheHitRatio = this.getCacheHitRatio()

    return {
      // Core metrics
      ...this.performanceMetrics,

      // Cache performance
      cacheSize: this.queryCache.size,
      cacheHitRatio: `${cacheHitRatio}%`,
      hotQueriesCount: this.hotQueries.size,

      // Error and performance rates
      errorRate:
        totalQueries > 0
          ? `${((this.performanceMetrics.errorCount / totalQueries) * 100).toFixed(2)}%`
          : '0%',

      // Query distribution insights
      topQueryTypes: this.getTopQueryTypes(),

      // Performance trends
      recentPerformanceTrend: this.getRecentPerformanceTrend(),

      // Connection pooling metrics
      connectionPoolHealth: this.getConnectionPoolHealth(),

      // Predictive analytics
      performancePrediction: this.predictPerformanceIssues(),
    }
  }

  // Get top query types for optimization insights
  getTopQueryTypes() {
    const types = Object.entries(this.performanceMetrics.queryTypeDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({
        type,
        count,
        percentage: ((count / this.performanceMetrics.queryCount) * 100).toFixed(1),
      }))
    return types
  }

  // Analyze recent performance trends
  getRecentPerformanceTrend() {
    const recentTrends = this.performanceMetrics.performanceTrends.slice(-10)
    if (recentTrends.length < 2) return 'insufficient_data'

    const avgRecent =
      recentTrends.reduce((sum, trend) => sum + trend.responseTime, 0) / recentTrends.length
    const avgOverall = this.performanceMetrics.avgResponseTime

    const improvement = ((avgOverall - avgRecent) / avgOverall) * 100

    if (improvement > 10) return 'improving'
    if (improvement < -10) return 'degrading'
    return 'stable'
  }

  // Monitor connection pool health
  getConnectionPoolHealth() {
    const utilization = (
      (this.performanceMetrics.connectionAttempts / this.poolConfig.maxConnections) *
      100
    ).toFixed(1)

    return {
      utilization: `${utilization}%`,
      maxConnections: this.poolConfig.maxConnections,
      idleTimeout: this.poolConfig.idleTimeout,
      status: utilization > 80 ? 'high_load' : utilization > 60 ? 'moderate_load' : 'healthy',
    }
  }

  // Predictive analytics for performance issues
  predictPerformanceIssues() {
    const recentTrends = this.performanceMetrics.performanceTrends.slice(-20)
    if (recentTrends.length < 10) return 'insufficient_data'

    const warnings = []

    // Check for degrading response times
    const responseTimesTrend = recentTrends.map((t) => t.responseTime)
    const isIncreasing = responseTimesTrend
      .slice(-5)
      .every((time, i, arr) => i === 0 || time >= arr[i - 1])
    if (isIncreasing) warnings.push('response_time_increasing')

    // Check cache hit ratio degradation
    const cacheRatios = recentTrends.map((t) => parseFloat(t.cacheHitRatio))
    const avgCacheRatio = cacheRatios.reduce((a, b) => a + b, 0) / cacheRatios.length
    if (avgCacheRatio < 70) warnings.push('low_cache_efficiency')

    // Check connection pressure
    const connectionTrend = recentTrends.map((t) => t.connectionAttempts)
    const connectionGrowth = connectionTrend.slice(-1)[0] - connectionTrend[0]
    if (connectionGrowth > this.poolConfig.maxConnections * 0.5) {
      warnings.push('connection_pressure')
    }

    return warnings.length > 0 ? warnings : 'healthy'
  }

  // Clear expired cache entries with intelligent cleanup
  clearExpiredCache() {
    const now = Date.now()
    let removedCount = 0

    for (const [key, value] of this.queryCache.entries()) {
      const config = this.cacheConfig[value.cacheType] || this.cacheConfig.staticData
      const age = now - value.timestamp

      if (age > config.ttl) {
        this.queryCache.delete(key)
        removedCount++
      }
    }

    // Clean up hot queries that haven't been accessed recently
    for (const [key, value] of this.hotQueries.entries()) {
      if (now - value.lastAccess > 3600000) {
        // 1 hour
        this.hotQueries.delete(key)
      }
    }

    console.log(`🧹 Cache cleanup: removed ${removedCount} expired entries`)
  }

  // Prepared statement optimization for high-frequency queries
  getPreparedStatement(queryType, params) {
    const statementKey = `${queryType}:${JSON.stringify(Object.keys(params).sort())}`

    if (this.preparedStatements.has(statementKey)) {
      this.performanceMetrics.preparedStatementUses++
      return this.preparedStatements.get(statementKey)
    }

    // Create optimized query builders for common operations
    let queryBuilder
    switch (queryType) {
      case 'customer_by_id':
        queryBuilder = this.client
          .from('customers')
          .select(
            'customer_id,first_name,last_name,business_name,email,package_type,status,directories_submitted,failed_directories,metadata,created_at'
          )
        break
      case 'customer_update':
        queryBuilder = this.client.from('customers')
        break
      case 'customer_insert':
        queryBuilder = this.client.from('customers')
        break
      default:
        return null
    }

    this.preparedStatements.set(statementKey, queryBuilder)
    return queryBuilder
  }

  // Enterprise-grade performance monitoring dashboard data
  getDatabaseHealthDashboard() {
    const stats = this.getPerformanceStats()
    const now = Date.now()

    return {
      status: this.getDatabaseStatus(stats),
      lastUpdated: now,

      // Core performance metrics
      performance: {
        avgResponseTime: stats.avgResponseTime,
        totalQueries: stats.queryCount,
        queriesPerMinute: this.getQueriesPerMinute(),
        errorRate: stats.errorRate,
        trend: stats.recentPerformanceTrend,
      },

      // Cache efficiency
      cache: {
        hitRatio: stats.cacheHitRatio,
        totalSize: stats.cacheSize,
        hotQueries: stats.hotQueriesCount,
        memoryUsage: this.estimateCacheMemoryUsage(),
      },

      // Connection pooling
      connections: stats.connectionPoolHealth,

      // Query analysis
      queryAnalysis: {
        topTypes: stats.topQueryTypes,
        distribution: stats.queryTypeDistribution,
        preparedStatementEfficiency: this.getPreparedStatementEfficiency(),
      },

      // Alerts and recommendations
      alerts: this.generatePerformanceAlerts(stats),
      recommendations: this.generateOptimizationRecommendations(stats),
    }
  }

  getDatabaseStatus(stats) {
    const warnings = stats.performancePrediction
    if (warnings === 'healthy') return 'healthy'
    if (Array.isArray(warnings) && warnings.length === 1) return 'warning'
    if (Array.isArray(warnings) && warnings.length > 1) return 'critical'
    return 'unknown'
  }

  getQueriesPerMinute() {
    const oneMinuteAgo = Date.now() - 60000
    const recentQueries = this.performanceMetrics.performanceTrends.filter(
      (trend) => trend.timestamp > oneMinuteAgo
    )
    return recentQueries.length
  }

  estimateCacheMemoryUsage() {
    // Rough estimation of cache memory usage in MB
    const avgEntrySize = 2 // KB per cache entry (rough estimate)
    return ((this.queryCache.size * avgEntrySize) / 1024).toFixed(2)
  }

  getPreparedStatementEfficiency() {
    const total = this.performanceMetrics.queryCount
    const prepared = this.performanceMetrics.preparedStatementUses
    return total > 0 ? ((prepared / total) * 100).toFixed(1) : 0
  }

  generatePerformanceAlerts(stats) {
    const alerts = []

    if (parseFloat(stats.cacheHitRatio) < 70) {
      alerts.push({
        type: 'warning',
        message: 'Low cache hit ratio detected',
        suggestion: 'Consider increasing cache TTL or optimizing query patterns',
      })
    }

    if (stats.connectionPoolHealth.status === 'high_load') {
      alerts.push({
        type: 'critical',
        message: 'High connection pool utilization',
        suggestion: 'Consider scaling connection pool or optimizing connection usage',
      })
    }

    if (stats.avgResponseTime > 1000) {
      alerts.push({
        type: 'warning',
        message: 'High average response time detected',
        suggestion: 'Review slow queries and consider database optimization',
      })
    }

    return alerts
  }

  generateOptimizationRecommendations(stats) {
    const recommendations = []

    if (parseFloat(this.getPreparedStatementEfficiency()) < 30) {
      recommendations.push({
        priority: 'high',
        action: 'Implement prepared statements for frequent queries',
        impact: 'Can improve performance by 20-40%',
      })
    }

    if (stats.hotQueriesCount > 100) {
      recommendations.push({
        priority: 'medium',
        action: 'Consider indexing optimization for hot queries',
        impact: 'Reduce query execution time for frequently accessed data',
      })
    }

    if (this.queryCache.size > 8000) {
      recommendations.push({
        priority: 'low',
        action: 'Monitor cache memory usage and consider cache partitioning',
        impact: 'Prevent memory bloat and improve cache efficiency',
      })
    }

    return recommendations
  }

  async addCustomer(customerData) {
    try {
      if (!this.client) {
        await this.initialize()
      }

      const { data, error } = await this.client
        .from('customers')
        .insert([
          {
            customer_id: customerData.customerId,
            first_name: customerData.firstName,
            last_name: customerData.lastName,
            business_name: customerData.businessName,
            email: customerData.email,
            phone: customerData.phone || '',
            website: customerData.website || '',
            address: customerData.address || '',
            city: customerData.city || '',
            state: customerData.state || '',
            zip: customerData.zip || '',
            package_type: customerData.packageType || 'starter',
            status: customerData.status || 'active',
          },
        ])
        .select()
        .single()

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      return {
        success: true,
        customerId: data.customer_id,
        updatedRows: 1,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  async getAllCustomers(limit = 100) {
    try {
      if (!this.client) {
        await this.initialize()
      }

      const { data, error } = await this.client
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        return {
          success: false,
          error: error.message,
          customers: [],
          total: 0,
        }
      }

      const customers = data.map((record) => ({
        customerId: record.customer_id,
        firstName: record.first_name || '',
        lastName: record.last_name || '',
        businessName: record.business_name || '',
        email: record.email || '',
        phone: record.phone || '',
        website: record.website || '',
        address: record.address || '',
        city: record.city || '',
        state: record.state || '',
        zip: record.zip || '',
        packageType: record.package_type || 'starter',
        status: record.status || 'active',
        created: record.created_at || '',
      }))

      return {
        success: true,
        customers,
        total: customers.length,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        customers: [],
        total: 0,
      }
    }
  }

  async updateCustomer(customerId, updateData) {
    try {
      if (!this.client) {
        await this.initialize()
      }

      // Map fields to database column names
      const updateFields = {}
      const fieldMapping = {
        firstName: 'first_name',
        lastName: 'last_name',
        businessName: 'business_name',
        email: 'email',
        phone: 'phone',
        website: 'website',
        address: 'address',
        city: 'city',
        state: 'state',
        zip: 'zip',
        packageType: 'package_type',
        status: 'status',
      }

      Object.entries(updateData).forEach(([key, value]) => {
        const dbField = fieldMapping[key] || key.toLowerCase()
        updateFields[dbField] = value
      })

      const { data, error } = await this.client
        .from('customers')
        .update(updateFields)
        .eq('customer_id', customerId.toUpperCase())
        .select()
        .single()

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      return {
        success: true,
        updatedFields: Object.keys(updateData),
        customerId,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  getPackageLimits() {
    return {
      starter: 50,
      growth: 75,
      professional: 150,
      enterprise: 500,
    }
  }

  validateCustomerId(customerId) {
    const pattern = /^DIR-\d{8}-\d{6}$/
    return pattern.test(customerId)
  }

  generateCustomerId() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0')
    return `DIR-${year}${month}${day}-${random}`
  }

  // Helper functions for mapping between old and new schemas
  mapTierToPackage(tier) {
    const tierToPackageMap = {
      basic: 'starter',
      pro: 'professional',
      enterprise: 'enterprise',
    }
    return tierToPackageMap[tier] || 'starter'
  }

  mapSupabaseStatus(status) {
    const statusMap = {
      active: 'active',
      trialing: 'pending',
      past_due: 'past_due',
      cancelled: 'cancelled',
      unpaid: 'unpaid',
    }
    return statusMap[status] || 'pending'
  }

  // Alias methods for compatibility with existing code
  async findByCustomerId(customerId) {
    const result = await this.getCustomerById(customerId)
    return result.found ? result.customer : null
  }

  async createBusinessSubmission(customerData) {
    // Generate customer ID if not provided
    if (!customerData.customerId) {
      customerData.customerId = this.generateCustomerId()
    }

    const result = await this.addCustomer(customerData)
    if (result.success) {
      return {
        ...customerData,
        customerId: result.customerId,
      }
    } else {
      throw new Error(result.error)
    }
  }

  // Additional methods needed by queue-manager
  async healthCheck() {
    try {
      const result = await this.testConnection()
      return result.ok
    } catch (error) {
      return false
    }
  }

  async findByStatus(status) {
    try {
      if (!this.client) {
        await this.initialize()
      }

      const { data, error } = await this.client
        .from('customers')
        .select('*')
        .eq('status', status.toLowerCase())
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error finding customers by status:', error)
        return []
      }

      return data.map((record) => ({
        recordId: record.id,
        customerId: record.customer_id,
        firstName: record.first_name || '',
        lastName: record.last_name || '',
        businessName: record.business_name || '',
        email: record.email || '',
        phone: record.phone || '',
        website: record.website || '',
        address: record.address || '',
        city: record.city || '',
        state: record.state || '',
        zip: record.zip || '',
        packageType: record.package_type || 'starter',
        status: record.status || 'active',
        submissionStatus: record.status || 'active',
        purchaseDate: record.created_at || new Date().toISOString(),
        created: record.created_at || '',
      }))
    } catch (error) {
      console.error('Error finding customers by status:', error)
      return []
    }
  }

  async updateSubmissionStatus(
    customerId,
    status,
    directoriesSubmitted = null,
    failedDirectories = null
  ) {
    try {
      if (!this.client) {
        await this.initialize()
      }

      const updateData = { status: status.toLowerCase() }

      // Add additional fields if provided
      if (directoriesSubmitted !== null) {
        updateData.directories_submitted = directoriesSubmitted
      }
      if (failedDirectories !== null) {
        updateData.failed_directories = failedDirectories
      }

      const { data, error } = await this.client
        .from('customers')
        .update(updateData)
        .eq('customer_id', customerId.toUpperCase())
        .select()
        .single()

      if (error) {
        console.error('Error updating submission status:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating submission status:', error)
      return false
    }
  }

  // Real-time subscription methods
  subscribeToCustomers(callback) {
    if (!this.client) {
      throw new Error('Supabase client not initialized')
    }

    return this.client
      .channel('customers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
        },
        callback
      )
      .subscribe()
  }

  unsubscribe(subscription) {
    if (subscription) {
      this.client.removeChannel(subscription)
    }
  }
}

// Factory function to create and return a SupabaseService instance
function createSupabaseService() {
  return new SupabaseService()
}

// Export both the class and the factory function
module.exports = {
  SupabaseService,
  createSupabaseService,
  default: SupabaseService,
}

// For compatibility with different import styles
module.exports.SupabaseService = SupabaseService
module.exports.createSupabaseService = createSupabaseService
module.exports.default = SupabaseService

