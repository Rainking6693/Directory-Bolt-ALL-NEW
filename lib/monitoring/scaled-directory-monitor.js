/**
 * Scaled Directory Health Monitoring System
 * Enhanced version capable of monitoring 500+ directories efficiently
 * 
 * Features:
 * - Horizontal scaling with worker pools
 * - Intelligent resource management
 * - Adaptive scheduling based on directory priority
 * - Advanced error handling and recovery
 * - Performance optimization for large-scale monitoring
 * 
 * Authors: Quinn (DevOps & Security) + Alex (Full-Stack Engineer)
 */

import { DirectoryHealthMonitor } from './directory-health-monitor.js'
import { logger } from '../utils/logger'

export class ScaledDirectoryMonitor extends DirectoryHealthMonitor {
    constructor() {
        super()
        
        // Scaling configuration
        this.maxConcurrentChecks = 20 // Increased from 5
        this.workerPools = new Map()
        this.adaptiveScheduling = true
        this.resourceThreshold = 0.05 // 5% CPU limit
        this.performanceMetrics = {
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            averageResponseTime: 0,
            peakMemoryUsage: 0,
            cpuUsageHistory: []
        }
        
        // Advanced scheduling
        this.priorityQueues = {
            critical: [],
            high: [],
            medium: [],
            low: []
        }
        
        // Resource monitoring
        this.resourceMonitor = {
            cpuUsage: 0,
            memoryUsage: 0,
            activeConnections: 0,
            queueDepth: 0
        }
        
        // Circuit breaker for overload protection
        this.circuitBreaker = {
            isOpen: false,
            failureCount: 0,
            lastFailureTime: null,
            threshold: 10,
            timeout: 60000 // 1 minute
        }
        
        logger.info('Scaled Directory Monitor initialized for 500+ directories')
    }

    /**
     * Initialize scaled monitoring system
     */
    async initializeScaledMonitoring(directoryCount = 500) {
        try {
            logger.info(`Initializing scaled monitoring for ${directoryCount} directories...`)
            
            // Initialize base monitoring
            await super.init()
            
            // Setup worker pools
            await this.initializeWorkerPools()
            
            // Setup adaptive scheduling
            await this.setupAdaptiveScheduling()
            
            // Initialize resource monitoring
            await this.initializeResourceMonitoring()
            
            // Setup circuit breaker
            this.setupCircuitBreaker()
            
            // Start performance monitoring
            this.startPerformanceMonitoring()
            
            logger.info('Scaled monitoring system initialized successfully', {
                metadata: {
                    directoryCount: this.directories.length,
                    workerPools: this.workerPools.size,
                    maxConcurrentChecks: this.maxConcurrentChecks,
                    resourceThreshold: this.resourceThreshold
                }
            })
            
            return {
                success: true,
                directoryCount: this.directories.length,
                scalingCapacity: this.maxConcurrentChecks,
                estimatedThroughput: this.calculateThroughput()
            }
            
        } catch (error) {
            logger.error('Failed to initialize scaled monitoring', {}, error)
            throw error
        }
    }

    /**
     * Initialize worker pools for concurrent processing
     */
    async initializeWorkerPools() {
        try {
            // Create worker pools by directory category
            const categories = [...new Set(this.directories.map(d => d.category))]
            
            categories.forEach(category => {
                const categoryDirectories = this.directories.filter(d => d.category === category)
                const poolSize = Math.min(Math.ceil(categoryDirectories.length / 10), 5) // Max 5 workers per category
                
                this.workerPools.set(category, {
                    size: poolSize,
                    activeWorkers: 0,
                    queue: [],
                    directories: categoryDirectories,
                    performance: {
                        totalProcessed: 0,
                        averageTime: 0,
                        errorRate: 0
                    }
                })
            })
            
            logger.info(`Initialized ${this.workerPools.size} worker pools`, {
                metadata: {
                    categories: categories,
                    totalWorkers: Array.from(this.workerPools.values()).reduce((sum, pool) => sum + pool.size, 0)
                }
            })
            
        } catch (error) {
            logger.error('Failed to initialize worker pools', {}, error)
            throw error
        }
    }

    /**
     * Setup adaptive scheduling based on directory priority and performance
     */
    async setupAdaptiveScheduling() {
        try {
            // Categorize directories by priority
            this.directories.forEach(directory => {
                const priority = this.calculateDirectoryPriority(directory)
                directory.priority = priority
                directory.schedulingWeight = this.calculateSchedulingWeight(directory)
                
                this.priorityQueues[priority].push(directory)
            })
            
            // Setup adaptive intervals
            this.schedulingIntervals = {
                critical: 5 * 60 * 1000,    // 5 minutes
                high: 15 * 60 * 1000,       // 15 minutes
                medium: 30 * 60 * 1000,     // 30 minutes
                low: 60 * 60 * 1000         // 1 hour
            }
            
            // Start adaptive scheduler
            this.startAdaptiveScheduler()
            
            logger.info('Adaptive scheduling configured', {
                metadata: {
                    critical: this.priorityQueues.critical.length,
                    high: this.priorityQueues.high.length,
                    medium: this.priorityQueues.medium.length,
                    low: this.priorityQueues.low.length
                }
            })
            
        } catch (error) {
            logger.error('Failed to setup adaptive scheduling', {}, error)
            throw error
        }
    }

    /**
     * Calculate directory priority for scheduling
     */
    calculateDirectoryPriority(directory) {
        let score = 0
        
        // Domain authority weight
        score += (directory.domainAuthority || 0) * 0.3
        
        // Traffic volume weight
        score += Math.min(Math.log10((directory.trafficVolume || 0) + 1) / 6, 1) * 0.25
        
        // Business importance
        const highValueCategories = ['Search Engines', 'Social Media', 'Review Sites', 'Maps Services']
        if (highValueCategories.includes(directory.category)) {
            score += 0.25
        }
        
        // Historical reliability
        const reliability = directory.reliability || 0.8
        score += reliability * 0.2
        
        // Determine priority level
        if (score >= 0.8) return 'critical'
        if (score >= 0.6) return 'high'
        if (score >= 0.4) return 'medium'
        return 'low'
    }

    /**
     * Calculate scheduling weight for load balancing
     */
    calculateSchedulingWeight(directory) {
        let weight = 1.0
        
        // Adjust based on complexity
        const complexity = directory.technicalComplexity || 0.5
        weight *= (1 - complexity * 0.3)
        
        // Adjust based on success rate
        const successRate = directory.successRate || 0.9
        weight *= successRate
        
        // Adjust based on response time
        const avgResponseTime = directory.averageResponseTime || 2000
        weight *= Math.max(0.5, 1 - (avgResponseTime / 10000)) // Penalize slow directories
        
        return Math.max(0.1, weight)
    }

    /**
     * Start adaptive scheduler
     */
    startAdaptiveScheduler() {
        // Schedule each priority level
        Object.keys(this.priorityQueues).forEach(priority => {
            const interval = this.schedulingIntervals[priority]
            
            setInterval(async () => {
                if (this.monitoringActive && !this.circuitBreaker.isOpen) {
                    await this.processDirectoryQueue(priority)
                }
            }, interval)
        })
        
        // Dynamic adjustment based on system load
        setInterval(() => {
            this.adjustSchedulingBasedOnLoad()
        }, 30000) // Check every 30 seconds
    }

    /**
     * Process directory queue for specific priority
     */
    async processDirectoryQueue(priority) {
        try {
            const queue = this.priorityQueues[priority]
            if (queue.length === 0) return
            
            // Check resource availability
            if (!this.hasAvailableResources()) {
                logger.warn(`Skipping ${priority} queue due to resource constraints`)
                return
            }
            
            // Calculate batch size based on priority and resources
            const batchSize = this.calculateOptimalBatchSize(priority)
            const batch = queue.slice(0, batchSize)
            
            logger.info(`Processing ${priority} priority batch`, {
                metadata: {
                    batchSize: batch.length,
                    queueRemaining: queue.length - batch.length,
                    resourceUsage: this.resourceMonitor.cpuUsage
                }
            })
            
            // Process batch with worker pool
            await this.processBatchWithWorkerPool(batch, priority)
            
        } catch (error) {
            logger.error(`Failed to process ${priority} queue`, {}, error)
            this.handleCircuitBreaker(error)
        }
    }

    /**
     * Process batch using worker pool
     */
    async processBatchWithWorkerPool(batch, priority) {
        try {
            const startTime = Date.now()
            
            // Find appropriate worker pool
            const workerPool = this.findOptimalWorkerPool(batch)
            
            // Process directories concurrently within resource limits
            const concurrencyLimit = Math.min(
                this.maxConcurrentChecks,
                workerPool.size,
                this.calculateDynamicConcurrency()
            )
            
            const results = await this.processConcurrentBatch(batch, concurrencyLimit)
            
            // Update performance metrics
            const endTime = Date.now()
            this.updatePerformanceMetrics(results, endTime - startTime)
            
            // Update worker pool performance
            this.updateWorkerPoolMetrics(workerPool, results, endTime - startTime)
            
            logger.info(`Batch processing completed`, {
                metadata: {
                    priority,
                    batchSize: batch.length,
                    successCount: results.filter(r => r.success).length,
                    processingTime: endTime - startTime,
                    concurrency: concurrencyLimit
                }
            })
            
        } catch (error) {
            logger.error('Batch processing failed', {}, error)
            throw error
        }
    }

    /**
     * Process directories concurrently with resource monitoring
     */
    async processConcurrentBatch(directories, concurrencyLimit) {
        const results = []
        const semaphore = new Semaphore(concurrencyLimit)
        
        const promises = directories.map(async (directory) => {
            await semaphore.acquire()
            
            try {
                this.resourceMonitor.activeConnections++
                
                const result = await this.monitorDirectoryWithMetrics(directory)
                results.push(result)
                
                return result
                
            } catch (error) {
                logger.error(`Directory monitoring failed: ${directory.id}`, {}, error)
                results.push({
                    directoryId: directory.id,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                })
                
            } finally {
                this.resourceMonitor.activeConnections--
                semaphore.release()
            }
        })
        
        await Promise.allSettled(promises)
        return results
    }

    /**
     * Monitor directory with performance metrics
     */
    async monitorDirectoryWithMetrics(directory) {
        const startTime = Date.now()
        
        try {
            // Perform standard directory monitoring
            const result = await super.monitorDirectory(directory)
            
            const endTime = Date.now()
            const responseTime = endTime - startTime
            
            // Update directory performance metrics
            directory.lastResponseTime = responseTime
            directory.averageResponseTime = directory.averageResponseTime 
                ? (directory.averageResponseTime * 0.8) + (responseTime * 0.2)
                : responseTime
            
            // Update success rate
            directory.successRate = directory.successRate 
                ? (directory.successRate * 0.9) + (0.1)
                : 1.0
            
            return {
                directoryId: directory.id,
                success: true,
                responseTime,
                result,
                timestamp: new Date().toISOString()
            }
            
        } catch (error) {
            const endTime = Date.now()
            const responseTime = endTime - startTime
            
            // Update failure metrics
            directory.lastResponseTime = responseTime
            directory.successRate = directory.successRate 
                ? (directory.successRate * 0.9)
                : 0.0
            
            throw error
        }
    }

    /**
     * Find optimal worker pool for batch
     */
    findOptimalWorkerPool(batch) {
        // Group by category and find the pool with best performance
        const categories = [...new Set(batch.map(d => d.category))]
        
        let bestPool = null
        let bestScore = -1
        
        categories.forEach(category => {
            const pool = this.workerPools.get(category)
            if (pool) {
                const score = this.calculatePoolScore(pool)
                if (score > bestScore) {
                    bestScore = score
                    bestPool = pool
                }
            }
        })
        
        return bestPool || this.workerPools.values().next().value
    }

    /**
     * Calculate worker pool performance score
     */
    calculatePoolScore(pool) {
        let score = 1.0
        
        // Factor in error rate (lower is better)
        score *= (1 - pool.performance.errorRate)
        
        // Factor in average processing time (faster is better)
        const normalizedTime = Math.min(pool.performance.averageTime / 5000, 1)
        score *= (1 - normalizedTime)
        
        // Factor in current load (less loaded is better)
        const loadFactor = pool.activeWorkers / pool.size
        score *= (1 - loadFactor)
        
        return score
    }

    /**
     * Calculate dynamic concurrency based on system resources
     */
    calculateDynamicConcurrency() {
        const cpuUsage = this.resourceMonitor.cpuUsage
        const memoryUsage = this.resourceMonitor.memoryUsage
        
        // Reduce concurrency if resource usage is high
        let concurrency = this.maxConcurrentChecks
        
        if (cpuUsage > 0.7) {
            concurrency = Math.floor(concurrency * 0.5)
        } else if (cpuUsage > 0.5) {
            concurrency = Math.floor(concurrency * 0.7)
        }
        
        if (memoryUsage > 0.8) {
            concurrency = Math.floor(concurrency * 0.6)
        }
        
        return Math.max(1, concurrency)
    }

    /**
     * Check if system has available resources
     */
    hasAvailableResources() {
        return (
            this.resourceMonitor.cpuUsage < this.resourceThreshold &&
            this.resourceMonitor.memoryUsage < 0.8 &&
            this.resourceMonitor.activeConnections < this.maxConcurrentChecks &&
            !this.circuitBreaker.isOpen
        )
    }

    /**
     * Calculate optimal batch size based on priority and resources
     */
    calculateOptimalBatchSize(priority) {
        const baseSizes = {
            critical: 5,
            high: 10,
            medium: 15,
            low: 20
        }
        
        let batchSize = baseSizes[priority] || 10
        
        // Adjust based on current resource usage
        const resourceFactor = 1 - this.resourceMonitor.cpuUsage
        batchSize = Math.floor(batchSize * resourceFactor)
        
        // Ensure minimum batch size
        return Math.max(1, batchSize)
    }

    /**
     * Adjust scheduling based on system load
     */
    adjustSchedulingBasedOnLoad() {
        const cpuUsage = this.resourceMonitor.cpuUsage
        const queueDepth = this.resourceMonitor.queueDepth
        
        // If system is overloaded, increase intervals
        if (cpuUsage > this.resourceThreshold) {
            Object.keys(this.schedulingIntervals).forEach(priority => {
                this.schedulingIntervals[priority] *= 1.2 // Increase by 20%
            })
            
            logger.warn('Increased scheduling intervals due to high CPU usage', {
                metadata: { cpuUsage, newIntervals: this.schedulingIntervals }
            })
        }
        
        // If system is underutilized, decrease intervals
        else if (cpuUsage < this.resourceThreshold * 0.5 && queueDepth > 0) {
            Object.keys(this.schedulingIntervals).forEach(priority => {
                this.schedulingIntervals[priority] *= 0.9 // Decrease by 10%
            })
            
            logger.info('Decreased scheduling intervals due to low CPU usage', {
                metadata: { cpuUsage, newIntervals: this.schedulingIntervals }
            })
        }
    }

    /**
     * Initialize resource monitoring
     */
    async initializeResourceMonitoring() {
        try {
            // Start resource monitoring loop
            setInterval(() => {
                this.updateResourceMetrics()
            }, 5000) // Update every 5 seconds
            
            logger.info('Resource monitoring initialized')
            
        } catch (error) {
            logger.error('Failed to initialize resource monitoring', {}, error)
            throw error
        }
    }

    /**
     * Update resource metrics
     */
    updateResourceMetrics() {
        try {
            // CPU usage (simulated - in production would use actual system metrics)
            const activeRatio = this.resourceMonitor.activeConnections / this.maxConcurrentChecks
            this.resourceMonitor.cpuUsage = Math.min(activeRatio * 0.8, 0.95)
            
            // Memory usage (simulated)
            this.resourceMonitor.memoryUsage = Math.min(
                (this.directories.length / 1000) * 0.5 + activeRatio * 0.3,
                0.9
            )
            
            // Queue depth
            this.resourceMonitor.queueDepth = Object.values(this.priorityQueues)
                .reduce((sum, queue) => sum + queue.length, 0)
            
            // Track CPU history for trending
            this.performanceMetrics.cpuUsageHistory.push({
                timestamp: Date.now(),
                usage: this.resourceMonitor.cpuUsage
            })
            
            // Keep only last 100 measurements
            if (this.performanceMetrics.cpuUsageHistory.length > 100) {
                this.performanceMetrics.cpuUsageHistory.shift()
            }
            
        } catch (error) {
            logger.error('Failed to update resource metrics', {}, error)
        }
    }

    /**
     * Setup circuit breaker for overload protection
     */
    setupCircuitBreaker() {
        // Monitor for consecutive failures
        setInterval(() => {
            this.checkCircuitBreaker()
        }, 10000) // Check every 10 seconds
    }

    /**
     * Check and manage circuit breaker state
     */
    checkCircuitBreaker() {
        const now = Date.now()
        
        // If circuit is open, check if timeout has passed
        if (this.circuitBreaker.isOpen) {
            if (now - this.circuitBreaker.lastFailureTime > this.circuitBreaker.timeout) {
                this.circuitBreaker.isOpen = false
                this.circuitBreaker.failureCount = 0
                logger.info('Circuit breaker reset - resuming monitoring')
            }
            return
        }
        
        // Check if failure threshold is exceeded
        if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
            this.circuitBreaker.isOpen = true
            this.circuitBreaker.lastFailureTime = now
            
            logger.error('Circuit breaker opened due to excessive failures', {
                metadata: {
                    failureCount: this.circuitBreaker.failureCount,
                    threshold: this.circuitBreaker.threshold
                }
            })
        }
    }

    /**
     * Handle circuit breaker on error
     */
    handleCircuitBreaker(error) {
        this.circuitBreaker.failureCount++
        this.circuitBreaker.lastFailureTime = Date.now()
        
        logger.warn('Circuit breaker failure recorded', {
            metadata: {
                failureCount: this.circuitBreaker.failureCount,
                error: error.message
            }
        })
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        setInterval(() => {
            this.generatePerformanceReport()
        }, 60000) // Generate report every minute
    }

    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(results, processingTime) {
        const successCount = results.filter(r => r.success).length
        const totalCount = results.length
        
        this.performanceMetrics.totalChecks += totalCount
        this.performanceMetrics.successfulChecks += successCount
        this.performanceMetrics.failedChecks += (totalCount - successCount)
        
        // Update average response time
        const avgResponseTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / totalCount
        this.performanceMetrics.averageResponseTime = this.performanceMetrics.averageResponseTime
            ? (this.performanceMetrics.averageResponseTime * 0.8) + (avgResponseTime * 0.2)
            : avgResponseTime
        
        // Update memory usage
        if (process.memoryUsage) {
            const memUsage = process.memoryUsage().heapUsed
            this.performanceMetrics.peakMemoryUsage = Math.max(
                this.performanceMetrics.peakMemoryUsage,
                memUsage
            )
        }
    }

    /**
     * Update worker pool metrics
     */
    updateWorkerPoolMetrics(pool, results, processingTime) {
        const successCount = results.filter(r => r.success).length
        const totalCount = results.length
        
        pool.performance.totalProcessed += totalCount
        pool.performance.errorRate = pool.performance.errorRate
            ? (pool.performance.errorRate * 0.9) + ((totalCount - successCount) / totalCount * 0.1)
            : (totalCount - successCount) / totalCount
        
        pool.performance.averageTime = pool.performance.averageTime
            ? (pool.performance.averageTime * 0.8) + (processingTime * 0.2)
            : processingTime
    }

    /**
     * Calculate system throughput
     */
    calculateThroughput() {
        const directoriesPerHour = this.directories.length * (3600000 / 30000) // Assuming 30s average interval
        return {
            directoriesPerHour,
            directoriesPerDay: directoriesPerHour * 24,
            estimatedCapacity: this.maxConcurrentChecks * 120 // 120 checks per hour per worker
        }
    }

    /**
     * Generate performance report
     */
    generatePerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            systemMetrics: {
                totalDirectories: this.directories.length,
                activeConnections: this.resourceMonitor.activeConnections,
                cpuUsage: this.resourceMonitor.cpuUsage,
                memoryUsage: this.resourceMonitor.memoryUsage,
                queueDepth: this.resourceMonitor.queueDepth
            },
            performanceMetrics: {
                ...this.performanceMetrics,
                successRate: this.performanceMetrics.totalChecks > 0
                    ? this.performanceMetrics.successfulChecks / this.performanceMetrics.totalChecks
                    : 0
            },
            circuitBreaker: {
                isOpen: this.circuitBreaker.isOpen,
                failureCount: this.circuitBreaker.failureCount
            },
            workerPools: Array.from(this.workerPools.entries()).map(([category, pool]) => ({
                category,
                size: pool.size,
                activeWorkers: pool.activeWorkers,
                performance: pool.performance
            }))
        }
        
        // Log performance summary
        logger.info('Performance report generated', {
            metadata: {
                cpuUsage: report.systemMetrics.cpuUsage,
                successRate: report.performanceMetrics.successRate,
                avgResponseTime: report.performanceMetrics.averageResponseTime,
                totalChecks: report.performanceMetrics.totalChecks
            }
        })
        
        return report
    }

    /**
     * Get scaled monitoring status
     */
    getScaledMonitoringStatus() {
        const baseStatus = super.getMonitoringStatus()
        
        return {
            ...baseStatus,
            scalingMetrics: {
                maxConcurrentChecks: this.maxConcurrentChecks,
                activeConnections: this.resourceMonitor.activeConnections,
                cpuUsage: this.resourceMonitor.cpuUsage,
                memoryUsage: this.resourceMonitor.memoryUsage,
                queueDepth: this.resourceMonitor.queueDepth,
                circuitBreakerOpen: this.circuitBreaker.isOpen,
                workerPoolCount: this.workerPools.size,
                throughput: this.calculateThroughput()
            },
            performanceMetrics: this.performanceMetrics
        }
    }

    /**
     * Optimize resource usage dynamically
     */
    async optimizeResourceUsage() {
        try {
            const currentUsage = this.resourceMonitor.cpuUsage
            
            if (currentUsage > this.resourceThreshold) {
                // Reduce concurrency
                this.maxConcurrentChecks = Math.max(5, Math.floor(this.maxConcurrentChecks * 0.8))
                
                // Increase intervals
                Object.keys(this.schedulingIntervals).forEach(priority => {
                    this.schedulingIntervals[priority] *= 1.3
                })
                
                logger.warn('Resource optimization: Reduced system load', {
                    metadata: {
                        newConcurrency: this.maxConcurrentChecks,
                        cpuUsage: currentUsage
                    }
                })
            } else if (currentUsage < this.resourceThreshold * 0.3) {
                // Increase concurrency if system is underutilized
                this.maxConcurrentChecks = Math.min(30, Math.floor(this.maxConcurrentChecks * 1.2))
                
                logger.info('Resource optimization: Increased system capacity', {
                    metadata: {
                        newConcurrency: this.maxConcurrentChecks,
                        cpuUsage: currentUsage
                    }
                })
            }
            
        } catch (error) {
            logger.error('Failed to optimize resource usage', {}, error)
        }
    }

    /**
     * Stop scaled monitoring
     */
    stopScaledMonitoring() {
        super.stopMonitoring()
        
        // Clear worker pools
        this.workerPools.clear()
        
        // Reset circuit breaker
        this.circuitBreaker.isOpen = false
        this.circuitBreaker.failureCount = 0
        
        logger.info('Scaled monitoring stopped')
    }
}

/**
 * Semaphore for concurrency control
 */
class Semaphore {
    constructor(permits) {
        this.permits = permits
        this.waiting = []
    }
    
    async acquire() {
        if (this.permits > 0) {
            this.permits--
            return
        }
        
        return new Promise(resolve => {
            this.waiting.push(resolve)
        })
    }
    
    release() {
        if (this.waiting.length > 0) {
            const resolve = this.waiting.shift()
            resolve()
        } else {
            this.permits++
        }
    }
}

export default ScaledDirectoryMonitor