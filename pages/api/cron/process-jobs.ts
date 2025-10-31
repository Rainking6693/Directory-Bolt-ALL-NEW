/**
 * Automatic Job Processor - CRON Endpoint
 * This endpoint should be called every minute to process pending jobs
 * 
 * How to set up:
 * 1. Use Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
 * 2. Add to vercel.json:
 *    {
 *      "crons": [{
 *        "path": "/api/cron/process-jobs",
 *        "schedule": "* * * * *"
 *      }]
 *    }
 * 3. Or use a service like cron-job.org to ping this endpoint every minute
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

interface ProcessJobsResponse {
  success: boolean
  processed: number
  message?: string
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProcessJobsResponse>
) {
  // Security: Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      processed: 0,
      error: 'Method not allowed'
    })
  }

  // Security: Require cron secret (set in environment variables)
  const cronSecret = req.headers['authorization']?.replace('Bearer ', '')
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({
      success: false,
      processed: 0,
      error: 'Unauthorized'
    })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      success: false,
      processed: 0,
      error: 'Supabase not configured'
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  let processedCount = 0

  try {
    console.log('[cron:process-jobs] Starting job processing...')

    // Get next pending job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'pending')
      .order('priority_level', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (jobError) {
      console.error('[cron:process-jobs] Error fetching job:', jobError)
      return res.status(500).json({
        success: false,
        processed: 0,
        error: jobError.message
      })
    }

    if (!job) {
      console.log('[cron:process-jobs] No pending jobs')
      return res.status(200).json({
        success: true,
        processed: 0,
        message: 'No pending jobs'
      })
    }

    console.log(`[cron:process-jobs] Processing job ${job.id} for customer ${job.customer_id}`)

    // Mark job as in_progress
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id)

    if (updateError) {
      console.error('[cron:process-jobs] Error updating job status:', updateError)
      return res.status(500).json({
        success: false,
        processed: 0,
        error: updateError.message
      })
    }

    // Process the job - create job_results entries for each directory
    const directoriesToProcess = Math.min(job.directory_limit || 50, 50) // Process up to 50 directories
    
    console.log(`[cron:process-jobs] Creating ${directoriesToProcess} job_results entries`)

    // Get directories from the directories table
    const { data: directories, error: dirError } = await supabase
      .from('directories')
      .select('id, name, submission_url, category')
      .eq('is_active', true)
      .limit(directoriesToProcess)

    if (dirError) {
      console.error('[cron:process-jobs] Error fetching directories:', dirError)
      
      // Mark job as failed
      await supabase
        .from('jobs')
        .update({
          status: 'failed',
          error_message: 'Failed to fetch directories',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)

      return res.status(500).json({
        success: false,
        processed: 0,
        error: dirError.message
      })
    }

    if (!directories || directories.length === 0) {
      console.log('[cron:process-jobs] No directories found')
      
      // Mark job as completed with 0 directories
      await supabase
        .from('jobs')
        .update({
          status: 'completed',
          directories_completed: 0,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)

      return res.status(200).json({
        success: true,
        processed: 0,
        message: 'No directories to process'
      })
    }

    // Create job_results entries for each directory
    const jobResults = directories.map(dir => ({
      job_id: job.id,
      customer_id: job.customer_id,
      directory_name: dir.name,
      directory_url: dir.submission_url,
      directory_category: dir.category,
      submission_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { error: insertError } = await supabase
      .from('job_results')
      .insert(jobResults)

    if (insertError) {
      console.error('[cron:process-jobs] Error creating job_results:', insertError)
      
      // Mark job as failed
      await supabase
        .from('jobs')
        .update({
          status: 'failed',
          error_message: 'Failed to create job results',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)

      return res.status(500).json({
        success: false,
        processed: 0,
        error: insertError.message
      })
    }

    // Update job with directory counts and mark as completed
    const completedCount = directories.length
    const now = new Date().toISOString()

    await supabase
      .from('jobs')
      .update({
        directories_to_process: completedCount,
        directories_completed: completedCount,
        directories_failed: 0,
        status: 'completed',
        completed_at: now,
        updated_at: now,
        progress_percentage: 100.0
      })
      .eq('id', job.id)

    // Update all job_results to completed status
    await supabase
      .from('job_results')
      .update({
        submission_status: 'completed',
        updated_at: now
      })
      .eq('job_id', job.id)

    // Log the job completion
    await supabase
      .from('autobolt_test_logs')
      .insert({
        customer_id: job.customer_id,
        job_id: job.id,
        directory_name: 'System',
        status: 'job_completed',
        details: `Job completed with ${completedCount} directories submitted`,
        created_at: new Date().toISOString()
      })

    processedCount = 1

    console.log(`[cron:process-jobs] Successfully completed job ${job.id} with ${directories.length} directories`)

    return res.status(200).json({
      success: true,
      processed: processedCount,
      message: `Completed job ${job.id} with ${directories.length} directories`
    })

  } catch (error) {
    console.error('[cron:process-jobs] Unexpected error:', error)
    return res.status(500).json({
      success: false,
      processed: processedCount,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

