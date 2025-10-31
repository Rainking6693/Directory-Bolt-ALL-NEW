/**
 * 🎼 AI SUBMISSION ORCHESTRATOR
 * 
 * Orchestrates and integrates all AI services with the existing submission workflow.
 * Features:
 * - Unified AI service coordination
 * - Workflow integration and management
 * - Service health monitoring and failover
 * - Performance optimization across services
 * - Error handling and recovery
 * - Service dependency management
 */

const AIEnhancedQueueManager = require('./AIEnhancedQueueManager');
const SuccessProbabilityCalculator = require('./SuccessProbabilityCalculator');
const SubmissionTimingOptimizer = require('./SubmissionTimingOptimizer');
const DescriptionCustomizer = require('./DescriptionCustomizer');
const IntelligentRetryAnalyzer = require('./IntelligentRetryAnalyzer');
const ABTestingFramework = require('./ABTestingFramework');
const PerformanceFeedbackLoop = require('./PerformanceFeedbackLoop');

class AISubmissionOrchestrator {
  constructor(config = {}) {
    this.config = {
      enableAllAIServices: config.enableAllAIServices !== false,
      healthCheckInterval: config.healthCheckInterval || 5 * 60 * 1000, // 5 minutes
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000, // 1 minute
      maxConcurrentOperations: config.maxConcurrentOperations || 50,
      serviceTimeoutMs: config.serviceTimeoutMs || 30000, // 30 seconds
      ...config
    };
    
    // Initialize all AI services
    this.services = {};
    this.serviceHealth = new Map();
    this.circuitBreakers = new Map();
    this.operationQueue = [];
    this.activeOperations = new Set();
    
    // Service orchestration metrics
    this.orchestrationMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      serviceFailures: {},
      circuitBreakerTrips: 0
    };
    
    this.initializeOrchestrator();
  }
  
  async initializeOrchestrator() {
    console.log('🎼 Initializing AI Submission Orchestrator...');
    
    try {
      // Initialize all AI services
      await this.initializeAIServices();
      
      // Setup service health monitoring
      this.startHealthMonitoring();
      
      // Initialize circuit breakers
      this.initializeCircuitBreakers();
      
      // Start operation processing
      this.startOperationProcessing();
      
      console.log('✅ AI Submission Orchestrator initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize AI Orchestrator:', error);
      throw error;
    }
  }
  
  /**
   * Initialize all AI services
   */
  async initializeAIServices() {
    console.log('🤖 Initializing AI services...');
    
    try {
      // Enhanced Queue Manager (primary orchestration point)
      this.services.queueManager = new AIEnhancedQueueManager(this.config);
      
      // Core AI services
      this.services.probabilityCalculator = new SuccessProbabilityCalculator(this.config);
      this.services.timingOptimizer = new SubmissionTimingOptimizer(this.config);
      this.services.descriptionCustomizer = new DescriptionCustomizer(this.config);
      this.services.retryAnalyzer = new IntelligentRetryAnalyzer(this.config);
      this.services.abTesting = new ABTestingFramework(this.config);
      this.services.feedbackLoop = new PerformanceFeedbackLoop(this.config);
      
      // Initialize service health tracking
      Object.keys(this.services).forEach(serviceName => {
        this.serviceHealth.set(serviceName, {
          status: 'healthy',
          lastCheck: Date.now(),
          failures: 0,
          responseTime: 0
        });
      });
      
      console.log(`✅ Initialized ${Object.keys(this.services).length} AI services`);
      
    } catch (error) {
      console.error('Failed to initialize AI services:', error);
      throw error;
    }
  }
  
  /**
   * Process a submission with full AI enhancement
   */
  async processSubmission(submissionData) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      console.log(`🎼 [${requestId}] Processing AI-enhanced submission`);
      
      // Validate input
      this.validateSubmissionData(submissionData);
      
      // Create operation context
      const operationContext = {
        requestId,
        submissionData,
        startTime,
        phase: 'initialization',
        services: {},
        results: {},
        errors: []
      };
      
      // Execute AI workflow
      const result = await this.executeAIWorkflow(operationContext);
      
      // Record metrics
      this.recordOperationMetrics(operationContext, result);
      
      console.log(`✅ [${requestId}] AI submission processing complete in ${Date.now() - startTime}ms`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ [${requestId}] AI submission processing failed:`, error);
      this.orchestrationMetrics.failedRequests++;
      throw error;
    } finally {
      this.orchestrationMetrics.totalRequests++;
    }
  }
  
  /**
   * Execute the complete AI workflow
   */
  async executeAIWorkflow(context) {
    const { submissionData, requestId } = context;
    
    try {
      // Phase 1: Success Probability Analysis
      context.phase = 'probability_analysis';
      const probabilityResult = await this.executeServiceWithFallback(
        'probabilityCalculator',
        'calculateSuccessProbability',
        [submissionData],
        context
      );
      
      // Phase 2: Timing Optimization (if probability is acceptable)
      if (probabilityResult.success && probabilityResult.probability > 0.3) {
        context.phase = 'timing_optimization';
        const timingResult = await this.executeServiceWithFallback(
          'timingOptimizer',
          'getOptimalTiming',
          [submissionData.directory.id, 'normal'],
          context
        );
        context.results.timing = timingResult;
      }
      
      // Phase 3: Content Customization
      context.phase = 'content_customization';
      const customizationRequest = {
        directoryId: submissionData.directory.id,
        businessData: submissionData.business,
        originalDescription: submissionData.business.description
      };
      
      const customizationResult = await this.executeServiceWithFallback(
        'descriptionCustomizer',
        'customizeDescription',
        [customizationRequest],
        context
      );
      
      // Phase 4: A/B Test Assignment (if enabled)
      context.phase = 'ab_testing';
      const abTestResult = await this.executeServiceWithFallback(
        'abTesting',
        'assignSubmissionToVariant',
        [{ submissionId: requestId, ...submissionData }],
        context
      );
      
      // Phase 5: Queue with AI Enhancement
      context.phase = 'queue_processing';
      const queueJob = this.createQueueJob(submissionData, context.results);
      
      const jobId = await this.executeServiceWithFallback(
        'queueManager',
        'enqueue',
        [queueJob],
        context
      );
      
      // Compile final result
      const finalResult = {
        requestId,
        jobId,
        success: true,
        probabilityAnalysis: probabilityResult,
        contentCustomization: customizationResult,
        timingOptimization: context.results.timing,
        abTestAssignment: abTestResult,
        processingPhase: 'queued',
        estimatedProcessingTime: this.estimateProcessingTime(context.results),
        aiEnhancements: this.summarizeAIEnhancements(context.results)
      };
      
      // Send to feedback loop for learning
      await this.sendToFeedbackLoop(finalResult, 'submission_processed');
      
      return finalResult;
      
    } catch (error) {
      context.errors.push(error);
      return this.handleWorkflowFailure(context, error);
    }
  }
  
  /**
   * Execute service method with circuit breaker and fallback
   */
  async executeServiceWithFallback(serviceName, methodName, args, context) {
    const startTime = Date.now();
    
    try {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen(serviceName)) {
        throw new Error(`Circuit breaker open for service: ${serviceName}`);
      }
      
      // Check service health
      const healthStatus = this.serviceHealth.get(serviceName);
      if (healthStatus && healthStatus.status === 'unhealthy') {
        console.warn(`⚠️ Service ${serviceName} is unhealthy, attempting anyway`);
      }
      
      // Execute with timeout
      const service = this.services[serviceName];
      if (!service || typeof service[methodName] !== 'function') {
        throw new Error(`Service method ${serviceName}.${methodName} not available`);
      }
      
      const result = await this.executeWithTimeout(
        service[methodName].bind(service),
        args,
        this.config.serviceTimeoutMs
      );
      
      // Record success
      this.recordServiceSuccess(serviceName, Date.now() - startTime);
      context.services[serviceName] = { status: 'success', responseTime: Date.now() - startTime };
      
      return result;
      
    } catch (error) {
      // Record failure
      this.recordServiceFailure(serviceName, error);
      context.services[serviceName] = { status: 'error', error: error.message };
      
      // Apply fallback strategy
      return await this.applyFallbackStrategy(serviceName, methodName, args, context, error);
    }
  }
  
  /**
   * Apply fallback strategy when service fails
   */
  async applyFallbackStrategy(serviceName, methodName, args, context, originalError) {
    console.warn(`⚠️ Applying fallback for ${serviceName}.${methodName}:`, originalError.message);
    
    switch (serviceName) {
      case 'probabilityCalculator':
        return {
          success: true,
          probability: 0.5, // Default neutral probability
          confidence: 0.3,
          factors: {},
          fallback: true
        };
        
      case 'timingOptimizer':
        return {
          optimalWindows: [{
            windowStart: new Date().toISOString(),
            windowEnd: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            score: 0.5,
            confidence: 0.3
          }],
          fallback: true
        };
        
      case 'descriptionCustomizer':
        return {
          primaryCustomization: {
            description: args[0]?.originalDescription || 'Professional business description',
            confidence: 0.3,
            keyChanges: ['Fallback customization applied'],
            fallback: true
          },
          variations: []
        };
        
      case 'retryAnalyzer':
        return {
          retryRecommendation: true,
          retryStrategy: {
            primaryApproach: 'standard_retry',
            timing: { recommendedDelayHours: 24 }
          },
          fallback: true
        };
        
      case 'abTesting':
        return {
          assignments: {},
          experimentCount: 0,
          fallback: true
        };
        
      case 'queueManager':
        // For queue manager, we need to fail gracefully
        throw new Error('Queue manager failure - cannot process submission');
        
      default:
        console.warn(`No fallback strategy for service: ${serviceName}`);
        return { success: false, error: originalError.message, fallback: true };
    }
  }
  
  /**
   * Create queue job from submission data and AI results
   */
  createQueueJob(submissionData, aiResults) {
    const job = {
      type: 'directory_submission',
      data: {
        directoryId: submissionData.directory.id,
        businessData: {
          ...submissionData.business
        },
        directoryData: submissionData.directory,
        requirements: submissionData.requirements || {}
      },
      priority: this.calculateJobPriority(submissionData, aiResults),
      metadata: {
        aiEnhanced: true,
        successProbability: aiResults.probability?.probability || 0.5,
        aiServices: Object.keys(aiResults).filter(key => aiResults[key] && !aiResults[key].fallback)
      }
    };
    
    // Apply customized description if available
    if (aiResults.customization && aiResults.customization.primaryCustomization) {
      job.data.businessData.description = aiResults.customization.primaryCustomization.description;
    }
    
    // Apply optimal timing if available
    if (aiResults.timing && aiResults.timing.optimalWindows && aiResults.timing.optimalWindows.length > 0) {
      const bestWindow = aiResults.timing.optimalWindows[0];
      if (new Date(bestWindow.windowStart) > new Date()) {
        job.scheduled_at = bestWindow.windowStart;
      }
    }
    
    return job;
  }
  
  /**
   * Calculate job priority based on AI analysis
   */
  calculateJobPriority(submissionData, aiResults) {
    let priority = submissionData.priority || 3; // Default priority
    
    // Adjust based on success probability
    if (aiResults.probability && aiResults.probability.probability) {
      const successProb = aiResults.probability.probability;
      if (successProb > 0.8) priority = Math.max(1, priority - 1);
      else if (successProb < 0.3) priority = Math.min(5, priority + 1);
    }
    
    // Adjust based on business tier/package
    if (submissionData.business.packageTier) {
      const tierPriorities = {
        'Enterprise': 1,
        'Professional': 2,
        'Growth': 3,
        'Starter': 4
      };
      const tierPriority = tierPriorities[submissionData.business.packageTier];
      if (tierPriority) {
        priority = Math.min(priority, tierPriority);
      }
    }
    
    return priority;
  }
  
  /**
   * Handle submission failure and retry analysis
   */
  async handleSubmissionFailure(submissionId, failureData) {
    const requestId = this.generateRequestId();
    
    try {
      console.log(`🔄 [${requestId}] Analyzing submission failure: ${submissionId}`);
      
      // Analyze failure with AI
      const failureAnalysis = await this.executeServiceWithFallback(
        'retryAnalyzer',
        'analyzeFailureAndRecommendRetry',
        [failureData],
        { requestId, phase: 'failure_analysis' }
      );
      
      // Send feedback to learning system
      await this.sendToFeedbackLoop({
        submissionId,
        outcome: 'failure',
        failureReason: failureData.error,
        retryRecommendation: failureAnalysis.retryRecommendation
      }, 'submission_failed');
      
      // Apply retry strategy if recommended
      if (failureAnalysis.retryRecommendation) {
        return await this.scheduleRetry(submissionId, failureAnalysis);
      }
      
      return {
        success: false,
        retryScheduled: false,
        analysis: failureAnalysis,
        requestId
      };
      
    } catch (error) {
      console.error(`❌ [${requestId}] Failure analysis failed:`, error);
      throw error;
    }
  }
  
  /**
   * Schedule retry based on AI analysis
   */
  async scheduleRetry(submissionId, failureAnalysis) {
    try {
      const retryJob = {
        type: 'directory_submission_retry',
        data: {
          originalSubmissionId: submissionId,
          retryStrategy: failureAnalysis.retryStrategy,
          improvements: failureAnalysis.improvements
        },
        priority: 2, // Higher priority for retries
        scheduled_at: failureAnalysis.optimalTiming.retryDate,
        metadata: {
          aiAnalyzedRetry: true,
          retryAttempt: (failureAnalysis.attemptNumber || 0) + 1
        }
      };
      
      const jobId = await this.services.queueManager.enqueue(retryJob);
      
      return {
        success: true,
        retryScheduled: true,
        retryJobId: jobId,
        scheduledFor: retryJob.scheduled_at,
        improvements: failureAnalysis.improvements
      };
      
    } catch (error) {
      console.error('Failed to schedule retry:', error);
      throw error;
    }
  }
  
  /**
   * Handle successful submission
   */
  async handleSubmissionSuccess(submissionId, successData) {
    try {
      // Send success feedback to learning system
      await this.sendToFeedbackLoop({
        submissionId,
        outcome: 'success',
        successData,
        processingTime: successData.processingTime
      }, 'submission_succeeded');
      
      // Update A/B test results if applicable
      if (successData.abTestAssignments) {
        await this.services.abTesting.recordExperimentResult(
          submissionId,
          { status: 'approved', submissionId },
          successData
        );
      }
      
    } catch (error) {
      console.error('Failed to process success feedback:', error);
      // Don't throw - success processing should not fail
    }
  }
  
  /**
   * Send feedback to learning system
   */
  async sendToFeedbackLoop(data, eventType) {
    try {
      await this.executeServiceWithFallback(
        'feedbackLoop',
        'processFeedback',
        [{
          ...data,
          eventType,
          timestamp: new Date().toISOString()
        }],
        { requestId: this.generateRequestId() }
      );
    } catch (error) {
      console.warn('Feedback loop processing failed:', error);
      // Don't throw - feedback failures should not break main flow
    }
  }
  
  // Service health and monitoring methods
  startHealthMonitoring() {
    setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }
  
  async performHealthChecks() {
    console.log('🏥 Performing AI service health checks...');
    
    const healthPromises = Object.keys(this.services).map(async serviceName => {
      try {
        const startTime = Date.now();
        
        // Simple health check - call a basic method or check service stats
        let isHealthy = true;
        let responseTime = 0;
        
        if (this.services[serviceName].getStats) {
          await this.services[serviceName].getStats();
          responseTime = Date.now() - startTime;
        }
        
        this.updateServiceHealth(serviceName, 'healthy', responseTime);
        
      } catch (error) {
        console.warn(`⚠️ Health check failed for ${serviceName}:`, error.message);
        this.updateServiceHealth(serviceName, 'unhealthy', 0);
      }
    });
    
    await Promise.allSettled(healthPromises);
  }
  
  updateServiceHealth(serviceName, status, responseTime) {
    const health = this.serviceHealth.get(serviceName) || {};
    
    health.status = status;
    health.lastCheck = Date.now();
    health.responseTime = responseTime;
    
    if (status === 'unhealthy') {
      health.failures = (health.failures || 0) + 1;
    } else {
      health.failures = 0;
    }
    
    this.serviceHealth.set(serviceName, health);
  }
  
  // Circuit breaker implementation
  initializeCircuitBreakers() {
    Object.keys(this.services).forEach(serviceName => {
      this.circuitBreakers.set(serviceName, {
        failures: 0,
        lastFailureTime: 0,
        state: 'closed' // closed, open, half-open
      });
    });
  }
  
  isCircuitBreakerOpen(serviceName) {
    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) return false;
    
    if (breaker.state === 'open') {
      // Check if timeout has passed to allow half-open state
      if (Date.now() - breaker.lastFailureTime > this.config.circuitBreakerTimeout) {
        breaker.state = 'half-open';
        return false;
      }
      return true;
    }
    
    return false;
  }
  
  recordServiceSuccess(serviceName, responseTime) {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'closed';
    }
    
    const health = this.serviceHealth.get(serviceName);
    if (health) {
      health.responseTime = responseTime;
    }
  }
  
  recordServiceFailure(serviceName, error) {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      breaker.failures++;
      breaker.lastFailureTime = Date.now();
      
      if (breaker.failures >= this.config.circuitBreakerThreshold) {
        breaker.state = 'open';
        this.orchestrationMetrics.circuitBreakerTrips++;
        console.warn(`🚨 Circuit breaker opened for service: ${serviceName}`);
      }
    }
    
    // Track service-specific failures
    if (!this.orchestrationMetrics.serviceFailures[serviceName]) {
      this.orchestrationMetrics.serviceFailures[serviceName] = 0;
    }
    this.orchestrationMetrics.serviceFailures[serviceName]++;
  }
  
  // Utility methods
  async executeWithTimeout(fn, args, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      fn(...args)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
  
  estimateProcessingTime(aiResults) {
    let baseTime = 300; // 5 minutes base processing time
    
    // Adjust based on timing optimization
    if (aiResults.timing && aiResults.timing.optimalWindows) {
      const bestWindow = aiResults.timing.optimalWindows[0];
      if (bestWindow && new Date(bestWindow.windowStart) > new Date()) {
        const delayMs = new Date(bestWindow.windowStart).getTime() - Date.now();
        baseTime += Math.floor(delayMs / 1000); // Add delay time
      }
    }
    
    // Adjust based on success probability
    if (aiResults.probability && aiResults.probability.probability < 0.5) {
      baseTime *= 1.5; // Longer processing time for lower probability submissions
    }
    
    return baseTime;
  }
  
  summarizeAIEnhancements(aiResults) {
    const enhancements = [];
    
    if (aiResults.probability && !aiResults.probability.fallback) {
      enhancements.push('success-probability-analysis');
    }
    
    if (aiResults.timing && !aiResults.timing.fallback) {
      enhancements.push('optimal-timing');
    }
    
    if (aiResults.customization && !aiResults.customization.fallback) {
      enhancements.push('content-customization');
    }
    
    return enhancements;
  }
  
  recordOperationMetrics(context, result) {
    const processingTime = Date.now() - context.startTime;
    
    if (result.success) {
      this.orchestrationMetrics.successfulRequests++;
    } else {
      this.orchestrationMetrics.failedRequests++;
    }
    
    // Update average response time
    const totalRequests = this.orchestrationMetrics.successfulRequests + this.orchestrationMetrics.failedRequests;
    this.orchestrationMetrics.averageResponseTime = 
      ((this.orchestrationMetrics.averageResponseTime * (totalRequests - 1)) + processingTime) / totalRequests;
  }
  
  handleWorkflowFailure(context, error) {
    console.error(`Workflow failure in phase ${context.phase}:`, error);
    
    return {
      requestId: context.requestId,
      success: false,
      error: error.message,
      failurePhase: context.phase,
      serviceStatuses: context.services,
      fallbackApplied: true
    };
  }
  
  validateSubmissionData(data) {
    if (!data.business || !data.directory) {
      throw new Error('Business and directory data are required');
    }
    
    if (!data.business.name || !data.directory.id) {
      throw new Error('Business name and directory ID are required');
    }
  }
  
  generateRequestId() {
    return `orchestrator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  startOperationProcessing() {
    // Process operations queue to manage concurrency
    setInterval(() => {
      this.processOperationQueue();
    }, 1000);
  }
  
  async processOperationQueue() {
    while (this.operationQueue.length > 0 && 
           this.activeOperations.size < this.config.maxConcurrentOperations) {
      
      const operation = this.operationQueue.shift();
      this.activeOperations.add(operation.id);
      
      // Process operation
      operation.execute()
        .finally(() => {
          this.activeOperations.delete(operation.id);
        });
    }
  }
  
  /**
   * Get comprehensive orchestrator statistics
   */
  getOrchestratorStats() {
    return {
      serviceHealth: Object.fromEntries(this.serviceHealth.entries()),
      circuitBreakers: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([name, breaker]) => [
          name, 
          { state: breaker.state, failures: breaker.failures }
        ])
      ),
      operationQueue: this.operationQueue.length,
      activeOperations: this.activeOperations.size,
      metrics: this.orchestrationMetrics
    };
  }
  
  /**
   * Shutdown orchestrator and all services
   */
  async shutdown() {
    console.log('🛑 Shutting down AI Submission Orchestrator...');
    
    try {
      // Shutdown all services
      const shutdownPromises = Object.entries(this.services).map(([name, service]) => {
        if (service.shutdown && typeof service.shutdown === 'function') {
          return service.shutdown().catch(error => {
            console.warn(`Warning: ${name} shutdown failed:`, error);
          });
        }
      });
      
      await Promise.allSettled(shutdownPromises);
      
      // Clear all maps and intervals
      this.serviceHealth.clear();
      this.circuitBreakers.clear();
      this.operationQueue.length = 0;
      this.activeOperations.clear();
      
      console.log('✅ AI Submission Orchestrator shutdown complete');
      
    } catch (error) {
      console.error('Error during orchestrator shutdown:', error);
    }
  }
}

module.exports = AISubmissionOrchestrator;