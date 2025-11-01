import type { NextApiRequest, NextApiResponse } from 'next';
import {
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_VALUE,
  createSessionCookie,
  resolveStaffCredentials,
  TEST_MODE_ENABLED,
  STAFF_FALLBACK_USERNAME,
  STAFF_FALLBACK_PASSWORD,
} from '../../../lib/auth/constants';

interface StaffLoginResponse {
  success: boolean;
  sessionToken?: string;
  user?: {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    permissions: Record<string, boolean>;
  };
  error?: string;
  message?: string;
}

const STAFF_SESSION_MAX_AGE = 7 * 24 * 60 * 60;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StaffLoginResponse>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    const credentials = resolveStaffCredentials();

    if (!credentials) {
      console.error('[staff.login] STAFF credentials missing while TEST_MODE disabled');
      return res.status(500).json({
        success: false,
        error: 'Configuration error',
        message: 'STAFF_USERNAME and STAFF_PASSWORD must be configured or TEST_MODE enabled.',
      });
    }

    const { username, password } = (req.body || {}) as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Username and password are required',
      });
    }

    // Check against configured credentials or fallback credentials
    const usernameMatch = username === credentials.username;
    const passwordMatch = password === credentials.password;
    
    // Also check fallback credentials if TEST_MODE is enabled (for development)
    const fallbackMatch = TEST_MODE_ENABLED && 
      username === STAFF_FALLBACK_USERNAME && 
      password === STAFF_FALLBACK_PASSWORD;

    if (!usernameMatch || !passwordMatch) {
      if (!fallbackMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: 'Username or password is incorrect',
        });
      }
    }

    const user = {
      id: 'staff-user',
      username: credentials.username,
      email: 'ben.stone@directorybolt.com',
      first_name: 'Staff',
      last_name: 'User',
      role: 'staff_manager',
      permissions: {
        queue: true,
        processing: true,
        analytics: true,
        support: true,
        customers: true,
      },
    };

    const cookie = createSessionCookie(STAFF_SESSION_COOKIE, STAFF_SESSION_VALUE, STAFF_SESSION_MAX_AGE);

    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({
      success: true,
      sessionToken: STAFF_SESSION_VALUE,
      user,
    });
  } catch (error) {
    console.error('[staff.login] unexpected error', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Authentication service temporarily unavailable',
    });
  }
}
