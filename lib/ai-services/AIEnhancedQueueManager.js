/**
 * 🤖 AI-ENHANCED QUEUE MANAGER
 * 
 * Integrates AI services with queue management for intelligent prioritization and optimization.
 * Features:
 * - AI-driven priority scoring
 * - Success probability-based queue ordering
 * - Optimal timing integration
 * - Dynamic priority adjustment
 * - Load balancing with AI insights
 * - Performance-based queue optimization
 */

const QueueManager = require('../batch-processing/QueueManager');
const SuccessProbabilityCalculator = require('./SuccessProbabilityCalculator');
const SubmissionTimingOptimizer = require('./SubmissionTimingOptimizer');
const DescriptionCustomizer = require('./DescriptionCustomizer');
const IntelligentRetryAnalyzer = require('./IntelligentRetryAnalyzer');
const PerformanceFeedbackLoop = require('./PerformanceFeedbackLoop');

class AIEnhancedQueueManager extends QueueManager {
  constructor(options = {}) {
    super(options);
    
    this.aiConfig = {
      enableAIPrioritization: options.enableAIPrioritization !== false,
      enableTimingOptimization: options.enableTimingOptimization !== false,
      enableDynamicCustomization: options.enableDynamicCustomization !== false,
      priorityRefreshInterval: options.priorityRefreshInterval || 30 * 60 * 1000, // 30 minutes
      batchSize: options.batchSize || 10,
      ...options.aiConfig
    };
    
    // Initialize AI services
    this.probabilityCalculator = new SuccessProbabilityCalculator(options.aiConfig);
    this.timingOptimizer = new SubmissionTimingOptimizer(options.aiConfig);
    this.descriptionCustomizer = new DescriptionCustomizer(options.aiConfig);
    this.retryAnalyzer = new IntelligentRetryAnalyzer(options.aiConfig);
    this.feedbackLoop = new PerformanceFeedbackLoop(options.aiConfig);
    
    // AI-enhanced queue state
    this.aiPriorityScores = new Map(); // Job ID -> AI priority score
    this.optimalTimings = new Map(); // Job ID -> optimal timing data
    this.customizedContent = new Map(); // Job ID -> customized content
    this.retryStrategies = new Map(); // Job ID -> retry strategy
    
    // Performance tracking
    this.aiMetrics = {
      prioritizationAccuracy: 0,
      timingOptimizationSuccess: 0,
      customizationImpact: 0,
      totalAIProcessedJobs: 0
    };
    
    this.initializeAIEnhancements();
  }
  
  async initializeAIEnhancements() {
    console.log('🤖 Initializing AI-Enhanced Queue Manager...');
    
    try {
      // Start AI-driven priority refresh
      if (this.aiConfig.enableAIPrioritization) {
        this.startAIPriorityRefresh();
      }
      
      // Initialize performance monitoring
      this.startPerformanceMonitoring();
      
      console.log('✅ AI enhancements initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize AI enhancements:', error);
      throw error;
    }
  }
  
  /**
   * Enhanced enqueue with AI prioritization
   */
  async enqueue(job) {
    try {
      // Validate and normalize job first
      const normalizedJob = this.normalizeJob(job);
      
      // Apply AI enhancements if enabled
      if (this.aiConfig.enableAIPrioritization) {
        await this.applyAIEnhancements(normalizedJob);
      }
      
      // Call parent enqueue method
      const jobId = super.enqueue(normalizedJob);
      
      // Process AI optimizations asynchronously
      this.processAIOptimizationsAsync(jobId, normalizedJob);
      
      return jobId;
      
    } catch (error) {
      console.error('AI-enhanced enqueue failed:', error);
      // Fallback to standard enqueue
      return super.enqueue(job);
    }
  }
  
  /**
   * AI-enhanced dequeue with intelligent prioritization
   */
  dequeue() {
    try {
      if (!this.aiConfig.enableAIPrioritization) {
        return super.dequeue();
      }
      
      // Get AI-optimized job
      const job = this.getAIOptimizedJob();
      
      if (job) {
        this.processingJobs.add(job.id);
        this.emit('jobDequeued', {
          job_id: job.id,
          priority: job.priority,
          ai_enhanced: true,
          ai_score: this.aiPriorityScores.get(job.id) || 0
        });
        
        // Track AI dequeue for performance metrics
        this.aiMetrics.totalAIProcessedJobs++;
        
        return job;
      }
      
      // Fallback to standard dequeue
      return super.dequeue();
      
    } catch (error) {
      console.error('AI-enhanced dequeue failed:', error);
      return super.dequeue();
    }
  }
  
  /**
   * Apply AI enhancements to job during enqueue
   */
  async applyAIEnhancements(job) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      console.log(`🤖 [${requestId}] Applying AI enhancements to job: ${job.id}`);
      
      // Calculate success probability
      const probabilityResult = await this.calculateJobSuccessProbability(job);
      
      // Adjust priority based on success probability
      if (probabilityResult.success) {
        const aiAdjustedPriority = this.calculateAIAdjustedPriority(
          job.priority,
          probabilityResult.probability,
          probabilityResult.confidence
        );
        
        job.priority = aiAdjustedPriority;
        this.aiPriorityScores.set(job.id, {
          originalPriority: job.priority,
          aiScore: probabilityResult.probability,
          confidence: probabilityResult.confidence,
          adjustedPriority: aiAdjustedPriority
        });
      }
      
      console.log(`✅ [${requestId}] AI enhancements applied in ${Date.now() - startTime}ms`);
      
    } catch (error) {
      console.warn(`⚠️ [${requestId}] AI enhancement failed, using fallback:`, error);
    }
  }
  
  /**
   * Process AI optimizations asynchronously (non-blocking)
   */
  async processAIOptimizationsAsync(jobId, job) {
    try {
      // Process in parallel without blocking the main queue
      const optimizations = await Promise.allSettled([
        this.optimizeJobTiming(jobId, job),
        this.customizeJobContent(jobId, job),
        this.prepareRetryStrategy(jobId, job)
      ]);
      
      // Log optimization results
      const successful = optimizations.filter(result => result.status === 'fulfilled').length;
      console.log(`🔧 Job ${jobId}: ${successful}/${optimizations.length} AI optimizations completed`);
      
    } catch (error) {
      console.error('Async AI optimization failed:', error);
    }
  }
  
  /**
   * Calculate job success probability
   */
  async calculateJobSuccessProbability(job) {
    try {
      if (!job.data || !job.data.directoryId || !job.data.businessData) {
        return { success: false, error: 'Insufficient job data for AI analysis' };
      }
      
      const submissionData = {
        business: job.data.businessData,
        directory: job.data.directoryData || { id: job.data.directoryId },
        metadata: job.metadata || {}
      };
      
      const result = await this.probabilityCalculator.calculateSuccessProbability(submissionData);
      
      return {
        success: true,
        probability: result.probability,
        confidence: result.confidence,
        factors: result.factors,
        recommendations: result.recommendations
      };
      
    } catch (error) {
      console.warn('Success probability calculation failed:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Optimize job timing
   */
  async optimizeJobTiming(jobId, job) {
    try {
      if (!this.aiConfig.enableTimingOptimization || !job.data.directoryId) {
        return;
      }
      
      const timingResult = await this.timingOptimizer.getOptimalTiming(
        job.data.directoryId,
        this.mapPriorityToTimingPriority(job.priority)
      );
      
      if (timingResult.optimalWindows && timingResult.optimalWindows.length > 0) {
        const bestWindow = timingResult.optimalWindows[0];
        
        // Schedule job for optimal time if it's in the future
        if (new Date(bestWindow.windowStart) > new Date()) {
          job.scheduled_at = bestWindow.windowStart;
          this.optimalTimings.set(jobId, {
            originalTime: job.created_at,
            optimizedTime: bestWindow.windowStart,
            reason: 'AI timing optimization',
            confidence: bestWindow.confidence
          });
        }
      }
      
    } catch (error) {
      console.warn('Timing optimization failed:', error);
    }
  }
  
  /**
   * Customize job content
   */
  async customizeJobContent(jobId, job) {
    try {
      if (!this.aiConfig.enableDynamicCustomization || 
          !job.data.businessData || 
          !job.data.directoryId) {
        return;
      }
      
      const customizationRequest = {
        directoryId: job.data.directoryId,
        businessData: job.data.businessData,
        originalDescription: job.data.businessData.description,
        requirements: job.data.requirements || {}
      };
      
      const customizationResult = await this.descriptionCustomizer.customizeDescription(customizationRequest);
      
      if (customizationResult.primaryCustomization) {
        this.customizedContent.set(jobId, {
          original: customizationRequest.originalDescription,
          customized: customizationResult.primaryCustomization.description,
          variations: customizationResult.variations,
          strategy: customizationResult.customizationStrategy,
          confidence: customizationResult.primaryCustomization.confidence
        });
        
        // Update job data with customized content
        job.data.businessData.description = customizationResult.primaryCustomization.description;
      }
      
    } catch (error) {
      console.warn('Content customization failed:', error);
    }
  }
  
  /**
   * Prepare retry strategy
   */
  async prepareRetryStrategy(jobId, job) {
    try {
      // Pre-calculate retry strategy in case job fails
      const retryStrategy = {
        maxAttempts: this.getMaxAttemptsForPriority(job.priority),
        baseDelay: this.getBaseDelayForPriority(job.priority),
        backoffStrategy: 'exponential',
        aiEnhanced: true,
        preparedAt: new Date().toISOString()
      };
      
      this.retryStrategies.set(jobId, retryStrategy);
      
    } catch (error) {
      console.warn('Retry strategy preparation failed:', error);
    }
  }
  
  /**
   * Get AI-optimized job from queue
   */
  getAIOptimizedJob() {
    const allJobsWithScores = [];
    
    // Collect all jobs with their AI scores
    for (let priority = 1; priority <= this.config.priorityLevels; priority++) {
      const priorityQueue = this.queues.get(priority);
      if (priorityQueue && priorityQueue.length > 0) {
        priorityQueue.forEach(job => {
          const aiScore = this.aiPriorityScores.get(job.id);
          allJobsWithScores.push({
            job,
            originalPriority: priority,
            aiScore: aiScore ? aiScore.aiScore : 0.5,
            confidence: aiScore ? aiScore.confidence : 0.5,
            combinedScore: this.calculateCombinedScore(job, aiScore)
          });
        });
      }
    }
    
    if (allJobsWithScores.length === 0) {
      return null;
    }
    
    // Sort by combined score (higher is better)
    allJobsWithScores.sort((a, b) => b.combinedScore - a.combinedScore);
    
    // Get the best job and remove it from its original queue
    const bestJobData = allJobsWithScores[0];
    const job = bestJobData.job;
    
    // Remove from original queue
    const originalQueue = this.queues.get(bestJobData.originalPriority);
    const jobIndex = originalQueue.findIndex(j => j.id === job.id);
    if (jobIndex !== -1) {
      originalQueue.splice(jobIndex, 1);
    }
    
    return job;
  }
  
  /**
   * Calculate combined score for AI-enhanced prioritization
   */
  calculateCombinedScore(job, aiScore) {
    const basePriority = (6 - job.priority) / 5; // Convert priority 1-5 to score 1-0
    const successProbability = aiScore ? aiScore.aiScore : 0.5;
    const confidence = aiScore ? aiScore.confidence : 0.5;
    
    // Age factor - older jobs get slight boost
    const age = Date.now() - new Date(job.created_at).getTime();
    const ageHours = age / (1000 * 60 * 60);
    const ageFactor = Math.min(1.2, 1 + (ageHours / 24) * 0.1); // Max 20% boost after 2 days
    
    // Combine factors
    const combinedScore = (
      basePriority * 0.4 +           // Original priority weight
      successProbability * 0.4 +     // AI success prediction weight
      confidence * 0.2               // Confidence in AI prediction weight
    ) * ageFactor;
    
    return combinedScore;
  }
  
  /**
   * Calculate AI-adjusted priority
   */
  calculateAIAdjustedPriority(originalPriority, successProbability, confidence) {
    // Only adjust if we have high confidence in the AI prediction
    if (confidence < 0.6) {
      return originalPriority;
    }
    
    // Adjust priority based on success probability
    if (successProbability > 0.8) {
      // High success probability - increase priority (lower number)
      return Math.max(1, originalPriority - 1);
    } else if (successProbability < 0.3) {
      // Low success probability - decrease priority (higher number)
      return Math.min(5, originalPriority + 1);
    }
    
    return originalPriority;
  }
  
  /**
   * Enhanced failure handling with AI retry analysis
   */
  async markFailed(jobId, error, shouldRetry = true) {
    try {
      // Get job data for AI analysis
      const jobData = this.getJobData(jobId);
      
      if (shouldRetry && jobData) {
        // Use AI to analyze failure and determine retry strategy
        const failureAnalysis = await this.analyzeFailureWithAI(jobId, jobData, error);
        
        if (failureAnalysis.shouldRetry) {
          // Apply AI-enhanced retry strategy
          await this.applyAIRetryStrategy(jobId, jobData, failureAnalysis);
          return;
        }
      }
      
      // Fall back to standard failure handling
      super.markFailed(jobId, error, shouldRetry);
      
    } catch (analysisError) {
      console.error('AI failure analysis failed:', analysisError);
      super.markFailed(jobId, error, shouldRetry);
    }
  }
  
  /**
   * Analyze failure using AI
   */
  async analyzeFailureWithAI(jobId, jobData, error) {
    try {
      const failureData = {
        submissionId: jobId,
        directoryId: jobData.directoryId,
        businessName: jobData.businessName,
        businessCategory: jobData.businessCategory,
        businessDescription: jobData.businessDescription,
        rejectionReason: error.message,
        attemptNumber: jobData.retry_count || 1,
        submittedAt: jobData.created_at
      };
      
      const analysis = await this.retryAnalyzer.analyzeFailureAndRecommendRetry(failureData);
      
      return {
        shouldRetry: analysis.retryRecommendation,
        retryStrategy: analysis.retryStrategy,
        improvements: analysis.improvements,
        timing: analysis.optimalTiming,
        confidence: analysis.confidence
      };
      
    } catch (error) {
      console.error('AI failure analysis failed:', error);
      return { shouldRetry: true }; // Fallback to retry
    }
  }
  
  /**
   * Apply AI-enhanced retry strategy
   */
  async applyAIRetryStrategy(jobId, jobData, failureAnalysis) {
    const retryJob = {
      ...jobData,
      retry_count: (jobData.retry_count || 0) + 1,
      last_error: failureAnalysis.retryStrategy.reasoning || 'AI-analyzed failure',
      scheduled_at: failureAnalysis.timing.retryDate,
      ai_enhanced: true,
      ai_improvements: failureAnalysis.improvements
    };
    
    // Apply content improvements if suggested
    if (failureAnalysis.improvements.contentChanges && 
        failureAnalysis.improvements.contentChanges.length > 0) {
      // Request content customization with improvements
      await this.customizeJobContent(jobId, retryJob);
    }
    
    // Schedule the retry
    this.scheduleJob(retryJob);
    
    this.emit('aiEnhancedRetry', {
      job_id: jobId,
      retry_count: retryJob.retry_count,
      success_probability: failureAnalysis.retryStrategy.successProbability,
      scheduled_for: retryJob.scheduled_at
    });
  }
  
  /**
   * Start AI priority refresh cycle
   */
  startAIPriorityRefresh() {
    this.priorityRefreshInterval = setInterval(async () => {
      try {
        await this.refreshAIPriorities();
      } catch (error) {
        console.error('AI priority refresh failed:', error);
      }
    }, this.aiConfig.priorityRefreshInterval);
  }
  
  /**
   * Refresh AI priorities for pending jobs
   */
  async refreshAIPriorities() {
    console.log('🔄 Refreshing AI priorities for pending jobs...');
    
    const jobsToRefresh = [];
    
    // Collect jobs that need priority refresh
    for (let priority = 1; priority <= this.config.priorityLevels; priority++) {
      const priorityQueue = this.queues.get(priority);
      if (priorityQueue && priorityQueue.length > 0) {
        // Only refresh jobs older than 1 hour
        const cutoff = Date.now() - 60 * 60 * 1000;
        const oldJobs = priorityQueue.filter(job => 
          new Date(job.created_at).getTime() < cutoff
        );
        jobsToRefresh.push(...oldJobs);
      }
    }
    
    if (jobsToRefresh.length === 0) {
      return;
    }
    
    // Process in batches
    const batchSize = this.aiConfig.batchSize;
    for (let i = 0; i < jobsToRefresh.length; i += batchSize) {
      const batch = jobsToRefresh.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async job => {
        try {
          const probabilityResult = await this.calculateJobSuccessProbability(job);
          if (probabilityResult.success) {
            this.aiPriorityScores.set(job.id, {
              aiScore: probabilityResult.probability,
              confidence: probabilityResult.confidence,
              refreshedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.warn(`Failed to refresh priority for job ${job.id}:`, error);
        }
      }));
      
      // Small delay between batches to prevent overwhelming AI services
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ Refreshed AI priorities for ${jobsToRefresh.length} jobs`);
  }
  
  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.updateAIMetrics();
    }, 5 * 60 * 1000); // Update every 5 minutes
  }
  
  /**
   * Update AI performance metrics
   */
  updateAIMetrics() {
    // Calculate AI prioritization effectiveness
    // This would be based on actual submission success rates
    
    this.emit('aiMetricsUpdated', {
      metrics: this.aiMetrics,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get comprehensive queue statistics including AI metrics
   */
  getAIEnhancedStats() {
    const baseStats = super.getStats();
    
    return {
      ...baseStats,
      ai_enhancements: {
        enabled: this.aiConfig.enableAIPrioritization,
        jobs_with_ai_scores: this.aiPriorityScores.size,
        optimized_timings: this.optimalTimings.size,
        customized_content: this.customizedContent.size,
        retry_strategies: this.retryStrategies.size,
        performance_metrics: this.aiMetrics
      }
    };
  }
  
  // Helper methods
  mapPriorityToTimingPriority(queuePriority) {
    const priorityMap = {
      1: 'high',
      2: 'high',
      3: 'normal',
      4: 'normal',
      5: 'low'
    };
    return priorityMap[queuePriority] || 'normal';
  }
  
  getMaxAttemptsForPriority(priority) {
    const attemptMap = {
      1: 5, // High priority gets more attempts
      2: 4,
      3: 3,
      4: 2,
      5: 1  // Low priority gets fewer attempts
    };
    return attemptMap[priority] || 3;
  }
  
  getBaseDelayForPriority(priority) {
    const delayMap = {
      1: 30 * 60 * 1000, // 30 minutes for high priority
      2: 60 * 60 * 1000, // 1 hour
      3: 2 * 60 * 60 * 1000, // 2 hours
      4: 4 * 60 * 60 * 1000, // 4 hours
      5: 8 * 60 * 60 * 1000  // 8 hours for low priority
    };
    return delayMap[priority] || 2 * 60 * 60 * 1000;
  }
  
  generateRequestId() {
    return `ai_queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Enhanced shutdown with AI service cleanup
   */
  shutdown() {
    console.log('🛑 Shutting down AI-Enhanced Queue Manager...');
    
    // Clear AI-specific intervals
    if (this.priorityRefreshInterval) {
      clearInterval(this.priorityRefreshInterval);
    }
    
    // Clear AI data structures
    this.aiPriorityScores.clear();
    this.optimalTimings.clear();
    this.customizedContent.clear();
    this.retryStrategies.clear();
    
    // Call parent shutdown
    super.shutdown();
    
    console.log('✅ AI-Enhanced Queue Manager shutdown complete');
  }
}

module.exports = AIEnhancedQueueManager;