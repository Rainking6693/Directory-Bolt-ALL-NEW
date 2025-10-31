// DirectoryBolt Batch Processing System
// Handles bulk directory submissions with queue management and progress tracking

const { createClient } = require('@supabase/supabase-js');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class BatchProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Configuration
    this.config = {
      maxConcurrentJobs: options.maxConcurrentJobs || 3,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 5000, // 5 seconds
      rateLimitDelay: options.rateLimitDelay || 2000, // 2 seconds between submissions
      timeoutMs: options.timeoutMs || 30000, // 30 seconds per submission
      ...options
    };

    // State management
    this.activeJobs = new Map();
    this.jobQueue = [];
    this.isProcessing = false;
    this.stats = {
      totalProcessed: 0,
      successfulSubmissions: 0,
      failedSubmissions: 0,
      retriedSubmissions: 0
    };

    // Start processing
    this.startProcessor();
  }

  /**
   * Create a new batch submission job
   */
  async createBatch(batchData) {
    try {
      const {
        user_id,
        batch_name,
        directory_ids = [],
        business_data,
        configuration = {}
      } = batchData;

      // Validate input
      if (!directory_ids.length) {
        throw new Error('No directories specified for batch');
      }

      if (!business_data || !business_data.business_name) {
        throw new Error('Business data is required');
      }

      // Validate directories exist and are active
      const { data: directories, error: dirError } = await this.supabase
        .from('directories')
        .select(`
          id,
          name,
          website,
          category_id,
          submission_requirements,
          form_fields,
          average_approval_time,
          is_active,
          categories!inner(display_name)
        `)
        .in('id', directory_ids)
        .eq('is_active', true);

      if (dirError) {
        throw new Error(`Failed to validate directories: ${dirError.message}`);
      }

      if (directories.length !== directory_ids.length) {
        const foundIds = directories.map(d => d.id);
        const missingIds = directory_ids.filter(id => !foundIds.includes(id));
        throw new Error(`Directories not found or inactive: ${missingIds.join(', ')}`);
      }

      // Create batch record
      const batchId = uuidv4();
      const { data: batch, error: batchError } = await this.supabase
        .from('batch_submissions')
        .insert([{
          id: batchId,
          user_id,
          batch_name: batch_name || `Batch ${new Date().toISOString()}`,
          total_submissions: directory_ids.length,
          status: 'pending',
          configuration: {
            priority: configuration.priority || 3,
            auto_retry: configuration.auto_retry !== false,
            notification_email: configuration.notification_email,
            ...configuration
          }
        }])
        .select()
        .single();

      if (batchError) {
        throw new Error(`Failed to create batch: ${batchError.message}`);
      }

      // Create individual submission jobs
      const submissionJobs = directories.map(directory => ({
        id: uuidv4(),
        batch_id: batchId,
        user_id,
        directory_id: directory.id,
        directory_name: directory.name,
        directory_website: directory.website,
        business_data,
        form_fields: directory.form_fields,
        submission_requirements: directory.submission_requirements,
        priority: configuration.priority || 3,
        retry_count: 0,
        max_retries: configuration.max_retries || this.config.retryAttempts,
        created_at: new Date().toISOString()
      }));

      // Insert submission records
      const { data: submissions, error: submissionError } = await this.supabase
        .from('user_submissions')
        .insert(
          submissionJobs.map(job => ({
            id: job.id,
            user_id: job.user_id,
            directory_id: job.directory_id,
            batch_id: batchId,
            business_name: business_data.business_name,
            business_description: business_data.business_description,
            business_url: business_data.business_url,
            business_email: business_data.business_email,
            business_phone: business_data.business_phone,
            business_address: business_data.business_address,
            business_category: business_data.business_category,
            submission_data: business_data.submission_data || {},
            priority: job.priority,
            submission_status: 'pending',
            max_retries: job.max_retries
          }))
        )
        .select();

      if (submissionError) {
        // Clean up batch if submissions failed
        await this.supabase
          .from('batch_submissions')
          .delete()
          .eq('id', batchId);
        
        throw new Error(`Failed to create submissions: ${submissionError.message}`);
      }

      // Add jobs to processing queue
      submissionJobs.forEach(job => {
        this.jobQueue.push(job);
      });

      // Update batch status to processing
      await this.supabase
        .from('batch_submissions')
        .update({
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', batchId);

      this.emit('batchCreated', {
        batch_id: batchId,
        total_jobs: submissionJobs.length,
        batch_name: batch.batch_name
      });

      return {
        batch_id: batchId,
        total_submissions: submissionJobs.length,
        estimated_completion_time: this.calculateEstimatedCompletion(submissionJobs.length),
        batch_name: batch.batch_name
      };

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start the batch processor
   */
  startProcessor() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processQueue();
    
    // Set up periodic queue check
    this.queueInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.processQueue();
      }
    }, 5000);
  }

  /**
   * Stop the batch processor
   */
  stopProcessor() {
    this.isProcessing = false;
    
    if (this.queueInterval) {
      clearInterval(this.queueInterval);
      this.queueInterval = null;
    }

    // Cancel active jobs
    for (const [jobId, jobPromise] of this.activeJobs) {
      // In a real implementation, you'd cancel the job here
      this.emit('jobCancelled', { job_id: jobId });
    }
    
    this.activeJobs.clear();
  }

  /**
   * Process the job queue
   */
  async processQueue() {
    if (!this.isProcessing || this.jobQueue.length === 0) {
      return;
    }

    // Process jobs up to the concurrency limit
    while (this.activeJobs.size < this.config.maxConcurrentJobs && this.jobQueue.length > 0) {
      const job = this.jobQueue.shift();
      this.processJob(job);
    }

    // Check if we should continue processing
    if (this.jobQueue.length > 0 || this.activeJobs.size > 0) {
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  /**
   * Process a single submission job
   */
  async processJob(job) {
    const jobPromise = this.executeSubmission(job);
    this.activeJobs.set(job.id, jobPromise);

    try {
      await jobPromise;
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Execute a directory submission
   */
  async executeSubmission(job) {
    try {
      this.emit('jobStarted', {
        job_id: job.id,
        directory_name: job.directory_name,
        batch_id: job.batch_id
      });

      // Update submission status to in_progress
      await this.supabase
        .from('user_submissions')
        .update({
          submission_status: 'in_progress',
          submitted_at: new Date().toISOString()
        })
        .eq('id', job.id);

      // Simulate submission process (in real implementation, this would call directory APIs)
      const result = await this.submitToDirectory(job);

      // Update submission with success
      await this.supabase
        .from('user_submissions')
        .update({
          submission_status: result.status,
          response_data: result.response_data,
          external_submission_id: result.external_id,
          approved_at: result.status === 'approved' ? new Date().toISOString() : null,
          rejection_reason: result.rejection_reason || null
        })
        .eq('id', job.id);

      this.stats.totalProcessed++;
      if (result.status === 'approved' || result.status === 'submitted') {
        this.stats.successfulSubmissions++;
      } else {
        this.stats.failedSubmissions++;
      }

      this.emit('jobCompleted', {
        job_id: job.id,
        directory_name: job.directory_name,
        batch_id: job.batch_id,
        status: result.status,
        result
      });

      // Update batch progress
      await this.updateBatchProgress(job.batch_id);

    } catch (error) {
      await this.handleJobError(job, error);
    }
  }

  /**
   * Submit to directory (mock implementation)
   */
  async submitToDirectory(job) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));

    // Rate limiting delay
    if (this.config.rateLimitDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay));
    }

    // Simulate different outcomes based on directory requirements
    const successRate = this.calculateDirectorySuccessRate(job);
    const random = Math.random();

    if (random < successRate) {
      return {
        status: Math.random() < 0.8 ? 'submitted' : 'approved',
        response_data: {
          submission_id: `ext_${uuidv4()}`,
          submitted_at: new Date().toISOString(),
          directory_response: 'Submission successful'
        },
        external_id: `ext_${uuidv4()}`
      };
    } else if (random < successRate + 0.1) {
      // Temporary failure - can be retried
      throw new Error('Directory temporarily unavailable');
    } else {
      return {
        status: 'rejected',
        response_data: {
          rejection_reason: 'Business does not meet directory requirements',
          directory_response: 'Submission rejected'
        },
        rejection_reason: 'Business does not meet directory requirements'
      };
    }
  }

  /**
   * Handle job errors and retries
   */
  async handleJobError(job, error) {
    try {
      const canRetry = job.retry_count < job.max_retries;
      
      if (canRetry && this.shouldRetry(error)) {
        // Schedule retry
        const retryDelay = this.calculateRetryDelay(job.retry_count);
        
        setTimeout(() => {
          job.retry_count++;
          this.jobQueue.unshift(job); // Add to front of queue for priority
          this.stats.retriedSubmissions++;
          
          this.emit('jobRetrying', {
            job_id: job.id,
            directory_name: job.directory_name,
            batch_id: job.batch_id,
            retry_count: job.retry_count,
            error_message: error.message
          });
        }, retryDelay);

        // Update submission with retry info
        await this.supabase
          .from('user_submissions')
          .update({
            submission_status: 'pending',
            retry_count: job.retry_count,
            next_retry_at: new Date(Date.now() + retryDelay).toISOString(),
            response_data: { 
              last_error: error.message,
              retry_scheduled: true 
            }
          })
          .eq('id', job.id);

      } else {
        // Mark as failed
        await this.supabase
          .from('user_submissions')
          .update({
            submission_status: 'failed',
            rejection_reason: error.message,
            response_data: { 
              error: error.message,
              failed_at: new Date().toISOString(),
              retry_count: job.retry_count
            }
          })
          .eq('id', job.id);

        this.stats.totalProcessed++;
        this.stats.failedSubmissions++;

        this.emit('jobFailed', {
          job_id: job.id,
          directory_name: job.directory_name,
          batch_id: job.batch_id,
          error: error.message,
          retry_count: job.retry_count
        });

        // Update batch progress
        await this.updateBatchProgress(job.batch_id);
      }

    } catch (updateError) {
      this.emit('error', updateError);
    }
  }

  /**
   * Update batch progress and completion status
   */
  async updateBatchProgress(batchId) {
    try {
      // Get current submission stats for this batch
      const { data: submissions, error } = await this.supabase
        .from('user_submissions')
        .select('submission_status')
        .eq('batch_id', batchId);

      if (error) {
        throw new Error(`Failed to get batch progress: ${error.message}`);
      }

      const stats = {
        total: submissions.length,
        pending: submissions.filter(s => s.submission_status === 'pending').length,
        in_progress: submissions.filter(s => s.submission_status === 'in_progress').length,
        submitted: submissions.filter(s => s.submission_status === 'submitted').length,
        approved: submissions.filter(s => s.submission_status === 'approved').length,
        rejected: submissions.filter(s => s.submission_status === 'rejected').length,
        failed: submissions.filter(s => s.submission_status === 'failed').length
      };

      const completed = stats.submitted + stats.approved + stats.rejected + stats.failed;
      const progressPercentage = Math.round((completed / stats.total) * 100);
      const isCompleted = completed === stats.total;

      // Update batch record
      const updateData = {
        successful_submissions: stats.submitted + stats.approved,
        failed_submissions: stats.rejected + stats.failed,
        pending_submissions: stats.pending + stats.in_progress,
        progress_percentage: progressPercentage,
        results_summary: stats
      };

      if (isCompleted) {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
      }

      await this.supabase
        .from('batch_submissions')
        .update(updateData)
        .eq('id', batchId);

      this.emit('batchProgress', {
        batch_id: batchId,
        progress_percentage: progressPercentage,
        stats,
        completed: isCompleted
      });

      if (isCompleted) {
        this.emit('batchCompleted', {
          batch_id: batchId,
          stats,
          success_rate: Math.round(((stats.submitted + stats.approved) / stats.total) * 100)
        });
      }

    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Get batch status and progress
   */
  async getBatchStatus(batchId) {
    try {
      const { data: batch, error: batchError } = await this.supabase
        .from('batch_submissions')
        .select('*')
        .eq('id', batchId)
        .single();

      if (batchError) {
        throw new Error(`Batch not found: ${batchError.message}`);
      }

      const { data: submissions, error: submissionError } = await this.supabase
        .from('user_submissions')
        .select(`
          id,
          directory_id,
          submission_status,
          submitted_at,
          approved_at,
          rejection_reason,
          retry_count,
          directories!inner(name, website)
        `)
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true });

      if (submissionError) {
        throw new Error(`Failed to get submissions: ${submissionError.message}`);
      }

      return {
        batch: batch,
        submissions: submissions.map(s => ({
          id: s.id,
          directory_name: s.directories.name,
          directory_website: s.directories.website,
          status: s.submission_status,
          submitted_at: s.submitted_at,
          approved_at: s.approved_at,
          rejection_reason: s.rejection_reason,
          retry_count: s.retry_count
        })),
        progress: {
          percentage: batch.progress_percentage,
          completed: batch.status === 'completed',
          stats: batch.results_summary
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Utility methods
   */
  
  calculateDirectorySuccessRate(job) {
    // Base success rate simulation - in real implementation, 
    // this would use historical data and directory-specific factors
    const baseRate = 0.75;
    const categoryBonus = job.business_data.business_category ? 0.05 : 0;
    const qualityBonus = job.business_data.business_description?.length > 100 ? 0.05 : 0;
    
    return Math.min(baseRate + categoryBonus + qualityBonus, 0.95);
  }

  shouldRetry(error) {
    const retryableErrors = [
      'temporarily unavailable',
      'rate limit',
      'timeout',
      'network error',
      'connection refused'
    ];
    
    return retryableErrors.some(errorType => 
      error.message.toLowerCase().includes(errorType)
    );
  }

  calculateRetryDelay(attemptNumber) {
    // Exponential backoff with jitter
    const baseDelay = this.config.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attemptNumber);
    const jitter = Math.random() * 1000;
    
    return Math.min(exponentialDelay + jitter, 60000); // Max 1 minute delay
  }

  calculateEstimatedCompletion(jobCount) {
    const avgProcessingTime = 5000; // 5 seconds per job
    const concurrency = this.config.maxConcurrentJobs;
    const rateLimitDelay = this.config.rateLimitDelay;
    
    const totalTime = Math.ceil(jobCount / concurrency) * (avgProcessingTime + rateLimitDelay);
    
    return new Date(Date.now() + totalTime).toISOString();
  }

  /**
   * Get processor statistics
   */
  getStats() {
    return {
      ...this.stats,
      active_jobs: this.activeJobs.size,
      queued_jobs: this.jobQueue.length,
      is_processing: this.isProcessing
    };
  }

  /**
   * Pause batch processing
   */
  pause() {
    this.isProcessing = false;
    this.emit('processorPaused');
  }

  /**
   * Resume batch processing
   */
  resume() {
    if (!this.isProcessing) {
      this.isProcessing = true;
      this.processQueue();
      this.emit('processorResumed');
    }
  }
}

module.exports = BatchProcessor;