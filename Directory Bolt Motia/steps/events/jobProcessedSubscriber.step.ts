import type { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { getSupabaseClient } from '../utils/supabaseClient'

export const config: EventConfig = {
  type: 'event',
  name: 'JobProcessedSubscriber',
  description: 'Handles job-processed events and updates job status in Supabase',
  flows: ['directory-bolt'],
  subscribes: ['job-processed'],
  emits: [],
  input: z.object({
    jobId: z.string(),
    directory: z.string(),
    status: z.string(),
    processedAt: z.string(),
    details: z.any().optional(),
  }),
}

export const handler: Handlers['JobProcessedSubscriber'] = async (input, { logger }) => {
  logger.info('Job processed event received', input)

  const supabase = getSupabaseClient()

  // Best-effort job status update; if no Supabase creds are configured, this will no-op via the mock client.
  try {
    const { error } = await (supabase as any)
      .from('jobs')
      .update({
        status: input.status || 'processed',
        updated_at: new Date().toISOString(),
        completed_at: input.processedAt,
      })
      .eq('id', input.jobId)

    if (error) {
      logger.error('Failed to update job status for job-processed event', { error, jobId: input.jobId })
    } else {
      logger.info('Job status updated from job-processed event', { jobId: input.jobId })
    }
  } catch (err: any) {
    logger.error('Unexpected error updating job from job-processed event', { error: err?.message, jobId: input.jobId })
  }
}
