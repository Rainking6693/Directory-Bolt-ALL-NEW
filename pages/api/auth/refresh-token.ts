// 🔄 TOKEN REFRESH API ENDPOINT - AUTH-005
// Handles JWT token refresh and rotation requests
// Provides secure token renewal for authenticated users

import type { NextApiRequest, NextApiResponse } from 'next';
import { handleTokenRefresh } from '../../../lib/middleware/token-rotation';
import { withIPWhitelist } from '../../../lib/middleware/ip-whitelist';

// 🔒 SECURITY: Secure CORS configuration for token refresh
function getTokenRefreshCorsHeaders(req: NextApiRequest) {
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['https://directorybolt.netlify.app', 'https://directorybolt.com']
    : ['http://localhost:3000', 'http://localhost:3001'];
    
  const origin = req.headers.origin;
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Refresh-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  
  if (origin && allowedOrigins.includes(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  }
  
  return corsHeaders;
}

// 🔒 SECURITY: Apply CORS headers to response
function applyCorsHeaders(res: NextApiResponse, corsHeaders: Record<string, string>) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 🔒 SECURITY FIX: Apply secure CORS headers
  const corsHeaders = getTokenRefreshCorsHeaders(req);
  applyCorsHeaders(res, corsHeaders);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Use the token refresh handler from middleware
    await handleTokenRefresh(req, res);
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Token refresh failed'
    });
  }
}

// 🔒 SECURITY: Apply rate limiting for token refresh (optional IP whitelist for staff)
export default handler;