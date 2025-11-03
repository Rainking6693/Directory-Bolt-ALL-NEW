// Rate Limiting Middleware
// Implements rate limiting for API endpoints using Supabase for persistence

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  message?: string
  identifierType?: 'ip' | 'api_key' // Type of identifier to use
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Fallback in-memory store for rate limiting (if Supabase fails)
const requestCounts = new Map<string, { count: number; resetTime: number }>()

async function checkRateLimitSupabase(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<{
  allowed: boolean
  limit: number
  remaining: number
  reset: number
}> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowMs)

  try {
    // Count requests in current window
    const { data: requests, error: countError } = await supabase
      .from('rate_limit_requests')
      .select('id', { count: 'exact' })
      .eq('identifier', identifier)
      .eq('endpoint', endpoint)
      .gte('created_at', windowStart.toISOString())

    if (countError) {
      console.error('Rate limit count error:', countError)
      throw countError
    }

    const requestCount = requests?.length || 0
    const remaining = Math.max(0, config.maxRequests - requestCount)
    const allowed = requestCount < config.maxRequests

    // If allowed, record this request
    if (allowed) {
      const { error: insertError } = await supabase
        .from('rate_limit_requests')
        .insert({
          identifier,
          endpoint,
          created_at: now.toISOString(),
        })

      if (insertError) {
        console.error('Rate limit insert error:', insertError)
      }
    }

    return {
      allowed,
      limit: config.maxRequests,
      remaining: allowed ? remaining - 1 : 0,
      reset: Math.floor((now.getTime() + config.windowMs) / 1000),
    }
  } catch (error) {
    console.error('Rate limit check error:', error)
    throw error
  }
}

function checkRateLimitMemory(
  clientId: string,
  config: RateLimitConfig
): {
  allowed: boolean
  limit: number
  remaining: number
  reset: number
} {
  const now = Date.now()

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
  const allowed = clientRecord.count < config.maxRequests

  if (allowed) {
    clientRecord.count++
  }

  return {
    allowed,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - clientRecord.count),
    reset: Math.floor(clientRecord.resetTime / 1000),
  }
}

export function withRateLimit(config: RateLimitConfig) {
  return function(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      const clientId = getClientId(req, config.identifierType || 'ip')
      const endpoint = req.url || 'unknown'

      let result: {
        allowed: boolean
        limit: number
        remaining: number
        reset: number
      }

      try {
        // Try Supabase first
        result = await checkRateLimitSupabase(clientId, endpoint, config)
      } catch (error) {
        // Fallback to in-memory if Supabase fails
        console.warn('Falling back to in-memory rate limiting:', error)
        result = checkRateLimitMemory(clientId, config)
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit.toString())
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString())
      res.setHeader('X-RateLimit-Reset', result.reset.toString())

      // Check if limit exceeded
      if (!result.allowed) {
        const retryAfter = result.reset - Math.floor(Date.now() / 1000)
        res.setHeader('Retry-After', retryAfter.toString())

        return res.status(429).json({
          error: 'Too Many Requests',
          message: config.message || 'Rate limit exceeded',
          retryAfter,
          statusCode: 429
        })
      }

      return handler(req, res)
    }
  }
}

function getClientId(req: NextApiRequest, identifierType: 'ip' | 'api_key' = 'ip'): string {
  if (identifierType === 'api_key') {
    const apiKey = req.headers['x-api-key'] as string
    if (apiKey) {
      return `api_key:${apiKey}`
    }
    // Fall back to IP if no API key
  }

  // Use IP address as client identifier
  const forwarded = req.headers['x-forwarded-for']
  const ip = forwarded
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
    : req.connection.remoteAddress || req.socket.remoteAddress || 'unknown'

  return `ip:${ip || 'unknown'}`
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

// Export as rateLimitPresets for consistency
export const rateLimitPresets = rateLimitConfigs

/**
 * Standalone rate limit middleware function that can be called directly in API routes
 * Returns a promise that resolves to a rate limit check result
 */
export function rateLimit(config: RateLimitConfig) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<{ allowed: boolean }> => {
    const clientId = getClientId(req, config.identifierType || 'ip')
    const endpoint = req.url || 'unknown'

    let result: {
      allowed: boolean
      limit: number
      remaining: number
      reset: number
    }

    try {
      // Try Supabase first
      result = await checkRateLimitSupabase(clientId, endpoint, config)
    } catch (error) {
      // Fallback to in-memory if Supabase fails
      console.warn('Falling back to in-memory rate limiting:', error)
      result = checkRateLimitMemory(clientId, config)
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', result.limit.toString())
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString())
    res.setHeader('X-RateLimit-Reset', result.reset.toString())

    // Check if limit exceeded
    if (!result.allowed) {
      const retryAfter = result.reset - Math.floor(Date.now() / 1000)
      res.setHeader('Retry-After', retryAfter.toString())

      res.status(429).json({
        error: 'Too Many Requests',
        message: config.message || 'Rate limit exceeded',
        retryAfter,
        statusCode: 429
      })
    }

    return { allowed: result.allowed }
  }
}