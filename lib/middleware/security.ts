// @ts-nocheck

// Comprehensive API Security Middleware
import { NextApiRequest, NextApiResponse } from 'next'
import rateLimit from 'express-rate-limit'
import slowDown from 'express-slow-down'
import { createHash } from 'crypto'
import { envValidator } from '../config/environment-validation'

// Rate limiting configurations per endpoint type
const RATE_LIMITS = {
  // High-security endpoints
  payment: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 requests per 15 minutes
  registration: { windowMs: 15 * 60 * 1000, max: 3 }, // 3 requests per 15 minutes
  
  // Standard API endpoints
  api: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
  analysis: { windowMs: 15 * 60 * 1000, max: 10 }, // 10 requests per 15 minutes
  
  // Public endpoints
  public: { windowMs: 15 * 60 * 1000, max: 200 }, // 200 requests per 15 minutes
}

// Request validation schemas
const REQUEST_SCHEMAS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s\-\(\)]{10,}$/,
  url: /^https?:\/\/.+$/,
  customerId: /^DIR-\d{8}-[A-Z0-9]{6}$/,
  sessionId: /^cs_[a-zA-Z0-9]+$/,
}

interface SecurityOptions {
  rateLimitType?: keyof typeof RATE_LIMITS
  requireAuth?: boolean
  validateCSRF?: boolean
  allowedMethods?: string[]
  requireHTTPS?: boolean
  validateOrigin?: boolean
}

export class SecurityMiddleware {
  private static rateLimiters = new Map()

  static createRateLimiter(type: keyof typeof RATE_LIMITS) {
    if (!this.rateLimiters.has(type)) {
      const config = RATE_LIMITS[type]
      this.rateLimiters.set(type, rateLimit({
        ...config,
        keyGenerator: (req: NextApiRequest) => {
          // Use IP + User-Agent for better rate limiting
          const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
          const userAgent = req.headers['user-agent'] || ''
          return createHash('sha256').update(`${ip}:${userAgent}`).digest('hex')
        },
        handler: (req: NextApiRequest, res: NextApiResponse) => {
          res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil(config.windowMs / 1000)
          })
        }
      }))
    }
    return this.rateLimiters.get(type)
  }

  static async validateRequest(req: NextApiRequest, res: NextApiResponse, options: SecurityOptions = {}) {
    const {
      rateLimitType = 'api',
      requireAuth = false,
      validateCSRF = false,
      allowedMethods = ['GET', 'POST'],
      requireHTTPS = true,
      validateOrigin = true
    } = options

    // Method validation
    if (!allowedMethods.includes(req.method || '')) {
      return this.sendError(res, 405, 'Method not allowed')
    }

    // HTTPS validation in production
    if (requireHTTPS && envValidator.isProduction()) {
      const protocol = req.headers['x-forwarded-proto'] || 'http'
      if (protocol !== 'https') {
        return this.sendError(res, 400, 'HTTPS required')
      }
    }

    // Origin validation
    if (validateOrigin) {
      const origin = req.headers.origin
      const allowedOrigins = [envValidator.getEnv().NEXT_PUBLIC_APP_URL]
      if (origin && !allowedOrigins.includes(origin)) {
        return this.sendError(res, 403, 'Invalid origin')
      }
    }

    // Rate limiting
    const rateLimiter = this.createRateLimiter(rateLimitType)
    await new Promise((resolve) => {
      rateLimiter(req, res, resolve)
    })

    // CSRF validation for state-changing operations
    if (validateCSRF && ['POST', 'PUT', 'DELETE'].includes(req.method || '')) {
      const csrfToken = req.headers['x-csrf-token']
      if (!csrfToken || !this.validateCSRFToken(csrfToken.toString())) {
        return this.sendError(res, 403, 'Invalid CSRF token')
      }
    }

    // Set security headers
    const headers = envValidator.getSecureHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value)
    })

    return true
  }

  static validateInputData(data: any, schema: Record<string, any>): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    for (const [field, value] of Object.entries(data)) {
      if (schema[field]) {
        const validator = schema[field]
        
        if (typeof validator === 'object' && validator.required && !value) {
          errors.push(`${field} is required`)
        }
        
        if (value && validator.pattern && !validator.pattern.test(value)) {
          errors.push(`${field} has invalid format`)
        }
        
        if (value && validator.maxLength && value.length > validator.maxLength) {
          errors.push(`${field} exceeds maximum length`)
        }
      }
    }

    return { isValid: errors.length === 0, errors }
  }

  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
  }

  static validateEmail(email: string): boolean {
    return REQUEST_SCHEMAS.email.test(email)
  }

  static validatePhone(phone: string): boolean {
    return REQUEST_SCHEMAS.phone.test(phone)
  }

  static validateURL(url: string): boolean {
    return REQUEST_SCHEMAS.url.test(url)
  }

  static validateCustomerId(customerId: string): boolean {
    return REQUEST_SCHEMAS.customerId.test(customerId)
  }

  static validateSessionId(sessionId: string): boolean {
    return REQUEST_SCHEMAS.sessionId.test(sessionId)
  }

  private static validateCSRFToken(token: string): boolean {
    // Implement CSRF token validation logic
    // This is a simplified version - in production, use proper CSRF token validation
    return token.length > 20
  }

  private static sendError(res: NextApiResponse, status: number, message: string) {
    res.status(status).json({
      error: true,
      message,
      timestamp: new Date().toISOString()
    })
    return false
  }
}

// Middleware wrapper for easy usage
export function withSecurity(options: SecurityOptions = {}) {
  return async (req: NextApiRequest, res: NextApiResponse, next: Function) => {
    const isValid = await SecurityMiddleware.validateRequest(req, res, options)
    if (isValid) {
      return next()
    }
  }
}

export default SecurityMiddleware