// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { withRateLimit, rateLimiters } from '../../../../lib/middleware/production-rate-limit';

const STAFF_API_KEY_ENV = 'STAFF_API_KEY' as const;
const STAFF_PASSWORD_ENV = 'STAFF_DASHBOARD_PASSWORD' as const;

interface RetryResult {
  success: boolean;
  retriedCount: number;
  failedCount: number;
  error?: string;
}

type ApiResponse =
  | {
      success: true;
      data: {
        retriedJobsCount: number;
        failedToRetryCount: number;
        jobIds: string[];
        retryTimestamp: string;
      };
      message: string;
    }
  | { success: false; error: string };

function readSingleHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
}

function hasStaffSessionCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) {
    return false;
  }
  return cookieHeader.split(';').some((part) => part.trim().startsWith('staff-session='));
}

function authenticateStaff(req: NextApiRequest): boolean {
  const expectedKey = process.env[STAFF_API_KEY_ENV];
  const expectedPassword = process.env[STAFF_PASSWORD_ENV];

  const headerKey = readSingleHeader(req.headers['x-staff-key']);
  if (expectedKey && headerKey === expectedKey) {
    return true;
  }

  const bearerToken = extractBearerToken(readSingleHeader(req.headers.authorization));
  if (expectedKey && bearerToken === expectedKey) {
    return true;
  }

  const authHeader = readSingleHeader(req.headers.authorization);
  if (expectedPassword && authHeader?.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('utf8');
    const [username, password] = decoded.split(':');
    if (username === 'staff' && password === expectedPassword) {
      return true;
    }
  }

  if (hasStaffSessionCookie(readSingleHeader(req.headers.cookie))) {
    return true;
  }

  return false;
}

function parseJobIds(body: unknown): string[] | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const jobIds = (body as { jobIds?: unknown }).jobIds;
  if (!Array.isArray(jobIds)) {
    return null;
  }

  const sanitized = jobIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  return sanitized.length > 0 ? sanitized : null;
}

function resolveSupabaseCredentials(): { url: string; serviceKey: string } | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    return null;
  }
  return { url, serviceKey };
}

function createSupabaseClient(): SupabaseClient | null {
  const credentials = resolveSupabaseCredentials();
  if (!credentials) {
    return null;
  }

  return createClient(credentials.url, credentials.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function basicRetryImplementation(jobIds: string[]): Promise<RetryResult> {
  const supabase = createSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      retriedCount: 0,
      failedCount: jobIds.length,
      error: 'Supabase credentials are not configured.'
    };
  }

  let retriedCount = 0;
  let failedCount = 0;
  const timestamp = new Date().toISOString();

  for (const jobId of jobIds) {
    try {
      const { error, count } = await supabase
        .from('jobs')
        .update({
          status: 'pending',
          started_at: null,
          completed_at: null,
          error_message: null,
          updated_at: timestamp
        })
        .eq('id', jobId)
        .select('id', { head: true, count: 'exact' });

      if (error || !count) {
        failedCount += 1;
      } else {
        retriedCount += count;
      }
    } catch (error) {
      console.error(`[autobolt:jobs:retry] Failed to enqueue job ${jobId} for retry`, error);
      failedCount += 1;
    }
  }

  return {
    success: failedCount === 0,
    retriedCount,
    failedCount,
    error: failedCount === 0 ? undefined : 'Some jobs could not be queued for retry.'
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  if (!authenticateStaff(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const jobIds = parseJobIds(req.body);
  if (!jobIds) {
    return res.status(400).json({ success: false, error: 'jobIds array is required and cannot be empty' });
  }

  try {
    const retryResult = await basicRetryImplementation(jobIds);

    if (!retryResult.success) {
      const errorMessage = retryResult.error ?? 'Failed to retry jobs';
      return res.status(500).json({ success: false, error: errorMessage });
    }

    return res.status(200).json({
      success: true,
      data: {
        retriedJobsCount: retryResult.retriedCount,
        failedToRetryCount: retryResult.failedCount,
        jobIds,
        retryTimestamp: new Date().toISOString()
      },
      message: `Successfully queued ${retryResult.retriedCount} jobs for retry`
    });
  } catch (error) {
    console.error('[autobolt:jobs:retry] Internal error', error);
    return res.status(500).json({ success: false, error: 'Internal server error. Please try again later.' });
  }
}

export default withRateLimit(handler, rateLimiters.general);
