// Advanced Queue Management System with Load Balancing
import { dbManager } from '../database/optimized-queries'
import EventEmitter from 'events'

interface QueueJob {
  id: string
  customer_id: string
  package_type: string
  priority_level: number
  directories_allocated: number
  directories_processed: number
  retry_count: number
  max_retries: number
  created_at: string
  estimated_completion: string
}

interface ProcessingMetrics {
  totalProcessed: number
  successRate: number
  averageProcessingTime: number
  currentLoad: number
  queueSize: number
}

class AdvancedQueueManager extends EventEmitter {
  private static instance: AdvancedQueueManager
  private processingQueue: Map<string, QueueJob> = new Map()
  private activeWorkers: number = 0
  private maxWorkers: number = 10
  private processingMetrics: ProcessingMetrics = {
    totalProcessed: 0,
    successRate: 0,
    averageProcessingTime: 0,
    currentLoad: 0,
    queueSize: 0
  }

  // Priority weights for different package types
  private readonly PRIORITY_WEIGHTS = {
    enterprise: 1,
    professional: 2,
    growth: 3,
    starter: 4
  }

  // Processing capacity per package tier
  private readonly TIER_CAPACITY = {
    enterprise: { maxConcurrent: 5, processingSpeed: 1000 }, // 1 second per directory
    professional: { maxConcurrent: 3, processingSpeed: 2000 }, // 2 seconds per directory
    growth: { maxConcurrent: 2, processingSpeed: 5000 }, // 5 seconds per directory
    starter: { maxConcurrent: 1, processingSpeed: 10000 } // 10 seconds per directory
  }

  private constructor() {
    super()
    this.startQueueProcessor()
    this.startMetricsCollector()
  }

  static getInstance(): AdvancedQueueManager {
    if (!AdvancedQueueManager.instance) {
      AdvancedQueueManager.instance = new AdvancedQueueManager()
    }
    return AdvancedQueueManager.instance
  }

  // Add job to processing queue with smart prioritization
  async addToQueue(job: Omit<QueueJob, 'id' | 'retry_count' | 'max_retries'>) {
    const queueJob: QueueJob = {
      ...job,
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retry_count: 0,
      max_retries: 3
    }

    // Calculate priority score based on package type and wait time
    const waitTime = Date.now() - new Date(job.created_at).getTime()
    const priorityScore = this.calculatePriorityScore(job.package_type, waitTime)
    
    this.processingQueue.set(queueJob.id, queueJob)
    
    console.log(`🎯 Job added to queue: ${queueJob.id} (Priority: ${priorityScore})`)
    this.emit('jobAdded', queueJob)
    
    return queueJob.id
  }

  // Smart queue processing with load balancing
  private async startQueueProcessor() {
    setInterval(async () => {
      await this.processQueue()
    }, 5000) // Process every 5 seconds
  }

  private async processQueue() {
    if (this.activeWorkers >= this.maxWorkers) {
      return // At capacity
    }

    // Get next batch of jobs to process
    const jobsToProcess = this.getNextJobBatch()
    
    for (const job of jobsToProcess) {
      if (this.activeWorkers >= this.maxWorkers) break
      
      this.activeWorkers++
      this.processJob(job).finally(() => {
        this.activeWorkers--
      })
    }
  }

  // Get next batch of jobs using intelligent prioritization
  private getNextJobBatch(): QueueJob[] {
    const jobs = Array.from(this.processingQueue.values())
    
    // Sort by priority and wait time
    jobs.sort((a, b) => {
      const aPriority = this.calculatePriorityScore(a.package_type, Date.now() - new Date(a.created_at).getTime())
      const bPriority = this.calculatePriorityScore(b.package_type, Date.now() - new Date(b.created_at).getTime())
      return aPriority - bPriority
    })

    // Return batch based on available capacity
    const availableWorkers = this.maxWorkers - this.activeWorkers
    return jobs.slice(0, availableWorkers)
  }

  // Calculate dynamic priority score
  private calculatePriorityScore(packageType: string, waitTimeMs: number): number {
    const basePriority = this.PRIORITY_WEIGHTS[packageType as keyof typeof this.PRIORITY_WEIGHTS] || 5
    const waitTimePenalty = Math.floor(waitTimeMs / (60 * 60 * 1000)) // Penalty per hour waited
    
    return basePriority - waitTimePenalty // Lower score = higher priority
  }

  // Process individual job with error handling and retries
  private async processJob(job: QueueJob): Promise<void> {
    console.log(`🔄 Processing job: ${job.id} for customer: ${job.customer_id}`)
    
    try {
      const startTime = Date.now()
      
      // Update job status to processing
      await this.updateJobStatus(job.customer_id, 'processing')
      
      // Simulate directory submission processing
      const result = await this.executeDirectorySubmissions(job)
      
      const processingTime = Date.now() - startTime
      
      if (result.success) {
        await this.completeJob(job, result)
        this.updateMetrics(processingTime, true)
        console.log(`✅ Job completed: ${job.id} in ${processingTime}ms`)
      } else {
        throw new Error(result.error || 'Processing failed')
      }
      
    } catch (error) {
      console.error(`❌ Job failed: ${job.id}`, error)
      await this.handleJobFailure(job, error as Error)
      this.updateMetrics(0, false)
    } finally {
      this.processingQueue.delete(job.id)
    }
  }

  // Execute directory submissions for a customer
  private async executeDirectorySubmissions(job: QueueJob): Promise<{ success: boolean; error?: string; processed: number }> {
    try {
      // Get customer data from database
      const { data: customer, error } = await dbManager.getClient()
        .from('customers')
        .select('*')
        .eq('customer_id', job.customer_id)
        .single()

      if (error || !customer) {
        throw new Error('Customer not found')
      }

      // Simulate processing directories based on package allocation
      const tierConfig = this.TIER_CAPACITY[job.package_type as keyof typeof this.TIER_CAPACITY]
      const processingDelay = tierConfig?.processingSpeed || 5000

      // Simulate directory processing
      let processedDirectories = 0
      const totalDirectories = job.directories_allocated

      for (let i = 0; i < totalDirectories; i++) {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, processingDelay / totalDirectories))
        
        processedDirectories++
        
        // Update progress in database every 10 directories
        if (processedDirectories % 10 === 0) {
          await this.updateProcessingProgress(job.customer_id, processedDirectories)
        }
        
        // Emit progress event
        this.emit('processingProgress', {
          customerId: job.customer_id,
          processed: processedDirectories,
          total: totalDirectories,
          percentage: Math.round((processedDirectories / totalDirectories) * 100)
        })
      }

      return { success: true, processed: processedDirectories }
      
    } catch (error) {
      return { success: false, error: (error as Error).message, processed: 0 }
    }
  }

  // Update job status in database
  private async updateJobStatus(customerId: string, status: string) {
    await dbManager.getClient()
      .from('queue_history')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', customerId)
  }

  // Update processing progress
  private async updateProcessingProgress(customerId: string, processed: number) {
    await dbManager.getClient()
      .from('customers')
      .update({
        directories_submitted: processed,
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', customerId)
  }

  // Complete job successfully
  private async completeJob(job: QueueJob, result: { processed: number }) {
    await dbManager.getClient()
      .from('customers')
      .update({
        status: 'completed',
        directories_submitted: result.processed,
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', job.customer_id)

    await this.updateJobStatus(job.customer_id, 'completed')
    
    // Create completion notification
    await this.createCompletionNotification(job.customer_id, result.processed)
    
    this.emit('jobCompleted', job)
  }

  // Handle job failures with retry logic
  private async handleJobFailure(job: QueueJob, error: Error) {
    job.retry_count++
    
    if (job.retry_count < job.max_retries) {
      console.log(`🔄 Retrying job: ${job.id} (Attempt ${job.retry_count + 1}/${job.max_retries})`)
      
      // Exponential backoff for retries
      const delay = Math.pow(2, job.retry_count) * 1000
      setTimeout(() => {
        this.processingQueue.set(job.id, job)
      }, delay)
      
    } else {
      console.error(`💀 Job permanently failed: ${job.id}`)
      
      await dbManager.getClient()
        .from('customers')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', job.customer_id)

      await this.updateJobStatus(job.customer_id, 'failed')
      this.emit('jobFailed', job)
    }
  }

  // Create completion notification
  private async createCompletionNotification(customerId: string, processed: number) {
    await dbManager.getClient()
      .from('customer_notifications')
      .insert([{
        id: crypto.randomUUID(),
        customer_id: customerId,
        notification_type: 'success',
        title: 'Directory Submissions Completed!',
        message: `Your business has been successfully submitted to ${processed} directories. You should start seeing results within 24-48 hours.`,
        action_url: '/dashboard',
        action_text: 'View Results',
        read: false,
        created_at: new Date().toISOString()
      }])
  }

  // Update processing metrics
  private updateMetrics(processingTime: number, success: boolean) {
    this.processingMetrics.totalProcessed++
    
    if (success) {
      const oldAverage = this.processingMetrics.averageProcessingTime
      const newAverage = (oldAverage * (this.processingMetrics.totalProcessed - 1) + processingTime) / this.processingMetrics.totalProcessed
      this.processingMetrics.averageProcessingTime = newAverage
    }
    
    // Calculate success rate
    const successCount = this.processingMetrics.totalProcessed * this.processingMetrics.successRate
    const newSuccessCount = success ? successCount + 1 : successCount
    this.processingMetrics.successRate = newSuccessCount / this.processingMetrics.totalProcessed
    
    // Update current load
    this.processingMetrics.currentLoad = (this.activeWorkers / this.maxWorkers) * 100
    this.processingMetrics.queueSize = this.processingQueue.size
  }

  // Start metrics collection
  private startMetricsCollector() {
    setInterval(() => {
      this.emit('metricsUpdate', this.processingMetrics)
    }, 30000) // Update every 30 seconds
  }

  // Public methods for monitoring
  getMetrics(): ProcessingMetrics {
    return { ...this.processingMetrics }
  }

  getQueueSize(): number {
    return this.processingQueue.size
  }

  getActiveWorkers(): number {
    return this.activeWorkers
  }

  // Adjust processing capacity based on load
  adjustCapacity(newMaxWorkers: number) {
    this.maxWorkers = Math.max(1, Math.min(20, newMaxWorkers))
    console.log(`⚙️ Queue capacity adjusted to ${this.maxWorkers} workers`)
  }
}

export const queueManager = AdvancedQueueManager.getInstance()
export default AdvancedQueueManager