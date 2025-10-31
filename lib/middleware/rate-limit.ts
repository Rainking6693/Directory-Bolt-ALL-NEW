// Rate Limiting Middleware
// Implements basic rate limiting for API endpoints

import { NextApiRequest, NextApiResponse } from 'next'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  message?: string
}

// In-memory store for rate limiting (in production, use Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export function withRateLimit(config: RateLimitConfig) {
  return function(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      const clientId = getClientId(req)
      const now = Date.now()
      const windowStart = now - config.windowMs

      // Clean up expired entries
      for (const [key, value] of requestCounts.entries()) {
        if (value.resetTime < now) {
          requestCounts.delete(key)
        }
      }

      // Get or create client record
      let clientRecord = requestCounts.get(clientId)
      if (!clientRecord || clientRecord.resetTime < now) {
        clientRecord = { count: 0, resetTime: now + config.windowMs }
        requestCounts.set(clientId, clientRecord)
      }

      // Check if limit exceeded
      if (clientRecord.count >= config.maxRequests) {
        const retryAfter = Math.ceil((clientRecord.resetTime - now) / 1000)
        
        res.setHeader('Retry-After', retryAfter.toString())
        res.setHeader('X-RateLimit-Limit', config.maxRequests.toString())
        res.setHeader('X-RateLimit-Remaining', '0')
        res.setHeader('X-RateLimit-Reset', new Date(clientRecord.resetTime).toISOString())
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: config.message || 'Rate limit exceeded',
          retryAfter,
          statusCode: 429
        })
      }

      // Increment counter
      clientRecord.count++

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString())
      res.setHeader('X-RateLimit-Remaining', (config.maxRequests - clientRecord.count).toString())
      res.setHeader('X-RateLimit-Reset', new Date(clientRecord.resetTime).toISOString())

      return handler(req, res)
    }
  }
}

function getClientId(req: NextApiRequest): string {
  // Use IP address as client identifier
  const forwarded = req.headers['x-forwarded-for']
  const ip = forwarded 
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
    : req.connection.remoteAddress || req.socket.remoteAddress || 'unknown'
  
  return ip || 'unknown'
}

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // Strict rate limiting for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts'
  },
  
  // Moderate rate limiting for staff endpoints
  staff: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'Too many staff API requests'
  },
  
  // Lenient rate limiting for public endpoints
  public: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests'
  },
  
  // Very strict for admin endpoints
  admin: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many admin requests'
  }
}
