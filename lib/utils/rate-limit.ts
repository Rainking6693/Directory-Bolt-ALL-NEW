import { NextApiResponse } from 'next'
import { logger } from './logger'

interface RateLimitConfig {
  interval: number // Time window in milliseconds
  uniqueTokenPerInterval: number // Max unique tokens per interval
}

interface RateLimitData {
  count: number
  resetTime: number
}

// In-memory store for development (use Redis in production)
const rateLimitStore = new Map<string, RateLimitData>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  const entries = Array.from(rateLimitStore.entries())
  for (const [key, data] of entries) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export function rateLimit(config: RateLimitConfig) {
  return {
    check: async (
      res: NextApiResponse,
      limit: number,
      token: string
    ): Promise<void> => {
      const now = Date.now()
      const key = `${token}`
      
      // Get or create rate limit data
      let data = rateLimitStore.get(key)
      
      if (!data || now > data.resetTime) {
        // Reset or create new window
        data = {
          count: 0,
          resetTime: now + config.interval
        }
        rateLimitStore.set(key, data)
      }

      // Increment count
      data.count++

      // Set headers for client information
      res.setHeader('X-RateLimit-Limit', limit.toString())
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - data.count).toString())
      res.setHeader('X-RateLimit-Reset', Math.ceil(data.resetTime / 1000).toString())

      // Check if limit exceeded
      if (data.count > limit) {
        const retryAfter = Math.ceil((data.resetTime - now) / 1000)
        res.setHeader('Retry-After', retryAfter.toString())
        
        logger.warn('Rate limit exceeded', {
          metadata: {
            token: token.substring(0, 8) + '...',
            count: data.count,
            limit,
            resetTime: new Date(data.resetTime).toISOString()
          }
        })
        
        throw new Error('Rate limit exceeded')
      }

      // Update store
      rateLimitStore.set(key, data)
    }
  }
}

export class AdvancedRateLimit {
  private store: Map<string, any>
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    this.store = new Map()
    
    // Cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60 * 1000)
  }

  // Sliding window rate limiting
  async slidingWindow(
    token: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now()
    const windowStart = now - windowMs
    const key = `sliding_${token}`
    
    // Get existing requests
    let requests = this.store.get(key) || []
    
    // Remove old requests outside the window
    requests = requests.filter((timestamp: number) => timestamp > windowStart)
    
    // Check if we can allow this request
    const allowed = requests.length < limit
    
    if (allowed) {
      requests.push(now)
      this.store.set(key, requests)
    }

    return {
      allowed,
      remaining: Math.max(0, limit - requests.length),
      resetTime: windowStart + windowMs
    }
  }

  // Token bucket rate limiting
  async tokenBucket(
    token: string,
    capacity: number,
    refillRate: number, // tokens per second
    cost: number = 1
  ): Promise<{ allowed: boolean; tokensRemaining: number }> {
    const now = Date.now()
    const key = `bucket_${token}`
    
    const bucket = this.store.get(key) || {
      tokens: capacity,
      lastRefill: now
    }

    // Calculate tokens to add based on time elapsed
    const timeDelta = (now - bucket.lastRefill) / 1000
    const tokensToAdd = Math.floor(timeDelta * refillRate)
    
    bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd)
    bucket.lastRefill = now

    // Check if we have enough tokens
    const allowed = bucket.tokens >= cost
    
    if (allowed) {
      bucket.tokens -= cost
    }

    this.store.set(key, bucket)

    return {
      allowed,
      tokensRemaining: bucket.tokens
    }
  }

  // IP-based rate limiting with different limits per endpoint
  async limitByIPAndEndpoint(
    ip: string,
    endpoint: string,
    limits: {
      perMinute: number
      perHour: number
      perDay: number
    }
  ): Promise<{
    allowed: boolean
    reason?: string
    resetTime?: number
  }> {
    const now = Date.now()
    
    // Check each time window
    const checks = [
      { window: 60 * 1000, limit: limits.perMinute, name: 'minute' },
      { window: 60 * 60 * 1000, limit: limits.perHour, name: 'hour' },
      { window: 24 * 60 * 60 * 1000, limit: limits.perDay, name: 'day' }
    ]

    for (const check of checks) {
      const result = await this.slidingWindow(
        `${ip}_${endpoint}_${check.name}`,
        check.limit,
        check.window
      )

      if (!result.allowed) {
        return {
          allowed: false,
          reason: `Rate limit exceeded: ${check.limit} requests per ${check.name}`,
          resetTime: result.resetTime
        }
      }
    }

    return { allowed: true }
  }

  private cleanup(): void {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours

    const entries = Array.from(this.store.entries())
    for (const [key, data] of entries) {
      if (key.startsWith('sliding_')) {
        // Clean up sliding window data
        const requests = data.filter((timestamp: number) => 
          now - timestamp < maxAge
        )
        
        if (requests.length === 0) {
          this.store.delete(key)
        } else {
          this.store.set(key, requests)
        }
      } else if (key.startsWith('bucket_')) {
        // Clean up old bucket data
        if (now - data.lastRefill > maxAge) {
          this.store.delete(key)
        }
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.store.clear()
  }
}

// Global rate limiter instance
export const globalRateLimit = new AdvancedRateLimit()

// Helper function to get client IP
export function getClientIP(req: any): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  )
}

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // API endpoints
  analyze: { perMinute: 5, perHour: 50, perDay: 200 },
  submit: { perMinute: 2, perHour: 20, perDay: 100 },
  auth: { perMinute: 5, perHour: 30, perDay: 100 },
  
  // User actions
  registration: { perMinute: 1, perHour: 5, perDay: 10 },
  passwordReset: { perMinute: 1, perHour: 3, perDay: 5 },
  
  // General API
  general: { perMinute: 10, perHour: 100, perDay: 1000 }
}

// Rate limiting middleware
export function withRateLimit(
  limits: { perMinute: number; perHour: number; perDay: number },
  endpoint: string
) {
  return async (req: any, res: NextApiResponse, next: () => void) => {
    try {
      const ip = getClientIP(req)
      const result = await globalRateLimit.limitByIPAndEndpoint(ip, endpoint, limits)

      if (!result.allowed) {
        res.status(429).json({
          error: result.reason,
          resetTime: result.resetTime
        })
        return
      }

      next()
    } catch (error) {
      logger.error('Rate limiting error', { metadata: { error, endpoint } })
      // Allow request to continue on rate limit errors
      next()
    }
  }
}