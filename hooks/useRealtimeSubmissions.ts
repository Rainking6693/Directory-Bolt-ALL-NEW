/**
 * useRealtimeSubmissions Hook
 * Real-time submission updates for staff dashboard and customer portal
 */

import { useEffect, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  subscribeToCustomerSubmissions,
  subscribeToJobUpdates,
  subscribeToAllActiveJobs,
  unsubscribe,
  SubmissionUpdate,
  JobUpdate,
} from '../lib/realtime/submission-updates';

export interface UseRealtimeSubmissionsOptions {
  customerId?: string;
  jobId?: string;
  watchAllJobs?: boolean;
}

export interface RealtimeSubmissionsState {
  submissions: SubmissionUpdate[];
  jobs: Map<string, JobUpdate>;
  isConnected: boolean;
  lastUpdate: Date | null;
}

export function useRealtimeSubmissions(options: UseRealtimeSubmissionsOptions = {}) {
  const { customerId, jobId, watchAllJobs = false } = options;

  const [state, setState] = useState<RealtimeSubmissionsState>({
    submissions: [],
    jobs: new Map(),
    isConnected: false,
    lastUpdate: null,
  });

  const [channels, setChannels] = useState<RealtimeChannel[]>([]);

  // Handle submission update
  const handleSubmissionUpdate = useCallback((update: SubmissionUpdate) => {
    setState((prev) => {
      const existingIndex = prev.submissions.findIndex(
        (s) => s.submission_id === update.submission_id
      );

      const newSubmissions = [...prev.submissions];
      if (existingIndex >= 0) {
        newSubmissions[existingIndex] = update;
      } else {
        newSubmissions.push(update);
      }

      return {
        ...prev,
        submissions: newSubmissions,
        lastUpdate: new Date(),
      };
    });
  }, []);

  // Handle job update
  const handleJobUpdate = useCallback((update: JobUpdate) => {
    setState((prev) => {
      const newJobs = new Map(prev.jobs);
      newJobs.set(update.job_id, update);

      return {
        ...prev,
        jobs: newJobs,
        lastUpdate: new Date(),
      };
    });
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const newChannels: RealtimeChannel[] = [];

    // Subscribe to customer submissions
    if (customerId) {
      const channel = subscribeToCustomerSubmissions(customerId, handleSubmissionUpdate);
      if (channel) {
        newChannels.push(channel);
      }
    }

    // Subscribe to specific job
    if (jobId) {
      const channel = subscribeToJobUpdates(jobId, handleJobUpdate);
      if (channel) {
        newChannels.push(channel);
      }
    }

    // Subscribe to all jobs (staff dashboard)
    if (watchAllJobs) {
      const channel = subscribeToAllActiveJobs(handleJobUpdate);
      if (channel) {
        newChannels.push(channel);
      }
    }

    if (newChannels.length > 0) {
      setChannels(newChannels);
      setState((prev) => ({ ...prev, isConnected: true }));
    }

    // Cleanup on unmount
    return () => {
      newChannels.forEach((channel) => {
        unsubscribe(channel);
      });
      setState((prev) => ({ ...prev, isConnected: false }));
    };
  }, [customerId, jobId, watchAllJobs, handleSubmissionUpdate, handleJobUpdate]);

  // Get job by ID
  const getJob = useCallback(
    (jobId: string): JobUpdate | undefined => {
      return state.jobs.get(jobId);
    },
    [state.jobs]
  );

  // Get submissions for a specific job
  const getSubmissionsByJob = useCallback(
    (jobId: string): SubmissionUpdate[] => {
      return state.submissions.filter((s) => s.job_id === jobId);
    },
    [state.submissions]
  );

  // Get latest submission
  const getLatestSubmission = useCallback((): SubmissionUpdate | undefined => {
    if (state.submissions.length === 0) return undefined;
    return state.submissions.reduce((latest, current) =>
      new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    );
  }, [state.submissions]);

  return {
    ...state,
    getJob,
    getSubmissionsByJob,
    getLatestSubmission,
  };
}

