import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  organizationId: string
  tier: 'starter' | 'growth' | 'professional' | 'enterprise'
  limits: {
    requests: {
      perMinute: number
      perHour: number
      perDay: number
    }
    endpoints: {
      [endpoint: string]: {
        perMinute: number
        perHour: number
      }
    }
    burst: {
      enabled: boolean
      maxTokens: number
      refillRate: number
    }
  }
  overrides: {
    [userId: string]: Partial<RateLimitConfig['limits']>
  }
}

interface RateLimitRecord {
  organizationId: string
  userId?: string
  endpoint: string
  requests: number
  resetTime: number
  burstTokens: number
  lastRequest: number
}

// In-memory storage for demo (replace with Redis in production)
const rateLimitStore: Map<string, RateLimitRecord> = new Map()
const rateLimitConfigs: Map<string, RateLimitConfig> = new Map()

// Default rate limits by tier
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig['limits']> = {
  starter: {
    requests: { perMinute: 10, perHour: 100, perDay: 1000 },
    endpoints: {
      '/api/analytics/*': { perMinute: 5, perHour: 50 },
      '/api/ai/*': { perMinute: 2, perHour: 20 },
      '/api/directories/*': { perMinute: 8, perHour: 80 }
    },
    burst: { enabled: false, maxTokens: 0, refillRate: 0 }
  },
  growth: {
    requests: { perMinute: 30, perHour: 500, perDay: 5000 },
    endpoints: {
      '/api/analytics/*': { perMinute: 15, perHour: 150 },
      '/api/ai/*': { perMinute: 8, perHour: 80 },
      '/api/directories/*': { perMinute: 25, perHour: 250 }
    },
    burst: { enabled: true, maxTokens: 10, refillRate: 1 }
  },
  professional: {
    requests: { perMinute: 100, perHour: 2000, perDay: 20000 },
    endpoints: {
      '/api/analytics/*': { perMinute: 50, perHour: 500 },
      '/api/ai/*': { perMinute: 30, perHour: 300 },
      '/api/directories/*': { perMinute: 80, perHour: 800 }
    },
    burst: { enabled: true, maxTokens: 25, refillRate: 2 }
  },
  enterprise: {
    requests: { perMinute: 500, perHour: 10000, perDay: 100000 },
    endpoints: {
      '/api/analytics/*': { perMinute: 200, perHour: 2000 },
      '/api/ai/*': { perMinute: 100, perHour: 1000 },
      '/api/directories/*': { perMinute: 300, perHour: 3000 }
    },
    burst: { enabled: true, maxTokens: 100, refillRate: 5 }
  }
}

export class APIRateLimiter {
  static async checkRateLimit(
    organizationId: string,
    userId: string,
    endpoint: string,
    userTier: string
  ): Promise<{ allowed: boolean; resetTime?: number; remaining?: number }> {
    const key = `${organizationId}:${userId}:${endpoint}`
    const now = Date.now()
    
    // Get or create rate limit config
    let config = rateLimitConfigs.get(organizationId)
    if (!config) {
      config = {
        organizationId,
        tier: userTier as any,
        limits: DEFAULT_RATE_LIMITS[userTier] || DEFAULT_RATE_LIMITS.starter,
        overrides: {}
      }
      rateLimitConfigs.set(organizationId, config)
    }

    // Get current record
    let record = rateLimitStore.get(key)
    if (!record) {
      record = {
        organizationId,
        userId,
        endpoint,
        requests: 0,
        resetTime: now + 60000, // 1 minute
        burstTokens: config.limits.burst.maxTokens,
        lastRequest: now
      }
      rateLimitStore.set(key, record)
    }

    // Reset if time window has passed
    if (now >= record.resetTime) {
      record.requests = 0
      record.resetTime = now + 60000
      record.burstTokens = config.limits.burst.maxTokens
    }

    // Refill burst tokens
    if (config.limits.burst.enabled) {
      const timeSinceLastRequest = now - record.lastRequest
      const tokensToAdd = Math.floor(timeSinceLastRequest / 1000) * config.limits.burst.refillRate
      record.burstTokens = Math.min(
        config.limits.burst.maxTokens,
        record.burstTokens + tokensToAdd
      )
    }

    // Check limits
    const limits = this.getEffectiveLimits(config, userId)
    const endpointLimits = this.getEndpointLimits(config, endpoint)
    
    const perMinuteLimit = endpointLimits?.perMinute || limits.requests.perMinute
    const remaining = perMinuteLimit - record.requests

    // Use burst tokens if available
    if (remaining <= 0 && config.limits.burst.enabled && record.burstTokens > 0) {
      record.burstTokens--
      record.lastRequest = now
      rateLimitStore.set(key, record)
      return { allowed: true, resetTime: record.resetTime, remaining: 0 }
    }

    if (remaining <= 0) {
      return { allowed: false, resetTime: record.resetTime, remaining: 0 }
    }

    // Allow request
    record.requests++
    record.lastRequest = now
    rateLimitStore.set(key, record)

    return { allowed: true, resetTime: record.resetTime, remaining: remaining - 1 }
  }

  private static getEffectiveLimits(config: RateLimitConfig, userId: string) {
    const userOverrides = config.overrides[userId]
    if (!userOverrides) return config.limits

    return {
      requests: {
        perMinute: userOverrides.requests?.perMinute || config.limits.requests.perMinute,
        perHour: userOverrides.requests?.perHour || config.limits.requests.perHour,
        perDay: userOverrides.requests?.perDay || config.limits.requests.perDay
      },
      endpoints: { ...config.limits.endpoints, ...userOverrides.endpoints },
      burst: { ...config.limits.burst, ...userOverrides.burst }
    }
  }

  private static getEndpointLimits(config: RateLimitConfig, endpoint: string) {
    // Find matching endpoint pattern
    for (const [pattern, limits] of Object.entries(config.limits.endpoints)) {
      if (this.matchEndpoint(endpoint, pattern)) {
        return limits
      }
    }
    return null
  }

  private static matchEndpoint(endpoint: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'))
      return regex.test(endpoint)
    }
    return endpoint === pattern
  }

  static async updateRateLimitConfig(
    organizationId: string,
    updates: Partial<RateLimitConfig>
  ): Promise<void> {
    const existing = rateLimitConfigs.get(organizationId)
    const updated = { ...existing, ...updates, organizationId }
    rateLimitConfigs.set(organizationId, updated as RateLimitConfig)
  }

  static async getRateLimitStatus(
    organizationId: string,
    userId?: string
  ): Promise<{
    config: RateLimitConfig
    usage: Array<{ endpoint: string; requests: number; remaining: number; resetTime: number }>
  }> {
    const config = rateLimitConfigs.get(organizationId)
    if (!config) {
      throw new Error('Rate limit config not found')
    }

    const usage: any[] = []
    const keyPrefix = userId ? `${organizationId}:${userId}:` : `${organizationId}:`

    for (const [key, record] of rateLimitStore.entries()) {
      if (key.startsWith(keyPrefix)) {
        const limits = this.getEffectiveLimits(config, record.userId || '')
        const endpointLimits = this.getEndpointLimits(config, record.endpoint)
        const limit = endpointLimits?.perMinute || limits.requests.perMinute
        
        usage.push({
          endpoint: record.endpoint,
          requests: record.requests,
          remaining: Math.max(0, limit - record.requests),
          resetTime: record.resetTime
        })
      }
    }

    return { config, usage }
  }
}

// Middleware function for Next.js API routes
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: { endpoint?: string } = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Extract organization and user info from request
      const organizationId = req.headers.get('x-organization-id') || 'default'
      const userId = req.headers.get('x-user-id') || 'anonymous'
      const userTier = req.headers.get('x-user-tier') || 'starter'
      const endpoint = options.endpoint || req.nextUrl.pathname

      // Check rate limit
      const result = await APIRateLimiter.checkRateLimit(
        organizationId,
        userId,
        endpoint,
        userTier
      )

      if (!result.allowed) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            resetTime: result.resetTime,
            message: 'Too many requests. Please try again later.'
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Reset': result.resetTime?.toString() || '',
              'Retry-After': Math.ceil(((result.resetTime || 0) - Date.now()) / 1000).toString()
            }
          }
        )
      }

      // Add rate limit headers to response
      const response = await handler(req)
      response.headers.set('X-RateLimit-Remaining', result.remaining?.toString() || '')
      response.headers.set('X-RateLimit-Reset', result.resetTime?.toString() || '')
      
      return response
    } catch (error) {
      console.error('Rate limiting error:', error)
      // Continue without rate limiting on error
      return handler(req)
    }
  }
}