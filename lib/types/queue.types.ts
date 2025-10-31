/**
 * Queue Processing API Types
 * Complete type definitions for DirectoryBolt Queue Processing System
 * Phase 2.2 Implementation
 */

// Base Queue Item Types
export interface QueueItem {
  recordId: string
  customerId: string
  businessName: string
  packageType: 'starter' | 'growth' | 'pro' | 'subscription'
  directoryLimit: number
  submissionStatus: 'pending' | 'in-progress' | 'completed' | 'failed' | 'paused'
  priority: number
  createdAt: string
  updatedAt: string
  businessData: BusinessSubmissionRecord
  processingMetadata?: QueueProcessingMetadata
  estimatedCompletionTime?: string
  actualCompletionTime?: string
}

// Business submission record structure
export interface BusinessSubmissionRecord {
  recordId: string
  customerId: string
  businessName: string
  businessDescription: string
  businessUrl: string
  businessEmail: string
  businessPhone?: string
  businessAddress?: string
  businessCategory: string
  packageType: string
  submissionStatus: string
  purchaseDate: string
  directoriesSubmitted?: number
  failedDirectories?: number
  processingNotes?: string
}

// Queue processing metadata
export interface QueueProcessingMetadata {
  startedAt?: string
  retryCount: number
  lastRetryAt?: string
  processingErrors: string[]
  directoriesProcessed: number
  directoriesRemaining: number
  currentDirectoryName?: string
  progressPercentage: number
  estimatedTimeRemaining?: number
}

// Queue processing results
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
}

// Queue statistics
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

// Real-time queue updates
export interface QueueUpdate {
  type: 'status_change' | 'progress_update' | 'completion' | 'error' | 'started'
  customerId: string
  timestamp: string
  data: {
    oldStatus?: string
    newStatus?: string
    progress?: number
    message?: string
    error?: string
    directoriesProcessed?: number
    estimatedTimeRemaining?: number
  }
}

// API Request/Response Types
export interface GetQueueRequest {
  status?: 'pending' | 'in-progress' | 'completed' | 'failed' | 'paused' | 'all'
  limit?: number
  offset?: number
  sortBy?: 'priority' | 'createdAt' | 'packageType'
  sortOrder?: 'asc' | 'desc'
  packageType?: string[]
  dateRange?: {
    from: string
    to: string
  }
}

export interface GetQueueResponse {
  success: boolean
  data: {
    items: QueueItem[]
    pagination: {
      total: number
      offset: number
      limit: number
      hasMore: boolean
    }
    stats: QueueStats
  }
  timestamp: string
}

export interface ProcessQueueRequest {
  customerId?: string // Process specific customer
  batchSize?: number
  priorityOnly?: boolean
  packageTypes?: string[]
}

export interface ProcessQueueResponse {
  success: boolean
  data: {
    processedCustomers: string[]
    failedCustomers: string[]
    totalProcessed: number
    estimatedTimeRemaining: number
    batchId: string
  }
  message: string
  timestamp: string
}

// Queue management operations
export interface QueueOperation {
  type: 'pause' | 'resume' | 'cancel' | 'retry' | 'prioritize' | 'deprioritize'
  customerId: string
  reason?: string
  metadata?: Record<string, any>
}

export interface QueueOperationResponse {
  success: boolean
  customerId: string
  operation: string
  oldStatus: string
  newStatus: string
  message: string
  timestamp: string
}

// Batch operations
export interface BatchOperation {
  id: string
  type: 'process' | 'retry' | 'cancel'
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  customerIds: string[]
  createdAt: string
  startedAt?: string
  completedAt?: string
  progress: {
    total: number
    completed: number
    failed: number
    percentage: number
  }
  results?: QueueProcessingResult[]
}

export interface CreateBatchRequest {
  customerIds: string[]
  operation: 'process' | 'retry' | 'cancel'
  priority?: number
  scheduledFor?: string
}

export interface BatchOperationResponse {
  success: boolean
  data: BatchOperation
  message: string
}

// WebSocket message types for real-time updates
export interface WebSocketMessage {
  type: 'queue_update' | 'batch_update' | 'stats_update' | 'error' | 'heartbeat'
  payload: QueueUpdate | BatchOperation | QueueStats | { error: string } | { timestamp: string }
  timestamp: string
}

// Extension API types
export interface ExtensionQueueSubmission {
  businessData: Omit<BusinessSubmissionRecord, 'recordId' | 'customerId' | 'submissionStatus' | 'purchaseDate'>
  packageType: string
  apiKey: string
  customerEmail: string
  priority?: number
}

export interface ExtensionSubmissionResponse {
  success: boolean
  data: {
    customerId: string
    queuePosition: number
    estimatedWaitTime: number
    trackingId: string
  }
  message: string
}

// Error handling types
export interface QueueError {
  code: string
  message: string
  customerId?: string
  timestamp: string
  context?: Record<string, any>
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface QueueErrorResponse {
  success: false
  error: QueueError
  suggestedActions?: string[]
}

// Progress tracking types
export interface ProgressIndicator {
  customerId: string
  currentStep: string
  totalSteps: number
  completedSteps: number
  percentage: number
  estimatedTimeRemaining: number
  lastUpdateTime: string
  stepDetails: {
    stepName: string
    status: 'pending' | 'in-progress' | 'completed' | 'failed'
    startTime?: string
    endTime?: string
    duration?: number
  }[]
}

// ETA calculation types
export interface ETACalculation {
  customerId: string
  estimatedStartTime: string
  estimatedCompletionTime: string
  estimatedProcessingDuration: number
  confidence: number
  factors: {
    queuePosition: number
    packageType: string
    historicalProcessingTime: number
    currentLoad: number
    timeOfDay: string
  }
}

// User feedback types
export interface UserNotification {
  id: string
  customerId: string
  type: 'started' | 'progress' | 'completed' | 'failed' | 'delayed'
  title: string
  message: string
  timestamp: string
  read: boolean
  actionRequired: boolean
  actions?: {
    label: string
    action: string
    data?: Record<string, any>
  }[]
}

// API client configuration
export interface QueueAPIConfig {
  baseUrl: string
  apiKey: string
  timeout: number
  retryAttempts: number
  retryDelay: number
  enableWebSocket: boolean
  websocketUrl?: string
  enablePolling: boolean
  pollingInterval: number
}

// Hook return types for React integration
export interface UseQueueReturn {
  queue: QueueItem[]
  stats: QueueStats | null
  isLoading: boolean
  error: QueueError | null
  refetch: () => Promise<void>
  processCustomer: (customerId: string) => Promise<QueueProcessingResult>
  pauseCustomer: (customerId: string) => Promise<void>
  resumeCustomer: (customerId: string) => Promise<void>
  cancelCustomer: (customerId: string) => Promise<void>
}

export interface UseQueueUpdatesReturn {
  updates: QueueUpdate[]
  isConnected: boolean
  lastUpdate: string | null
  connectionError: string | null
  connect: () => void
  disconnect: () => void
}

// Component prop types
export interface QueueDashboardProps {
  showStats?: boolean
  showFilters?: boolean
  enableBatchOperations?: boolean
  enableRealTimeUpdates?: boolean
  customerId?: string
  packageTypes?: string[]
  onItemClick?: (item: QueueItem) => void
  onBatchComplete?: (batch: BatchOperation) => void
}

export interface QueueItemCardProps {
  item: QueueItem
  showActions?: boolean
  showProgress?: boolean
  onProcess?: (customerId: string) => void
  onPause?: (customerId: string) => void
  onResume?: (customerId: string) => void
  onCancel?: (customerId: string) => void
  onViewDetails?: (customerId: string) => void
}

export interface ProgressIndicatorProps {
  progress: ProgressIndicator
  showSteps?: boolean
  showETA?: boolean
  compact?: boolean
}