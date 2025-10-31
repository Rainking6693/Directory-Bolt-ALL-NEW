// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next'
import { rateLimit } from '../../../lib/utils/rate-limit'
import { getSupabaseAdminClient } from '../../../lib/server/supabaseAdmin'
import type { AutoBoltResponse } from '../../../types/api'

// Rate limiting for AutoBolt API
const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500, // Limit each IP to 500 requests per interval
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AutoBoltResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET.'
    })
  }

  try {
    // Apply rate limiting
    await limiter.check(res, 10, 'autobolt-queue') // 10 requests per minute per IP
  } catch {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please try again later.'
    })
  }

  try {
    const supabase = getSupabaseAdminClient()
    
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Supabase client not available'
      })
    }

    // Get jobs with customer information
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        id,
        customer_id,
        package_size,
        priority_level,
        status,
        created_at,
        started_at,
        completed_at,
        error_message,
        business_name,
        email
      `)
      .order('created_at', { ascending: true })

    if (jobsError) {
      console.error('[AutoBolt Queue API] Failed to fetch jobs:', jobsError)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch jobs'
      })
    }

    // Get job results for statistics
    const jobIds = jobs?.map((job) => job.id) || []
    let resultsByJob: Record<string, { completed: number; failed: number; total: number }> = {}

    if (jobIds.length > 0) {
      const { data: results, error: resultsError } = await supabase
        .from('job_results')
        .select('job_id, status')
        .in('job_id', jobIds)

      if (resultsError) {
        console.error('[AutoBolt Queue API] Failed to fetch job results:', resultsError)
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch job results'
        })
      }

      resultsByJob = (results || []).reduce<Record<string, { completed: number; failed: number; total: number }>>((acc, row) => {
        const current = acc[row.job_id] || { completed: 0, failed: 0, total: 0 }
        current.total += 1
        if (row.status === 'submitted') current.completed += 1
        if (row.status === 'failed') current.failed += 1
        acc[row.job_id] = current
        return acc
      }, {})
    }

    // Transform jobs data
    const queueItems = (jobs || []).map((job) => {
      const stats = resultsByJob[job.id] || { completed: 0, failed: 0, total: 0 }
      const total = job.package_size || stats.total
      const processed = stats.total
      const progress = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0
      const status = normalizeJobStatus(job.status as string) ?? 'pending'

      return {
        id: job.id,
        customerId: job.customer_id,
        businessName: job.business_name ?? null,
        email: job.email ?? null,
        packageSize: job.package_size,
        priorityLevel: job.priority_level,
        status,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        errorMessage: job.error_message,
        directoriesTotal: total,
        directoriesCompleted: stats.completed,
        directoriesFailed: stats.failed,
        progressPercentage: progress
      }
    })

    // Calculate statistics
    const stats = queueItems.reduce((acc, job) => {
      acc.totalJobs += 1
      acc.totalDirectories += job.directoriesTotal
      acc.completedDirectories += job.directoriesCompleted
      acc.failedDirectories += job.directoriesFailed

      if (job.status === 'pending') acc.pendingJobs += 1
      if (job.status === 'in_progress') acc.inProgressJobs += 1
      if (job.status === 'complete') acc.completedJobs += 1
      if (job.status === 'failed') acc.failedJobs += 1

      return acc
    }, {
      totalJobs: 0,
      pendingJobs: 0,
      inProgressJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      totalDirectories: 0,
      completedDirectories: 0,
      failedDirectories: 0,
      successRate: 0
    })

    stats.successRate = stats.totalDirectories > 0
      ? Math.round((stats.completedDirectories / stats.totalDirectories) * 100)
      : 0

    return res.status(200).json({
      success: true,
      data: {
        queueItems,
        stats
      }
    })

  } catch (error) {
    console.error('AutoBolt Queue API Error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    })
  }
}

function normalizeJobStatus(input?: string | null): string | null {
  if (typeof input !== 'string') {
    return null
  }

  const value = input.trim().toLowerCase()
  if (!value) {
    return null
  }

  switch (value) {
    case 'pending':
      return 'pending'
    case 'in_progress':
    case 'in-progress':
    case 'processing':
    case 'submitted':
      return 'in_progress'
    case 'complete':
    case 'completed':
      return 'complete'
    case 'failed':
      return 'failed'
    default:
      return 'pending'
  }
}