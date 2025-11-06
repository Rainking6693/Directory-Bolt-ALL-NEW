// @ts-nocheck
/**
 * Staff Jobs Progress API
 *
 * GET /api/staff/jobs/progress
 * Returns job progress data for staff dashboard monitoring
 *
 * Security: Requires staff authentication (API key, session, or basic auth)
 * Usage: Staff dashboard JobProgressMonitor component
 *
 * Phase 2 - Task 2.2 Implementation
 * Agent: Riley (Frontend Engineer)
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { withRateLimit, rateLimiters } from '../../../../lib/middleware/production-rate-limit'
import { JOB_STATUSES } from '../../../../lib/constants/job-status'
import type {
  DirectoryBoltDatabase,
  JobsRow,
  JobResultsRow,
  JobStatus,
  JobResultStatus,
  Json,
} from '../../../../types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
const supabase = createClient<DirectoryBoltDatabase>(supabaseUrl, supabaseServiceKey)

type PackageTier = 'starter' | 'growth' | 'professional' | 'enterprise' | 'custom'
type SubmissionStatus = 'success' | 'failed'

interface JobProgressResult {
  id: string
  directory_name: string
  submission_status: SubmissionStatus
  submitted_at: string | null
  response_log: Json | null
}

interface JobProgressData {
  id: string
  customer_id: string
  business_name: string | null
  email: string | null
  package_type: PackageTier
  status: JobStatus
  directories_total: number
  directories_completed: number
  directories_failed: number
  progress_percentage: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  results: JobProgressResult[]
}

interface JobProgressStats {
  total_jobs: number
  pending_jobs: number
  in_progress_jobs: number
  completed_jobs: number
  failed_jobs: number
  total_directories: number
  completed_directories: number
  failed_directories: number
  success_rate: number
}

interface JobProgressResponse {
  success: boolean
  data?: {
    jobs: JobProgressData[]
    stats: JobProgressStats
  }
  message?: string
  error?: string
}

const PACKAGE_BY_SIZE: Record<number, PackageTier> = {
  50: 'starter',
  100: 'growth',
  300: 'professional',
  500: 'enterprise',
}

const toPackageTier = (size: number): PackageTier => PACKAGE_BY_SIZE[size] ?? 'custom'

const toSubmissionStatus = (status: JobResultStatus): SubmissionStatus =>
  status === 'submitted' ? 'success' : 'failed'

const authenticateStaff = (req: NextApiRequest): boolean => {
  const headerValue = req.headers['x-staff-key'] ?? req.headers['authorization']
  const staffKey = Array.isArray(headerValue) ? headerValue[0] : headerValue
  const validStaffKey = process.env.STAFF_API_KEY || 'DirectoryBolt-Staff-2025-SecureKey'

  if (staffKey === validStaffKey || staffKey === `Bearer ${validStaffKey}`) {
    return true
  }

  const cookies = Array.isArray(req.headers.cookie) ? req.headers.cookie : [req.headers.cookie]
  const staffSession = cookies
    .filter(Boolean)
    .flatMap((value) => value?.split(';') ?? [])
    .map((value) => value.trim())
    .find((value) => value.startsWith('staff-session='))
    ?.split('=')[1]

  const validStaffSession = process.env.STAFF_SESSION_TOKEN || 'DirectoryBolt-Staff-Session-2025'
  if (staffSession === validStaffSession) {
    return true
  }

  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization

  if (authHeader && authHeader.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString()
    const [username, password] = credentials.split(':')

    const validUsername = process.env.STAFF_USERNAME || 'staff'
    const validPassword = process.env.STAFF_PASSWORD || 'DirectoryBoltStaff2025!'

    if (username === validUsername && password === validPassword) {
      return true
    }
  }

  return false
}

const getClientIp = (req: NextApiRequest): string => {
  const forwarded = req.headers['x-forwarded-for']
  if (Array.isArray(forwarded)) {
    return forwarded[0] ?? 'unknown'
  }
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress ?? 'unknown'
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<JobProgressResponse>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET.',
    })
  }

  if (!authenticateStaff(req)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Staff authentication required.',
      message: 'Use API key (x-staff-key), session cookie (staff-session), or basic auth',
    })
  }

  console.log('?? Staff jobs progress requested', { ip: getClientIp(req) })

  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Database error getting job progress:', error)

      if (error.code === 'PGRST106' || error.code === 'PGRST202') {
        return res.status(503).json({
          success: false,
          error: 'Job queue system not initialized',
          message:
            'Database migration required. Apply migrations/020_create_job_queue_tables.sql in Supabase SQL Editor',
        })
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch job progress data',
      })
    }

    const jobsList = Array.isArray(jobs) ? jobs : []

    const jobProgress: JobProgressData[] = await Promise.all(
      jobsList.map(async (job) => {
        const { data: results, error: resultsError } = await supabase
          .from('job_results')
          .select('*')
          .eq('job_id', job.id)

        if (resultsError) {
          console.error('Failed to load job results:', resultsError)
          return {
            id: job.id,
            customer_id: job.customer_id,
            business_name: null,
            email: null,
            package_type: toPackageTier(job.package_size),
            status: job.status as JobStatus,
            directories_total: job.package_size,
            directories_completed: 0,
            directories_failed: 0,
            progress_percentage: 0,
            created_at: job.created_at,
            started_at: job.started_at,
            completed_at: job.completed_at,
            results: [],
          }
        }

        const resultList = (results ?? []) as JobResultsRow[]
        const completedCount = resultList.filter((item) => item.status === 'submitted').length
        const failedCount = resultList.filter((item) => item.status === 'failed').length
        const total = job.package_size
        const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0

        const normalizedResults: JobProgressResult[] = resultList.map((item) => ({
          id: item.id,
          directory_name: item.directory_name,
          submission_status: toSubmissionStatus(item.status as JobResultStatus),
          submitted_at: item.submitted_at,
          response_log: item.response_log,
        }))

        return {
          id: job.id,
          customer_id: job.customer_id,
          business_name: null,
          email: null,
          package_type: toPackageTier(job.package_size),
          status: job.status as JobStatus,
          directories_total: total,
          directories_completed: completedCount,
          directories_failed: failedCount,
          progress_percentage: progress,
          created_at: job.created_at,
          started_at: job.started_at,
          completed_at: job.completed_at,
          results: normalizedResults,
        }
      }),
    )

    const stats = jobProgress.reduce<JobProgressStats>(
      (acc, job) => {
        acc.total_jobs += 1
        acc.total_directories += job.directories_total
        acc.completed_directories += job.directories_completed
        acc.failed_directories += job.directories_failed

        if (job.status === JOB_STATUSES.PENDING) acc.pending_jobs += 1
        if (job.status === JOB_STATUSES.IN_PROGRESS) acc.in_progress_jobs += 1
        if (job.status === JOB_STATUSES.COMPLETED) acc.completed_jobs += 1
        if (job.status === JOB_STATUSES.FAILED) acc.failed_jobs += 1

        return acc
      },
      {
        total_jobs: 0,
        pending_jobs: 0,
        in_progress_jobs: 0,
        completed_jobs: 0,
        failed_jobs: 0,
        total_directories: 0,
        completed_directories: 0,
        failed_directories: 0,
        success_rate: 0,
      },
    )

    const processedTotal = stats.completed_directories + stats.failed_directories
    stats.success_rate = processedTotal > 0
      ? Math.round((stats.completed_directories / processedTotal) * 100)
      : 0

    return res.status(200).json({
      success: true,
      data: {
        jobs: jobProgress,
        stats,
      },
    })
  } catch (error) {
    console.error('Staff Jobs Progress API Error:', error)

    return res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.',
    })
  }
}

export default withRateLimit(handler, rateLimiters.admin)


