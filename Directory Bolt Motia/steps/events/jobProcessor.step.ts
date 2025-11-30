export const config = {
  name: 'JobProcessor',
  type: 'event',
  subscribes: ['job.process']
};

export const handler = async (input: any, { logger }: { logger: any }) => {
  const { job_id, customer_id, package_size, priority } = input.data;
  
  logger.info(`Starting job ${job_id} for customer ${customer_id}`);
  
  // Mark job as in progress (update Supabase)
  await updateJobStatus(job_id, 'in_progress');
  
  // Record in queue history
  await recordQueueHistory(job_id, null, "flow_started", {});
  
  try {
    // Fetch directories for this job (from Supabase)
    const directories = await getDirectoriesForJob(job_id, package_size);
    
    // Update job with total directories
    await updateJobTotalDirectories(job_id, directories.length);
    
    let directoriesCompleted = 0;
    
    // Process each directory
    for (const directory of directories) {
      try {
        // Get field mapping plan from brain service
        const plan = await getFieldMappingPlan(directory, job_id);
        
        // Process the directory submission
        const result = await processDirectorySubmission(plan, directory, job_id);
        
        // Save result to database
        await saveSubmissionResult(job_id, directory, result);
        
        // Update job progress
        directoriesCompleted++;
        await updateJobProgress(job_id, directoriesCompleted, directories.length);
        
        // Record completion
        await recordQueueHistory(job_id, directory, "submission_complete", {
          status: result.status
        });
      } catch (error: any) {
        logger.error(`Error processing directory ${directory}:`, error);
        // Record error in queue history
        await recordQueueHistory(job_id, directory, "submission_error", {
          error: error.message
        });
      }
    }
    
    // Mark job as completed
    await updateJobStatus(job_id, 'completed');
    await recordQueueHistory(job_id, null, "flow_completed", {});
    
    logger.info(`Job ${job_id} completed successfully`);
    
    return { status: "completed" };
  } catch (error: any) {
    logger.error(`Error processing job ${job_id}:`, error);
    
    // Mark job as failed
    await updateJobStatus(job_id, 'failed', error.message);
    await recordQueueHistory(job_id, null, "flow_failed", {
      error: error.message
    });
    
    return { status: "failed", error: error.message };
  }
};

// Helper functions (these would connect to your Supabase database)
async function updateJobStatus(job_id: string, status: string, error_message: string | null = null) {
  const supabase = getSupabaseClient();
  
  const data: any = {
    status: status,
    updated_at: new Date().toISOString()
  };
  
  if (status === 'in_progress') {
    data.started_at = new Date().toISOString();
  } else if (status === 'completed' || status === 'failed') {
    data.completed_at = new Date().toISOString();
  }
  
  if (error_message) {
    data.error_message = error_message;
  }
  
  const result: any = await supabase
    .from('jobs')
    .update(data)
    .eq('id', job_id);
  
  if (result.error) {
    throw new Error(`Failed to update job status: ${result.error.message}`);
  }
  
  console.log(`Updated job ${job_id} status to ${status}`);
}

async function updateJobProgress(job_id: string, completed: number, total: number) {
  const supabase = getSupabaseClient();
  
  const progress = Math.round((completed / total) * 100);
  
  const result: any = await supabase
    .from('jobs')
    .update({
      directories_done: completed,
      directories_total: total,
      progress: progress,
      updated_at: new Date().toISOString()
    })
    .eq('id', job_id);
  
  if (result.error) {
    throw new Error(`Failed to update job progress: ${result.error.message}`);
  }
  
  console.log(`Updated job ${job_id} progress: ${progress}% (${completed}/${total})`);
}

async function updateJobTotalDirectories(job_id: string, total: number) {
  const supabase = getSupabaseClient();
  
  const result: any = await supabase
    .from('jobs')
    .update({
      directories_total: total,
      updated_at: new Date().toISOString()
    })
    .eq('id', job_id);
  
  if (result.error) {
    throw new Error(`Failed to update job total directories: ${result.error.message}`);
  }
}

async function saveSubmissionResult(job_id: string, directory: string, result: any) {
  const supabase = getSupabaseClient();
  
  // Create idempotency key (same as in your current system)
  const crypto = require('crypto');
  const idempotency_key = crypto
    .createHash('sha256')
    .update(`${job_id}${directory}${JSON.stringify(result.payload || {})}`)
    .digest('hex');
  
  // Check if result already exists
  const { data: existing, error: checkError }: any = await supabase
    .from('job_results')
    .select('id')
    .eq('idempotency_key', idempotency_key)
    .maybeSingle();
  
  if (checkError) {
    throw new Error(`Failed to check existing result: ${checkError.message}`);
  }
  
  // If result exists and is already submitted or skipped, don't insert again
  if (existing && result.status in ['submitted', 'skipped']) {
    console.log(`Skipping duplicate result for ${directory} in job ${job_id}`);
    return 'duplicate_success';
  }
  
  // Insert new result
  const data = {
    job_id: job_id,
    directory_name: directory,
    status: result.status,
    idempotency_key: idempotency_key,
    payload: result.payload || {},
    response_log: result.response_log || {},
    error_message: result.error || null
  };
  
  const insertResult: any = await supabase
    .from('job_results')
    .insert(data);
  
  if (insertResult.error) {
    throw new Error(`Failed to save submission result: ${insertResult.error.message}`);
  }
  
  console.log(`Saved result for ${directory} in job ${job_id}`);
  return 'inserted';
}

async function recordQueueHistory(job_id: string, directory: string | null, event: string, details: any) {
  // Implementation would connect to Supabase
  // This replaces the functionality in your backend/db/dao.py
  console.log(`Recording history: ${event} for job ${job_id}`);
}

async function getDirectoriesForJob(job_id: string, package_size: number) {
  // Implementation to fetch directories from Supabase
  return ["example-directory.com"]; // Placeholder
}

async function getFieldMappingPlan(directory: string, job_id: string) {
  // Implementation to get field mapping plan (calls internal brain service)
  return { url: `https://${directory}`, fields: {} }; // Placeholder
}

async function processDirectorySubmission(plan: any, directory: string, job_id: string) {
  // Implementation for directory submission processing
  return { status: "submitted", payload: {} }; // Placeholder
}

// Helper function to get Supabase client
function getSupabaseClient() {
  // Implementation for Supabase client
  // This would use the same credentials as your current system
  console.log("Initializing Supabase client");
  return {
    // Mock client methods
    table: (tableName: string) => ({
      select: () => ({ eq: () => ({ execute: async () => ({ data: [] }) }) }),
      insert: () => ({ execute: async () => ({ data: [] }) }),
      update: () => ({ eq: () => ({ execute: async () => ({ data: [] }) }) })
    }),
    from: (tableName: string) => ({
      select: (columns: string = '*') => {
        let query: any = {
          data: [],
          error: null
        };
        
        // Add query methods
        query.eq = () => query;
        query.in = () => query;
        query.order = () => query;
        query.limit = () => query;
        query.range = () => query;
        query.maybeSingle = () => query;
        query.single = () => query;
        
        return query;
      },
      insert: (data: any) => ({
        execute: async () => ({ data: [], error: null })
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          execute: async () => ({ data: [], error: null })
        })
      })
    })
  };
}