/**
 * AutoBolt Activity API - Recent Jobs Overview
 *
 * GET /api/autobolt/activity
 * Returns recent jobs with computed progress from job_results
 *
 * Auth: Requires staff key (x-staff-key) or AUTOBOLT_API_KEY (x-api-key)
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface ActivityJob {
  id: string
  customer_id: string
  package_size: number
  status: string
  created_at: string
  started_at?: string | null
  completed_at?: string | null
  progressPercentage: number
  counts: {
    submitted: number
    failed: number
    pending: number
    totalProcessed: number
  }
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; data?: { jobs: ActivityJob[] }; error?: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const staffKeyHeader = (req.headers['x-staff-key'] as string) || ''
    const autoKeyHeader = (req.headers['x-api-key'] as string) || ''
    const validStaffKey = process.env.STAFF_API_KEY || 'DirectoryBolt-Staff-2025-SecureKey'
    const validAutoKey = process.env.AUTOBOLT_API_KEY || ''

    if (staffKeyHeader !== validStaffKey && autoKeyHeader !== validAutoKey) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 50)

    // Get recent jobs
    const { data: jobs, error: jobsErr } = await supabase
      .from('jobs')
      .select('id, customer_id, package_size, status, created_at, started_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (jobsErr) {
      return res.status(500).json({ success: false, error: 'Failed to fetch jobs' })
    }

    const jobIds = (jobs || []).map(j => j.id)
    let resultsByJob: Record<string, { submitted: number; failed: number; pending: number }> = {}

    if (jobIds.length > 0) {
      const { data: results, error: resErr } = await supabase
        .from('job_results')
        .select('job_id, status')
        .in('job_id', jobIds)

      if (resErr) {
        return res.status(500).json({ success: false, error: 'Failed to fetch job results' })
      }

      for (const r of results || []) {
        const key = (r as any).job_id as string
        const status = (r as any).status as string
        if (!resultsByJob[key]) {
          resultsByJob[key] = { submitted: 0, failed: 0, pending: 0 }
        }
        if (status === 'submitted') resultsByJob[key].submitted += 1
        else if (status === 'failed') resultsByJob[key].failed += 1
        else resultsByJob[key].pending += 1
      }
    }

    const activity: ActivityJob[] = (jobs || []).map(j => {
      const counts = resultsByJob[j.id] || { submitted: 0, failed: 0, pending: 0 }
      const totalProcessed = counts.submitted + counts.failed + counts.pending
      const pkg = (j as any).package_size || 0
      const progress = pkg ? Math.min(100, Math.round((totalProcessed / pkg) * 100)) : 0
      return {
        id: j.id,
        customer_id: j.customer_id,
        package_size: j.package_size as any,
        status: j.status as any,
        created_at: j.created_at as any,
        started_at: (j as any).started_at || null,
        completed_at: (j as any).completed_at || null,
        progressPercentage: progress,
        counts: { ...counts, totalProcessed }
      }
    })

    return res.status(200).json({ success: true, data: { jobs: activity } })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export default withRateLimit(handler, rateLimiters.status)


