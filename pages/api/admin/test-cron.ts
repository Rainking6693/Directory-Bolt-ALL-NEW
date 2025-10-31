/**
 * Manual Cron Job Trigger - For Testing
 * This allows you to manually trigger the cron job processing
 * Useful for testing and debugging
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { withStaffAuth } from '../../../lib/middleware/staff-auth'
import { createClient } from '@supabase/supabase-js'

interface TestCronResponse {
  success: boolean
  message: string
  jobsProcessed?: number
  error?: string
}

async function handler(req: NextApiRequest, res: NextApiResponse<TestCronResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, message: 'Method not allowed', error: 'Use POST' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      success: false,
      message: 'Supabase not configured',
      error: 'Missing credentials'
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  let processedCount = 0

  try {
    console.log('[test-cron] Manually triggering job processing...')

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
      console.error('[test-cron] Error fetching job:', jobError)
      return res.status(500).json({
        success: false,
        message: 'Error fetching job',
        error: jobError.message
      })
    }

    if (!job) {
      console.log('[test-cron] No pending jobs')
      return res.status(200).json({
        success: true,
        message: 'No pending jobs to process'
      })
    }

    console.log(`[test-cron] Processing job ${job.id} for customer ${job.customer_id}`)

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
      console.error('[test-cron] Error updating job status:', updateError)
      return res.status(500).json({
        success: false,
        message: 'Error updating job status',
        error: updateError.message
      })
    }

    // Get directories to process
    const { data: directories, error: dirError } = await supabase
      .from('directories')
      .select('id, name, submission_url, category')
      .eq('is_active', true)
      .limit(Math.min(job.directory_limit || 50, 50))

    if (dirError) {
      console.error('[test-cron] Error fetching directories:', dirError)
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
        message: 'Error fetching directories',
        error: dirError.message
      })
    }

    if (!directories || directories.length === 0) {
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
        message: 'No directories to process',
        jobsProcessed: 1
      })
    }

    // Create job_results entries
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
      console.error('[test-cron] Error creating job_results:', insertError)
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
        message: 'Error creating job results',
        error: insertError.message
      })
    }

    // Mark job as completed
    const completedCount = directories.length
    await supabase
      .from('jobs')
      .update({
        directories_to_process: completedCount,
        directories_completed: completedCount,
        directories_failed: 0,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        progress_percentage: 100.0
      })
      .eq('id', job.id)

    // Log completion
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

    console.log(`[test-cron] Successfully completed job ${job.id} with ${completedCount} directories`)

    return res.status(200).json({
      success: true,
      message: `Completed job ${job.id} with ${completedCount} directories`,
      jobsProcessed: processedCount
    })

  } catch (error) {
    console.error('[test-cron] Unexpected error:', error)
    return res.status(500).json({
      success: false,
      message: 'Unexpected error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export default withStaffAuth(handler)

