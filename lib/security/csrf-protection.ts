// 🔒 CSRF PROTECTION
// Cross-Site Request Forgery protection for DirectoryBolt

import crypto from 'crypto'
import { NextApiRequest, NextApiResponse } from 'next'

export interface CSRFConfig {
  secret: string
  cookieName?: string
  headerName?: string
  tokenLength?: number
  sameSite?: 'strict' | 'lax' | 'none'
  secure?: boolean
  httpOnly?: boolean
  maxAge?: number
}

export interface CSRFValidationResult {
  isValid: boolean
  error?: string
  token?: string
}

/**
 * CSRF Token Generator and Validator
 */
export class CSRFProtection {
  private config: Required<CSRFConfig>

  constructor(config: CSRFConfig) {
    this.config = {
      secret: config.secret,
      cookieName: config.cookieName || 'csrf-token',
      headerName: config.headerName || 'x-csrf-token',
      tokenLength: config.tokenLength || 32,
      sameSite: config.sameSite || 'strict',
      secure: config.secure ?? process.env.NODE_ENV === 'production',
      httpOnly: config.httpOnly ?? false, // Allow JS access for AJAX requests
      maxAge: config.maxAge || 3600 // 1 hour
    }
  }

  /**
   * Generate a cryptographically secure CSRF token
   */
  generateToken(): string {
    const randomBytes = crypto.randomBytes(this.config.tokenLength)
    const timestamp = Date.now().toString()
    const payload = `${randomBytes.toString('hex')}.${timestamp}`
    
    const hmac = crypto.createHmac('sha256', this.config.secret)
    hmac.update(payload)
    const signature = hmac.digest('hex')
    
    return `${payload}.${signature}`
  }

  /**
   * Validate CSRF token
   */
  validateToken(token: string): CSRFValidationResult {
    if (!token) {
      return {
        isValid: false,
        error: 'CSRF token is required'
      }
    }

    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        return {
          isValid: false,
          error: 'Invalid CSRF token format'
        }
      }

      const [randomHex, timestamp, signature] = parts
      const payload = `${randomHex}.${timestamp}`

      // Verify signature
      const hmac = crypto.createHmac('sha256', this.config.secret)
      hmac.update(payload)
      const expectedSignature = hmac.digest('hex')

      if (!crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )) {
        return {
          isValid: false,
          error: 'Invalid CSRF token signature'
        }
      }

      // Check token age
      const tokenTime = parseInt(timestamp, 10)
      const currentTime = Date.now()
      const maxAge = this.config.maxAge * 1000 // Convert to milliseconds

      if (currentTime - tokenTime > maxAge) {
        return {
          isValid: false,
          error: 'CSRF token has expired'
        }
      }

      return {
        isValid: true,
        token
      }

    } catch (error) {
      return {
        isValid: false,
        error: `CSRF validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Set CSRF token in cookie
   */
  setTokenCookie(res: NextApiResponse, token: string): void {
    const cookieOptions = [
      `${this.config.cookieName}=${token}`,
      `Max-Age=${this.config.maxAge}`,
      `SameSite=${this.config.sameSite}`,
      'Path=/'
    ]

    if (this.config.secure) {
      cookieOptions.push('Secure')
    }

    if (this.config.httpOnly) {
      cookieOptions.push('HttpOnly')
    }

    res.setHeader('Set-Cookie', cookieOptions.join('; '))
  }

  /**
   * Get CSRF token from request
   */
  getTokenFromRequest(req: NextApiRequest): string | null {
    // Check header first
    const headerToken = req.headers[this.config.headerName] as string
    if (headerToken) {
      return headerToken
    }

    // Check body
    const bodyToken = req.body?.[this.config.cookieName] || req.body?.csrfToken
    if (bodyToken) {
      return bodyToken
    }

    // Check cookies
    const cookies = req.headers.cookie
    if (cookies) {
      const cookieMatch = cookies.match(new RegExp(`${this.config.cookieName}=([^;]+)`))
      if (cookieMatch) {
        return cookieMatch[1]
      }
    }

    return null
  }

  /**
   * Middleware for CSRF protection
   */
  middleware() {
    return (req: NextApiRequest, res: NextApiResponse, next: () => void) => {
      // Skip CSRF for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
        return next()
      }

      // Skip CSRF for webhook endpoints (they use signature validation)
      if (req.url?.includes('/webhook')) {
        return next()
      }

      const token = this.getTokenFromRequest(req)
      const validation = this.validateToken(token || '')

      if (!validation.isValid) {
        return res.status(403).json({
          success: false,
          error: 'CSRF validation failed',
          code: 'CSRF_INVALID',
          details: validation.error
        })
      }

      next()
    }
  }
}

// Global CSRF protection instance
const csrfSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
export const csrfProtection = new CSRFProtection({
  secret: csrfSecret,
  secure: process.env.NODE_ENV === 'production'
})

/**
 * CSRF token endpoint for frontend to fetch tokens
 */
export function handleCSRFTokenRequest(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  const token = csrfProtection.generateToken()
  csrfProtection.setTokenCookie(res, token)

  res.status(200).json({
    success: true,
    token,
    cookieName: 'csrf-token'
  })
}

/**
 * Validate CSRF for API routes
 */
export function validateCSRF(req: NextApiRequest): CSRFValidationResult {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
    return { isValid: true }
  }

  // Skip for webhook endpoints
  if (req.url?.includes('/webhook')) {
    return { isValid: true }
  }

  const token = csrfProtection.getTokenFromRequest(req)
  return csrfProtection.validateToken(token || '')
}

/**
 * Security headers for CSRF protection
 */
export function setCSRFSecurityHeaders(res: NextApiResponse): void {
  // Prevent embedding in frames
  res.setHeader('X-Frame-Options', 'DENY')
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://js.stripe.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.stripe.com; " +
    "frame-src https://js.stripe.com;"
  )
}

/**
 * Rate limiting for CSRF token requests
 */
export class CSRFRateLimiter {
  private attempts: Map<string, number[]> = new Map()
  private readonly maxAttempts: number
  private readonly windowMs: number

  constructor(maxAttempts = 10, windowMs = 60000) { // 10 tokens per minute
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
  }

  isAllowed(ip: string): boolean {
    const now = Date.now()
    const attempts = this.attempts.get(ip) || []
    
    // Remove old attempts
    const validAttempts = attempts.filter(time => now - time < this.windowMs)
    
    if (validAttempts.length >= this.maxAttempts) {
      return false
    }

    validAttempts.push(now)
    this.attempts.set(ip, validAttempts)
    
    return true
  }
}

export const csrfRateLimiter = new CSRFRateLimiter()

/**
 * Complete CSRF protection for API routes
 */
export function withCSRFProtection(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Set security headers
    setCSRFSecurityHeaders(res)

    // Rate limiting for token requests
    if (req.url?.includes('/csrf-token')) {
      const ip = req.headers['x-forwarded-for'] as string || 
                req.headers['x-real-ip'] as string || 
                'unknown'
      
      if (!csrfRateLimiter.isAllowed(ip)) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded for CSRF token requests'
        })
      }
    }

    // Validate CSRF for state-changing operations
    const csrfValidation = validateCSRF(req)
    if (!csrfValidation.isValid) {
      return res.status(403).json({
        success: false,
        error: 'CSRF validation failed',
        code: 'CSRF_INVALID',
        details: csrfValidation.error
      })
    }

    // Call the original handler
    return handler(req, res)
  }
}