export const config = {
  name: 'SQSProcessor',
  type: 'event',
  subscribes: ['job.enqueued'] // This would be triggered when jobs are enqueued
};

export const handler = async (input: any, { logger }: { logger: any }) => {
  logger.info('Processing SQS message', input);
  
  // Extract job details from the message
  const { job_id, customer_id, package_size, priority } = input.data;
  
  // Record queue claim (like your current system)
  await recordQueueHistory(job_id, null, "queue_claimed", {
    source: "motia_backend"
  });
  
  // Instead of triggering Prefect, we can emit an event for the worker
  // In a real implementation, you might want to use the emit function
  // But for now, we'll just log that we would emit the event
  
  console.log(`Would emit event: job.process with data:`, {
    job_id,
    customer_id,
    package_size,
    priority
  });
  
  // Record flow trigger (like your current system)
  await recordQueueHistory(job_id, null, "flow_triggered", {
    flow_system: "motia_internal"
  });
  
  return { status: "processed" };
};

// Helper function to record queue history (would connect to Supabase)
async function recordQueueHistory(job_id: string, directory: string | null, event: string, details: any) {
  // Implementation would connect to Supabase
  // This replaces the functionality in your backend/db/dao.py
  console.log(`Recording history: ${event} for job ${job_id}`);
}