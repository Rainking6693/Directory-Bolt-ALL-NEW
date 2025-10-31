import type { NextApiRequest, NextApiResponse } from 'next'
import { withRateLimit, rateLimiters } from '../../../../lib/middleware/production-rate-limit'
import { createClient } from '@supabase/supabase-js'

const WORKER_API_ENV_KEY = 'AUTOBOLT_API_KEY' as const

type AutoBoltPackage = 'starter' | 'growth' | 'professional' | 'enterprise' | 'custom'

type ApiResponse =
  | { success: true; data: NextJobPayload | null; message?: string }
  | { success: false; error: string }

interface NextJobPayload {
  jobId: string
  customerId: string
  customerName: string | null
  customerEmail: string | null
  packageType: AutoBoltPackage
  directoryLimit: number
  priorityLevel: number
  status: string
  createdAt: string | null
  startedAt: string | null
  businessData: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

const PACKAGE_BY_LIMIT: Record<number, AutoBoltPackage> = {
  50: 'starter',
  100: 'growth',
  300: 'professional',
  500: 'enterprise',
}

function mapPackageType(packageSize: number, metadata?: Record<string, unknown> | null): AutoBoltPackage {
  const candidate = (metadata?.['package_type'] as string | undefined)?.trim()
  if (candidate && ['starter', 'growth', 'professional', 'enterprise', 'custom'].includes(candidate)) {
    return candidate as AutoBoltPackage
  }
  return PACKAGE_BY_LIMIT[Number(packageSize)] ?? 'custom'
}

function readSingleHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function extractApiKey(req: NextApiRequest): string | undefined {
  const directHeader = readSingleHeader(req.headers['x-api-key'])
  if (directHeader) return directHeader
  const authHeader = readSingleHeader(req.headers.authorization)
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice('Bearer '.length)
  return undefined
}

async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const expectedKey = process.env[WORKER_API_ENV_KEY]
  if (!expectedKey) {
    console.error('[autobolt:jobs:id] Missing AUTOBOLT_API_KEY environment variable')
    return res.status(500).json({ success: false, error: 'Worker authentication not configured' })
  }

  const providedKey = extractApiKey(req)
  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const jobId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ success: false, error: 'id is required' })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !serviceKey) {
      console.error('[autobolt:jobs:id] Supabase not configured')
      return res.status(500).json({ success: false, error: 'Database not configured' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Fetch job
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, customer_id, status, package_size, priority_level, metadata, created_at, started_at')
      .eq('id', jobId)
      .maybeSingle()

    if (jobErr) {
      console.error('[autobolt:jobs:id] job query error', jobErr)
      return res.status(500).json({ success: false, error: 'Failed to fetch job' })
    }

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' })
    }

    // Fetch customer by internal id
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', job.customer_id)
      .maybeSingle()

    if (custErr) {
      console.error('[autobolt:jobs:id] customer query error', custErr)
      return res.status(500).json({ success: false, error: 'Failed to fetch customer' })
    }

    const packageType = mapPackageType(Number(job.package_size || 0), job.metadata as Record<string, unknown> | null)

    const payload: NextJobPayload = {
      jobId: job.id,
      customerId: job.customer_id,
      customerName: typeof customer?.business_name === 'string' ? (customer!.business_name as string) : null,
      customerEmail: typeof customer?.email === 'string' ? (customer!.email as string) : null,
      packageType: packageType,
      directoryLimit: Number(job.package_size || 0),
      priorityLevel: Number(job.priority_level || 0),
      status: job.status || 'pending',
      createdAt: job.created_at || null,
      startedAt: job.started_at || null,
      businessData: (customer || null) as unknown as Record<string, unknown> | null,
      metadata: (job.metadata as Record<string, unknown> | null) || null,
    }

    return res.status(200).json({ success: true, data: payload })
  } catch (error: any) {
    console.error('[autobolt:jobs:id] error', error?.message || error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export default withRateLimit(handler, rateLimiters.general)
