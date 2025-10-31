// Staff Dashboard Queue API
// Provides real-time job queue data using the proper job queue system

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  console.log('[staff:queue] Environment check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!serviceKey,
    url: supabaseUrl?.substring(0, 20) + '...',
    key: serviceKey?.substring(0, 10) + '...'
  })

  if (!supabaseUrl || !serviceKey) {
    console.error('[staff:queue] Missing Supabase configuration')
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Supabase is not configured on this environment',
      details: {
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceKey
      }
    })
  }

  try {
    console.log('📋 Staff requesting queue data from jobs table')

    const supabase = createClient(supabaseUrl, serviceKey)

    // Get jobs data - use only columns that exist in the jobs table
    console.log('[staff:queue] Querying jobs table...')

    // First check if jobs table exists
    const { error: tableCheckError } = await supabase
      .from('jobs')
      .select('id')
      .limit(1)

    if (tableCheckError && tableCheckError.message?.includes('relation "jobs" does not exist')) {
      console.log('[staff:queue] Jobs table does not exist, returning empty data')
      return res.status(200).json({
        success: true,
        data: {
          stats: { pending: 0, processing: 0, completed: 0, failed: 0, total: 0, completedToday: 0 },
          queue: [],
          alerts: [],
          recent_activity: [],
          processing_summary: {
            total_directories_allocated: 0,
            total_directories_submitted: 0,
            total_directories_failed: 0,
            overall_completion_rate: 0
          }
        },
        retrieved_at: new Date().toISOString()
      })
    }

    // Use canonical jobs table and compute progress from job_results
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        id,
        customer_id,
        business_name,
        email,
        package_size,
        priority_level,
        status,
        created_at,
        started_at,
        completed_at,
        error_message,
        metadata
      `)
      .order('created_at', { ascending: false })

    console.log('[staff:queue] Query result:', {
      jobCount: jobs?.length || 0,
      hasError: !!jobsError,
      errorMessage: jobsError?.message
    })

    if (jobsError) {
      console.error('❌ Jobs query error:', jobsError)
      return res.status(500).json({
        error: 'Database Query Failed',
        message: 'Failed to fetch jobs from database',
        details: jobsError.message,
        code: jobsError.code
      })
    }

    if (!jobs) {
      console.log('[staff:queue] No jobs found, returning empty data')
      return res.status(200).json({
        success: true,
        data: {
          stats: { pending: 0, processing: 0, completed: 0, failed: 0, total: 0, completedToday: 0 },
          queue: [],
          alerts: [],
          recent_activity: [],
          processing_summary: {
            total_directories_allocated: 0,
            total_directories_submitted: 0,
            total_directories_failed: 0,
            overall_completion_rate: 0
          }
        },
        retrieved_at: new Date().toISOString()
      })
    }

    // Aggregate progress from job_results
    const jobIds: string[] = (jobs || []).map((j: any) => j.id)
    const countsByJob: Record<string, { total: number; completed: number; failed: number }> = {}
    if (jobIds.length > 0) {
      try {
        const { data: jr, error: jrErr } = await supabase
          .from('job_results')
          .select('job_id, status')
          .in('job_id', jobIds)
        if (!jrErr) {
          for (const row of jr || []) {
            const current = countsByJob[row.job_id] || { total: 0, completed: 0, failed: 0 }
            current.total += 1
            if (row.status === 'submitted' || row.status === 'approved') current.completed += 1
            if (row.status === 'failed') current.failed += 1
            countsByJob[row.job_id] = current
          }
        }
      } catch (e) {
        // If job_results missing, proceed with zero counts
      }
    }

    // Pull customer names/emails for nicer display if not embedded on queue rows
    const uniqueCustomerIds = Array.from(new Set((jobs || []).map((j: any) => j.customer_id).filter(Boolean)))
    let customerById: Record<string, { business_name?: string | null; email?: string | null }> = {}
    if (uniqueCustomerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, business_name, email')
        .in('id', uniqueCustomerIds)
      for (const c of customers || []) {
        customerById[c.id] = { business_name: c.business_name, email: c.email }
      }
    }

    // Transform jobs data with safe fallbacks
    const transformedJobs = (jobs || []).map((job: any) => {
      const counts = countsByJob[job.id] || { total: 0, completed: 0, failed: 0 }
      const directories_allocated = job.package_size || counts.total || 0
      const directories_submitted = counts.completed
      const directories_failed = counts.failed
      const progress_percentage = directories_allocated > 0
        ? Math.min(100, Math.round(((directories_submitted + directories_failed) / directories_allocated) * 100))
        : 0

      const fallbackCustomer = customerById[job.customer_id] || {}
      const businessName = job.business_name || fallbackCustomer.business_name || 'Unknown Business'
      const email = job.email || fallbackCustomer.email || ''

      return {
        id: job.id,
        customer_id: job.customer_id,
        business_name: businessName,
        email: email,
        package_type: mapPackageType(job.package_size || directories_allocated),
        status: job.status,
        priority_level: job.priority_level ?? 3,
        directories_allocated,
        directories_submitted,
        directories_failed,
        progress_percentage,
        estimated_completion: job.completed_at,
        completed_at: job.completed_at,
        created_at: job.created_at,
        updated_at: job.started_at || job.created_at,
        started_at: job.started_at,
        recent_activity: [],
        current_submissions: []
      }
    })

    // Calculate stats
    const stats = transformedJobs.reduce((acc, job) => {
      acc.total += 1
      if (job.status === 'pending') acc.pending += 1
      if (job.status === 'in_progress') acc.processing += 1
      if (job.status === 'complete' || job.status === 'completed') acc.completed += 1
      if (job.status === 'failed') acc.failed += 1
      return acc
    }, { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 })

    // Calculate today's completed
    const today = new Date().toDateString()
    const completedToday = transformedJobs.filter(job =>
      (job.status === 'complete' || job.status === 'completed') &&
      job.completed_at &&
      new Date(job.completed_at).toDateString() === today
    ).length

    const queueData = {
      stats: {
        pending: stats.pending,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed,
        total: stats.total,
        completedToday: completedToday
      },
      queue: transformedJobs,
      alerts: generateJobAlerts(transformedJobs),
      recent_activity: [],
      processing_summary: {
        total_directories_allocated: transformedJobs.reduce((sum, job) => sum + job.directories_allocated, 0),
        total_directories_submitted: transformedJobs.reduce((sum, job) => sum + job.directories_submitted, 0),
        total_directories_failed: transformedJobs.reduce((sum, job) => sum + job.directories_failed, 0),
        overall_completion_rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
      }
    }

    console.log(`✅ Retrieved ${transformedJobs.length} jobs from database`)

    res.status(200).json({
      success: true,
      data: queueData,
      retrieved_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Staff queue error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Check for specific error types
    if (errorMessage.includes('JWT')) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Staff authentication required',
        details: 'Please log in to the staff dashboard'
      })
    }

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return res.status(503).json({
        error: 'Network Error',
        message: 'Unable to connect to database',
        details: errorMessage
      })
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve queue data',
      details: errorMessage
    })
  }
}

function mapPackageType(packageSize: number): string {
  const packageMap: Record<number, string> = {
    50: 'starter',
    75: 'growth',
    150: 'professional',
    500: 'enterprise'
  }
  return packageMap[packageSize] || 'custom'
}

// Types for alerts returned to the staff dashboard
type AlertPriority = 'high' | 'medium' | 'low'
interface Alert {
  type: 'warning' | 'error' | 'info'
  title: string
  message: string
  customer_id: string
  priority: AlertPriority
}

function generateJobAlerts(jobs: any[]): Alert[] {
  const alerts: Alert[] = []
  const now = new Date()
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000)

  // Check for stuck jobs (in progress but no recent activity)
  const stuckJobs = jobs.filter(job => {
    if (job.status !== 'in_progress') return false
    if (!job.started_at) return false

    const lastActivity = new Date(job.started_at)
    return lastActivity < fourHoursAgo && job.progress_percentage > 0
  })

  stuckJobs.forEach(job => {
    alerts.push({
      type: 'warning',
      title: 'Stuck Job',
      message: `${job.business_name || 'Job'} has no progress in the last 4 hours`,
      customer_id: job.customer_id,
      priority: 'medium'
    })
  })

  // Check for high failure rates
  const highFailureJobs = jobs.filter(job => {
    const failureRate = job.directories_allocated > 0
      ? (job.directories_failed / job.directories_allocated) * 100
      : 0
    return failureRate > 20 // More than 20% failure rate
  })

  highFailureJobs.forEach(job => {
    const failureRate = Math.round((job.directories_failed / job.directories_allocated) * 100)
    alerts.push({
      type: 'error',
      title: 'High Failure Rate',
      message: `${job.business_name || 'Job'} has ${failureRate}% failure rate`,
      customer_id: job.customer_id,
      priority: 'high'
    })
  })

  return alerts.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder]
  })
}

// Export without middleware for debugging
export default handler