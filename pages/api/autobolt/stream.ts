/**
 * AutoBolt Live Stream (SSE)
 *
 * GET /api/autobolt/stream?jobId=<uuid>
 * Streams live progress for a job by periodically polling job_results
 *
 * Auth: Requires staff key (x-staff-key) or AUTOBOLT_API_KEY (x-api-key)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

export const config = {
  api: {
    bodyParser: false
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).end('Method Not Allowed')
    return
  }

  const staffKeyHeader = (req.headers['x-staff-key'] as string) || ''
  const autoKeyHeader = (req.headers['x-api-key'] as string) || ''
  const validStaffKey = process.env.STAFF_API_KEY || 'DirectoryBolt-Staff-2025-SecureKey'
  const validAutoKey = process.env.AUTOBOLT_API_KEY || ''
  if (staffKeyHeader !== validStaffKey && autoKeyHeader !== validAutoKey) {
    res.status(401).end('Unauthorized')
    return
  }

  const jobId = (req.query.jobId as string) || ''
  if (!jobId) {
    res.status(400).end('jobId required')
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')

  let timer: NodeJS.Timeout | null = null

  async function pushUpdate() {
    try {
      const { data: job } = await supabase
        .from('jobs')
        .select('package_size, status, started_at, completed_at')
        .eq('id', jobId)
        .single()

      const { data: results } = await supabase
        .from('job_results')
        .select('status')
        .eq('job_id', jobId)

      const submitted = (results || []).filter(r => (r as any).status === 'submitted').length
      const failed = (results || []).filter(r => (r as any).status === 'failed').length
      const pending = (results || []).length - submitted - failed
      const pkg = (job as any)?.package_size || 0
      const totalProcessed = (results || []).length
      const progressPercentage = pkg ? Math.min(100, Math.round((totalProcessed / pkg) * 100)) : 0

      const payload = {
        jobId,
        status: (job as any)?.status || 'unknown',
        progressPercentage,
        counts: { submitted, failed, pending, totalProcessed },
        started_at: (job as any)?.started_at || null,
        completed_at: (job as any)?.completed_at || null
      }

      res.write(`event: update\n`)
      res.write(`data: ${JSON.stringify(payload)}\n\n`)

      if (payload.status === 'completed' || payload.status === 'failed' || progressPercentage >= 100) {
        res.write('event: end\n')
        res.write('data: done\n\n')
        if (timer) clearInterval(timer)
        res.end()
      }
    } catch (e) {
      // best-effort; keep stream alive
    }
  }

  // Initial event
  res.write(`event: start\n`)
  res.write(`data: streaming\n\n`)

  timer = setInterval(pushUpdate, 1500)
  await pushUpdate()

  req.on('close', () => {
    if (timer) clearInterval(timer)
  })
}


