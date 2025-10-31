import type { NextApiRequest, NextApiResponse } from 'next';
import { clearSessionCookie, STAFF_SESSION_COOKIE } from '../../../lib/auth/constants';

interface StaffLogoutResponse {
  success: boolean;
  message: string;
  redirectTo: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StaffLogoutResponse | { error: string; message: string }>,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', message: 'Only POST is supported' });
    return;
  }

  try {
    const cookie = clearSessionCookie(STAFF_SESSION_COOKIE);

    res.setHeader('Set-Cookie', cookie);

    res.status(200).json({
      success: true,
      message: 'Logout successful',
      redirectTo: '/staff-login',
    });
  } catch (error) {
    console.error('[staff.logout] unexpected error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Logout failed',
    });
  }
}
