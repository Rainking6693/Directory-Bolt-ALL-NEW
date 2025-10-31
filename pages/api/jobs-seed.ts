import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseAdminClient } from '../../lib/server/supabaseAdmin'
import { logInfo, logWarn, logError, serializeError } from '../../lib/server/logging'

logInfo('jobs-seed.module', 'Seed endpoint module loaded')

const REQUIRED_AUTH = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function authorize(authHeader?: string): boolean {
  const fn = 'jobs-seed.authorize'
  const isValid = Boolean(
    authHeader &&
      authHeader.startsWith('Bearer ') &&
      authHeader.slice(7) === REQUIRED_AUTH
  )
  logInfo(fn, 'Authorization evaluated', {
    hasHeader: Boolean(authHeader),
    isValid
  })
  return isValid
}

function validatePayload(body: Record<string, unknown>) {
  const fn = 'jobs-seed.validatePayload'
  const errors: string[] = []

  if (!body.customer_id || typeof body.customer_id !== 'string') {
    errors.push('customer_id (string) is required')
  }

  const directoryLimit = typeof body.directory_limit === 'number' ? body.directory_limit : Number(body.directory_limit ?? 50)
  if (!Number.isFinite(directoryLimit) || directoryLimit <= 0) {
    errors.push('directory_limit must be a positive number')
  }

  const packageType = typeof body.package_type === 'string' ? body.package_type : 'starter'

  logInfo(fn, 'Validation evaluated', {
    hasErrors: errors.length > 0,
    directoryLimit,
    packageType
  })

  return {
    errors,
    directoryLimit,
    packageType
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const fn = 'jobs-seed.handler'
  logInfo(fn, 'Handler invoked', { method: req.method, url: req.url })

  if (req.method !== 'POST') {
    logWarn(fn, 'Method not allowed', { method: req.method })
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!authorize(req.headers.authorization)) {
    logWarn(fn, 'Unauthorized request rejected')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const payload = (req.body || {}) as Record<string, unknown>
  logInfo(fn, 'Payload received', { keys: Object.keys(payload) })

  const { errors, directoryLimit, packageType } = validatePayload(payload)
  if (errors.length > 0) {
    logWarn(fn, 'Payload validation failed', { errors })
    return res.status(400).json({ error: 'Validation failed', details: errors })
  }

  try {
    const supabase = createSupabaseAdminClient()
    if (!supabase) {
      logError(fn, 'Supabase client unavailable')
      return res.status(500).json({ error: 'Supabase client unavailable' })
    }

    const insertPayload = {
      customer_id: payload.customer_id,
      business_name: payload.business_name ?? null,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      website: payload.website ?? null,
      address: payload.address ?? null,
      city: payload.city ?? null,
      state: payload.state ?? null,
      zip: payload.zip ?? null,
      description: payload.description ?? null,
      category: payload.category ?? null,
      package_type: packageType,
      directory_limit: directoryLimit,
      status: 'pending',
      priority_level: typeof payload.priority_level === 'number' ? payload.priority_level : 3,
      metadata: payload.metadata ?? null
    }

    logInfo(fn, 'Inserting job record', insertPayload)
    const { data, error } = await supabase
      .from('jobs')
      .insert(insertPayload)
      .select('id')
      .maybeSingle()

    if (error) {
      logError(fn, 'Failed to insert job', { error: serializeError(error) })
      return res.status(500).json({ error: 'Failed to insert job', details: error.message })
    }

    const jobId = data?.id
    logInfo(fn, 'Job seeded successfully', { jobId })
    return res.status(200).json({ success: true, jobId })
  } catch (error) {
    logError(fn, 'Unhandled error', { error: serializeError(error) })
    return res.status(500).json({ error: (error as Error)?.message || 'Internal error' })
  }
}
