import type { CronConfig, Handlers } from 'motia'
import { getSupabaseClient } from '../utils/supabaseClient'

export const config: CronConfig = {
  name: 'StaleJobMonitor',
  type: 'cron',
  cron: '0 */30 * * * *', // Every 30 minutes
  flows: ['directory-bolt'],
  emits: [],
}

export const handler: Handlers['StaleJobMonitor'] = async ({ logger }) => {
  logger.info('Running stale job monitor')

  const supabase = getSupabaseClient()
  const thresholdMinutes = Number.parseInt(process.env.STALE_JOB_MINUTES || '30', 10)
  const cutoffIso = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString()

  const { data: staleJobs, error } = await supabase
    .from('jobs')
    .select('id, status, updated_at, customer_id')
    .eq('status', 'in_progress')
    .lt('updated_at', cutoffIso)

  if (error) {
    logger.error('Failed to query stale jobs', { error })
    return
  }

  if (staleJobs?.length) {
    staleJobs.forEach((job: any) => {
      logger.warn(`Stale job detected: ${job.id}`, job)
    })
  }

  logger.info('Stale job monitor complete', { monitoredJobs: staleJobs?.length ?? 0 })
}
