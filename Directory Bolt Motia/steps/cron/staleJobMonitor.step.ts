import type { CronConfig, Handlers } from 'motia'

export const config: CronConfig = {
  name: 'StaleJobMonitor',
  type: 'cron',
  cron: '0 */30 * * * *', // Every 30 minutes
  flows: ['directory-bolt'],
  emits: []
};

export const handler: Handlers['StaleJobMonitor'] = async (input, { logger }) => {
  logger.info('Running stale job monitor');

  // Check for stale jobs in Supabase
  const staleJobs: any[] = await findStaleJobs();

  for (const job of staleJobs) {
    // Log or alert on stale jobs
    logger.warn(`Stale job detected: ${job.id}`, job);

    // You could emit an event to handle the stale job
    // or send notifications, etc.
  }

  return {
    status: "completed",
    monitoredJobs: staleJobs.length
  };
};

async function findStaleJobs() {
  // Implementation to find stale jobs in Supabase
  // Jobs that have been in_progress for too long
  return []; // Placeholder
}
