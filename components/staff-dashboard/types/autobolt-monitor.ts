import type { JobStatus } from "../../../types/supabase";

export type QueueStatus = JobStatus | "cancelled";

export interface QueueItem {
  id: string;
  customerId: string;
  businessName: string | null;
  email: string | null;
  packageSize: number;
  priorityLevel: number;
  status: JobStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  directoriesTotal: number;
  directoriesCompleted: number;
  directoriesFailed: number;
  progressPercentage: number;
}

export interface QueueStats {
  totalJobs: number;
  pendingJobs: number;
  inProgressJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalDirectories: number;
  completedDirectories: number;
  failedDirectories: number;
  successRate: number;
}

export interface QueueItemPayload extends Partial<Record<string, unknown>> {
  id?: string;
  customerId?: string;
  businessName?: string | null;
  email?: string | null;
  packageSize?: number;
  priorityLevel?: number;
  status?: string;
  createdAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  directoriesTotal?: number;
  directoriesCompleted?: number;
  directoriesFailed?: number;
  progressPercentage?: number;
}

export interface QueueStatsPayload {
  total_queued?: number;
  total_processing?: number;
  total_completed?: number;
  total_failed?: number;
  total_jobs?: number;
  completed_directories?: number;
  failed_directories?: number;
  success_rate?: number;
  totalDirectories?: number;
  completedDirectories?: number;
  failedDirectories?: number;
  successRate?: number;
  pendingJobs?: number;
  inProgressJobs?: number;
}

export type QueueSnapshotResponse =
  | {
      success: true;
      data: {
        queueItems?: QueueItemPayload[];
        stats?: QueueStatsPayload | null;
      };
      retrieved_at?: string;
    }
  | {
      success: false;
      error: string;
    };

export interface WorkerStatus {
  worker_id: string;
  status: "online" | "offline" | "processing" | "error" | "idle";
  last_heartbeat: string;
  current_job_id?: string;
  jobs_processed: number;
  jobs_failed: number;
  proxy_enabled: boolean;
  captcha_credits: number;
  error_message?: string;
  uptime_seconds: number;
}

export interface AutoBoltStatusPayload {
  workers: WorkerStatus[];
  system_status: "online" | "offline" | "degraded";
  total_workers: number;
  active_workers: number;
  processing_workers: number;
  queue_status: {
    pending_jobs: number;
    active_jobs: number;
    failed_jobs: number;
  };
  last_updated: string;
}

export type AutoBoltStatusResponse =
  | { success: true; data: AutoBoltStatusPayload }
  | { success: false; error: string };

export interface RetryJobsSuccess {
  success: true;
  data: {
    retriedJobsCount: number;
    failedToRetryCount: number;
    jobIds: string[];
    retryTimestamp: string;
  };
  message: string;
}

export interface RetryJobsFailure {
  success: false;
  error: string;
}

export type RetryJobsResponse = RetryJobsSuccess | RetryJobsFailure;

export interface ExtensionStatus {
  extension_id: string;
  status: "online" | "offline" | "processing" | "error";
  last_heartbeat: string;
  current_customer_id?: string;
  directories_processed: number;
  directories_failed: number;
  error_message?: string;
}

export type ExtensionStatusResponse =
  | {
      success: true;
      data: ExtensionStatus[] | { extensions: ExtensionStatus[] };
    }
  | { success: false; error: string };
