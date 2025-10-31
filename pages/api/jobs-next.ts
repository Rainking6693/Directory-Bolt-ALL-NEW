import type { NextApiRequest, NextApiResponse } from 'next'
import { getNextPendingJob, markJobInProgress } from '../../lib/server/autoboltJobs'
import { logInfo, logWarn, logError, serializeError } from '../../lib/server/logging'

logInfo('jobs-next.module', 'Autobolt jobs helpers loaded', {
  exports: ['getNextPendingJob', 'markJobInProgress']
})

function authorize(authHeader?: string): boolean {
  const fn = 'jobs-next.authorize'
  const isValid = Boolean(authHeader && authHeader.startsWith('Bearer ') &&
    authHeader.slice(7) === (process.env.SUPABASE_SERVICE_ROLE_KEY || ''))
  logInfo(fn, 'Authorization evaluated', {
    hasHeader: Boolean(authHeader),
    isValid
  })
  return isValid
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const fn = 'jobs-next.handler'
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
    logInfo(fn, 'Request authorized, fetching next job')
    const next = await getNextPendingJob()
    logInfo(fn, 'getNextPendingJob completed', { hasJob: Boolean(next) })

    if (!next) {
      logInfo(fn, 'No jobs available, returning empty payload')
      return res.status(200).json({ job: null })
    }

    logInfo(fn, 'Marking job in progress', { jobId: next.job.id })
    await markJobInProgress(next.job.id)

    const directoryLimitByPackage: Record<string, number> = {
      starter: 50,
      growth: 150,
      professional: 300,
      enterprise: 500,
      pro: 500
    }

    const packageLimitKey = next.job.packageType.toLowerCase()
    const normalizedDirectoryLimit =
      next.job.directoryLimit > 0
        ? next.job.directoryLimit
        : directoryLimitByPackage[packageLimitKey] ?? 50


    const jobPayload = {
      id: next.job.id,
      customer_id: next.job.customerId,
      package_size: next.job.packageSize,
      priority_level: next.job.priorityLevel,
      status: next.job.status,
      created_at: next.job.createdAt,
      started_at: next.job.startedAt,
      updated_at: next.job.updatedAt,
      business_name: next.job.businessName,
      email: next.job.email,
      phone: next.job.phone,
      website: next.job.website,
      address: next.job.address,
      city: next.job.city,
      state: next.job.state,
      zip: next.job.zip,
      description: next.job.description,
      category: next.job.category,
      package_type: next.job.packageType,
      directory_limit: normalizedDirectoryLimit,
      metadata: next.job.metadata ?? null,
    }
    logInfo(fn, 'Responding with job payload', { jobId: jobPayload.id })
    return res.status(200).json({ job: jobPayload })
  } catch (error) {
    logError(fn, 'Unhandled error', { error: serializeError(error) })
    return res.status(500).json({ error: (error as Error)?.message || 'Internal error' })
  }
}
