import { serialize } from 'cookie';
import type { SerializeOptions } from 'cookie';

export const STAFF_SESSION_COOKIE = 'staff-session';
export const STAFF_SESSION_VALUE = process.env.STAFF_SESSION_TOKEN || 'VALIDTOKEN';
export const STAFF_FALLBACK_USERNAME = 'staffuser';
export const STAFF_FALLBACK_PASSWORD = 'DirectoryBoltStaff2025!';

export const ADMIN_SESSION_COOKIE = 'admin-session';
export const ADMIN_SESSION_VALUE = process.env.ADMIN_SESSION_TOKEN || 'ADMINVALIDTOKEN';
export const ADMIN_FALLBACK_API_KEY = '718e8866b81ecc6527dfc1b640e103e6741d844f4438286210d652ca02ee4622';

export const STAFF_FALLBACK_API_KEY = 'DirectoryBolt-Staff-2025-SecureKey';

export const isProductionEnv = () => process.env.NODE_ENV === 'production';
export const TEST_MODE_ENABLED = process.env.TEST_MODE === 'true';

const baseCookieOptions = (): SerializeOptions => ({
  httpOnly: true,
  secure: isProductionEnv() && !TEST_MODE_ENABLED,
  sameSite: 'strict',
  path: '/',
});

export function createSessionCookie(name: string, value: string, maxAgeSeconds: number) {
  return serialize(name, value, {
    ...baseCookieOptions(),
    maxAge: maxAgeSeconds,
  });
}

export function clearSessionCookie(name: string) {
  return serialize(name, '', {
    ...baseCookieOptions(),
    maxAge: 0,
  });
}

export function resolveStaffCredentials(): { username: string; password: string } | null {
  const username = process.env.STAFF_USERNAME;
  const password = process.env.STAFF_PASSWORD;

  if (username && password) {
    return { username, password };
  }

  if (TEST_MODE_ENABLED) {
    return {
      username: STAFF_FALLBACK_USERNAME,
      password: STAFF_FALLBACK_PASSWORD,
    };
  }

  return null;
}

export function resolveStaffApiKey(): string | null {
  const key = process.env.STAFF_API_KEY;
  if (key) {
    return key;
  }
  if (TEST_MODE_ENABLED) {
    return STAFF_FALLBACK_API_KEY;
  }
  return null;
}

export function resolveAdminApiKey(): string | null {
  const key = process.env.ADMIN_API_KEY;
  if (key) {
    return key;
  }
  if (TEST_MODE_ENABLED) {
    return ADMIN_FALLBACK_API_KEY;
  }
  return null;
}
