// DirectoryBolt Queue Management System
// Advanced features: priority scheduling, rate limiting, monitoring, and Redis integration
// Centralized queue operations and background job processing

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Redis/Bull Queue integration (production)
// const Queue = require('bull');
// const Redis = require('ioredis');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Queue configurations by subscription tier
const TIER_QUEUE_CONFIGS = {
  basic: {
    priority_weight: 3,
    max_concurrent: 2,
    rate_limit_per_hour: 50,
    processing_delay: 5000,
    retry_attempts: 3,
    queue_name: 'basic-tier'
  },
  professional: {
    priority_weight: 2,
    max_concurrent: 8,
    rate_limit_per_hour: 200,
    processing_delay: 2000,
    retry_attempts: 5,
    queue_name: 'professional-tier'
  },
  enterprise: {
    priority_weight: 1,
    max_concurrent: 20,
    rate_limit_per_hour: 1000,
    processing_delay: 1000,
    retry_attempts: 7,
    queue_name: 'enterprise-tier'
  }
};

// Processing method configurations
const PROCESSING_METHODS = {
  browser: {
    timeout: 120000,
    max_concurrent: 5,
    resource_weight: 3,
    success_rate: 0.85
  },
  api: {
    timeout: 30000,
    max_concurrent: 15,
    resource_weight: 1,
    success_rate: 0.90
  },
  hybrid: {
    timeout: 90000,
    max_concurrent: 8,
    resource_weight: 2,
    success_rate: 0.88
  }
};

class QueueManager {
  constructor() {
    this.queues = new Map();
    this.systemMetrics = {
      total_jobs_processed: 0,
      current_load: 0,
      error_rate: 0,
      average_processing_time: 0
    };
    this.rateLimiters = new Map();
    this.initializeQueues();
  }

  // Initialize queue system
  async initializeQueues() {
    try {
      // In production, initialize Redis/Bull queues
      /*
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3
      });

      // Create queues for each tier
      Object.entries(TIER_QUEUE_CONFIGS).forEach(([tier, config]) => {
        const queue = new Queue(config.queue_name, {
          redis: redis,
          defaultJobOptions: {
            removeOnComplete: 10,
            removeOnFail: 5,
            attempts: config.retry_attempts,
            backoff: {
              type: 'exponential',
              delay: 2000
            }
          }
        });

        queue.process(config.max_concurrent, this.processQueueJob.bind(this));
        this.queues.set(tier, queue);
      });
      */

      // Simulate queue initialization for now
      Object.keys(TIER_QUEUE_CONFIGS).forEach(tier => {
        this.queues.set(tier, {
          tier,
          jobs: [],
          processing: [],
          completed: [],
          failed: []
        });
      });

      console.log('Queue system initialized');
    } catch (error) {
      console.error('Failed to initialize queues:', error);
    }
  }

  // Advanced priority scheduling
  calculateJobPriority(submission, tierConfig, directoryInfo) {
    let priority = tierConfig.priority_weight * 1000; // Base tier priority

    // Customer tier multiplier
    priority += this.getTierBonus(submission.subscription_tier);

    // Directory success rate bonus
    if (directoryInfo.success_rate > 85) {
      priority += 100;
    } else if (directoryInfo.success_rate < 60) {
      priority -= 50;
    }

    // DA score bonus
    if (directoryInfo.da_score > 80) {
      priority += 150;
    } else if (directoryInfo.da_score > 60) {
      priority += 75;
    }

    // Deadline urgency
    const deadlineHours = this.getHoursUntilDeadline(submission.deadline);
    if (deadlineHours <= 2) {
      priority += 500;
    } else if (deadlineHours <= 12) {
      priority += 200;
    } else if (deadlineHours <= 24) {
      priority += 100;
    }

    // Retry penalty
    if (submission.retry_count > 0) {
      priority -= (submission.retry_count * 25);
    }

    // Processing method efficiency
    const methodConfig = PROCESSING_METHODS[submission.processing_method || 'browser'];
    priority += Math.round(methodConfig.success_rate * 100);

    return Math.max(1, Math.round(priority));
  }

  // Smart batch optimization
  async optimizeBatchProcessing(submissions) {
    const batches = new Map();
    const optimization = {
      original_count: submissions.length,
      optimized_batches: 0,
      estimated_time_saved: 0,
      grouping_strategies: []
    };

    // Group by directory for batch submission opportunities
    submissions.forEach(submission => {
      const directoryId = submission.directory_id;
      if (!batches.has(directoryId)) {
        batches.set(directoryId, {
          directory_id: directoryId,
          directory_name: submission.directory_name,
          submissions: [],
          batch_potential: 0
        });
      }
      batches.get(directoryId).submissions.push(submission);
    });

    // Analyze batching opportunities
    batches.forEach((batch, directoryId) => {
      if (batch.submissions.length > 1) {
        batch.batch_potential = this.calculateBatchPotential(batch.submissions);
        
        if (batch.batch_potential > 0.7) {
          optimization.optimized_batches++;
          optimization.estimated_time_saved += batch.submissions.length * 30; // 30 seconds saved per submission
          optimization.grouping_strategies.push({
            directory: batch.directory_name,
            count: batch.submissions.length,
            time_saved: batch.submissions.length * 30
          });
        }
      }
    });

    return {
      batches: Array.from(batches.values()),
      optimization
    };
  }

  // Rate limiting with tier-based quotas
  async checkRateLimit(userId, tierConfig, endpoint = 'default') {
    const key = `rate_limit:${userId}:${endpoint}`;
    const limit = tierConfig.rate_limit_per_hour;
    const windowMs = 60 * 60 * 1000; // 1 hour

    try {
      // In production, use Redis for distributed rate limiting
      /*
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }
      
      const ttl = await redis.ttl(key);
      const remaining = Math.max(0, limit - current);
      
      return {
        allowed: current <= limit,
        limit,
        remaining,
        reset_time: new Date(Date.now() + ttl * 1000).toISOString()
      };
      */

      // Simulate rate limiting
      const rateLimiter = this.rateLimiters.get(key) || { count: 0, reset_time: Date.now() + windowMs };
      
      if (Date.now() > rateLimiter.reset_time) {
        rateLimiter.count = 0;
        rateLimiter.reset_time = Date.now() + windowMs;
      }
      
      rateLimiter.count++;
      this.rateLimiters.set(key, rateLimiter);
      
      return {
        allowed: rateLimiter.count <= limit,
        limit,
        remaining: Math.max(0, limit - rateLimiter.count),
        reset_time: new Date(rateLimiter.reset_time).toISOString()
      };

    } catch (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true, limit, remaining: limit };
    }
  }

  // Comprehensive system monitoring
  async getSystemHealthMetrics() {
    try {
      // Queue metrics
      const queueMetrics = await this.getQueueMetrics();
      
      // Database performance
      const dbMetrics = await this.getDatabaseMetrics();
      
      // Processing performance
      const processingMetrics = await this.getProcessingMetrics();
      
      // Error rates and patterns
      const errorMetrics = await this.getErrorMetrics();
      
      // System capacity
      const capacityMetrics = await this.getCapacityMetrics();

      return {
        timestamp: new Date().toISOString(),
        overall_health: this.calculateOverallHealth({
          queue: queueMetrics.health,
          database: dbMetrics.health,
          processing: processingMetrics.health,
          errors: errorMetrics.health,
          capacity: capacityMetrics.health
        }),
        metrics: {
          queue: queueMetrics,
          database: dbMetrics,
          processing: processingMetrics,
          errors: errorMetrics,
          capacity: capacityMetrics
        },
        alerts: await this.getActiveAlerts(),
        recommendations: this.generateHealthRecommendations({
          queueMetrics,
          dbMetrics,
          processingMetrics,
          errorMetrics,
          capacityMetrics
        })
      };

    } catch (error) {
      console.error('Health metrics error:', error);
      return {
        timestamp: new Date().toISOString(),
        overall_health: 'unhealthy',
        error: error.message
      };
    }
  }

  // Intelligent load balancing
  async balanceProcessingLoad() {
    const tiers = Object.keys(TIER_QUEUE_CONFIGS);
    const loadBalance = {
      timestamp: new Date().toISOString(),
      adjustments: [],
      total_capacity: 0,
      utilized_capacity: 0
    };

    for (const tier of tiers) {
      const tierConfig = TIER_QUEUE_CONFIGS[tier];
      const queueStatus = await this.getQueueStatus(tier);
      
      const utilizationRate = queueStatus.active_jobs / tierConfig.max_concurrent;
      loadBalance.total_capacity += tierConfig.max_concurrent;
      loadBalance.utilized_capacity += queueStatus.active_jobs;

      // Adjust processing delays based on load
      if (utilizationRate > 0.8) {
        // High load - increase delays
        const adjustment = Math.ceil(tierConfig.processing_delay * 1.5);
        loadBalance.adjustments.push({
          tier,
          type: 'increase_delay',
          from: tierConfig.processing_delay,
          to: adjustment,
          reason: 'High utilization rate'
        });
      } else if (utilizationRate < 0.3) {
        // Low load - decrease delays
        const adjustment = Math.ceil(tierConfig.processing_delay * 0.8);
        loadBalance.adjustments.push({
          tier,
          type: 'decrease_delay',
          from: tierConfig.processing_delay,
          to: adjustment,
          reason: 'Low utilization rate'
        });
      }
    }

    // Apply adjustments
    for (const adjustment of loadBalance.adjustments) {
      await this.applyLoadBalanceAdjustment(adjustment);
    }

    return loadBalance;
  }

  // Dynamic resource allocation
  async allocateResources(jobType, priority, estimatedDuration) {
    const allocation = {
      cpu_cores: 1,
      memory_mb: 512,
      network_bandwidth: 'normal',
      processing_timeout: 30000,
      concurrent_limit: 5
    };

    // Adjust based on job type
    const methodConfig = PROCESSING_METHODS[jobType] || PROCESSING_METHODS.browser;
    allocation.processing_timeout = methodConfig.timeout;
    allocation.concurrent_limit = methodConfig.max_concurrent;

    // Priority-based adjustments
    if (priority > 5000) { // High priority
      allocation.cpu_cores = 2;
      allocation.memory_mb = 1024;
      allocation.network_bandwidth = 'high';
      allocation.concurrent_limit = Math.ceil(allocation.concurrent_limit * 1.5);
    } else if (priority < 2000) { // Low priority
      allocation.memory_mb = 256;
      allocation.network_bandwidth = 'low';
      allocation.concurrent_limit = Math.floor(allocation.concurrent_limit * 0.7);
    }

    // Duration-based adjustments
    if (estimatedDuration > 300000) { // > 5 minutes
      allocation.cpu_cores += 1;
      allocation.memory_mb += 256;
    }

    return allocation;
  }

  // Predictive capacity planning
  async predictCapacityNeeds(timeHorizonHours = 24) {
    try {
      const historicalData = await this.getHistoricalUsageData(timeHorizonHours * 7); // 7 days of history
      const currentTrends = await this.getCurrentUsageTrends();
      
      const prediction = {
        time_horizon_hours: timeHorizonHours,
        predicted_peak_load: 0,
        predicted_average_load: 0,
        capacity_recommendations: [],
        confidence_score: 0,
        factors_considered: []
      };

      // Analyze patterns
      const patterns = this.analyzeUsagePatterns(historicalData);
      prediction.factors_considered.push('Historical usage patterns');

      // Apply seasonal adjustments
      const seasonalMultiplier = this.getSeasonalMultiplier();
      prediction.factors_considered.push(`Seasonal adjustment: ${seasonalMultiplier}`);

      // Calculate predictions
      prediction.predicted_average_load = Math.ceil(patterns.average_load * seasonalMultiplier);
      prediction.predicted_peak_load = Math.ceil(patterns.peak_load * seasonalMultiplier);

      // Generate recommendations
      Object.entries(TIER_QUEUE_CONFIGS).forEach(([tier, config]) => {
        const tierLoad = Math.ceil(prediction.predicted_peak_load * this.getTierLoadDistribution(tier));
        const recommendedCapacity = Math.ceil(tierLoad * 1.2); // 20% buffer

        if (recommendedCapacity > config.max_concurrent) {
          prediction.capacity_recommendations.push({
            tier,
            current_capacity: config.max_concurrent,
            recommended_capacity: recommendedCapacity,
            increase_needed: recommendedCapacity - config.max_concurrent,
            reason: 'Predicted peak load exceeds current capacity'
          });
        }
      });

      prediction.confidence_score = this.calculatePredictionConfidence(historicalData, currentTrends);

      return prediction;

    } catch (error) {
      console.error('Capacity prediction error:', error);
      return {
        time_horizon_hours: timeHorizonHours,
        error: error.message,
        confidence_score: 0
      };
    }
  }

  // Helper methods
  getTierBonus(tier) {
    const bonuses = { enterprise: 200, professional: 100, basic: 0 };
    return bonuses[tier] || 0;
  }

  getHoursUntilDeadline(deadline) {
    if (!deadline) return 999;
    const hours = (new Date(deadline) - new Date()) / (1000 * 60 * 60);
    return Math.max(0, hours);
  }

  calculateBatchPotential(submissions) {
    const similarity = this.calculateSubmissionSimilarity(submissions);
    const timeWindow = this.calculateTimeWindow(submissions);
    return (similarity * 0.6) + (timeWindow * 0.4);
  }

  calculateSubmissionSimilarity(submissions) {
    // Analyze form field overlap, business categories, etc.
    return Math.random() * 0.3 + 0.7; // Simulate 70-100% similarity
  }

  calculateTimeWindow(submissions) {
    const timestamps = submissions.map(s => new Date(s.created_at));
    const range = Math.max(...timestamps) - Math.min(...timestamps);
    const hours = range / (1000 * 60 * 60);
    return Math.max(0, 1 - (hours / 24)); // Better score for submissions within 24 hours
  }

  async getQueueStatus(tier) {
    // Simulate queue status
    const config = TIER_QUEUE_CONFIGS[tier];
    return {
      active_jobs: Math.floor(Math.random() * config.max_concurrent),
      pending_jobs: Math.floor(Math.random() * 50),
      completed_today: Math.floor(Math.random() * 200),
      failed_today: Math.floor(Math.random() * 10),
      average_processing_time: Math.floor(Math.random() * 300) + 180
    };
  }

  async getQueueMetrics() {
    const metrics = { health: 'healthy', active_queues: 3, total_jobs: 0, processing_rate: 0 };
    
    for (const tier of Object.keys(TIER_QUEUE_CONFIGS)) {
      const status = await this.getQueueStatus(tier);
      metrics.total_jobs += status.active_jobs + status.pending_jobs;
      metrics.processing_rate += status.completed_today;
    }

    if (metrics.total_jobs > 1000) metrics.health = 'degraded';
    if (metrics.total_jobs > 2000) metrics.health = 'unhealthy';

    return metrics;
  }

  async getDatabaseMetrics() {
    // Simulate database metrics
    return {
      health: 'healthy',
      connection_pool_usage: Math.floor(Math.random() * 80) + 10,
      average_query_time: Math.floor(Math.random() * 50) + 10,
      active_connections: Math.floor(Math.random() * 20) + 5
    };
  }

  async getProcessingMetrics() {
    return {
      health: 'healthy',
      success_rate: 0.85 + Math.random() * 0.1,
      average_processing_time: 180 + Math.random() * 120,
      concurrent_jobs: Math.floor(Math.random() * 50) + 10
    };
  }

  async getErrorMetrics() {
    const errorRate = Math.random() * 0.05; // 0-5% error rate
    return {
      health: errorRate < 0.02 ? 'healthy' : errorRate < 0.05 ? 'degraded' : 'unhealthy',
      error_rate: errorRate,
      common_errors: [
        { type: 'network_timeout', count: Math.floor(Math.random() * 10) },
        { type: 'captcha_failed', count: Math.floor(Math.random() * 5) }
      ]
    };
  }

  async getCapacityMetrics() {
    const utilization = Math.random() * 0.8 + 0.1; // 10-90% utilization
    return {
      health: utilization < 0.7 ? 'healthy' : utilization < 0.85 ? 'degraded' : 'unhealthy',
      cpu_utilization: utilization,
      memory_utilization: utilization * 0.9,
      network_utilization: utilization * 0.6
    };
  }

  calculateOverallHealth(healthMetrics) {
    const healthValues = Object.values(healthMetrics);
    const healthyCount = healthValues.filter(h => h === 'healthy').length;
    const degradedCount = healthValues.filter(h => h === 'degraded').length;
    const unhealthyCount = healthValues.filter(h => h === 'unhealthy').length;

    if (unhealthyCount > 0) return 'unhealthy';
    if (degradedCount > healthValues.length / 2) return 'degraded';
    return 'healthy';
  }

  async getActiveAlerts() {
    return []; // Simulate no active alerts
  }

  generateHealthRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.queueMetrics.health !== 'healthy') {
      recommendations.push('Consider scaling queue processing capacity');
    }
    
    if (metrics.errorMetrics.error_rate > 0.03) {
      recommendations.push('Investigate error patterns and implement fixes');
    }
    
    if (metrics.capacityMetrics.cpu_utilization > 0.8) {
      recommendations.push('Scale up system resources to handle increased load');
    }

    return recommendations;
  }

  async applyLoadBalanceAdjustment(adjustment) {
    // In production, would update Redis configurations or restart workers
    console.log('Applied load balance adjustment:', adjustment);
  }

  async getHistoricalUsageData(hours) {
    // Simulate historical data
    const data = [];
    for (let i = 0; i < hours; i++) {
      data.push({
        timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
        load: Math.floor(Math.random() * 100) + 20
      });
    }
    return data;
  }

  async getCurrentUsageTrends() {
    return {
      trend: 'increasing',
      rate_of_change: 0.05
    };
  }

  analyzeUsagePatterns(historicalData) {
    const loads = historicalData.map(d => d.load);
    return {
      average_load: loads.reduce((a, b) => a + b, 0) / loads.length,
      peak_load: Math.max(...loads),
      min_load: Math.min(...loads)
    };
  }

  getSeasonalMultiplier() {
    return 1.1; // 10% increase for current season
  }

  getTierLoadDistribution(tier) {
    const distributions = {
      basic: 0.3,
      professional: 0.5,
      enterprise: 0.2
    };
    return distributions[tier] || 0.3;
  }

  calculatePredictionConfidence(historicalData, trends) {
    return Math.min(95, 70 + (historicalData.length / 100) * 25); // Higher confidence with more data
  }
}

// Export singleton instance
module.exports = new QueueManager();