// AutoBolt Submission Logs API
// Receives submission logs from workers and stores them in the database

import type { NextApiRequest, NextApiResponse } from 'next';
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit';
import { createSupabaseAdminClient } from '../../../lib/server/supabaseAdmin';

const WORKER_API_ENV_KEY = 'AUTOBOLT_API_KEY' as const;

type ApiResponse =
  | { success: true; data: { inserted: number }; message: string }
  | { success: false; error: string };

interface SubmissionLogEntry {
  jobId: string;
  customerId: string;
  directoryName: string;
  action: string;
  details: string;
  success: boolean;
  screenshotUrl?: string;
  processingTimeMs?: number;
  errorMessage?: string;
}

interface SubmissionLogsRequestBody {
  jobId: string;
  entries: SubmissionLogEntry[];
}

function readSingleHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function extractApiKey(req: NextApiRequest): string | undefined {
  const directHeader = readSingleHeader(req.headers['x-api-key']);
  if (directHeader) {
    return directHeader;
  }

  const authHeader = readSingleHeader(req.headers.authorization);
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }

  return undefined;
}

function sanitizeLogEntry(entry: unknown): SubmissionLogEntry | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  
  const candidate = entry as Partial<SubmissionLogEntry>;
  
  if (typeof candidate.jobId !== 'string' || 
      typeof candidate.customerId !== 'string' || 
      typeof candidate.directoryName !== 'string' || 
      typeof candidate.action !== 'string' || 
      typeof candidate.details !== 'string' || 
      typeof candidate.success !== 'boolean') {
    return null;
  }

  return {
    jobId: candidate.jobId,
    customerId: candidate.customerId,
    directoryName: candidate.directoryName,
    action: candidate.action,
    details: candidate.details,
    success: candidate.success,
    screenshotUrl: typeof candidate.screenshotUrl === 'string' ? candidate.screenshotUrl : undefined,
    processingTimeMs: typeof candidate.processingTimeMs === 'number' ? candidate.processingTimeMs : undefined,
    errorMessage: typeof candidate.errorMessage === 'string' ? candidate.errorMessage : undefined
  };
}

function parseRequestBody(body: unknown): SubmissionLogsRequestBody | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  
  const candidate = body as Partial<SubmissionLogsRequestBody>;
  
  if (typeof candidate.jobId !== 'string' || candidate.jobId.trim().length === 0) {
    return null;
  }
  
  if (!Array.isArray(candidate.entries)) {
    return null;
  }

  const sanitizedEntries = candidate.entries
    .map(sanitizeLogEntry)
    .filter((entry): entry is SubmissionLogEntry => entry !== null);

  return {
    jobId: candidate.jobId,
    entries: sanitizedEntries
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  const expectedKey = process.env[WORKER_API_ENV_KEY];
  if (!expectedKey) {
    console.error('[autobolt:submission-logs] Missing AUTOBOLT_API_KEY environment variable');
    return res.status(500).json({ success: false, error: 'Worker authentication not configured' });
  }

  const providedKey = extractApiKey(req);
  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Valid AUTOBOLT_API_KEY required.' });
  }

  const parsedBody = parseRequestBody(req.body);
  if (!parsedBody) {
    return res.status(400).json({ success: false, error: 'Invalid request body. jobId and entries array required.' });
  }

  const { jobId, entries } = parsedBody;

  if (entries.length === 0) {
    return res.status(200).json({ 
      success: true, 
      data: { inserted: 0 }, 
      message: 'No valid entries to insert' 
    });
  }

  try {
    const supabase = createSupabaseAdminClient();

    // Create submission logs table if it doesn't exist
    const { error: createTableError } = await supabase.rpc('create_submission_logs_table_if_not_exists');
    if (createTableError) {
      console.warn('[autobolt:submission-logs] Could not create table:', createTableError.message);
    }

    // Insert submission logs
    const logRows = entries.map(entry => ({
      job_id: jobId,
      customer_id: entry.customerId,
      directory_name: entry.directoryName,
      action: entry.action,
      details: entry.details,
      success: entry.success,
      screenshot_url: entry.screenshotUrl || null,
      processing_time_ms: entry.processingTimeMs || null,
      error_message: entry.errorMessage || null,
      timestamp: new Date().toISOString()
    }));

    const { data, error: insertError } = await supabase
      .from('autobolt_submission_logs')
      .insert(logRows)
      .select('id');

    if (insertError) {
      console.error('[autobolt:submission-logs] Failed to insert logs:', insertError);
      return res.status(500).json({ success: false, error: 'Failed to store submission logs' });
    }

    return res.status(200).json({
      success: true,
      data: { inserted: data?.length || 0 },
      message: `Successfully stored ${data?.length || 0} submission logs`
    });

  } catch (error) {
    console.error('[autobolt:submission-logs] Failed to process submission logs', error);
    return res.status(500).json({ success: false, error: 'Internal server error. Please try again later.' });
  }
}

export default withRateLimit(handler, rateLimiters.general);