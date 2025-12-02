import type { EventConfig, Handlers } from 'motia'
import { z } from 'zod'

export const config: EventConfig = {
  type: 'event',
  name: 'ProcessFoodOrder', // Keeping the name for now as I don't know the intended name, maybe 'JobProcessor'?
  description: 'Job processor event step',
  flows: ['directory-bolt'], // Changed from basic-tutorial
  subscribes: ['process-job'], // Changed to something generic
  emits: ['notification'],
  input: z.object({
    jobId: z.string(),
    type: z.string(),
    data: z.any()
  }),
}

export const handler: Handlers['ProcessFoodOrder'] = async (input, { traceId, logger, state, emit }) => {
  logger.info('Processing job', { input, traceId })

  // Placeholder logic
  logger.info('Job processed', { jobId: input.jobId })

  /*
  await emit({
    topic: 'notification',
    data: {
      email: 'test@example.com',
      templateId: 'job-completed',
      templateData: {
        jobId: input.jobId,
        status: 'completed'
      },
    },
  })
  */
}
