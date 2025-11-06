/**
 * Job Status Constants
 *
 * Standardizes job status values across the codebase to prevent inconsistencies
 * like 'complete' vs 'completed', 'in_progress' vs 'processing'.
 */

export const JOB_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export type JobStatus = typeof JOB_STATUSES[keyof typeof JOB_STATUSES]

/**
 * Check if job is actively processing
 * @param status - The job status to check
 * @returns true if job is in progress or processing
 */
export const isProcessing = (status: string): boolean =>
  status === JOB_STATUSES.IN_PROGRESS || status === JOB_STATUSES.PROCESSING

/**
 * Check if job is completed
 * @param status - The job status to check
 * @returns true if job is in completed state
 */
export const isCompleted = (status: string): boolean =>
  status === JOB_STATUSES.COMPLETED

/**
 * Check if job is in a final state (no further processing)
 * @param status - The job status to check
 * @returns true if job is in completed, failed, or cancelled state
 */
export const isFinalState = (status: string): boolean =>
  status === JOB_STATUSES.COMPLETED ||
  status === JOB_STATUSES.FAILED ||
  status === JOB_STATUSES.CANCELLED

/**
 * Check if job can be retried
 * @param status - The job status to check
 * @returns true if job is in failed state and eligible for retry
 */
export const canRetry = (status: string): boolean =>
  status === JOB_STATUSES.FAILED
