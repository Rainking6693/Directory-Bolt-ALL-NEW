import type { EventConfig, Handlers } from 'motia'
import { z } from 'zod'

export const config: EventConfig = {
  type: 'event',
  name: 'JobProcessor',
  description: 'Processes directory submission jobs and emits status updates',
  flows: ['directory-bolt'],
  subscribes: ['process-job'],
  emits: ['job-processed'],
  input: z.object({
    jobId: z.string(),
    customerId: z.string(),
    directory: z.string(),
    payload: z.record(z.string(), z.any()),
  }),
}

export const handler: Handlers['JobProcessor'] = async (input, { traceId, logger, emit }) => {
  logger.info('Processing job', { input, traceId })

  // TODO: wire to Playwright runner / worker pipeline
  const jobStatus = {
    jobId: input.jobId,
    directory: input.directory,
    status: 'processed',
    processedAt: new Date().toISOString(),
  }

  await emit({
    topic: 'job-processed',
    data: jobStatus,
  })

  logger.info('Job processed', jobStatus)
}
