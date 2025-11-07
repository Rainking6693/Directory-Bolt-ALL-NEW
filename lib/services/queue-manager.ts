/**
 * AutoBolt Queue Management Service
 * 
 * Handles the queue processing system for DirectoryBolt customer submissions.
 * Integrates with Airtable to process pending customers based on their package limits.
 * 
 * Phase 3, Section 3.1 Implementation:
 * - 3.1.1: Reads "pending" records from Airtable
 * - 3.1.2: Respects packageType limits (50, 100, 200 directories)
 * - 3.1.3: Updates submissionStatus during processing
 * - 3.1.4: Batch processing with delays between submissions
 * - 3.1.5: Error handling and retry logic
 */

const { createSupabaseService } = require('./supabase.js')

// Temporary types for build compatibility
interface AutoBoltProcessingResult {
  success: boolean
  message: string
  totalDirectories: number
  processedDirectories: number
  successfulSubmissions: number
  failedSubmissions: number
  skippedDirectories: number
  completedAt: Date
  processingTimeSeconds?: number
  results: Array<{
    success: boolean
    directoryName: string
    error?: string
  }>
}

interface DirectoryEntry {
  id: string
  name: string
}

interface EnhancedProcessingResult {
  totalDirectories: number
  processedDirectories: number
  successfulSubmissions: number
  failedSubmissions: number
  skippedDirectories: number
  completedAt: Date
  processingTimeSeconds?: number
  averageConfidence: number
  mappingStats: {
    siteSpecific: number
    autoMapped: number
    fallbackMapped: number
    manualMapped: number
  }
  results: Array<{
    success: boolean
    directoryName: string
    error?: string
  }>
}

// Re-export types for convenience
export type { QueueItem, BusinessSubmissionRecord } from '../types/queue.types'
import type { QueueItem, BusinessSubmissionRecord } from '../types/queue.types'

export interface QueueProcessingResult {
  success: boolean
  customerId: string
  directoriesProcessed: number
  directoriesFailed: number
  completedAt: Date
  processingTimeSeconds: number
  errors?: string[]
  warnings?: string[]
  skippedDirectories?: string[]
  message?: string
}

export interface QueueStats {
  totalPending: number
  totalInProgress: number
  totalCompleted: number
  totalFailed: number
  totalPaused: number
  averageProcessingTime: number
  averageWaitTime: number
  queueDepth: number
  todaysProcessed: number
  todaysGoal: number
  successRate: number
  currentThroughput: number
  peakHours: { hour: number; count: number }[]
}

export class QueueManager {
  private supabaseService: ReturnType<typeof createSupabaseService> | null = null
  private isProcessing: boolean = false
  private processingQueue: QueueItem[] = []
  private maxConcurrentProcessing: number = 3
  private retryAttempts: number = 3
  private retryDelay: number = 5000 // 5 seconds
  private batchDelay: number = 2000 // 2 seconds between batches

  constructor() {
    // Lazy load Google Sheets service to avoid build-time initialization
  }

  /**
   * Get or create Supabase service instance (lazy-loaded)
   */
  private getSupabaseService(): ReturnType<typeof createSupabaseService> {
    if (!this.supabaseService) {
      this.supabaseService = createSupabaseService()
    }
    return this.supabaseService
  }

  /**
   * 3.1.1: Read "pending" records from Supabase
   */
  async getPendingQueue(): Promise<QueueItem[]> {
    try {
      console.log('🔄 Fetching pending submissions from Supabase...')
      
      // Test Supabase connection first
      const supabaseService = this.getSupabaseService()
      const healthCheck = await supabaseService.healthCheck()
      
      if (!healthCheck) {
        throw new Error('Supabase health check failed - connection not working')
      }
      
      const pendingRecords = await supabaseService.findByStatus('pending')
      
      const queueItems: QueueItem[] = pendingRecords.map((record: any) => {
        const packageType = record.packageType || 'starter'
        const directoryLimit = this.getDirectoryLimit(packageType)
        
        return {
          recordId: record.recordId,
          customerId: record.customerId,
          businessName: record.businessName,
          packageType,
          directoryLimit,
          submissionStatus: record.submissionStatus,
          priority: this.calculatePriority(packageType, record.purchaseDate),
          createdAt: record.purchaseDate,
          updatedAt: new Date().toISOString(),
          businessData: record
        }
      })

      // Sort by priority (higher first) then by creation date (oldest first)
      queueItems.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })

      console.log(`✅ Found ${queueItems.length} pending submissions from Supabase`)
      return queueItems

    } catch (error) {
      console.error('❌ Failed to fetch pending queue from Supabase, using mock data:', error)
      return this.getMockPendingQueue()
    }
  }

  /**
   * Get mock pending queue for development/fallback
   */
  private getMockPendingQueue(): QueueItem[] {
    const mockCustomers: QueueItem[] = [
      {
        recordId: 'rec001',
        customerId: 'DIR-2025-001234',
        businessName: 'TechStart Solutions',
        packageType: 'pro',
        directoryLimit: 200,
        submissionStatus: 'pending',
        priority: 105,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        businessData: {
          businessName: 'TechStart Solutions',
          businessDescription: 'Enterprise technology solutions',
          businessUrl: 'https://techstart.com',
          packageType: 'pro',
          submissionStatus: 'pending',
          purchaseDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        } as BusinessSubmissionRecord
      },
      {
        recordId: 'rec002',
        customerId: 'DIR-2025-005678',
        businessName: 'Local Cafe & Bistro',
        packageType: 'growth',
        directoryLimit: 100,
        submissionStatus: 'pending',
        priority: 78,
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        businessData: {
          businessName: 'Local Cafe & Bistro',
          businessDescription: 'Neighborhood cafe and bistro',
          businessUrl: 'https://localcafe.com',
          packageType: 'growth',
          submissionStatus: 'pending',
          purchaseDate: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
        } as BusinessSubmissionRecord
      },
      {
        recordId: 'rec003',
        customerId: 'DIR-2025-009012',
        businessName: 'Fitness First Gym',
        packageType: 'starter',
        directoryLimit: 50,
        submissionStatus: 'pending',
        priority: 52,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        businessData: {
          businessName: 'Fitness First Gym',
          businessDescription: 'Full service fitness center',
          businessUrl: 'https://fitnessfirst.com',
          packageType: 'starter',
          submissionStatus: 'pending',
          purchaseDate: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        } as BusinessSubmissionRecord
      }
    ]

    return mockCustomers
  }

  /**
   * 3.1.2: Get directory limits based on package type
   */
  private getDirectoryLimit(packageType: string): number {
    const limits = {
      'starter': 50,
      'growth': 100,
      'pro': 200,
      'subscription': 0 // Subscription is ongoing, not bulk
    }
    return limits[packageType.toLowerCase() as keyof typeof limits] || 50
  }

  /**
   * Calculate processing priority based on package and purchase date
   * Pro > Growth > Starter, with newer orders getting slight priority
   */
  private calculatePriority(packageType: string, purchaseDate: string): number {
    const packagePriority = {
      'pro': 100,
      'growth': 75,
      'starter': 50,
      'subscription': 25
    }

    const basePriority = packagePriority[packageType.toLowerCase() as keyof typeof packagePriority] || 50
    
    // Add small time-based priority (newer gets +1-5 points)
    const daysSincePurchase = Math.floor((Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24))
    const timePriority = Math.max(0, 5 - daysSincePurchase)
    
    return basePriority + timePriority
  }

  /**
   * 3.1.3: Update submission status during processing
   */
  async updateSubmissionStatus(
    customerId: string, 
    status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'paused',
    directoriesSubmitted?: number,
    failedDirectories?: number
  ): Promise<void> {
    try {
      console.log(`🔄 Updating status for ${customerId} to ${status}`)
      
      await this.getSupabaseService().updateSubmissionStatus(
        customerId,
        status,
        directoriesSubmitted,
        failedDirectories
      )

      console.log(`✅ Status updated for ${customerId}`)
    } catch (error) {
      console.error(`❌ Failed to update status for ${customerId}:`, error)
      throw error
    }
  }

  /**
   * 3.1.4: Batch processing with delays between submissions
   * Process customers in batches with configurable delays
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('⚠️ Queue processing already in progress')
      return
    }

    this.isProcessing = true
    console.log('🚀 Starting AutoBolt queue processing...')

    try {
      const pendingQueue = await this.getPendingQueue()
      
      if (pendingQueue.length === 0) {
        console.log('📭 No pending submissions to process')
        return
      }

      console.log(`📊 Processing ${pendingQueue.length} submissions...`)

      // Process in batches to avoid overwhelming external systems
      const batchSize = this.maxConcurrentProcessing
      for (let i = 0; i < pendingQueue.length; i += batchSize) {
        const batch = pendingQueue.slice(i, i + batchSize)
        
        console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(pendingQueue.length / batchSize)}`)
        
        // Process batch concurrently
        const batchPromises = batch.map(item => this.processCustomer(item))
        await Promise.allSettled(batchPromises)
        
        // Add delay between batches (except for last batch)
        if (i + batchSize < pendingQueue.length) {
          console.log(`⏳ Waiting ${this.batchDelay}ms before next batch...`)
          await this.delay(this.batchDelay)
        }
      }

      console.log('✅ Queue processing completed')

    } catch (error) {
      console.error('❌ Queue processing failed:', error)
      throw error
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process individual customer with retry logic
   * 3.1.5: Error handling and retry logic
   */
  async processCustomer(queueItem: QueueItem): Promise<QueueProcessingResult> {
    const { customerId, businessData, directoryLimit } = queueItem
    
    console.log(`🔄 Processing customer ${customerId} (${businessData.businessName})`)

    // Update status to in-progress
    await this.updateSubmissionStatus(customerId, 'in-progress')

    let lastError: Error | null = null
    
    // Retry logic
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`📡 Attempt ${attempt}/${this.retryAttempts} for ${customerId}`)
        
        const result = await this.processDirectorySubmissions(queueItem)
        
        // Update status to completed with results
        await this.updateSubmissionStatus(
          customerId,
          'completed',
          result.directoriesProcessed,
          result.directoriesFailed
        )

        console.log(`✅ Customer ${customerId} processed successfully`)
        return result

      } catch (error) {
        lastError = error as Error
        console.error(`❌ Attempt ${attempt} failed for ${customerId}:`, error)
        
        if (attempt < this.retryAttempts) {
          console.log(`⏳ Waiting ${this.retryDelay}ms before retry...`)
          await this.delay(this.retryDelay)
        }
      }
    }

    // All retries failed, mark as failed
    await this.updateSubmissionStatus(customerId, 'failed', 0, directoryLimit)
    
    console.error(`❌ Customer ${customerId} processing failed after ${this.retryAttempts} attempts`)
    
    return {
      success: false,
      customerId,
      directoriesProcessed: 0,
      directoriesFailed: directoryLimit,
      completedAt: new Date(),
      processingTimeSeconds: 0,
      errors: [lastError?.message || 'Unknown error after multiple retries']
    }
  }

  /**
   * Process directory submissions for a customer
   * Phase 3.2 Integration: Uses AutoBolt Extension Service for basic directory processing
   * Phase 3.3 Integration: Enhanced with Dynamic Form Mapping Engine
   */
  private async processDirectorySubmissions(queueItem: QueueItem): Promise<QueueProcessingResult> {
    const { customerId, businessData, directoryLimit } = queueItem
    
    console.log(`🚀 Starting directory processing for ${businessData.businessName} (${directoryLimit} directories)`)
    
    // Choose processing method based on customer tier and directory complexity
    const useEnhancedProcessing = this.shouldUseEnhancedProcessing(queueItem)
    
    if (useEnhancedProcessing) {
      return await this.processDirectorySubmissionsEnhanced(queueItem)
    } else {
      return await this.processDirectorySubmissionsBasic(queueItem)
    }
  }

  /**
   * Phase 3.3: Enhanced directory processing with dynamic form mapping
   */
  private async processDirectorySubmissionsEnhanced(queueItem: QueueItem): Promise<QueueProcessingResult> {
    const { customerId, businessData, directoryLimit } = queueItem
    
    console.log(`🚀 Starting Enhanced AutoBolt processing for ${businessData.businessName} (${directoryLimit} directories)`)

    try {
      // Find or create job in Supabase, then send to SQS
      const jobId = await this.findOrCreateJob(customerId, businessData, directoryLimit)
      
      // Send job to SQS queue for real backend processing
      // The Python backend subscriber will pick it up and process with Prefect + Playwright
      await this.sendJobToSQS(jobId, customerId, directoryLimit)
      
      console.log(`✅ Enhanced AutoBolt job ${jobId} queued for real processing via SQS`)

      // Return immediate response - real processing happens in background
      return {
        success: true,
        customerId,
        directoriesProcessed: 0, // Will be updated by backend as it processes
        directoriesFailed: 0,
        completedAt: new Date(),
        processingTimeSeconds: 0,
        errors: [],
        message: `Job ${jobId} queued for real processing. Submissions will be performed by Python backend.`
      }

    } catch (error) {
      console.error(`❌ Enhanced AutoBolt processing failed for ${customerId}:`, error)
      
      // Fallback to basic processing if enhanced fails
      console.log(`🔄 Falling back to basic processing for ${customerId}`)
      return await this.processDirectorySubmissionsBasic(queueItem)
    }
  }

  /**
   * Phase 3.2: Basic directory processing (fallback)
   */
  private async processDirectorySubmissionsBasic(queueItem: QueueItem): Promise<QueueProcessingResult> {
    const { customerId, businessData, directoryLimit } = queueItem
    
    console.log(`🚀 Starting basic AutoBolt processing for ${businessData.businessName} (${directoryLimit} directories)`)
    
    try {
      // Find or create job in Supabase, then send to SQS
      const jobId = await this.findOrCreateJob(customerId, businessData, directoryLimit)
      
      // Send job to SQS queue for real backend processing
      // The Python backend subscriber will pick it up and process with Prefect + Playwright
      await this.sendJobToSQS(jobId, customerId, directoryLimit)
      
      console.log(`✅ Basic AutoBolt job ${jobId} queued for real processing via SQS`)

      // Return immediate response - real processing happens in background
      return {
        success: true,
        customerId,
        directoriesProcessed: 0, // Will be updated by backend as it processes
        directoriesFailed: 0,
        completedAt: new Date(),
        processingTimeSeconds: 0,
        errors: [],
        message: `Job ${jobId} queued for real processing. Submissions will be performed by Python backend.`
      }

    } catch (error) {
      console.error(`❌ Basic AutoBolt processing failed for ${customerId}:`, error)
      
      return {
        success: false,
        customerId,
        directoriesProcessed: 0,
        directoriesFailed: directoryLimit,
        completedAt: new Date(),
        processingTimeSeconds: 0,
        errors: [`AutoBolt processing error: ${error instanceof Error ? error.message : String(error)}`]
      }
    }
  }

  /**
   * Determine if enhanced processing should be used
   */
  private shouldUseEnhancedProcessing(queueItem: QueueItem): boolean {
    // Use enhanced processing for Growth and Pro tiers
    const enhancedTiers = ['growth', 'pro']
    return enhancedTiers.includes(queueItem.packageType)
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      const supabaseService = this.getSupabaseService()
      const healthCheck = await supabaseService.healthCheck()
      
      if (!healthCheck) {
        console.warn('⚠️ Supabase not configured, using mock data for development')
        return this.getMockQueueStats()
      }

      const [pending, inProgress, completed, failed] = await Promise.all([
        supabaseService.findByStatus('pending'),
        supabaseService.findByStatus('in-progress'),
        supabaseService.findByStatus('completed'),
        supabaseService.findByStatus('failed')
      ])

      return {
        totalPending: pending.length,
        totalInProgress: inProgress.length,
        totalCompleted: completed.length,
        totalFailed: failed.length,
        totalPaused: 0,
        averageProcessingTime: 0, // TODO: Calculate from actual data
        averageWaitTime: 0,
        queueDepth: pending.length + inProgress.length,
        todaysProcessed: 0,
        todaysGoal: 50,
        successRate: completed.length / Math.max(completed.length + failed.length, 1),
        currentThroughput: 0,
        peakHours: []
      }
    } catch (error) {
      console.error('❌ Failed to get queue stats from Supabase, falling back to mock data:', error)
      return this.getMockQueueStats()
    }
  }

  /**
   * Get mock queue statistics for development/fallback
   */
  private getMockQueueStats(): QueueStats {
    return {
      totalPending: 5,
      totalInProgress: 2,
      totalCompleted: 23,
      totalFailed: 1,
      totalPaused: 0,
      averageProcessingTime: 45,
      averageWaitTime: 2.5,
      queueDepth: 7,
      todaysProcessed: 8,
      todaysGoal: 50,
      successRate: 0.92,
      currentThroughput: 1.2,
      peakHours: [
        { hour: 9, count: 3 },
        { hour: 14, count: 5 },
        { hour: 16, count: 4 }
      ]
    }
  }

  /**
   * Get next customer to process (highest priority pending)
   */
  async getNextCustomer(): Promise<QueueItem | null> {
    try {
      const pendingQueue = await this.getPendingQueue()
      return pendingQueue.length > 0 ? pendingQueue[0] : null
    } catch (error) {
      console.error('❌ Failed to get next customer:', error)
      return null
    }
  }

  /**
   * Process a specific customer by ID
   */
  async processSpecificCustomer(customerId: string): Promise<QueueProcessingResult> {
    try {
      const record = await this.getSupabaseService().findByCustomerId(customerId)
      
      if (!record) {
        throw new Error(`Customer ${customerId} not found`)
      }

      if (record.submissionStatus !== 'pending') {
        throw new Error(`Customer ${customerId} is not in pending status (current: ${record.submissionStatus})`)
      }

      const queueItem: QueueItem = {
        recordId: record.recordId,
        customerId: record.customerId,
        businessName: record.businessName,
        packageType: record.packageType,
        directoryLimit: this.getDirectoryLimit(record.packageType),
        submissionStatus: record.submissionStatus,
        priority: this.calculatePriority(record.packageType, record.purchaseDate),
        createdAt: record.purchaseDate,
        updatedAt: new Date().toISOString(),
        businessData: record
      }

      return await this.processCustomer(queueItem)

    } catch (error) {
      console.error(`❌ Failed to process specific customer ${customerId}:`, error)
      throw error
    }
  }

  /**
   * Find or create a job in Supabase for the customer
   */
  private async findOrCreateJob(customerId: string, businessData: any, directoryLimit: number): Promise<string> {
    try {
      const supabaseService = this.getSupabaseService()
      
      // Try to find existing pending job for this customer
      const existingJobs = await supabaseService.findByCustomerId(customerId)
      
      // Look for pending job in Supabase directly
      const { createClient } = require('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase not configured')
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      // Check for existing pending job
      const { data: existingJob } = await supabase
        .from('jobs')
        .select('id')
        .eq('customer_id', customerId)
        .eq('status', 'pending')
        .single()
      
      if (existingJob?.id) {
        console.log(`✅ Found existing job ${existingJob.id} for customer ${customerId}`)
        return existingJob.id
      }
      
      // Create new job
      const { data: newJob, error: jobError } = await supabase
        .from('jobs')
        .insert({
          customer_id: customerId,
          business_name: businessData.businessName || businessData.business_name || 'Unknown Business',
          email: businessData.email || '',
          package_size: directoryLimit,
          priority_level: this.getPriorityFromPackageSize(directoryLimit),
          status: 'pending',
          metadata: {
            businessName: businessData.businessName || businessData.business_name,
            email: businessData.email,
            phone: businessData.phone,
            website: businessData.website || businessData.businessUrl,
            address: businessData.address,
            city: businessData.city,
            state: businessData.state,
            zip: businessData.zip,
            package_size: directoryLimit
          }
        })
        .select('id')
        .single()
      
      if (jobError || !newJob) {
        throw new Error(`Failed to create job: ${jobError?.message || 'Unknown error'}`)
      }
      
      console.log(`✅ Created new job ${newJob.id} for customer ${customerId}`)
      return newJob.id
      
    } catch (error) {
      console.error(`❌ Error finding/creating job for ${customerId}:`, error)
      throw error
    }
  }

  /**
   * Send job to AWS SQS queue for real backend processing
   */
  private async sendJobToSQS(jobId: string, customerId: string, packageSize: number): Promise<void> {
    const baseUrl =
      process.env.BACKEND_ENQUEUE_URL ||
      process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_ENQUEUE_URL

    if (!baseUrl) {
      console.error('🚨 BACKEND_ENQUEUE_URL not configured - cannot send job to backend queue service')
      throw new Error('Queue backend URL not configured')
    }

    const enqueueToken =
      process.env.BACKEND_ENQUEUE_TOKEN ||
      process.env.STAFF_API_KEY ||
      process.env.ADMIN_API_KEY ||
      (process.env.TEST_MODE === 'true' ? 'DirectoryBolt-Staff-2025-SecureKey' : '')

    const endpoint = `${baseUrl.replace(/\/$/, '')}/api/jobs/enqueue`

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(enqueueToken ? { Authorization: `Bearer ${enqueueToken}` } : {}),
          'X-Source-Service': 'netlify-frontend'
        },
        body: JSON.stringify({
          job_id: jobId,
          customer_id: customerId,
          package_size: packageSize,
          priority: this.getPriorityFromPackageSize(packageSize),
          metadata: {
            source: 'netlify_frontend',
            created_at: new Date().toISOString()
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const message = errorData?.detail || errorData?.error || `Failed to enqueue job: HTTP ${response.status}`
        throw new Error(message)
      }

      const result = await response.json()
      const messageId = result.message_id || result.messageId
      console.log(`✅ Job ${jobId} sent to backend queue service. MessageId: ${messageId}`)

    } catch (error) {
      console.error(`❌ Error sending job ${jobId} to backend queue service:`, error)
      // Don't throw - allow job to be created even if enqueue fails so monitors can retry later
      console.warn(`⚠️ Job ${jobId} created but not enqueued. It may be processed later by monitors.`)
    }
  }

  /**
   * Get priority level from package size
   */
  private getPriorityFromPackageSize(packageSize: number): number {
    if (packageSize >= 500) return 1 // Enterprise
    if (packageSize >= 400) return 2 // Professional
    if (packageSize >= 250) return 3 // Growth
    return 4 // Starter
  }

  /**
   * Mock basic processing for development (DEPRECATED - DO NOT USE)
   * This function is kept for reference but should never be called
   */
  private async mockBasicProcessing(businessData: any, directoryLimit: number): Promise<AutoBoltProcessingResult> {
    // Simulate processing time
    await this.delay(2000 + Math.random() * 3000)
    
    const totalDirectories = Math.min(directoryLimit, 50)
    const successRate = 0.7 + Math.random() * 0.2 // 70-90% success rate
    const successfulSubmissions = Math.floor(totalDirectories * successRate)
    const failedSubmissions = totalDirectories - successfulSubmissions
    
    const results = Array.from({ length: totalDirectories }, (_, i) => ({
      success: i < successfulSubmissions,
      directoryName: `Directory ${i + 1}`,
      error: i >= successfulSubmissions ? 'Mock processing error' : undefined
    }))
    
    return {
      success: successfulSubmissions > 0,
      message: `Processed ${successfulSubmissions} out of ${totalDirectories} directories`,
      totalDirectories,
      processedDirectories: totalDirectories,
      successfulSubmissions,
      failedSubmissions,
      skippedDirectories: 0,
      completedAt: new Date(),
      processingTimeSeconds: 2 + Math.random() * 3,
      results
    }
  }

  /**
   * Mock enhanced processing for development (DEPRECATED - DO NOT USE)
   * This function is kept for reference but should never be called
   */
  private async mockEnhancedProcessing(businessData: any, directoryLimit: number): Promise<EnhancedProcessingResult> {
    // Simulate processing time
    await this.delay(3000 + Math.random() * 4000)
    
    const totalDirectories = Math.min(directoryLimit, 100)
    const successRate = 0.8 + Math.random() * 0.15 // 80-95% success rate for enhanced
    const successfulSubmissions = Math.floor(totalDirectories * successRate)
    const failedSubmissions = totalDirectories - successfulSubmissions
    
    const results = Array.from({ length: totalDirectories }, (_, i) => ({
      success: i < successfulSubmissions,
      directoryName: `Enhanced Directory ${i + 1}`,
      error: i >= successfulSubmissions ? 'Mock enhanced processing error' : undefined
    }))
    
    return {
      totalDirectories,
      processedDirectories: totalDirectories,
      successfulSubmissions,
      failedSubmissions,
      skippedDirectories: 0,
      completedAt: new Date(),
      processingTimeSeconds: 3 + Math.random() * 4,
      averageConfidence: 0.85 + Math.random() * 0.1,
      mappingStats: {
        siteSpecific: Math.floor(totalDirectories * 0.3),
        autoMapped: Math.floor(totalDirectories * 0.4),
        fallbackMapped: Math.floor(totalDirectories * 0.2),
        manualMapped: Math.floor(totalDirectories * 0.1)
      },
      results
    }
  }

  /**
   * Utility: Delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Check if queue processing is currently running
   */
  isQueueProcessing(): boolean {
    return this.isProcessing
  }

  /**
   * Stop queue processing (graceful shutdown)
   */
  stopProcessing(): void {
    console.log('🛑 Queue processing stop requested')
    this.isProcessing = false
  }
}

// Export lazy-loaded singleton instance
let queueManagerInstance: QueueManager | null = null

export const queueManager = (): QueueManager => {
  if (!queueManagerInstance) {
    queueManagerInstance = new QueueManager()
  }
  return queueManagerInstance
}

export default queueManager
