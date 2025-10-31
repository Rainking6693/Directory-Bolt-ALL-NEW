import type { NextApiRequest, NextApiResponse } from 'next'
import {
  updateJobProgress,
  normalizeJobStatus,
  type UpdateJobProgressParams
} from '../../lib/server/autoboltJobs'
import { logInfo, logWarn, logError, serializeError } from '../../lib/server/logging'

logInfo('jobs-update.module', 'Autobolt jobs helpers loaded', {
  exports: ['updateJobProgress']
})

function authorize(authHeader?: string): boolean {
  const fn = 'jobs-update.authorize'
  const isValid = Boolean(authHeader && authHeader.startsWith('Bearer ') &&
    authHeader.slice(7) === (process.env.SUPABASE_SERVICE_ROLE_KEY || ''))
  logInfo(fn, 'Authorization evaluated', {
    hasHeader: Boolean(authHeader),
    isValid
  })
  return isValid
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const fn = 'jobs-update.handler'
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
    const directoryResults = Array.isArray(payload.directoryResults) ? payload.directoryResults : []
    logInfo(fn, 'Payload received', {
      hasJobId: Boolean(payload.jobId),
      directoryResultCount: directoryResults.length,
      status: payload.status
    })

    if (!payload.jobId) {
      logWarn(fn, 'Missing jobId in payload')
      return res.status(400).json({ error: 'jobId is required' })
    }

    const results: UpdateJobProgressParams['directoryResults'] = directoryResults.map((result: any) => ({
      directoryName: result.directoryName,
      status: result.status as UpdateJobProgressParams['directoryResults'][number]['status'],
      submissionResult: result.message,
      listingUrl: result.listingUrl,
      directoryUrl: result.directoryUrl,
      directoryCategory: result.category,
      directoryTier: result.tier as any,
      responseLog: result.responseLog,
      rejectionReason: result.rejectionReason,
      processingTimeSeconds: result.processingTimeSeconds
    }))

    logInfo(fn, 'Calling updateJobProgress', { jobId: payload.jobId })
    const normalizedStatus = typeof payload.status === 'string'
      ? normalizeJobStatus(payload.status)
      : null;

    const progressPayload: UpdateJobProgressParams = {
      jobId: payload.jobId as string,
      directoryResults: results,
      status: normalizedStatus ?? undefined,
      errorMessage: typeof payload.errorMessage === 'string' && payload.errorMessage.trim().length > 0
        ? payload.errorMessage.trim()
        : undefined
    };

    const progress = await updateJobProgress(progressPayload);

    if (progress) {
      logInfo(fn, 'Progress updated successfully', { jobId: payload.jobId });
      return res.status(200).json({ success: true, data: progress });
    } else {
      logWarn(fn, 'Progress update returned null');
      return res.status(200).json({ success: true, data: null });
    }
  } catch (error) {
    logError(fn, 'Unhandled error', { error: serializeError(error) });
    return res.status(500).json({ success: false, error: 'Failed to update job progress' });
  }
}
