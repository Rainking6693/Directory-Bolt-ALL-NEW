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

    // Always check fallback credentials first (for convenience)
    const directFallbackMatch = username === STAFF_FALLBACK_USERNAME && 
      password === STAFF_FALLBACK_PASSWORD;

    // Then check configured credentials
    const credentials = resolveStaffCredentials();
    let usernameMatch = false;
    let passwordMatch = false;
    
    if (credentials) {
      usernameMatch = username === credentials.username;
      passwordMatch = password === credentials.password;
    }

    if (!directFallbackMatch && (!usernameMatch || !passwordMatch)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Username or password is incorrect',
      });
    }

    // Use fallback username if using fallback credentials, otherwise use configured
    const finalUsername = directFallbackMatch ? STAFF_FALLBACK_USERNAME : (credentials?.username || STAFF_FALLBACK_USERNAME);

    const user = {
      id: 'staff-user',
      username: finalUsername,
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
