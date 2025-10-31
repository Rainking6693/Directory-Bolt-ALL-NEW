import type { NextApiRequest, NextApiResponse } from 'next'
import { retryFailedJob } from '../../lib/server/autoboltJobs'
import { logInfo, logWarn, logError, serializeError } from '../../lib/server/logging'

logInfo('jobs-retry.module', 'Autobolt jobs helpers loaded', {
  exports: ['retryFailedJob']
})

function authorize(authHeader?: string): boolean {
  const fn = 'jobs-retry.authorize'
  const isValid = Boolean(authHeader && authHeader.startsWith('Bearer ') &&
    authHeader.slice(7) === (process.env.SUPABASE_SERVICE_ROLE_KEY || ''))
  logInfo(fn, 'Authorization evaluated', {
    hasHeader: Boolean(authHeader),
    isValid
  })
  return isValid
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const fn = 'jobs-retry.handler'
  logInfo(fn, 'Handler invoked', { method: req.method, url: req.url })

  if (req.method !== 'POST') {
    logWarn(fn, 'Method not allowed', { method: req.method })
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!authorize(req.headers.authorization)) {
    logWarn(fn, 'Unauthorized request rejected')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const payload = (req.body || {}) as Record<string, unknown>
    logInfo(fn, 'Payload received', { jobId: payload.jobId })

    if (!payload.jobId) {
      logWarn(fn, 'Missing jobId in payload')
      return res.status(400).json({ error: 'jobId is required' })
    }

    logInfo(fn, 'Retrying job', { jobId: payload.jobId })
    const job = await retryFailedJob(payload.jobId as string)
    logInfo(fn, 'Job retry processed', { jobId: payload.jobId, newStatus: job?.status })
    return res.status(200).json({ success: true, job })
  } catch (error) {
    logError(fn, 'Unhandled error', { error: serializeError(error) })
    return res.status(500).json({ error: (error as Error)?.message || 'Internal error' })
  }
}
