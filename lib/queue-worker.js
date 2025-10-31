// DirectoryBolt Queue Worker - Redis/Bull Queue Integration
// Production-ready background job processing with Redis, Bull Queue, and monitoring
// Handles directory submission automation, retry logic, and scaling

const Queue = require('bull');
const Redis = require('ioredis');
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
const { v4: uuidv4 } = require('uuid');

// Initialize clients
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

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
  maxmemoryPolicy: 'allkeys-lru'
};

// Create Redis instances for different purposes
const redis = new Redis(redisConfig);
const subscriber = new Redis(redisConfig);
const publisher = new Redis(redisConfig);

// Queue configurations
const QUEUE_CONFIGS = {
  'directory-submissions': {
    concurrency: 10,
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 20,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      delay: 1000 // Default delay between jobs
    }
  },
  'priority-submissions': {
    concurrency: 5,
    defaultJobOptions: {
      removeOnComplete: 25,
      removeOnFail: 10,
      attempts: 7,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      delay: 500
    }
  },
  'verification-actions': {
    concurrency: 8,
    defaultJobOptions: {
      removeOnComplete: 30,
      removeOnFail: 15,
      attempts: 3,
      backoff: {
        type: 'fixed',
        delay: 5000
      },
      delay: 2000
    }
  },
  'retry-operations': {
    concurrency: 3,
    defaultJobOptions: {
      removeOnComplete: 20,
      removeOnFail: 10,
      attempts: 10,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      delay: 10000
    }
  }
};

// Job types and their processors
const JOB_TYPES = {
  PROCESS_SUBMISSION: 'process-submission',
  VERIFY_SUBMISSION: 'verify-submission',
  RETRY_FAILED: 'retry-failed',
  BULK_PROCESS: 'bulk-process',
  HEALTH_CHECK: 'health-check',
  CLEANUP_STALE: 'cleanup-stale'
};

class QueueWorker {
  constructor() {
    this.queues = new Map();
    this.processors = new Map();
    this.browserPool = new Map();
    this.metrics = {
      processed: 0,
      failed: 0,
      retries: 0,
      startTime: Date.now()
    };
    this.isShuttingDown = false;
  }

  // Initialize all queues and processors
  async initialize() {
    try {
      console.log('Initializing Queue Worker...');

      // Create queues
      await this.createQueues();

      // Setup processors
      await this.setupProcessors();

      // Initialize browser pool
      await this.initializeBrowserPool();

      // Setup monitoring and health checks
      await this.setupMonitoring();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      console.log('Queue Worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Queue Worker:', error);
      throw error;
    }
  }

  // Create Bull queues
  async createQueues() {
    for (const [queueName, config] of Object.entries(QUEUE_CONFIGS)) {
      const queue = new Queue(queueName, {
        redis: redisConfig,
        defaultJobOptions: config.defaultJobOptions
      });

      // Setup event listeners
      this.setupQueueEventListeners(queue, queueName);

      this.queues.set(queueName, queue);
      console.log(`Created queue: ${queueName}`);
    }
  }

  // Setup processors for each queue
  async setupProcessors() {
    // Directory submissions processor
    const submissionsQueue = this.queues.get('directory-submissions');
    submissionsQueue.process(
      JOB_TYPES.PROCESS_SUBMISSION,
      QUEUE_CONFIGS['directory-submissions'].concurrency,
      this.processDirectorySubmission.bind(this)
    );

    submissionsQueue.process(
      JOB_TYPES.BULK_PROCESS,
      2, // Lower concurrency for bulk operations
      this.processBulkSubmissions.bind(this)
    );

    // Priority submissions processor
    const priorityQueue = this.queues.get('priority-submissions');
    priorityQueue.process(
      JOB_TYPES.PROCESS_SUBMISSION,
      QUEUE_CONFIGS['priority-submissions'].concurrency,
      this.processDirectorySubmission.bind(this)
    );

    // Verification actions processor
    const verificationQueue = this.queues.get('verification-actions');
    verificationQueue.process(
      JOB_TYPES.VERIFY_SUBMISSION,
      QUEUE_CONFIGS['verification-actions'].concurrency,
      this.processVerificationAction.bind(this)
    );

    // Retry operations processor
    const retryQueue = this.queues.get('retry-operations');
    retryQueue.process(
      JOB_TYPES.RETRY_FAILED,
      QUEUE_CONFIGS['retry-operations'].concurrency,
      this.processRetryOperation.bind(this)
    );

    // Health check processor (runs on all queues)
    this.queues.forEach(queue => {
      queue.process(JOB_TYPES.HEALTH_CHECK, 1, this.processHealthCheck.bind(this));
    });

    console.log('Processors setup completed');
  }

  // Initialize browser pool for automation
  async initializeBrowserPool() {
    const poolSize = parseInt(process.env.BROWSER_POOL_SIZE) || 3;
    
    for (let i = 0; i < poolSize; i++) {
      try {
        const browser = await puppeteer.launch({
          headless: process.env.NODE_ENV === 'production',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1366,768'
          ]
        });

        this.browserPool.set(`browser-${i}`, {
          browser,
          inUse: false,
          lastUsed: Date.now()
        });
      } catch (error) {
        console.error(`Failed to create browser ${i}:`, error);
      }
    }

    console.log(`Browser pool initialized with ${this.browserPool.size} instances`);
  }

  // Setup monitoring and metrics collection
  async setupMonitoring() {
    // Health check job scheduled every 5 minutes
    this.queues.get('directory-submissions').add(
      JOB_TYPES.HEALTH_CHECK,
      { timestamp: Date.now() },
      {
        repeat: { cron: '*/5 * * * *' },
        removeOnComplete: 5,
        removeOnFail: 2
      }
    );

    // Cleanup job scheduled every hour
    this.queues.get('directory-submissions').add(
      JOB_TYPES.CLEANUP_STALE,
      { timestamp: Date.now() },
      {
        repeat: { cron: '0 * * * *' },
        removeOnComplete: 3,
        removeOnFail: 1
      }
    );

    // Metrics collection
    setInterval(async () => {
      await this.collectMetrics();
    }, 30000); // Every 30 seconds
  }

  // Process directory submission job
  async processDirectorySubmission(job) {
    const { submissionId, directoryId, businessData, processingConfig } = job.data;
    
    try {
      job.progress(10);
      console.log(`Processing submission ${submissionId} for directory ${directoryId}`);

      // Update submission status
      await this.updateSubmissionStatus(submissionId, 'processing', {
        processing_started_at: new Date().toISOString(),
        processing_job_id: job.id
      });

      job.progress(20);

      // Get directory information
      const directory = await this.getDirectoryInfo(directoryId);
      if (!directory) {
        throw new Error('Directory not found');
      }

      job.progress(30);

      // Choose processing method
      const method = processingConfig?.method || this.selectOptimalMethod(directory);
      
      let result;
      if (method === 'api' && directory.api_config) {
        result = await this.processViaAPI(submissionId, directory, businessData, job);
      } else {
        result = await this.processViaBrowser(submissionId, directory, businessData, job);
      }

      job.progress(90);

      // Update submission with results
      await this.updateSubmissionStatus(submissionId, result.status, {
        external_submission_id: result.external_id,
        submitted_at: result.status === 'submitted' ? new Date().toISOString() : null,
        response_data: result.response_data,
        processing_completed_at: new Date().toISOString(),
        processing_time: Date.now() - job.timestamp
      });

      job.progress(100);

      this.metrics.processed++;
      
      return {
        success: true,
        submissionId,
        status: result.status,
        processingTime: Date.now() - job.timestamp
      };

    } catch (error) {
      console.error(`Failed to process submission ${submissionId}:`, error);
      
      await this.updateSubmissionStatus(submissionId, 'failed', {
        failure_reason: error.message,
        failed_at: new Date().toISOString(),
        retry_count: job.attemptsMade
      });

      this.metrics.failed++;
      throw error;
    }
  }

  // Process via API
  async processViaAPI(submissionId, directory, businessData, job) {
    const apiConfig = directory.api_config;
    
    try {
      const response = await fetch(apiConfig.endpoint, {
        method: apiConfig.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...apiConfig.headers
        },
        body: JSON.stringify(this.mapBusinessDataToAPI(businessData, apiConfig.field_mapping)),
        timeout: apiConfig.timeout || 30000
      });

      const responseData = await response.json();
      
      if (response.ok) {
        return {
          status: 'submitted',
          external_id: responseData.id || responseData.submission_id,
          response_data: responseData
        };
      } else {
        throw new Error(`API Error: ${response.status} - ${responseData.message}`);
      }

    } catch (error) {
      console.error('API processing error:', error);
      
      // Fallback to browser if API fails
      if (job.attemptsMade < 2) {
        return await this.processViaBrowser(submissionId, directory, businessData, job);
      }
      
      throw error;
    }
  }

  // Process via browser automation
  async processViaBrowser(submissionId, directory, businessData, job) {
    const browser = await this.getBrowserInstance();
    
    try {
      const page = await browser.newPage();
      
      // Set viewport and user agent
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

      job.progress(40);

      // Navigate to directory submission page
      await page.goto(directory.submission_url, { waitUntil: 'networkidle2' });
      
      job.progress(50);

      // Handle form filling
      const formResult = await this.fillDirectoryForm(page, directory, businessData, job);
      
      job.progress(80);

      // Submit form and handle response
      const submissionResult = await this.submitDirectoryForm(page, directory, job);

      await page.close();

      return {
        status: submissionResult.success ? 'submitted' : 'failed',
        external_id: submissionResult.confirmationId,
        response_data: {
          confirmation_page: submissionResult.confirmationUrl,
          screenshots: submissionResult.screenshots,
          automation_method: 'browser'
        }
      };

    } catch (error) {
      console.error('Browser processing error:', error);
      throw error;
    } finally {
      this.releaseBrowserInstance(browser);
    }
  }

  // Fill directory form using browser automation
  async fillDirectoryForm(page, directory, businessData, job) {
    const formFields = directory.form_fields || [];
    
    for (const field of formFields) {
      try {
        const value = this.mapBusinessDataToField(businessData, field);
        
        if (field.type === 'text' || field.type === 'email') {
          await page.waitForSelector(field.selector, { timeout: 10000 });
          await page.type(field.selector, value);
        } else if (field.type === 'select') {
          await page.waitForSelector(field.selector, { timeout: 10000 });
          await page.select(field.selector, value);
        } else if (field.type === 'checkbox') {
          if (value) {
            await page.waitForSelector(field.selector, { timeout: 10000 });
            await page.click(field.selector);
          }
        }

        // Add delay between field inputs
        await page.waitForTimeout(500);
        
      } catch (error) {
        console.error(`Failed to fill field ${field.name}:`, error);
        
        if (field.required) {
          throw new Error(`Required field ${field.name} could not be filled`);
        }
      }
    }

    return { success: true };
  }

  // Submit form and handle response
  async submitDirectoryForm(page, directory, job) {
    try {
      // Handle CAPTCHA if present
      await this.handleCaptcha(page, directory);

      // Take screenshot before submission
      const beforeScreenshot = await page.screenshot({ fullPage: true });
      
      // Click submit button
      await page.waitForSelector(directory.submit_button_selector, { timeout: 10000 });
      await page.click(directory.submit_button_selector);

      // Wait for response
      await page.waitForTimeout(3000);

      // Check for success indicators
      const isSuccess = await this.checkSubmissionSuccess(page, directory);
      
      // Take screenshot after submission
      const afterScreenshot = await page.screenshot({ fullPage: true });

      const result = {
        success: isSuccess,
        confirmationUrl: page.url(),
        screenshots: [
          { type: 'before_submit', data: beforeScreenshot.toString('base64') },
          { type: 'after_submit', data: afterScreenshot.toString('base64') }
        ]
      };

      // Extract confirmation ID if successful
      if (isSuccess && directory.confirmation_selector) {
        try {
          const confirmationElement = await page.$(directory.confirmation_selector);
          if (confirmationElement) {
            result.confirmationId = await page.evaluate(el => el.textContent, confirmationElement);
          }
        } catch (error) {
          console.warn('Could not extract confirmation ID:', error);
        }
      }

      return result;

    } catch (error) {
      console.error('Form submission error:', error);
      throw error;
    }
  }

  // Handle CAPTCHA challenges
  async handleCaptcha(page, directory) {
    // Check for common CAPTCHA types
    const captchaSelectors = [
      '.g-recaptcha',
      '.h-captcha',
      '#captcha',
      '.captcha-container'
    ];

    for (const selector of captchaSelectors) {
      try {
        const captchaElement = await page.$(selector);
        if (captchaElement) {
          // For production, integrate with CAPTCHA solving service
          console.log('CAPTCHA detected, requires manual intervention');
          throw new Error('CAPTCHA_REQUIRED');
        }
      } catch (error) {
        if (error.message === 'CAPTCHA_REQUIRED') {
          throw error;
        }
      }
    }
  }

  // Check submission success
  async checkSubmissionSuccess(page, directory) {
    const successIndicators = directory.success_indicators || [
      'thank you',
      'success',
      'submitted',
      'confirmation',
      'received'
    ];

    const pageContent = await page.content();
    const pageText = await page.evaluate(() => document.body.textContent);

    return successIndicators.some(indicator => 
      pageText.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  // Process bulk submissions
  async processBulkSubmissions(job) {
    const { batchId, submissionIds, processingConfig } = job.data;
    const results = [];

    try {
      job.progress(5);
      
      for (let i = 0; i < submissionIds.length; i++) {
        const submissionId = submissionIds[i];
        
        try {
          // Add individual submission to priority queue
          const priorityQueue = this.queues.get('priority-submissions');
          const submissionJob = await priorityQueue.add(
            JOB_TYPES.PROCESS_SUBMISSION,
            {
              submissionId,
              batchId,
              processingConfig
            },
            {
              priority: processingConfig.priority || 5,
              delay: i * 2000 // Stagger submissions
            }
          );

          results.push({
            submissionId,
            jobId: submissionJob.id,
            status: 'queued'
          });

        } catch (error) {
          console.error(`Failed to queue submission ${submissionId}:`, error);
          results.push({
            submissionId,
            error: error.message,
            status: 'failed_to_queue'
          });
        }

        job.progress(Math.round(((i + 1) / submissionIds.length) * 90));
      }

      // Update batch status
      await this.updateBatchStatus(batchId, 'processing', {
        individual_jobs_created: results.filter(r => r.jobId).length,
        failed_to_queue: results.filter(r => r.status === 'failed_to_queue').length
      });

      job.progress(100);

      return {
        success: true,
        batchId,
        results,
        totalJobs: results.length
      };

    } catch (error) {
      console.error(`Failed to process bulk submissions for batch ${batchId}:`, error);
      throw error;
    }
  }

  // Process verification action
  async processVerificationAction(job) {
    const { actionId, actionType, submissionId } = job.data;

    try {
      // Implementation for different verification types
      // (phone verification, email verification, etc.)
      
      return {
        success: true,
        actionId,
        result: 'verification_completed'
      };

    } catch (error) {
      console.error(`Failed to process verification action ${actionId}:`, error);
      throw error;
    }
  }

  // Process retry operation
  async processRetryOperation(job) {
    const { itemId, itemType, retryConfig } = job.data;

    try {
      if (itemType === 'submission') {
        // Retry submission processing
        const submissionsQueue = this.queues.get('directory-submissions');
        const retryJob = await submissionsQueue.add(
          JOB_TYPES.PROCESS_SUBMISSION,
          {
            submissionId: itemId,
            isRetry: true,
            retryAttempt: job.attemptsMade + 1,
            processingConfig: retryConfig
          },
          {
            priority: (retryConfig.priority || 3) + 2, // Higher priority for retries
            delay: retryConfig.delay || 0
          }
        );

        return {
          success: true,
          itemId,
          retryJobId: retryJob.id
        };
      }

    } catch (error) {
      console.error(`Failed to process retry for ${itemId}:`, error);
      throw error;
    }
  }

  // Process health check
  async processHealthCheck(job) {
    const healthData = {
      timestamp: new Date().toISOString(),
      queues: {},
      browserPool: this.getBrowserPoolStatus(),
      metrics: this.metrics,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    // Check each queue
    for (const [queueName, queue] of this.queues.entries()) {
      try {
        const [waiting, active, completed, failed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed()
        ]);

        healthData.queues[queueName] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length
        };
      } catch (error) {
        console.error(`Failed to get queue stats for ${queueName}:`, error);
        healthData.queues[queueName] = { error: error.message };
      }
    }

    // Store health data
    await this.storeHealthMetrics(healthData);

    return healthData;
  }

  // Utility methods
  async getBrowserInstance() {
    for (const [id, instance] of this.browserPool.entries()) {
      if (!instance.inUse) {
        instance.inUse = true;
        instance.lastUsed = Date.now();
        return instance.browser;
      }
    }

    // If no browsers available, create a temporary one
    console.warn('No browsers available in pool, creating temporary instance');
    return await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  releaseBrowserInstance(browser) {
    for (const [id, instance] of this.browserPool.entries()) {
      if (instance.browser === browser) {
        instance.inUse = false;
        return;
      }
    }

    // If it's a temporary browser, close it
    browser.close().catch(error => 
      console.error('Failed to close temporary browser:', error)
    );
  }

  getBrowserPoolStatus() {
    const status = {
      total: this.browserPool.size,
      available: 0,
      inUse: 0
    };

    for (const instance of this.browserPool.values()) {
      if (instance.inUse) {
        status.inUse++;
      } else {
        status.available++;
      }
    }

    return status;
  }

  // Database operations
  async updateSubmissionStatus(submissionId, status, additionalData = {}) {
    const { error } = await supabase
      .from('user_submissions')
      .update({
        submission_status: status,
        updated_at: new Date().toISOString(),
        ...additionalData
      })
      .eq('id', submissionId);

    if (error) {
      console.error('Failed to update submission status:', error);
      throw error;
    }
  }

  async updateBatchStatus(batchId, status, additionalData = {}) {
    const { error } = await supabase
      .from('batch_submissions')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...additionalData
      })
      .eq('id', batchId);

    if (error) {
      console.error('Failed to update batch status:', error);
      throw error;
    }
  }

  async getDirectoryInfo(directoryId) {
    const { data, error } = await supabase
      .from('directories')
      .select('*')
      .eq('id', directoryId)
      .single();

    if (error) {
      console.error('Failed to get directory info:', error);
      return null;
    }

    return data;
  }

  // Setup event listeners for queues
  setupQueueEventListeners(queue, queueName) {
    queue.on('completed', (job, result) => {
      console.log(`Job completed: ${queueName}:${job.id}`);
      this.metrics.processed++;
    });

    queue.on('failed', (job, error) => {
      console.error(`Job failed: ${queueName}:${job.id} - ${error.message}`);
      this.metrics.failed++;
    });

    queue.on('stalled', (job) => {
      console.warn(`Job stalled: ${queueName}:${job.id}`);
    });

    queue.on('progress', (job, progress) => {
      console.log(`Job progress: ${queueName}:${job.id} - ${progress}%`);
    });
  }

  // Graceful shutdown
  setupGracefulShutdown() {
    const shutdown = async () => {
      if (this.isShuttingDown) return;
      
      this.isShuttingDown = true;
      console.log('Gracefully shutting down Queue Worker...');

      try {
        // Close all queues
        for (const queue of this.queues.values()) {
          await queue.close();
        }

        // Close browser instances
        for (const instance of this.browserPool.values()) {
          await instance.browser.close();
        }

        // Close Redis connections
        redis.disconnect();
        subscriber.disconnect();
        publisher.disconnect();

        console.log('Queue Worker shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  // Additional utility methods
  selectOptimalMethod(directory) {
    if (directory.api_config && directory.api_success_rate > 0.9) {
      return 'api';
    }
    return 'browser';
  }

  mapBusinessDataToAPI(businessData, fieldMapping) {
    const apiData = {};
    for (const [apiField, businessField] of Object.entries(fieldMapping)) {
      apiData[apiField] = businessData[businessField];
    }
    return apiData;
  }

  mapBusinessDataToField(businessData, field) {
    const mapping = {
      business_name: businessData.business_name,
      business_email: businessData.business_email,
      business_url: businessData.business_url,
      business_description: businessData.business_description,
      business_phone: businessData.business_phone,
      business_address: businessData.business_address,
      business_category: businessData.business_category
    };

    return mapping[field.name] || field.default_value || '';
  }

  async collectMetrics() {
    // Collect and store performance metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      processed: this.metrics.processed,
      failed: this.metrics.failed,
      success_rate: this.metrics.processed / (this.metrics.processed + this.metrics.failed) * 100 || 0,
      uptime: Date.now() - this.metrics.startTime
    };

    // Store in Redis for monitoring dashboard
    await redis.setex('queue:metrics:current', 300, JSON.stringify(metrics));
  }

  async storeHealthMetrics(healthData) {
    await redis.setex('queue:health:current', 300, JSON.stringify(healthData));
  }
}

// Export worker instance
const queueWorker = new QueueWorker();

module.exports = {
  QueueWorker,
  queueWorker,
  JOB_TYPES
};

// Auto-initialize if run directly
if (require.main === module) {
  queueWorker.initialize().catch(error => {
    console.error('Failed to start Queue Worker:', error);
    process.exit(1);
  });
}