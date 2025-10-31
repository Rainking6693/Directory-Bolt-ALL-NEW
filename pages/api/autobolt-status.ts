import { NextApiRequest, NextApiResponse } from 'next'
import { withRateLimit, rateLimiters } from '../../lib/middleware/production-rate-limit'

interface WorkerStatus {
  worker_id: string
  status: 'online' | 'offline' | 'processing' | 'error' | 'idle'
  last_heartbeat: string
  current_job_id?: string
  jobs_processed: number
  jobs_failed: number
  proxy_enabled: boolean
  captcha_credits: number
  error_message?: string
  uptime_seconds: number
}

interface AutoBoltStatus {
  workers: WorkerStatus[]
  system_status: 'online' | 'offline' | 'degraded'
  total_workers: number
  active_workers: number
  processing_workers: number
  queue_status: {
    pending_jobs: number
    active_jobs: number
    failed_jobs: number
  }
  last_updated: string
}

function authenticateStaff(req: NextApiRequest) {
  const staffKey = req.headers['x-staff-key'] || req.headers['authorization']
  const validStaffKey = process.env.STAFF_API_KEY || 'DirectoryBolt-Staff-2025-SecureKey'

  if (staffKey === validStaffKey || staffKey === `Bearer ${validStaffKey}`) {
    return true
  }

  const staffSession = req.headers.cookie?.split('; ').find(row => row.startsWith('staff-session='))?.split('=')[1]
  if (staffSession) {
    return true
  }

  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString()
    const [username, password] = decoded.split(':')
    if (username === 'staff' && password === (process.env.STAFF_DASHBOARD_PASSWORD || 'DirectoryBoltStaff2025!')) {
      return true
    }
  }

  return false
}

async function getWorkerStatus(): Promise<WorkerStatus[]> {
  try {
    // In production, this would query worker heartbeat database
    // For now, we'll simulate worker data from the backend job system
    const mockWorkers: WorkerStatus[] = [
      {
        worker_id: 'worker-001',
        status: 'online',
        last_heartbeat: new Date().toISOString(),
        current_job_id: undefined,
        jobs_processed: 156,
        jobs_failed: 3,
        proxy_enabled: true,
        captcha_credits: 250,
        uptime_seconds: 86400
      }
    ]

    return mockWorkers
  } catch (error) {
    console.error('Failed to fetch worker status:', error)
    return []
  }
}

async function getQueueStatus() {
  try {
    // Query job queue status from backend
    const queueResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/staff/autobolt-queue`, {
      headers: {
        'Authorization': `Bearer ${process.env.STAFF_API_KEY || 'DirectoryBolt-Staff-2025-SecureKey'}`
      }
    })

    if (queueResponse.ok) {
      const queueData = await queueResponse.json()
      return {
        pending_jobs: queueData.data?.stats?.total_queued || 0,
        active_jobs: queueData.data?.stats?.total_processing || 0,
        failed_jobs: queueData.data?.stats?.total_failed || 0
      }
    }

    return {
      pending_jobs: 0,
      active_jobs: 0,
      failed_jobs: 0
    }
  } catch (error) {
    console.error('Failed to fetch queue status:', error)
    return {
      pending_jobs: 0,
      active_jobs: 0,
      failed_jobs: 0
    }
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  if (!authenticateStaff(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  try {
    const workers = await getWorkerStatus()
    const queueStatus = await getQueueStatus()
    
    const activeWorkers = workers.filter(w => w.status === 'online' || w.status === 'processing').length
    const processingWorkers = workers.filter(w => w.status === 'processing').length

    const systemStatus: AutoBoltStatus['system_status'] = 
      activeWorkers === 0 ? 'offline' :
      activeWorkers < workers.length ? 'degraded' : 'online'

    const status: AutoBoltStatus = {
      workers,
      system_status: systemStatus,
      total_workers: workers.length,
      active_workers: activeWorkers,
      processing_workers: processingWorkers,
      queue_status: queueStatus,
      last_updated: new Date().toISOString()
    }

    return res.status(200).json({
      success: true,
      data: status
    })

  } catch (error) {
    console.error('AutoBolt status API error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export default withRateLimit(handler, rateLimiters.general)