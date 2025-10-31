/**
 * Secure Admin Authentication Middleware
 * Implements enterprise-grade security for DirectoryBolt admin endpoints
 */

import crypto from 'crypto'
import { logger } from '../utils/logger'
import { validateApiKey } from '../utils/env-validator'
import { rateLimitMiddleware } from './production-rate-limit'

// Admin session management
const adminSessions = new Map()
const ADMIN_SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
const MAX_FAILED_ATTEMPTS = 3
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

// Failed attempt tracking
const failedAttempts = new Map()

/**
 * Secure Admin Authentication Class
 */
class SecureAdminAuth {
  constructor() {
    this.initializeCleanup()
  }

  /**
   * Authenticate admin request with multiple security layers
   */
  async authenticateAdmin(req) {
    const clientIp = this.getClientIP(req)
    const userAgent = req.headers['user-agent'] || 'unknown'
    const timestamp = new Date().toISOString()

    try {
      // Layer 1: Rate limiting check
      const rateLimitResult = await this.checkRateLimit(clientIp, req)
      if (!rateLimitResult.allowed) {
        return {
          authenticated: false,
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        }
      }

      // Layer 2: Account lockout check
      const lockoutResult = this.checkAccountLockout(clientIp)
      if (lockoutResult.locked) {
        logger.warn('Admin authentication blocked - account locked', {
          metadata: {
            clientIp: this.maskIP(clientIp),
            userAgent,
            lockoutExpires: lockoutResult.expiresAt,
            failedAttempts: lockoutResult.attempts
          }
        })
        return {
          authenticated: false,
          error: 'Account temporarily locked',
          retryAfter: Math.ceil((lockoutResult.expiresAt - Date.now()) / 1000)
        }
      }

      // Layer 3: API Key validation
      const apiKey = this.extractApiKey(req)
      if (!apiKey) {
        this.recordFailedAttempt(clientIp, 'missing_api_key')
        return {
          authenticated: false,
          error: 'API key required'
        }
      }

      // Validate API key format and security
      const keyValidation = await this.validateAdminApiKey(apiKey)
      if (!keyValidation.valid) {
        this.recordFailedAttempt(clientIp, 'invalid_api_key')
        return {
          authenticated: false,
          error: keyValidation.error
        }
      }

      // Layer 4: Session validation (if session-based auth is used)
      const sessionValidation = await this.validateAdminSession(req)
      if (sessionValidation.required && !sessionValidation.valid) {
        this.recordFailedAttempt(clientIp, 'invalid_session')
        return {
          authenticated: false,
          error: sessionValidation.error
        }
      }

      // Layer 5: Additional security checks
      const securityCheck = await this.performSecurityChecks(req, clientIp)
      if (!securityCheck.passed) {
        this.recordFailedAttempt(clientIp, securityCheck.reason)
        return {
          authenticated: false,
          error: securityCheck.error
        }
      }

      // Clear failed attempts on successful authentication
      this.clearFailedAttempts(clientIp)

      // Create or update admin session
      const sessionInfo = await this.createAdminSession(apiKey, clientIp, userAgent)

      logger.info('Admin authentication successful', {
        metadata: {
          clientIp: this.maskIP(clientIp),
          userAgent,
          sessionId: sessionInfo.sessionId,
          timestamp,
          authMethod: 'api_key'
        }
      })

      return {
        authenticated: true,
        user: {
          type: 'admin',
          permissions: ['admin:read', 'admin:write', 'admin:delete'],
          sessionId: sessionInfo.sessionId,
          lastActivity: timestamp
        },
        sessionInfo
      }

    } catch (error) {
      logger.error('Admin authentication error', {
        metadata: {
          clientIp: this.maskIP(clientIp),
          error: error.message,
          timestamp
        }
      })

      this.recordFailedAttempt(clientIp, 'authentication_error')

      return {
        authenticated: false,
        error: 'Authentication failed'
      }
    }
  }

  /**
   * Extract API key from request headers, query params, or body
   */
  extractApiKey(req) {
    // Check headers first (most secure)
    let apiKey = req.headers['x-admin-key'] || 
                 req.headers['x-api-key'] ||
                 req.headers['authorization']?.replace('Bearer ', '')

    // Check query params (less secure, but sometimes necessary)
    if (!apiKey) {
      apiKey = req.query?.admin_key || req.query?.api_key
    }

    // Check body (least secure)
    if (!apiKey && req.body) {
      apiKey = req.body.admin_key || req.body.api_key
    }

    return apiKey
  }

  /**
   * Validate admin API key with enhanced security
   */
  async validateAdminApiKey(apiKey) {
    // Basic format validation
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'Invalid API key format' }
    }

    // Check minimum length
    if (apiKey.length < 20) {
      return { valid: false, error: 'API key too short' }
    }

    // Environment-based validation
    const envAdminKey = process.env.ADMIN_API_KEY
    if (!envAdminKey) {
      logger.error('Admin API key not configured in environment')
      return { valid: false, error: 'Admin authentication not configured' }
    }

    // Secure comparison to prevent timing attacks
    const providedBuffer = Buffer.from(apiKey, 'utf8')
    const expectedBuffer = Buffer.from(envAdminKey, 'utf8')

    if (providedBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: 'Invalid API key' }
    }

    const isValid = crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    if (!isValid) {
      return { valid: false, error: 'Invalid API key' }
    }

    // Additional security checks for production
    if (process.env.NODE_ENV === 'production') {
      // Check if key follows secure pattern
      if (apiKey.includes('dev') || apiKey.includes('test') || apiKey === 'admin123') {
        logger.error('Development API key detected in production')
        return { valid: false, error: 'Invalid API key for production environment' }
      }
    }

    return { valid: true }
  }

  /**
   * Validate admin session if session-based auth is enabled
   */
  async validateAdminSession(req) {
    const sessionToken = req.headers['x-session-token'] || 
                        req.cookies?.adminSession ||
                        req.query?.session_token

    // If no session token, check if session auth is required
    if (!sessionToken) {
      const requireSession = process.env.ADMIN_REQUIRE_SESSION === 'true'
      return {
        required: requireSession,
        valid: !requireSession,
        error: requireSession ? 'Session token required' : null
      }
    }

    // Validate session
    const session = adminSessions.get(sessionToken)
    if (!session) {
      return {
        required: true,
        valid: false,
        error: 'Invalid session token'
      }
    }

    // Check session expiry
    if (Date.now() > session.expiresAt) {
      adminSessions.delete(sessionToken)
      return {
        required: true,
        valid: false,
        error: 'Session expired'
      }
    }

    // Update last activity
    session.lastActivity = Date.now()
    session.expiresAt = Date.now() + ADMIN_SESSION_TIMEOUT

    return {
      required: true,
      valid: true,
      session
    }
  }

  /**
   * Perform additional security checks
   */
  async performSecurityChecks(req, clientIp) {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /bot/i, /crawler/i, /scanner/i, /hack/i, /exploit/i
    ]

    const userAgent = req.headers['user-agent'] || ''
    const suspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent))

    if (suspicious) {
      logger.warn('Suspicious user agent in admin authentication', {
        metadata: {
          clientIp: this.maskIP(clientIp),
          userAgent,
          endpoint: req.url
        }
      })
      return {
        passed: false,
        reason: 'suspicious_user_agent',
        error: 'Access denied'
      }
    }

    // Check request headers for suspicious content
    const referer = req.headers['referer'] || ''
    if (referer && !referer.includes(process.env.NEXT_PUBLIC_APP_URL || 'localhost')) {
      logger.warn('External referer in admin authentication', {
        metadata: {
          clientIp: this.maskIP(clientIp),
          referer,
          endpoint: req.url
        }
      })
      // Warning only, don't block
    }

    // Check for development environment restrictions
    if (process.env.NODE_ENV === 'production') {
      const isDevelopmentIP = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.startsWith('192.168.')
      if (isDevelopmentIP && !process.env.ALLOW_LOCAL_ADMIN) {
        return {
          passed: false,
          reason: 'local_ip_production',
          error: 'Local access not allowed in production'
        }
      }
    }

    return { passed: true }
  }

  /**
   * Create or update admin session
   */
  async createAdminSession(apiKey, clientIp, userAgent) {
    const sessionId = crypto.randomBytes(32).toString('hex')
    const now = Date.now()

    const sessionInfo = {
      sessionId,
      apiKey: this.maskApiKey(apiKey),
      clientIp: this.maskIP(clientIp),
      userAgent,
      createdAt: now,
      lastActivity: now,
      expiresAt: now + ADMIN_SESSION_TIMEOUT,
      requestCount: 1
    }

    adminSessions.set(sessionId, sessionInfo)

    return sessionInfo
  }

  /**
   * Check account lockout status
   */
  checkAccountLockout(clientIp) {
    const attempts = failedAttempts.get(clientIp)
    if (!attempts) {
      return { locked: false }
    }

    // Check if lockout period has expired
    if (Date.now() > attempts.lockoutExpires) {
      failedAttempts.delete(clientIp)
      return { locked: false }
    }

    if (attempts.count >= MAX_FAILED_ATTEMPTS) {
      return {
        locked: true,
        attempts: attempts.count,
        expiresAt: attempts.lockoutExpires
      }
    }

    return { locked: false }
  }

  /**
   * Record failed authentication attempt
   */
  recordFailedAttempt(clientIp, reason) {
    const now = Date.now()
    const attempts = failedAttempts.get(clientIp) || { count: 0, firstAttempt: now }

    attempts.count++
    attempts.lastAttempt = now
    attempts.reason = reason

    // Set lockout if max attempts reached
    if (attempts.count >= MAX_FAILED_ATTEMPTS) {
      attempts.lockoutExpires = now + LOCKOUT_DURATION
      logger.warn('Admin account locked due to failed attempts', {
        metadata: {
          clientIp: this.maskIP(clientIp),
          attempts: attempts.count,
          reason,
          lockoutDuration: LOCKOUT_DURATION / 1000 / 60 + ' minutes'
        }
      })
    }

    failedAttempts.set(clientIp, attempts)
  }

  /**
   * Clear failed attempts on successful authentication
   */
  clearFailedAttempts(clientIp) {
    failedAttempts.delete(clientIp)
  }

  /**
   * Rate limiting for admin endpoints
   */
  async checkRateLimit(clientIp, req) {
    // Use existing rate limiter with admin configuration
    return { allowed: true } // Placeholder - integrate with actual rate limiter
  }

  /**
   * Get client IP address
   */
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.headers['cf-connecting-ip'] ||
           req.socket?.remoteAddress ||
           'unknown'
  }

  /**
   * Mask IP address for logging
   */
  maskIP(ip) {
    if (!ip || ip === 'unknown') return 'unknown'
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***.***`
    }
    return ip.substring(0, 8) + '***'
  }

  /**
   * Mask API key for logging
   */
  maskApiKey(apiKey) {
    if (!apiKey) return 'none'
    if (apiKey.length > 12) {
      return apiKey.substring(0, 6) + '***' + apiKey.substring(apiKey.length - 3)
    }
    return '***'
  }

  /**
   * Clean up expired sessions and failed attempts
   */
  cleanup() {
    const now = Date.now()
    let cleanedSessions = 0
    let cleanedAttempts = 0

    // Clean expired sessions
    for (const [sessionId, session] of adminSessions.entries()) {
      if (now > session.expiresAt) {
        adminSessions.delete(sessionId)
        cleanedSessions++
      }
    }

    // Clean expired failed attempts
    for (const [ip, attempts] of failedAttempts.entries()) {
      if (attempts.lockoutExpires && now > attempts.lockoutExpires) {
        failedAttempts.delete(ip)
        cleanedAttempts++
      }
    }

    if (cleanedSessions > 0 || cleanedAttempts > 0) {
      logger.info('Admin auth cleanup completed', {
        metadata: {
          cleanedSessions,
          cleanedAttempts,
          activeSessions: adminSessions.size,
          activeAttempts: failedAttempts.size
        }
      })
    }
  }

  /**
   * Initialize cleanup timer
   */
  initializeCleanup() {
    setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000) // Clean every 5 minutes
  }

  /**
   * Get authentication statistics
   */
  getStats() {
    return {
      activeSessions: adminSessions.size,
      failedAttemptIPs: failedAttempts.size,
      lockedAccounts: Array.from(failedAttempts.values()).filter(a => a.count >= MAX_FAILED_ATTEMPTS).length,
      totalFailedAttempts: Array.from(failedAttempts.values()).reduce((sum, a) => sum + a.count, 0)
    }
  }
}

// Export singleton instance
export const secureAdminAuth = new SecureAdminAuth()

/**
 * Middleware function for protecting admin endpoints
 */
export function requireAdminAuth(options = {}) {
  return async (req, res, next) => {
    try {
      const authResult = await secureAdminAuth.authenticateAdmin(req)

      if (!authResult.authenticated) {
        const statusCode = authResult.retryAfter ? 429 : 401
        const response = {
          error: authResult.error,
          message: 'Admin authentication required'
        }

        if (authResult.retryAfter) {
          response.retryAfter = authResult.retryAfter
          res.setHeader('Retry-After', authResult.retryAfter)
        }

        return res.status(statusCode).json(response)
      }

      // Attach admin user info to request
      req.adminUser = authResult.user
      req.adminSession = authResult.sessionInfo

      // Call next middleware or handler
      if (typeof next === 'function') {
        next()
      }

    } catch (error) {
      logger.error('Admin authentication middleware error', {
        metadata: { error: error.message }
      })
      return res.status(500).json({
        error: 'Authentication error',
        message: 'Admin authentication failed'
      })
    }
  }
}

/**
 * Export the authentication function for direct use
 */
export async function authenticateAdmin(req) {
  return await secureAdminAuth.authenticateAdmin(req)
}