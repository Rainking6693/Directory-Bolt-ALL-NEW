// Rate Limiter for Next.js API Routes
import rateLimit from 'express-rate-limit'

// Create rate limiters for different endpoints
const createRateLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // Default 15 minutes
    max: options.max || 100, // Default 100 requests per window
    message: options.message || {
      error: 'Too many requests from this IP',
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown'
    }
  })
}

// Rate limiter configurations
export const rateLimitConfigs = {
  analyze: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 analysis requests per 15 minutes per IP
    message: {
      error: 'Too many analysis requests. Please wait before trying again.',
      code: 'ANALYSIS_RATE_LIMIT',
      statusCode: 429
    }
  },
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
      error: 'Too many requests from this IP',
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429
    }
  },
  checkout: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 checkout attempts per minute
    message: {
      error: 'Too many checkout attempts. Please try again in a minute.',
      code: 'CHECKOUT_RATE_LIMIT',
      statusCode: 429
    }
  }
}

// Create rate limiters
export const analyzeRateLimit = createRateLimiter(rateLimitConfigs.analyze)
export const apiRateLimit = createRateLimiter(rateLimitConfigs.api)
export const checkoutRateLimit = createRateLimiter(rateLimitConfigs.checkout)

// Higher-order function to wrap API handlers with rate limiting
export function withRateLimit(config, endpoint) {
  const limiter = createRateLimiter(config)
  
  return (handler) => {
    return async (req, res) => {
      // Apply rate limiting
      return new Promise((resolve, reject) => {
        limiter(req, res, (err) => {
          if (err) {
            return res.status(429).json(config.message)
          }
          // Continue with the original handler
          handler(req, res).then(resolve).catch(reject)
        })
      })
    }
  }
}