import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateStaffRequest } from '../../../lib/auth/guards';
import { resolveStaffCredentials, STAFF_FALLBACK_USERNAME } from '../../../lib/auth/constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = authenticateStaffRequest(req);

    if (!auth.ok) {
      const status = auth.reason === 'CONFIG' ? 500 : 401;
      return res.status(status).json({
        error: auth.reason === 'CONFIG' ? 'Configuration error' : 'Unauthorized',
        message: auth.message ?? 'Staff session not found or expired',
      });
    }

    const credentials = resolveStaffCredentials();

    return res.status(200).json({
      authenticated: true,
      isAuthenticated: true,
      via: auth.via,
      user: {
        id: `${auth.role ?? 'staff'}-user`,
        username: credentials?.username ?? STAFF_FALLBACK_USERNAME,
        email: 'ben.stone@directorybolt.com',
        first_name: auth.role === 'admin' ? 'Admin' : 'Staff',
        last_name: auth.role === 'admin' ? 'User' : 'User',
        role: auth.role === 'admin' ? 'admin_manager' : 'staff_manager',
        permissions: {
          queue: true,
          processing: true,
          analytics: true,
          support: true,
          customers: true,
        },
      },
    });
  } catch (error) {
    console.error('[staff.auth-check] unexpected error', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication service temporarily unavailable',
    });
  }
}
