/**
 * Real-Time Submission Updates
 * Handles live updates from AI worker to frontend dashboard
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export interface SubmissionUpdate {
  submission_id: string;
  customer_id: string;
  job_id: string;
  directory_name: string;
  status: 'pending' | 'submitting' | 'submitted' | 'approved' | 'rejected' | 'failed';
  progress_percentage?: number;
  current_activity?: string;
  error_message?: string;
  timestamp: string;
}

export interface JobUpdate {
  job_id: string;
  customer_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  directories_completed: number;
  directories_failed: number;
  progress_percentage: number;
  current_directory?: string;
  timestamp: string;
}

/**
 * Subscribe to real-time submission updates for a specific customer
 */
export function subscribeToCustomerSubmissions(
  customerId: string,
  onUpdate: (update: SubmissionUpdate) => void
): RealtimeChannel | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials not configured for realtime');
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const channel = supabase
    .channel(`customer-submissions-${customerId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'directory_submissions',
        filter: `customer_id=eq.${customerId}`,
      },
      (payload) => {
        const submission = payload.new as any;
        onUpdate({
          submission_id: submission.id,
          customer_id: submission.customer_id,
          job_id: submission.submission_queue_id,
          directory_name: submission.directory_name || 'Unknown',
          status: submission.status,
          progress_percentage: submission.progress_percentage,
          current_activity: submission.current_activity,
          error_message: submission.error_message,
          timestamp: new Date().toISOString(),
        });
      }
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to real-time job updates
 */
export function subscribeToJobUpdates(
  jobId: string,
  onUpdate: (update: JobUpdate) => void
): RealtimeChannel | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials not configured for realtime');
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const channel = supabase
    .channel(`job-updates-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `id=eq.${jobId}`,
      },
      (payload) => {
        const job = payload.new as any;
        onUpdate({
          job_id: job.id,
          customer_id: job.customer_id,
          status: job.status,
          directories_completed: job.directories_completed || 0,
          directories_failed: job.directories_failed || 0,
          progress_percentage: job.progress_percentage || 0,
          current_directory: job.metadata?.current_directory,
          timestamp: new Date().toISOString(),
        });
      }
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to all active jobs (for staff dashboard)
 */
export function subscribeToAllActiveJobs(
  onUpdate: (update: JobUpdate) => void
): RealtimeChannel | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials not configured for realtime');
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const channel = supabase
    .channel('all-active-jobs')
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'jobs',
      },
      (payload) => {
        const job = payload.new as any;
        if (job) {
          onUpdate({
            job_id: job.id,
            customer_id: job.customer_id,
            status: job.status,
            directories_completed: job.directories_completed || 0,
            directories_failed: job.directories_failed || 0,
            progress_percentage: job.progress_percentage || 0,
            current_directory: job.metadata?.current_directory,
            timestamp: new Date().toISOString(),
          });
        }
      }
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe from a channel
 */
export async function unsubscribe(channel: RealtimeChannel): Promise<void> {
  await channel.unsubscribe();
}

