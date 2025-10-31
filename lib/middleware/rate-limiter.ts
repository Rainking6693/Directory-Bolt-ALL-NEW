/**
 * Rate Limiting Middleware for DirectoryBolt APIs
 * Prevents abuse and ensures fair usage across all endpoints
 */

import { NextApiRequest, NextApiResponse } from 'next';

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  message?: string;  // Custom error message
  keyGenerator?: (req: NextApiRequest) => string;  // Custom key generator
}

// In-memory store for rate limiting (consider Redis for production scaling)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Create a rate limiter middleware with specified configuration
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs = 60000, // Default: 1 minute
    maxRequests = 10, // Default: 10 requests
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => {
      // Default key: IP + endpoint
      const ip = req.headers['x-forwarded-for'] || 
                 req.headers['x-real-ip'] || 
                 req.socket?.remoteAddress || 
                 'unknown';
      return `${ip}:${req.url}`;
    }
  } = config;

  return async function rateLimitMiddleware(
    req: NextApiRequest,
    res: NextApiResponse,
    next?: () => void | Promise<void>
  ) {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired one
      entry = {
        count: 0,
        resetTime: now + windowMs
      };
    }
    
    // Increment request count
    entry.count++;
    rateLimitStore.set(key, entry);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
    
    // Check if limit exceeded
    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((entry.resetTime - now) / 1000).toString());
      return res.status(429).json({
        ok: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      });
    }
    
    // Continue to next middleware or handler
    if (next) {
      await next();
    }
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  // Extension validation: 100 requests per minute per IP
  extensionValidation: createRateLimiter({
    windowMs: 60000,
    maxRequests: 100,
    message: 'Extension validation rate limit exceeded. Please wait before retrying.'
  }),
  
  // Customer data operations: 30 requests per minute per IP
  customerData: createRateLimiter({
    windowMs: 60000,
    maxRequests: 30,
    message: 'Customer data API rate limit exceeded.'
  }),
  
  // Authentication: 5 attempts per 5 minutes per IP
  authentication: createRateLimiter({
    windowMs: 300000,
    maxRequests: 5,
    message: 'Too many authentication attempts. Please wait 5 minutes.'
  }),
  
  // General API: 60 requests per minute per IP
  general: createRateLimiter({
    windowMs: 60000,
    maxRequests: 60,
    message: 'API rate limit exceeded. Please slow down.'
  }),
  
  // Strict: 10 requests per minute (for sensitive operations)
  strict: createRateLimiter({
    windowMs: 60000,
    maxRequests: 10,
    message: 'Rate limit exceeded for this sensitive operation.'
  })
};

/**
 * Apply rate limiting to an API handler
 */
export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void,
  rateLimiter = rateLimiters.general
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    let handlerCalled = false;
    
    await rateLimiter(req, res, async () => {
      handlerCalled = true;
      await handler(req, res);
    });
    
    // If rate limiter didn't call the handler, it already sent a response
    if (!handlerCalled) {
      return;
    }
  };
}

const rateLimiterExports = { createRateLimiter, rateLimiters, withRateLimit };

export default rateLimiterExports;
