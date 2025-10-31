// DirectoryBolt Queue Manager
// Advanced queue management with priority, scheduling, and load balancing

const EventEmitter = require('events');
const { createClient } = require('@supabase/supabase-js');

class QueueManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Configuration
    this.config = {
      maxQueueSize: options.maxQueueSize || 1000,
      priorityLevels: options.priorityLevels || 5,
      defaultPriority: options.defaultPriority || 3,
      retryPolicy: {
        maxAttempts: options.maxRetryAttempts || 3,
        backoffMultiplier: options.backoffMultiplier || 2,
        baseDelayMs: options.baseDelayMs || 5000,
        maxDelayMs: options.maxDelayMs || 300000 // 5 minutes
      },
      ...options
    };

    // Queue state
    this.queues = new Map(); // Priority-based queues
    this.scheduledJobs = new Map(); // Jobs scheduled for future execution
    this.processingJobs = new Set(); // Currently processing jobs
    this.completedJobs = new Map(); // Recently completed jobs (for cleanup)
    
    // Initialize priority queues
    for (let i = 1; i <= this.config.priorityLevels; i++) {
      this.queues.set(i, []);
    }

    // Statistics
    this.stats = {
      totalEnqueued: 0,
      totalProcessed: 0,
      totalFailed: 0,
      totalRetried: 0,
      avgProcessingTime: 0,
      currentLoad: 0
    };

    // Start periodic cleanup and maintenance
    this.startMaintenance();
  }

  /**
   * Add job to queue
   */
  enqueue(job) {
    try {
      // Validate job
      if (!this.validateJob(job)) {
        throw new Error('Invalid job format');
      }

      // Check queue capacity
      const totalQueueSize = Array.from(this.queues.values())
        .reduce((total, queue) => total + queue.length, 0);
      
      if (totalQueueSize >= this.config.maxQueueSize) {
        throw new Error('Queue is full');
      }

      // Normalize job
      const normalizedJob = this.normalizeJob(job);
      
      // Handle scheduled jobs
      if (normalizedJob.scheduled_at && new Date(normalizedJob.scheduled_at) > new Date()) {
        this.scheduleJob(normalizedJob);
        return normalizedJob.id;
      }

      // Add to priority queue
      const priority = normalizedJob.priority;
      const priorityQueue = this.queues.get(priority);
      
      if (!priorityQueue) {
        throw new Error(`Invalid priority level: ${priority}`);
      }

      priorityQueue.push(normalizedJob);
      this.stats.totalEnqueued++;

      // Sort queue by created_at for FIFO within same priority
      priorityQueue.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      this.emit('jobEnqueued', {
        job_id: normalizedJob.id,
        priority: normalizedJob.priority,
        queue_size: priorityQueue.length
      });

      return normalizedJob.id;

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get next job to process (highest priority first)
   */
  dequeue() {
    try {
      // Check scheduled jobs first
      this.processScheduledJobs();

      // Get job from highest priority queue with jobs
      for (let priority = 1; priority <= this.config.priorityLevels; priority++) {
        const priorityQueue = this.queues.get(priority);
        if (priorityQueue && priorityQueue.length > 0) {
          const job = priorityQueue.shift();
          this.processingJobs.add(job.id);
          
          this.emit('jobDequeued', {
            job_id: job.id,
            priority: job.priority,
            remaining_in_queue: priorityQueue.length
          });

          return job;
        }
      }

      return null; // No jobs available

    } catch (error) {
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Mark job as completed
   */
  markCompleted(jobId, result = {}) {
    try {
      if (!this.processingJobs.has(jobId)) {
        throw new Error(`Job ${jobId} is not currently being processed`);
      }

      this.processingJobs.delete(jobId);
      this.completedJobs.set(jobId, {
        completed_at: new Date().toISOString(),
        result,
        status: 'completed'
      });

      this.stats.totalProcessed++;
      this.updateStats();

      this.emit('jobCompleted', {
        job_id: jobId,
        result
      });

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Mark job as failed and handle retry logic
   */
  markFailed(jobId, error, shouldRetry = true) {
    try {
      if (!this.processingJobs.has(jobId)) {
        throw new Error(`Job ${jobId} is not currently being processed`);
      }

      this.processingJobs.delete(jobId);

      // Get original job data for retry
      const jobData = this.getJobData(jobId);
      
      if (shouldRetry && jobData && this.shouldRetryJob(jobData, error)) {
        this.retryJob(jobData, error);
      } else {
        this.completedJobs.set(jobId, {
          completed_at: new Date().toISOString(),
          error: error.message,
          status: 'failed'
        });

        this.stats.totalFailed++;
        this.updateStats();

        this.emit('jobFailed', {
          job_id: jobId,
          error: error.message,
          retry_attempted: shouldRetry && jobData
        });
      }

    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Schedule job for future execution
   */
  scheduleJob(job) {
    const scheduledTime = new Date(job.scheduled_at);
    const delay = scheduledTime.getTime() - Date.now();

    if (delay <= 0) {
      // Schedule immediately
      const priority = job.priority || this.config.defaultPriority;
      this.queues.get(priority).push(job);
      return;
    }

    // Store scheduled job
    this.scheduledJobs.set(job.id, {
      ...job,
      timeout: setTimeout(() => {
        // Move to regular queue when time comes
        this.scheduledJobs.delete(job.id);
        const priority = job.priority || this.config.defaultPriority;
        this.queues.get(priority).push(job);
        
        this.emit('jobScheduled', {
          job_id: job.id,
          priority: job.priority
        });
      }, delay)
    });

    this.emit('jobScheduledLater', {
      job_id: job.id,
      scheduled_at: job.scheduled_at,
      delay_ms: delay
    });
  }

  /**
   * Process scheduled jobs that are ready
   */
  processScheduledJobs() {
    const now = new Date();
    
    for (const [jobId, scheduledJob] of this.scheduledJobs.entries()) {
      if (new Date(scheduledJob.scheduled_at) <= now) {
        // Clear timeout and move to regular queue
        if (scheduledJob.timeout) {
          clearTimeout(scheduledJob.timeout);
        }
        
        this.scheduledJobs.delete(jobId);
        const priority = scheduledJob.priority || this.config.defaultPriority;
        this.queues.get(priority).push(scheduledJob);
        
        this.emit('scheduledJobReady', {
          job_id: jobId,
          priority: priority
        });
      }
    }
  }

  /**
   * Retry failed job with backoff
   */
  retryJob(jobData, error) {
    try {
      const retryCount = (jobData.retry_count || 0) + 1;
      const maxAttempts = jobData.max_retries || this.config.retryPolicy.maxAttempts;

      if (retryCount > maxAttempts) {
        // Max retries reached, mark as permanently failed
        this.completedJobs.set(jobData.id, {
          completed_at: new Date().toISOString(),
          error: error.message,
          status: 'failed_permanent',
          retry_count: retryCount - 1
        });

        this.stats.totalFailed++;
        this.emit('jobFailedPermanent', {
          job_id: jobData.id,
          error: error.message,
          retry_count: retryCount - 1
        });

        return;
      }

      // Calculate retry delay with exponential backoff
      const baseDelay = this.config.retryPolicy.baseDelayMs;
      const backoffMultiplier = this.config.retryPolicy.backoffMultiplier;
      const maxDelay = this.config.retryPolicy.maxDelayMs;
      
      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, retryCount - 1),
        maxDelay
      );

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      const finalDelay = delay + jitter;

      // Schedule retry
      const retryJob = {
        ...jobData,
        retry_count: retryCount,
        last_error: error.message,
        scheduled_at: new Date(Date.now() + finalDelay).toISOString(),
        priority: Math.max(1, jobData.priority - 1) // Increase priority slightly for retries
      };

      this.scheduleJob(retryJob);
      this.stats.totalRetried++;

      this.emit('jobRetryScheduled', {
        job_id: jobData.id,
        retry_count: retryCount,
        delay_ms: finalDelay,
        error: error.message
      });

    } catch (err) {
      this.emit('error', err);
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const queueSizes = {};
    let totalQueued = 0;

    for (const [priority, queue] of this.queues.entries()) {
      queueSizes[`priority_${priority}`] = queue.length;
      totalQueued += queue.length;
    }

    return {
      ...this.stats,
      queue_sizes: queueSizes,
      total_queued: totalQueued,
      scheduled_jobs: this.scheduledJobs.size,
      processing_jobs: this.processingJobs.size,
      current_load: this.calculateCurrentLoad()
    };
  }

  /**
   * Get jobs by status
   */
  getJobs(status = 'all', limit = 100) {
    const jobs = [];

    switch (status) {
      case 'queued':
        for (const [priority, queue] of this.queues.entries()) {
          jobs.push(...queue.slice(0, limit).map(job => ({
            ...job,
            status: 'queued',
            queue_priority: priority
          })));
        }
        break;

      case 'scheduled':
        const scheduledArray = Array.from(this.scheduledJobs.values())
          .slice(0, limit)
          .map(job => ({
            ...job,
            status: 'scheduled'
          }));
        jobs.push(...scheduledArray);
        break;

      case 'processing':
        // In a real implementation, you'd track more details about processing jobs
        jobs.push(...Array.from(this.processingJobs).slice(0, limit).map(jobId => ({
          id: jobId,
          status: 'processing'
        })));
        break;

      case 'completed':
        const completedArray = Array.from(this.completedJobs.entries())
          .slice(-limit)
          .map(([jobId, data]) => ({
            id: jobId,
            ...data
          }));
        jobs.push(...completedArray);
        break;

      case 'all':
      default:
        // Return a summary of all jobs
        return {
          queued: this.getJobs('queued', 50),
          scheduled: this.getJobs('scheduled', 50),
          processing: this.getJobs('processing', 50),
          completed: this.getJobs('completed', 50)
        };
    }

    return jobs.sort((a, b) => new Date(b.created_at || b.completed_at) - new Date(a.created_at || a.completed_at));
  }

  /**
   * Cancel scheduled job
   */
  cancelJob(jobId) {
    try {
      // Check if job is scheduled
      if (this.scheduledJobs.has(jobId)) {
        const scheduledJob = this.scheduledJobs.get(jobId);
        if (scheduledJob.timeout) {
          clearTimeout(scheduledJob.timeout);
        }
        this.scheduledJobs.delete(jobId);
        
        this.emit('jobCancelled', { job_id: jobId, status: 'scheduled' });
        return true;
      }

      // Check if job is in queue
      for (const [priority, queue] of this.queues.entries()) {
        const jobIndex = queue.findIndex(job => job.id === jobId);
        if (jobIndex !== -1) {
          queue.splice(jobIndex, 1);
          this.emit('jobCancelled', { job_id: jobId, status: 'queued', priority });
          return true;
        }
      }

      // Job not found or already processing
      return false;

    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Clear completed jobs (cleanup)
   */
  clearCompleted(olderThan = 3600000) { // 1 hour default
    const cutoff = Date.now() - olderThan;
    let cleared = 0;

    for (const [jobId, jobData] of this.completedJobs.entries()) {
      if (new Date(jobData.completed_at).getTime() < cutoff) {
        this.completedJobs.delete(jobId);
        cleared++;
      }
    }

    this.emit('cleanupCompleted', { jobs_cleared: cleared });
    return cleared;
  }

  /**
   * Utility methods
   */

  validateJob(job) {
    return job && 
           typeof job === 'object' && 
           (job.id || job.type) && 
           job.data !== undefined;
  }

  normalizeJob(job) {
    return {
      id: job.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: job.type || 'generic',
      data: job.data || {},
      priority: Math.max(1, Math.min(job.priority || this.config.defaultPriority, this.config.priorityLevels)),
      created_at: new Date().toISOString(),
      retry_count: job.retry_count || 0,
      max_retries: job.max_retries !== undefined ? job.max_retries : this.config.retryPolicy.maxAttempts,
      scheduled_at: job.scheduled_at || null,
      metadata: job.metadata || {}
    };
  }

  getJobData(jobId) {
    // In a real implementation, you'd store job data separately
    // For now, this is a placeholder
    return null;
  }

  shouldRetryJob(jobData, error) {
    const retryableErrors = [
      'timeout',
      'network error',
      'temporarily unavailable',
      'rate limit',
      'service unavailable'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    );
  }

  calculateCurrentLoad() {
    const totalCapacity = this.config.maxQueueSize;
    const currentUsage = Array.from(this.queues.values())
      .reduce((total, queue) => total + queue.length, 0) + 
      this.processingJobs.size;

    return Math.round((currentUsage / totalCapacity) * 100);
  }

  updateStats() {
    // Update average processing time and other metrics
    // In a real implementation, this would track timing data
    this.stats.currentLoad = this.calculateCurrentLoad();
  }

  startMaintenance() {
    // Cleanup completed jobs every hour
    this.cleanupInterval = setInterval(() => {
      this.clearCompleted();
    }, 3600000);

    // Process scheduled jobs every minute
    this.scheduledInterval = setInterval(() => {
      this.processScheduledJobs();
    }, 60000);

    // Update stats every 30 seconds
    this.statsInterval = setInterval(() => {
      this.updateStats();
    }, 30000);
  }

  stopMaintenance() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.scheduledInterval) {
      clearInterval(this.scheduledInterval);
      this.scheduledInterval = null;
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Clear all scheduled job timeouts
    for (const scheduledJob of this.scheduledJobs.values()) {
      if (scheduledJob.timeout) {
        clearTimeout(scheduledJob.timeout);
      }
    }
  }

  /**
   * Shutdown queue manager gracefully
   */
  shutdown() {
    this.stopMaintenance();
    
    // Cancel all scheduled jobs
    for (const [jobId, scheduledJob] of this.scheduledJobs.entries()) {
      if (scheduledJob.timeout) {
        clearTimeout(scheduledJob.timeout);
      }
    }
    
    this.scheduledJobs.clear();
    this.queues.clear();
    this.processingJobs.clear();
    
    this.emit('shutdown');
  }
}

module.exports = QueueManager;