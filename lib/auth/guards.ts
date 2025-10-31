import type { NextApiRequest } from 'next';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_VALUE,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_VALUE,
  resolveAdminApiKey,
  resolveStaffApiKey,
} from './constants';

type AuthRole = 'staff' | 'admin';
type AuthVia = 'session' | 'apiKey';

type AuthFailureReason = 'UNAUTHORIZED' | 'CONFIG';

export interface AuthCheckResult {
  ok: boolean;
  role?: AuthRole;
  via?: AuthVia;
  reason?: AuthFailureReason;
  message?: string;
}

const STAFF_KEY_HEADERS = ['x-staff-key', 'x-api-key'];
const ADMIN_KEY_HEADERS = ['x-admin-key', 'x-api-key'];

function getHeaderValue(req: NextApiRequest, header: string): string | null {
  const value = req.headers[header.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === 'string' ? value : null;
}

function getBearerToken(req: NextApiRequest): string | null {
  const authHeader = getHeaderValue(req, 'authorization');
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

function matchesKey(provided: string | null, expected: string | null): boolean {
  if (!provided || !expected) {
    return false;
  }
  return provided.trim() === expected.trim();
}

function getFirstMatchingHeader(req: NextApiRequest, headers: string[]): string | null {
  for (const header of headers) {
    const value = getHeaderValue(req, header);
    if (value) {
      return value;
    }
  }
  return null;
}

export function authenticateStaffRequest(
  req: NextApiRequest,
  options: { allowAdminSession?: boolean; allowAdminApiKey?: boolean } = {},
): AuthCheckResult {
  const allowAdminSession = options.allowAdminSession ?? true;
  const allowAdminApiKey = options.allowAdminApiKey ?? true;

  const staffSession = req.cookies[STAFF_SESSION_COOKIE];
  if (staffSession === STAFF_SESSION_VALUE) {
    return { ok: true, role: 'staff', via: 'session' };
  }

  if (allowAdminSession) {
    const adminSession = req.cookies[ADMIN_SESSION_COOKIE];
    if (adminSession === ADMIN_SESSION_VALUE) {
      return { ok: true, role: 'admin', via: 'session' };
    }
  }

  const staffApiKey = resolveStaffApiKey();
  if (!staffApiKey) {
    return {
      ok: false,
      reason: 'CONFIG',
      message: 'STAFF_API_KEY is not configured and TEST_MODE is disabled',
    };
  }

  const headerKey = getFirstMatchingHeader(req, STAFF_KEY_HEADERS);
  const bearerToken = getBearerToken(req);

  if (matchesKey(headerKey, staffApiKey) || matchesKey(bearerToken, staffApiKey)) {
    return { ok: true, role: 'staff', via: 'apiKey' };
  }

  if (allowAdminApiKey) {
    const adminApiKey = resolveAdminApiKey();
    if (adminApiKey) {
      const adminHeaderKey = getFirstMatchingHeader(req, ADMIN_KEY_HEADERS);
      if (matchesKey(adminHeaderKey, adminApiKey) || matchesKey(bearerToken, adminApiKey)) {
        return { ok: true, role: 'admin', via: 'apiKey' };
      }
    }
  }

  return {
    ok: false,
    reason: 'UNAUTHORIZED',
    message: 'Valid staff authentication not provided',
  };
}

export function authenticateAdminRequest(
  req: NextApiRequest,
  options: { allowApiKey?: boolean } = {},
): AuthCheckResult {
  const adminSession = req.cookies[ADMIN_SESSION_COOKIE];
  if (adminSession === ADMIN_SESSION_VALUE) {
    return { ok: true, role: 'admin', via: 'session' };
  }

  if (options.allowApiKey === false) {
    return {
      ok: false,
      reason: 'UNAUTHORIZED',
      message: 'Admin session cookie required',
    };
  }

  const adminApiKey = resolveAdminApiKey();
  if (!adminApiKey) {
    return {
      ok: false,
      reason: 'CONFIG',
      message: 'ADMIN_API_KEY is not configured and TEST_MODE is disabled',
    };
  }

  const headerKey = getFirstMatchingHeader(req, ADMIN_KEY_HEADERS);
  const staffHeaderKey = getFirstMatchingHeader(req, STAFF_KEY_HEADERS);
  const bearerToken = getBearerToken(req);

  if (
    matchesKey(headerKey, adminApiKey) ||
    matchesKey(staffHeaderKey, adminApiKey) ||
    matchesKey(bearerToken, adminApiKey)
  ) {
    return { ok: true, role: 'admin', via: 'apiKey' };
  }

  return {
    ok: false,
    reason: 'UNAUTHORIZED',
    message: 'Admin authentication is required',
  };
}
