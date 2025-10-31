import type { NextApiRequest, NextApiResponse } from 'next';
import { withRateLimit, rateLimiters } from '../../../../lib/middleware/production-rate-limit';
import {
  completeJob,
  normalizeJobStatus,
  type JobSummary
} from '../../../../lib/server/autoboltJobs';

const WORKER_API_ENV_KEY = 'AUTOBOLT_API_KEY' as const;

type ApiResponse =
  | { success: true; data: Awaited<ReturnType<typeof completeJob>>; message: string }
  | { success: false; error: string };

interface CompleteJobRequestBody {
  jobId: string;
  finalStatus: string;
  errorMessage?: string;
  summary?: JobSummary;
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

function parseRequestBody(body: unknown): CompleteJobRequestBody | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const candidate = body as Partial<CompleteJobRequestBody>;
  if (typeof candidate.jobId !== 'string' || candidate.jobId.trim().length === 0) {
    return null;
  }
  if (typeof candidate.finalStatus !== 'string' || candidate.finalStatus.trim().length === 0) {
    return null;
  }
  return {
    jobId: candidate.jobId.trim(),
    finalStatus: candidate.finalStatus.trim(),
    errorMessage: typeof candidate.errorMessage === 'string' ? candidate.errorMessage : undefined,
    summary: isPlainObject(candidate.summary) ? (candidate.summary as JobSummary) : undefined
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const expectedKey = process.env[WORKER_API_ENV_KEY];
  if (!expectedKey) {
    console.error('[autobolt:jobs:complete] Missing AUTOBOLT_API_KEY environment variable');
    return res.status(500).json({ success: false, error: 'Worker authentication not configured' });
  }

  const providedKey = extractApiKey(req);
  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Valid AUTOBOLT_API_KEY required.' });
  }

  const parsedBody = parseRequestBody(req.body);
  if (!parsedBody) {
    return res.status(400).json({ success: false, error: 'jobId and finalStatus are required' });
  }

  const { jobId, finalStatus, errorMessage, summary } = parsedBody;
  const canonicalStatus = normalizeJobStatus(finalStatus);

  if (!canonicalStatus) {
    return res.status(400).json({ success: false, error: 'finalStatus is invalid' });
  }

  try {
    const result = await completeJob({
      jobId,
      finalStatus: canonicalStatus,
      errorMessage: errorMessage?.trim() || undefined,
      summary
    });

    return res.status(200).json({
      success: true,
      data: result,
      message: `Job ${jobId} marked as ${result.finalStatus}.`
    });
  } catch (error) {
    console.error('[autobolt:jobs:complete] Failed to complete job', error);
    return res.status(500).json({ success: false, error: 'Internal server error. Please try again later.' });
  }
}

export default withRateLimit(handler, rateLimiters.general);
