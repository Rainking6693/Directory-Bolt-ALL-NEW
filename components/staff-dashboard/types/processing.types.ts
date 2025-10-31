// Processing related TypeScript types for Staff Dashboard

export interface ProcessingJob {
  customerId: string;
  businessName: string;
  packageType: "STARTER" | "GROWTH" | "PRO";
  status: "queued" | "processing" | "completed" | "failed" | "paused";
  progress: number; // 0-100
  startedAt: string;
  estimatedCompletion?: string;
  elapsedTime: number; // in minutes
  currentActivity: string;
  directoriesTotal: number;
  directoriesCompleted: number;
  directoriesSuccessful: number;
  directoriesFailed: number;
  directoriesRemaining: number;
}

export interface DirectorySubmission {
  directoryName: string;
  status: "pending" | "processing" | "success" | "failed";
  message?: string;
  submittedAt?: string;
  completedAt?: string;
}

export interface ProcessingStats {
  activeJobs: number;
  processingSpeed: number; // dirs per minute
  successRate: number;
  errorRate: number;
  totalDirectoriesProcessed: number;
  totalCustomersProcessed: number;
}

export interface SystemHealth {
  apiStatus: Record<string, "operational" | "degraded" | "down">;
  processingCapacity: number;
  queueDepth: number;
  lastHealthCheck: string;
}

export interface ActivityFeedItem {
  id: string;
  timestamp: string;
  customerId: string;
  directoryName: string;
  status: "success" | "failed" | "processing" | "started";
  message: string;
  icon: string;
}

export interface ProcessingModalData {
  customerId: string;
  businessName: string;
  packageType: string;
  directoryCount: number;
  estimatedTime: string;
  canPriorityProcess: boolean;
}
