// @ts-nocheck
/**
 * AutoBolt Real-Time Status API
 * 
 * GET /api/autobolt/real-time-status - Get current processing status for all active jobs
 * Provides real-time updates for staff dashboard monitoring
 * 
 * Security: Requires staff authentication or AUTOBOLT_API_KEY
 * 
 * Phase 1 - Task 1.6 Implementation  
 * Agent: Alex (Full-Stack Engineer)
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'

// Initialize Supabase client with service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface ActiveJob {
  job_id: string
  customer_id: string
  customer_name: string
  package_type: string
  directory_limit: number
  status: string
  started_at: string
  progress_percentage: number
  directories_completed: number
  directories_failed: number
  directories_pending: number
  current_directory?: string
  estimated_completion?: string
  processing_time_minutes: number
  last_activity: string
}

interface ExtensionStatus {
  extension_id: string
  status: string
  last_heartbeat: string
  current_customer_id?: string
  current_queue_id?: string
  directories_processed: number
  directories_failed: number
  is_active: boolean
}

interface RealTimeStatusResponse {
  success: boolean
  data?: {
    active_jobs: ActiveJob[]
    extension_status: ExtensionStatus[]
    queue_summary: {
      total_queued: number
      total_processing: number
      total_completed_today: number
      total_failed_today: number
      average_processing_time_minutes: number
    }
    last_updated: string
  }
  error?: string
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RealTimeStatusResponse>
) {
  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET.'
    })
  }

  try {
    // Authenticate using API key or staff session
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '')
    
    // For now, require API key (can extend to support staff session later)
    if (!apiKey || apiKey !== process.env.AUTOBOLT_API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Valid AUTOBOLT_API_KEY required.'
      })
    }

    // Get active jobs with progress information
    const { data: activeJobs, error: jobsError } = await supabase
      .from('autobolt_processing_queue')
      .select(`
        id,
        customer_id,
        directory_limit,
        status,
        created_at,
        started_at,
        completed_at,
        updated_at,
        customers!inner(
          customer_id,
          business_name,
          package_type
        )
      `)
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: true })

    if (jobsError) {
      console.error('❌ Failed to fetch active jobs:', jobsError)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch active jobs'
      })
    }

    // Get extension status information
    const { data: extensionStatuses, error: extensionError } = await supabase
      .from('autobolt_extension_status')
      .select('*')
      .order('last_heartbeat', { ascending: false })

    if (extensionError) {
      console.error('❌ Failed to fetch extension status:', extensionError)
    }

    // Calculate progress for each active job
    const jobsWithProgress: ActiveJob[] = []

    for (const job of activeJobs || []) {
      // Get job results to calculate progress
      const { data: jobResults } = await supabase
        .from('job_results')
        .select('status')
        .eq('job_id', job.id)

      const directoriesCompleted = jobResults?.filter(r => 
        ['submitted', 'approved'].includes(r.status)
      ).length || 0
      
      const directoriesFailed = jobResults?.filter(r => 
        ['failed', 'rejected'].includes(r.status)
      ).length || 0
      
      const directoriesPending = Math.max(0, job.directory_limit - directoriesCompleted - directoriesFailed)
      
      const progressPercentage = job.directory_limit > 0 ? 
        Math.round(((directoriesCompleted + directoriesFailed) / job.directory_limit) * 100) : 0

      // Calculate processing time
      const startTime = job.started_at ? new Date(job.started_at) : new Date(job.created_at)
      const processingTimeMinutes = Math.round((Date.now() - startTime.getTime()) / (1000 * 60))

      // Estimate completion time based on current progress and average processing speed
      let estimatedCompletion = undefined
      if (job.status === 'processing' && directoriesCompleted > 0 && directoriesPending > 0) {
        const avgTimePerDirectory = processingTimeMinutes / (directoriesCompleted + directoriesFailed)
        const remainingMinutes = Math.round(avgTimePerDirectory * directoriesPending)
        estimatedCompletion = new Date(Date.now() + remainingMinutes * 60 * 1000).toISOString()
      }

      jobsWithProgress.push({
        job_id: job.id,
        customer_id: job.customer_id,
        customer_name: job.customers.business_name || 'Unknown',
        package_type: job.customers.package_type,
        directory_limit: job.directory_limit,
        status: job.status,
        started_at: job.started_at || job.created_at,
        progress_percentage: progressPercentage,
        directories_completed: directoriesCompleted,
        directories_failed: directoriesFailed,
        directories_pending: directoriesPending,
        estimated_completion: estimatedCompletion,
        processing_time_minutes: processingTimeMinutes,
        last_activity: job.updated_at
      })
    }

    // Transform extension status data
    const transformedExtensionStatuses: ExtensionStatus[] = (extensionStatuses || []).map(ext => {
      const lastHeartbeat = new Date(ext.last_heartbeat)
      const isActive = (Date.now() - lastHeartbeat.getTime()) < 5 * 60 * 1000 // Active if heartbeat within 5 minutes

      return {
        extension_id: ext.extension_id,
        status: ext.status,
        last_heartbeat: ext.last_heartbeat,
        current_customer_id: ext.current_customer_id,
        current_queue_id: ext.current_queue_id,
        directories_processed: ext.directories_processed || 0,
        directories_failed: ext.directories_failed || 0,
        is_active: isActive
      }
    })

    // Calculate queue summary statistics
    const { data: completedToday } = await supabase
      .from('autobolt_processing_queue')
      .select('id, started_at, completed_at')
      .eq('status', 'completed')
      .gte('completed_at', new Date().toISOString().split('T')[0] + 'T00:00:00.000Z')

    const { data: failedToday } = await supabase
      .from('autobolt_processing_queue')
      .select('id')
      .eq('status', 'failed')
      .gte('updated_at', new Date().toISOString().split('T')[0] + 'T00:00:00.000Z')

    // Calculate average processing time from completed jobs today
    const avgProcessingTime = completedToday && completedToday.length > 0 ? 
      Math.round(completedToday.reduce((sum, job) => {
        if (job.started_at && job.completed_at) {
          const processingTime = (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / (1000 * 60)
          return sum + processingTime
        }
        return sum
      }, 0) / completedToday.length) : 0

    const queueSummary = {
      total_queued: jobsWithProgress.filter(j => j.status === 'queued').length,
      total_processing: jobsWithProgress.filter(j => j.status === 'processing').length,
      total_completed_today: completedToday?.length || 0,
      total_failed_today: failedToday?.length || 0,
      average_processing_time_minutes: avgProcessingTime
    }

    console.log(`✅ Real-time status: ${queueSummary.total_processing} processing, ${queueSummary.total_queued} queued`)

    return res.status(200).json({
      success: true,
      data: {
        active_jobs: jobsWithProgress,
        extension_status: transformedExtensionStatuses,
        queue_summary: queueSummary,
        last_updated: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('AutoBolt Real-Time Status API Error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    })
  }
}

export default withRateLimit(handler, rateLimiters.general)