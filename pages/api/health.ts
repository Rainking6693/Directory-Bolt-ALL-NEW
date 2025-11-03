import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
)

async function checkDatabase() {
  try {
    const start = Date.now()
    const { error } = await supabase.from('jobs').select('id').limit(1)
    const latency = Date.now() - start

    return {
      status: error ? 'down' : 'up',
      latency,
      error: error?.message
    }
  } catch (error: any) {
    return { status: 'down', error: error.message }
  }
}

async function checkWorkers() {
  try {
    // Check for active workers (heartbeat in last 2 minutes)
    const { data: activeWorkers } = await supabase
      .from('worker_heartbeats')
      .select('worker_id', { count: 'exact' })
      .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())

    // Check for stale jobs
    const { data: staleJobs } = await supabase
      .rpc('find_stale_jobs', { threshold_minutes: 10 })

    return {
      status: 'up',
      active_count: activeWorkers?.length || 0,
      stale_count: staleJobs?.length || 0
    }
  } catch (error: any) {
    return { status: 'down', error: error.message }
  }
}

async function getMetrics() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [pending, inProgress, completedToday, failedToday] = await Promise.all([
      supabase.from('jobs').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('jobs').select('id', { count: 'exact' }).eq('status', 'in_progress'),
      supabase.from('jobs').select('id', { count: 'exact' }).eq('status', 'completed').gte('updated_at', today.toISOString()),
      supabase.from('jobs').select('id', { count: 'exact' }).eq('status', 'failed').gte('updated_at', today.toISOString())
    ])

    return {
      jobs_pending: pending.data?.length || 0,
      jobs_in_progress: inProgress.data?.length || 0,
      jobs_completed_today: completedToday.data?.length || 0,
      jobs_failed_today: failedToday.data?.length || 0
    }
  } catch (error) {
    return {}
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const [database, workers, metrics] = await Promise.all([
      checkDatabase(),
      checkWorkers(),
      getMetrics()
    ])

    const status = database.status === 'down' ? 'unhealthy' :
                   (workers.stale_count && workers.stale_count > 0) ? 'degraded' : 'healthy'

    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database,
        workers
      },
      metrics
    })
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message || 'Health check failed'
    })
  }
}