/**
 * Standardized CORS utility for DirectoryBolt API endpoints
 * Includes enhanced Chrome extension support as required by Hudson's audit
 */

import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Apply enhanced CORS headers with Chrome extension support
 * @param res - Next.js API response object
 * @param req - Next.js API request object
 * @param options - Additional CORS configuration
 */
export function applyCorsHeaders(
  res: NextApiResponse, 
  req: NextApiRequest,
  options: {
    allowCredentials?: boolean;
    additionalMethods?: string[];
    additionalHeaders?: string[];
  } = {}
) {
  const origin = req.headers.origin;
  
  // Enhanced Chrome extension support (Hudson's requirement)
  if (origin && origin.startsWith('chrome-extension://')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'production') {
    // Production: Only allow DirectoryBolt domain
    res.setHeader('Access-Control-Allow-Origin', 'https://directorybolt.netlify.app');
  } else {
    // Development: Allow localhost for testing
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    }
  }
  
  // Standard methods + additional if specified
  const defaultMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
  const allMethods = [...defaultMethods, ...(options.additionalMethods || [])];
  res.setHeader('Access-Control-Allow-Methods', allMethods.join(', '));
  
  // Standard headers + additional if specified
  const defaultHeaders = [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'x-api-key'
  ];
  const allHeaders = [...defaultHeaders, ...(options.additionalHeaders || [])];
  res.setHeader('Access-Control-Allow-Headers', allHeaders.join(', '));
  
  // Credentials support (needed for authenticated AutoBolt endpoints)
  if (options.allowCredentials !== false) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

/**
 * Handle OPTIONS preflight requests
 * @param res - Next.js API response object
 */
export function handleOptionsRequest(res: NextApiResponse) {
  return res.status(204).end();
}

/**
 * Complete CORS middleware for AutoBolt endpoints
 * @param req - Next.js API request object
 * @param res - Next.js API response object
 * @param options - CORS configuration options
 * @returns true if request should continue, false if handled (OPTIONS request)
 */
export function corsMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  options: Parameters<typeof applyCorsHeaders>[2] = {}
): boolean {
  // Apply CORS headers
  applyCorsHeaders(res, req, options);
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    handleOptionsRequest(res);
    return false; // Request handled, don't continue
  }
  
  return true; // Continue processing
}

export default corsMiddleware;