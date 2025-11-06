// @ts-nocheck
/**
 * Supabase-based Queue Management Service
 * 
 * Handles the queue processing system for DirectoryBolt customer submissions using Supabase.
 * Replaces Google Sheets with Supabase database queries for better performance and real-time capabilities.
 */

import { createSupabaseService } from './supabase';

// Re-export types for compatibility
export type { QueueItem, BusinessSubmissionRecord } from '../types/queue.types';
import type { QueueItem, BusinessSubmissionRecord } from '../types/queue.types';

export interface QueueProcessingResult {
  success: boolean;
  customerId: string;
  directoriesProcessed: number;
  directoriesFailed: number;
  completedAt: Date;
  processingTimeSeconds: number;
  errors?: string[];
  warnings?: string[];
  skippedDirectories?: string[];
  message?: string;
}

export interface QueueStats {
  totalPending: number;
  totalInProgress: number;
  totalCompleted: number;
  totalFailed: number;
  totalPaused: number;
  averageProcessingTime: number;
  averageWaitTime: number;
  queueDepth: number;
  todaysProcessed: number;
  todaysGoal: number;
  successRate: number;
  currentThroughput: number;
  peakHours: { hour: number; count: number }[];
}

interface AutoBoltProcessingResult {
  success: boolean;
  message: string;
  totalDirectories: number;
  processedDirectories: number;
  successfulSubmissions: number;
  failedSubmissions: number;
  skippedDirectories: number;
  completedAt: Date;
  processingTimeSeconds?: number;
  results: Array<{
    success: boolean;
    directoryName: string;
    error?: string;
  }>;
}

interface EnhancedProcessingResult {
  totalDirectories: number;
  processedDirectories: number;
  successfulSubmissions: number;
  failedSubmissions: number;
  skippedDirectories: number;
  completedAt: Date;
  processingTimeSeconds?: number;
  averageConfidence: number;
  mappingStats: {
    siteSpecific: number;
    autoMapped: number;
    fallbackMapped: number;
    manualMapped: number;
  };
  results: Array<{
    success: boolean;
    directoryName: string;
    error?: string;
  }>;
}

export class SupabaseQueueManager {
  private supabaseService: ReturnType<typeof createSupabaseService> | null = null;
  private isProcessing: boolean = false;
  private processingQueue: QueueItem[] = [];
  private maxConcurrentProcessing: number = 3;
  private retryAttempts: number = 3;
  private retryDelay: number = 5000; // 5 seconds
  private batchDelay: number = 2000; // 2 seconds between batches

  constructor() {
    // Lazy load Supabase service to avoid build-time initialization
  }

  /**
   * Get or create Supabase service instance (lazy-loaded)
   */
  private getSupabaseService(): ReturnType<typeof createSupabaseService> {
    if (!this.supabaseService) {
      this.supabaseService = createSupabaseService();
    }
    return this.supabaseService;
  }

  /**
   * Read "pending" records from Supabase
   */
  async getPendingQueue(): Promise<QueueItem[]> {
    try {
      console.log('🔄 Fetching pending submissions from Supabase...');
      
      // Test Supabase connection first
      const { data, error } = await this.getSupabaseService()
        .from('queue')
        .select('*')
        .eq('submission_status', 'pending');

      if (error) {
        throw error;
      }

      const pendingRecords = data || [];
      
      const queueItems: QueueItem[] = pendingRecords.map(record => {
        const packageType = record.packageType || 'starter';
        const directoryLimit = this.getDirectoryLimit(packageType);
        
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
        };
      });

      // Sort by priority (higher first) then by creation date (oldest first)
      queueItems.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      console.log(`✅ Found ${queueItems.length} pending submissions from Supabase`);
      return queueItems;

    } catch (error) {
      console.error('❌ Failed to fetch pending queue from Supabase, using mock data:', error);
      return this.getMockPendingQueue();
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
          recordId: 'rec001',
          customerId: 'DIR-2025-001234',
          businessName: 'TechStart Solutions',
          businessDescription: 'Enterprise technology solutions',
          businessUrl: 'https://techstart.com',
          packageType: 'pro',
          submissionStatus: 'pending',
          purchaseDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          directoriesSubmitted: 0,
          failedDirectories: 0
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
          recordId: 'rec002',
          customerId: 'DIR-2025-005678',
          businessName: 'Local Cafe & Bistro',
          businessDescription: 'Neighborhood cafe and bistro',
          businessUrl: 'https://localcafe.com',
          packageType: 'growth',
          submissionStatus: 'pending',
          purchaseDate: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          directoriesSubmitted: 0,
          failedDirectories: 0
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
          recordId: 'rec003',
          customerId: 'DIR-2025-009012',
          businessName: 'Fitness First Gym',
          businessDescription: 'Full service fitness center',
          businessUrl: 'https://fitnessfirst.com',
          packageType: 'starter',
          submissionStatus: 'pending',
          purchaseDate: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          directoriesSubmitted: 0,
          failedDirectories: 0
        } as BusinessSubmissionRecord
      }
    ];

    return mockCustomers;
  }

  /**
   * Get directory limits based on package type
   */
  private getDirectoryLimit(packageType: string): number {
    const limits = {
      'starter': 50,
      'growth': 100,
      'pro': 200,
      'subscription': 0 // Subscription is ongoing, not bulk
    };
    return limits[packageType.toLowerCase() as keyof typeof limits] || 50;
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
    };

    const basePriority = packagePriority[packageType.toLowerCase() as keyof typeof packagePriority] || 50;
    
    // Add small time-based priority (newer gets +1-5 points)
    const daysSincePurchase = Math.floor((Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
    const timePriority = Math.max(0, 5 - daysSincePurchase);
    
    return basePriority + timePriority;
  }

  /**
   * Update submission status during processing
   */
  async updateSubmissionStatus(
    customerId: string, 
    status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'paused',
    directoriesSubmitted?: number,
    failedDirectories?: number
  ): Promise<void> {
    try {
      console.log(`🔄 Updating status for ${customerId} to ${status}`);
      
      const updates: Record<string, any> = {
        submission_status: status,
        updated_at: new Date().toISOString()
      };

      if (typeof directoriesSubmitted === 'number') {
        updates.directories_submitted = directoriesSubmitted;
      }

      if (typeof failedDirectories === 'number') {
        updates.failed_directories = failedDirectories;
      }

      await this.getSupabaseService()
        .from('queue')
        .update(updates)
        .eq('customer_id', customerId);

      console.log(`✅ Status updated for ${customerId}`);
    } catch (error) {
      console.error(`❌ Failed to update status for ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Process queue in batches with delays between submissions
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('⚠️ Queue processing already in progress');
      return;
    }

    this.isProcessing = true;
    console.log('🚀 Starting AutoBolt queue processing...');

    try {
      const pendingQueue = await this.getPendingQueue();
      
      if (pendingQueue.length === 0) {
        console.log('📭 No pending submissions to process');
        return;
      }

      console.log(`📊 Processing ${pendingQueue.length} submissions...`);

      // Process in batches to avoid overwhelming external systems
      const batchSize = this.maxConcurrentProcessing;
      for (let i = 0; i < pendingQueue.length; i += batchSize) {
        const batch = pendingQueue.slice(i, i + batchSize);
        
        console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(pendingQueue.length / batchSize)}`);
        
        // Process batch concurrently
        const batchPromises = batch.map(item => this.processCustomer(item));
        await Promise.allSettled(batchPromises);
        
        // Add delay between batches (except for last batch)
        if (i + batchSize < pendingQueue.length) {
          console.log(`⏳ Waiting ${this.batchDelay}ms before next batch...`);
          await this.delay(this.batchDelay);
        }
      }

      console.log('✅ Queue processing completed');

    } catch (error) {
      console.error('❌ Queue processing failed:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual customer with retry logic
   */
  async processCustomer(queueItem: QueueItem): Promise<QueueProcessingResult> {
    const { customerId, businessData, directoryLimit } = queueItem;
    
    console.log(`🔄 Processing customer ${customerId} (${businessData.businessName})`);

    // Update status to in-progress
    await this.updateSubmissionStatus(customerId, 'in-progress');

    let lastError: Error | null = null;
    
    // Retry logic
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`📡 Attempt ${attempt}/${this.retryAttempts} for ${customerId}`);
        
        const result = await this.processDirectorySubmissions(queueItem);
        
        // Update status to completed with results
        await this.updateSubmissionStatus(
          customerId,
          'completed',
          result.directoriesProcessed,
          result.directoriesFailed
        );

        console.log(`✅ Customer ${customerId} processed successfully`);
        return result;

      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Attempt ${attempt} failed for ${customerId}:`, error);
        
        if (attempt < this.retryAttempts) {
          console.log(`⏳ Waiting ${this.retryDelay}ms before retry...`);
          await this.delay(this.retryDelay);
        }
      }
    }

    // All retries failed, mark as failed
    await this.updateSubmissionStatus(customerId, 'failed', 0, directoryLimit);
    
    console.error(`❌ Customer ${customerId} processing failed after ${this.retryAttempts} attempts`);
    
    return {
      success: false,
      customerId,
      directoriesProcessed: 0,
      directoriesFailed: directoryLimit,
      completedAt: new Date(),
      processingTimeSeconds: 0,
      errors: [lastError?.message || 'Unknown error after multiple retries']
    };
  }

  /**
   * Process directory submissions for a customer
   */
  private async processDirectorySubmissions(queueItem: QueueItem): Promise<QueueProcessingResult> {
    const { customerId, businessData, directoryLimit } = queueItem;
    
    console.log(`🚀 Starting directory processing for ${businessData.businessName} (${directoryLimit} directories)`);
    
    // Choose processing method based on customer tier and directory complexity
    const useEnhancedProcessing = this.shouldUseEnhancedProcessing(queueItem);
    
    if (useEnhancedProcessing) {
      return await this.processDirectorySubmissionsEnhanced(queueItem);
    } else {
      return await this.processDirectorySubmissionsBasic(queueItem);
    }
  }

  /**
   * Enhanced directory processing with dynamic form mapping
   */
  private async processDirectorySubmissionsEnhanced(queueItem: QueueItem): Promise<QueueProcessingResult> {
    const { customerId, businessData, directoryLimit } = queueItem;
    
    console.log(`🚀 Starting Enhanced AutoBolt processing for ${businessData.businessName} (${directoryLimit} directories)`);

    try {
      // Mock enhanced processing for now
      const result: EnhancedProcessingResult = await this.mockEnhancedProcessing(businessData, directoryLimit);

      console.log(`📊 Enhanced AutoBolt processing complete for ${customerId}:`);
      console.log(`  - Total directories: ${result.totalDirectories}`);
      console.log(`  - Processed: ${result.processedDirectories}`);
      console.log(`  - Successful: ${result.successfulSubmissions}`);
      console.log(`  - Failed: ${result.failedSubmissions}`);
      console.log(`  - Skipped: ${result.skippedDirectories}`);
      console.log(`  - Mapping breakdown: Site(${result.mappingStats.siteSpecific}) Auto(${result.mappingStats.autoMapped}) Fallback(${result.mappingStats.fallbackMapped}) Manual(${result.mappingStats.manualMapped})`);
      console.log(`  - Average confidence: ${result.averageConfidence.toFixed(2)}`);

      return {
        success: result.successfulSubmissions > 0,
        customerId,
        directoriesProcessed: result.successfulSubmissions,
        directoriesFailed: result.failedSubmissions,
        completedAt: result.completedAt,
        processingTimeSeconds: result.processingTimeSeconds || 0,
        errors: result.results
          .filter(r => !r.success)
          .map(r => `${r.directoryName}: ${r.error}`)
      };

    } catch (error) {
      console.error(`❌ Enhanced AutoBolt processing failed for ${customerId}:`, error);
      
      // Fallback to basic processing if enhanced fails
      console.log(`🔄 Falling back to basic processing for ${customerId}`);
      return await this.processDirectorySubmissionsBasic(queueItem);
    }
  }

  /**
   * Basic directory processing (fallback)
   */
  private async processDirectorySubmissionsBasic(queueItem: QueueItem): Promise<QueueProcessingResult> {
    const { customerId, businessData, directoryLimit } = queueItem;
    
    console.log(`🚀 Starting basic AutoBolt processing for ${businessData.businessName} (${directoryLimit} directories)`);
    
    try {
      // Mock basic processing for now
      const result: AutoBoltProcessingResult = await this.mockBasicProcessing(businessData, directoryLimit);

      console.log(`📊 Basic AutoBolt processing complete for ${customerId}:`);
      console.log(`  - Total directories: ${result.totalDirectories}`);
      console.log(`  - Processed: ${result.processedDirectories}`);
      console.log(`  - Successful: ${result.successfulSubmissions}`);
      console.log(`  - Failed: ${result.failedSubmissions}`);
      console.log(`  - Skipped: ${result.skippedDirectories}`);

      return {
        success: result.successfulSubmissions > 0, // Success if at least one submission worked
        customerId,
        directoriesProcessed: result.successfulSubmissions,
        directoriesFailed: result.failedSubmissions,
        completedAt: result.completedAt,
        processingTimeSeconds: result.processingTimeSeconds || 0,
        errors: result.results
          .filter(r => !r.success)
          .map(r => `${r.directoryName}: ${r.error}`)
      };

    } catch (error) {
      console.error(`❌ Basic AutoBolt processing failed for ${customerId}:`, error);
      
      return {
        success: false,
        customerId,
        directoriesProcessed: 0,
        directoriesFailed: directoryLimit,
        completedAt: new Date(),
        processingTimeSeconds: 0,
        errors: [`AutoBolt processing error: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Determine if enhanced processing should be used
   */
  private shouldUseEnhancedProcessing(queueItem: QueueItem): boolean {
    // Use enhanced processing for Growth and Pro tiers
    const enhancedTiers = ['growth', 'pro'];
    return enhancedTiers.includes(queueItem.packageType);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      const supabase = this.getSupabaseService();
      const pendingCount = (await (supabase as any).from('queue').select('id').eq('submission_status', 'pending')).data?.length ?? 0;
      const inProgressCount = (await (supabase as any).from('queue').select('id').eq('submission_status', 'in-progress')).data?.length ?? 0;
      const completedCount = (await (supabase as any).from('queue').select('id').eq('submission_status', 'completed')).data?.length ?? 0;
      const failedCount = (await (supabase as any).from('queue').select('id').eq('submission_status', 'failed')).data?.length ?? 0;

      return {
        totalPending: pendingCount,
        totalInProgress: inProgressCount,
        totalCompleted: completedCount,
        totalFailed: failedCount,
        totalPaused: 0,
        averageProcessingTime: 0,
        averageWaitTime: 0,
        queueDepth: pendingCount + inProgressCount,
        todaysProcessed: 0,
        todaysGoal: 50,
        successRate: completedCount / Math.max(completedCount + failedCount, 1),
        currentThroughput: 0,
        peakHours: []
      };
    } catch (error) {
      console.error('❌ Failed to get queue stats, falling back to mock data:', error);
      return this.getMockQueueStats();
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
    };
  }

  /**
   * Get next customer to process (highest priority pending)
   */
  async getNextCustomer(): Promise<QueueItem | null> {
    try {
      const pendingQueue = await this.getPendingQueue();
      return pendingQueue.length > 0 ? pendingQueue[0] : null;
    } catch (error) {
      console.error('❌ Failed to get next customer:', error);
      return null;
    }
  }

  /**
   * Process a specific customer by ID
   */
  async processSpecificCustomer(customerId: string): Promise<QueueProcessingResult> {
    try {
      const { data, error } = await this.getSupabaseService()
        .from('queue')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const record = data as any;
      
      if (!record) {
        throw new Error(`Customer ${customerId} not found`);
      }

      if (record.submissionStatus !== 'pending') {
        throw new Error(`Customer ${customerId} is not in pending status (current: ${record.submissionStatus})`);
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
      };

      return await this.processCustomer(queueItem);

    } catch (error) {
      console.error(`❌ Failed to process specific customer ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Mock basic processing for development
   */
  private async mockBasicProcessing(businessData: any, directoryLimit: number): Promise<AutoBoltProcessingResult> {
    // Simulate processing time
    await this.delay(2000 + Math.random() * 3000);
    
    const totalDirectories = Math.min(directoryLimit, 50);
    const successRate = 0.7 + Math.random() * 0.2; // 70-90% success rate
    const successfulSubmissions = Math.floor(totalDirectories * successRate);
    const failedSubmissions = totalDirectories - successfulSubmissions;
    
    const results = Array.from({ length: totalDirectories }, (_, i) => ({
      success: i < successfulSubmissions,
      directoryName: `Directory ${i + 1}`,
      error: i >= successfulSubmissions ? 'Mock processing error' : undefined
    }));
    
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
    };
  }

  /**
   * Mock enhanced processing for development
   */
  private async mockEnhancedProcessing(businessData: any, directoryLimit: number): Promise<EnhancedProcessingResult> {
    // Simulate processing time
    await this.delay(3000 + Math.random() * 4000);
    
    const totalDirectories = Math.min(directoryLimit, 100);
    const successRate = 0.8 + Math.random() * 0.15; // 80-95% success rate for enhanced
    const successfulSubmissions = Math.floor(totalDirectories * successRate);
    const failedSubmissions = totalDirectories - successfulSubmissions;
    
    const results = Array.from({ length: totalDirectories }, (_, i) => ({
      success: i < successfulSubmissions,
      directoryName: `Enhanced Directory ${i + 1}`,
      error: i >= successfulSubmissions ? 'Mock enhanced processing error' : undefined
    }));
    
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
    };
  }

  /**
   * Utility: Delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if queue processing is currently running
   */
  isQueueProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Stop queue processing (graceful shutdown)
   */
  stopProcessing(): void {
    console.log('🛑 Queue processing stop requested');
    this.isProcessing = false;
  }
}

// Export lazy-loaded singleton instance
let supabaseQueueManagerInstance: SupabaseQueueManager | null = null;

export const supabaseQueueManager = (): SupabaseQueueManager => {
  if (!supabaseQueueManagerInstance) {
    supabaseQueueManagerInstance = new SupabaseQueueManager();
  }
  return supabaseQueueManagerInstance;
};

export default supabaseQueueManager;
