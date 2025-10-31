/**
 * Production-Grade Rate Limiting Middleware
 * Protects DirectoryBolt API endpoints from abuse and DoS attacks
 * Implements enterprise-level rate limiting for $149-799 customers
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../utils/logger'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (req: NextApiRequest) => string
  onLimitReached?: (req: NextApiRequest, res: NextApiResponse) => void
}

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

// In-memory store (use Redis in production for multi-instance deployments)
const store: RateLimitStore = {}

// Default rate limit configurations for different endpoint types
export const RATE_LIMITS = {
  // Critical business endpoints - more restrictive
  analyze: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute per IP
  },
  checkout: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 checkout attempts per 15 minutes
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 auth attempts per 15 minutes
  },
  
  // General API endpoints
  general: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute per IP
  },
  
  // Admin endpoints - most restrictive
  admin: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute (admin operations)
  },
  
  // Status and health checks
  status: {
    windowMs: 30 * 1000, // 30 seconds
    maxRequests: 10, // 10 status checks per 30 seconds
  }
}

/**
 * Default key generator - uses IP address and endpoint
 */
function defaultKeyGenerator(req: NextApiRequest): string {
  const ip = getClientIP(req)
  const endpoint = req.url?.split('?')[0] || 'unknown'
  return `${ip}:${endpoint}`
}

/**
 * Get client IP address from request
 */
function getClientIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const realIP = req.headers['x-real-ip']
  const cfConnectingIP = req.headers['cf-connecting-ip'] // Cloudflare
  
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  
  if (typeof realIP === 'string') {
    return realIP
  }
  
  if (typeof cfConnectingIP === 'string') {
    return cfConnectingIP
  }
  
  return req.socket.remoteAddress || 'unknown'
}

/**
 * Clean up expired entries from store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  Object.keys(store).forEach(key => {
    if (store[key].resetTime <= now) {
      delete store[key]
    }
  })
}

/**
 * Rate limiting middleware factory
 */
export function createRateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator,
    onLimitReached
  } = config

  return async (req: NextApiRequest, res: NextApiResponse, next: () => void) => {
    try {
      // Clean up expired entries periodically
      if (Math.random() < 0.01) { // 1% chance
        cleanupExpiredEntries()
      }

      const key = keyGenerator(req)
      const now = Date.now()
      
      // Initialize or reset counter if window has expired
      if (!store[key] || store[key].resetTime <= now) {
        store[key] = {
          count: 0,
          resetTime: now + windowMs
        }
      }

      // Check if limit exceeded
      if (store[key].count >= maxRequests) {
        const resetTimeSeconds = Math.ceil((store[key].resetTime - now) / 1000)
        
        // Log rate limit violation
        logger.warn('Rate limit exceeded', {
          ip: getClientIP(req),
          endpoint: req.url,
          userAgent: req.headers['user-agent'],
          count: store[key].count,
          limit: maxRequests,
          resetTime: resetTimeSeconds
        })

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', maxRequests.toString())
        res.setHeader('X-RateLimit-Remaining', '0')
        res.setHeader('X-RateLimit-Reset', Math.ceil(store[key].resetTime / 1000).toString())
        res.setHeader('Retry-After', resetTimeSeconds.toString())

        // Call custom handler if provided
        if (onLimitReached) {
          onLimitReached(req, res)
          return
        }

        // Default rate limit response
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${resetTimeSeconds} seconds.`,
          retryAfter: resetTimeSeconds,
          limit: maxRequests,
          windowMs: Math.ceil(windowMs / 1000)
        })
      }

      // Store original res.status and res.json to intercept response
      const originalStatus = res.status.bind(res)
      const originalJson = res.json.bind(res)
      
      let statusCode = 200
      let shouldCount = true

      // Override res.status to capture status code
      res.status = function(code: number) {
        statusCode = code
        return originalStatus(code)
      }

      // Override res.json to capture final response
      res.json = function(data: any) {
        // Determine if we should count this request
        if (skipSuccessfulRequests && statusCode < 400) {
          shouldCount = false
        }
        if (skipFailedRequests && statusCode >= 400) {
          shouldCount = false
        }

        // Increment counter if we should count this request
        if (shouldCount) {
          store[key].count++
        }

        // Set rate limit headers
        const remaining = Math.max(0, maxRequests - store[key].count)
        res.setHeader('X-RateLimit-Limit', maxRequests.toString())
        res.setHeader('X-RateLimit-Remaining', remaining.toString())
        res.setHeader('X-RateLimit-Reset', Math.ceil(store[key].resetTime / 1000).toString())

        return originalJson(data)
      }

      // Continue to next middleware/handler
      next()

    } catch (error) {
      logger.error('Rate limiting middleware error', {
        endpoint: req.url,
        ip: getClientIP(req)
      }, error as Error)
      
      // On error, allow request to proceed (fail open)
      next()
    }
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  analyze: createRateLimit(RATE_LIMITS.analyze),
  checkout: createRateLimit(RATE_LIMITS.checkout),
  auth: createRateLimit(RATE_LIMITS.auth),
  general: createRateLimit(RATE_LIMITS.general),
  admin: createRateLimit(RATE_LIMITS.admin),
  status: createRateLimit(RATE_LIMITS.status)
}

/**
 * Apply rate limiting to an API handler
 */
export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => void | Promise<void>,
  limiter: ReturnType<typeof createRateLimit>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    return new Promise<void>((resolve, reject) => {
      limiter(req, res, async () => {
        try {
          await handler(req, res)
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    })
  }
}

/**
 * Utility to get rate limit info for monitoring
 */
export function getRateLimitInfo(): {
  totalKeys: number
  activeWindows: number
  topEndpoints: Array<{ key: string; count: number; resetTime: number }>
} {
  const now = Date.now()
  const activeEntries = Object.entries(store).filter(([_, data]) => data.resetTime > now)
  
  return {
    totalKeys: Object.keys(store).length,
    activeWindows: activeEntries.length,
    topEndpoints: activeEntries
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([key, data]) => ({ key, count: data.count, resetTime: data.resetTime }))
  }
}

export default rateLimiters