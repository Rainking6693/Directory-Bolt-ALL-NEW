// 🔒 JORDAN'S AUTHENTICATION MIDDLEWARE - Request security & validation
// Comprehensive middleware for JWT validation, RBAC, and session management

import type { NextApiRequest, NextApiResponse } from 'next'
import { jwtManager, extractTokenFromHeader, extractTokenFromCookie, type TokenPayload } from './jwt'
import { rbacManager, getUserRole, type Permission, type UserRole } from './rbac'
import { AuthenticationError, AuthorizationError, RateLimitError } from '../utils/errors'
import { validateRateLimit } from '../utils/validation'
import { logger } from '../utils/logger'
import type { User } from '../database/schema'

// Enhanced request interface with authentication context
export interface AuthenticatedRequest extends NextApiRequest {
  user?: User
  token?: TokenPayload
  role?: UserRole
  sessionId?: string
  rateLimitKey?: string
}

// Middleware configuration
export interface AuthMiddlewareConfig {
  requireAuth?: boolean
  requiredPermission?: Permission
  allowRefresh?: boolean
  rateLimitTier?: 'strict' | 'normal' | 'lenient'
  requireVerified?: boolean
  allowedRoles?: UserRole[]
}

// Rate limiting stores (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
const sessionStore = new Map<string, { userId: string; lastActivity: number; ipAddress: string }>()

// Session configuration
const SESSION_CONFIG = {
  TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  MAX_SESSIONS_PER_USER: 10
}

/**
 * Main authentication middleware
 */
export function authMiddleware(config: AuthMiddlewareConfig = {}) {
  return async (
    req: AuthenticatedRequest,
    res: NextApiResponse,
    next: () => void | Promise<void>
  ) => {
    const requestId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      // Extract client information
      const clientIp = getClientIp(req)
      const userAgent = req.headers['user-agent'] || 'unknown'
      
      // Rate limiting check
      if (config.rateLimitTier) {
        await checkRateLimit(req, clientIp, config.rateLimitTier)
      }
      
      // Token extraction and validation
      const token = extractAuthToken(req)
      
      if (!token) {
        if (config.requireAuth) {
          throw new AuthenticationError('Authentication token required', 'AUTH_REQUIRED')
        }
        return next()
      }

      // Validate JWT token
      let tokenPayload: TokenPayload
      try {
        tokenPayload = await jwtManager.validateAccessToken(token)
        req.token = tokenPayload
      } catch (error) {
        if (config.allowRefresh && error instanceof AuthenticationError && error.errorCode === 'TOKEN_EXPIRED') {
          // Attempt token refresh if refresh token is available
          const refreshToken = extractRefreshToken(req)
          if (refreshToken) {
            const result = await jwtManager.refreshAccessToken(refreshToken, clientIp, userAgent)
            
            // Set new tokens in response
            setAuthCookies(res, result.accessToken, result.newRefreshToken)
            
            // Update request context
            tokenPayload = await jwtManager.validateAccessToken(result.accessToken)
            req.token = tokenPayload
            req.user = result.user
          } else {
            throw error
          }
        } else {
          throw error
        }
      }

      // Get user information if not already set
      if (!req.user) {
        const user = await getUserById(tokenPayload.sub)
        if (!user) {
          throw new AuthenticationError('User not found', 'USER_NOT_FOUND')
        }
        req.user = user
      }

      // Verify user status
      if (config.requireVerified && !req.user.is_verified) {
        throw new AuthenticationError('Email verification required', 'EMAIL_NOT_VERIFIED')
      }

      // Set user role
      req.role = getUserRole(req.user)

      // Role-based access control
      if (config.allowedRoles && !config.allowedRoles.includes(req.role)) {
        throw new AuthorizationError(
          `Access denied for role: ${req.role}`,
          'ROLE_NOT_ALLOWED'
        )
      }

      // Permission-based access control
      if (config.requiredPermission) {
        const context = rbacManager.createContext(req.user, req.role, undefined, clientIp)
        rbacManager.enforcePermission(context, config.requiredPermission)
      }

      // Session management
      if (tokenPayload.sessionId) {
        await validateSession(tokenPayload.sessionId, req.user.id, clientIp)
        req.sessionId = tokenPayload.sessionId
      }

      // Log successful authentication
      logger.info('Request authenticated', {
        requestId,
        metadata: {
          userId: req.user.id,
          role: req.role,
          ip: clientIp,
          userAgent: req.headers['user-agent']
        }
      })

      // Continue to next middleware/handler
      await next()

    } catch (error) {
      logger.warn('Authentication failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          ip: getClientIp(req),
          userAgent: req.headers['user-agent'],
          hasToken: !!extractAuthToken(req)
        }
      })

      // Handle different error types
      if (error instanceof AuthenticationError) {
        return res.status(401).json({
          success: false,
          error: {
            message: error.message,
            code: error.errorCode,
            statusCode: 401
          },
          requestId
        })
      }

      if (error instanceof AuthorizationError) {
        return res.status(403).json({
          success: false,
          error: {
            message: error.message,
            code: error.errorCode,
            statusCode: 403
          },
          requestId
        })
      }

      if (error instanceof RateLimitError) {
        return res.status(429).json({
          success: false,
          error: {
            message: error.message,
            code: 'RATE_LIMIT_EXCEEDED',
            statusCode: 429,
            details: {
              retryAfter: error.retryAfter,
              remaining: error.remaining
            }
          },
          requestId
        })
      }

      // Unexpected errors
      return res.status(500).json({
        success: false,
        error: {
          message: 'Authentication error',
          code: 'AUTH_ERROR',
          statusCode: 500
        },
        requestId
      })
    }
  }
}

/**
 * CSRF Protection Middleware
 */
export function csrfProtection() {
  return async (
    req: AuthenticatedRequest,
    res: NextApiResponse,
    next: () => void | Promise<void>
  ) => {
    // Skip CSRF for GET requests
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next()
    }

    const csrfToken = req.headers['x-csrf-token'] || req.body.csrfToken
    const sessionToken = extractTokenFromCookie(req.headers.cookie)

    if (!csrfToken || !sessionToken) {
      throw new AuthenticationError('CSRF token required', 'CSRF_MISSING')
    }

    // Validate CSRF token (simplified - use proper CSRF library in production)
    if (!validateCSRFToken(csrfToken, sessionToken)) {
      throw new AuthenticationError('Invalid CSRF token', 'CSRF_INVALID')
    }

    await next()
  }
}

/**
 * API Key Authentication Middleware
 */
export function apiKeyAuth() {
  return async (
    req: AuthenticatedRequest,
    res: NextApiResponse,
    next: () => void | Promise<void>
  ) => {
    const apiKey = extractApiKey(req)
    
    if (!apiKey) {
      throw new AuthenticationError('API key required', 'API_KEY_REQUIRED')
    }

    // Validate API key
    const keyRecord = await validateApiKey(apiKey)
    if (!keyRecord) {
      throw new AuthenticationError('Invalid API key', 'API_KEY_INVALID')
    }

    if (!keyRecord.is_active) {
      throw new AuthenticationError('API key is inactive', 'API_KEY_INACTIVE')
    }

    if (keyRecord.expires_at && keyRecord.expires_at < new Date()) {
      throw new AuthenticationError('API key expired', 'API_KEY_EXPIRED')
    }

    // Rate limiting for API key
    const rateLimitKey = `apikey:${keyRecord.id}`
    const limit = keyRecord.rate_limit_per_hour || 100
    const result = validateRateLimit(rateLimitKey, limit, 60 * 60 * 1000, rateLimitStore)
    
    if (!result.allowed) {
      throw new RateLimitError(result.resetTime, result.remaining)
    }

    // Get user associated with API key
    const user = await getUserById(keyRecord.user_id)
    if (!user) {
      throw new AuthenticationError('API key user not found', 'USER_NOT_FOUND')
    }
    req.user = user

    req.role = getUserRole(req.user)
    req.rateLimitKey = rateLimitKey

    // Update API key usage
    await updateApiKeyUsage(keyRecord.id)

    await next()
  }
}

/**
 * Security Headers Middleware
 */
export function securityHeaders() {
  return async (
    req: AuthenticatedRequest,
    res: NextApiResponse,
    next: () => void | Promise<void>
  ) => {
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
    
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }

    await next()
  }
}

// Helper functions
function extractAuthToken(req: AuthenticatedRequest): string | null {
  // Try Authorization header first
  const headerToken = extractTokenFromHeader(req.headers.authorization)
  if (headerToken) return headerToken
  
  // Try cookies
  return extractTokenFromCookie(req.headers.cookie)
}

function extractRefreshToken(req: AuthenticatedRequest): string | null {
  if (!req.headers.cookie) return null
  
  const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = value
    return acc
  }, {} as Record<string, string>)
  
  return cookies.refresh_token || null
}

function extractApiKey(req: AuthenticatedRequest): string | null {
  const apiKey = req.headers['x-api-key'] || req.query.api_key
  return typeof apiKey === 'string' ? apiKey : null
}

function getClientIp(req: AuthenticatedRequest): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
         req.headers['x-real-ip'] as string ||
         req.socket.remoteAddress ||
         'unknown'
}

function setAuthCookies(
  res: NextApiResponse,
  accessToken: string,
  refreshToken?: string
): void {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/'
  }

  const accessCookie = `access_token=${accessToken}; ${Object.entries({
    ...cookieOptions,
    maxAge: 15 * 60 * 1000 // 15 minutes
  }).map(([k, v]) => `${k}=${v}`).join('; ')}`

  const cookies = [accessCookie]

  if (refreshToken) {
    const refreshCookie = `refresh_token=${refreshToken}; ${Object.entries({
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }).map(([k, v]) => `${k}=${v}`).join('; ')}`
    
    cookies.push(refreshCookie)
  }

  res.setHeader('Set-Cookie', cookies)
}

async function checkRateLimit(
  req: AuthenticatedRequest,
  clientIp: string,
  tier: 'strict' | 'normal' | 'lenient'
): Promise<void> {
  const limits = {
    strict: { requests: 10, windowMs: 60 * 1000 },
    normal: { requests: 60, windowMs: 60 * 1000 },
    lenient: { requests: 300, windowMs: 60 * 1000 }
  }

  const { requests, windowMs } = limits[tier]
  const rateLimitKey = `ip:${clientIp}`
  
  const result = validateRateLimit(rateLimitKey, requests, windowMs, rateLimitStore)
  if (!result.allowed) {
    throw new RateLimitError(result.resetTime, result.remaining)
  }
}

async function validateSession(
  sessionId: string,
  userId: string,
  clientIp: string
): Promise<void> {
  const session = sessionStore.get(sessionId)
  
  if (!session) {
    throw new AuthenticationError('Session not found', 'SESSION_NOT_FOUND')
  }
  
  if (session.userId !== userId) {
    throw new AuthenticationError('Session mismatch', 'SESSION_MISMATCH')
  }
  
  if (Date.now() - session.lastActivity > SESSION_CONFIG.TIMEOUT_MS) {
    sessionStore.delete(sessionId)
    throw new AuthenticationError('Session expired', 'SESSION_EXPIRED')
  }
  
  // Update session activity
  session.lastActivity = Date.now()
  session.ipAddress = clientIp
}

function validateCSRFToken(csrfToken: string, sessionToken: string): boolean {
  // Simplified CSRF validation - use proper library in production
  const expectedToken = Buffer.from(`${sessionToken}:csrf`).toString('base64')
  return csrfToken === expectedToken
}

// Database functions (mock implementations)
async function getUserById(userId: string): Promise<User | null> {
  // TODO: Implement actual database query
  if (userId === 'usr_test_123') {
    return {
      id: 'usr_test_123',
      email: 'test@directorybolt.com',
      password_hash: 'hashed_password',
      full_name: 'Test User',
      subscription_tier: 'professional',
      credits_remaining: 50,
      is_verified: true,
      failed_login_attempts: 0,
      created_at: new Date(),
      updated_at: new Date(),
      directories_used_this_period: 10,
      directory_limit: 100
    } as User
  }
  return null
}

async function validateApiKey(apiKey: string): Promise<any | null> {
  // TODO: Implement actual API key validation
  // This would hash the API key and look it up in the database
  return null
}

async function updateApiKeyUsage(keyId: string): Promise<void> {
  // TODO: Implement database update for API key usage tracking
  logger.info('API key usage updated', { metadata: { keyId } })
}

// Cleanup function for session store
setInterval(() => {
  const now = Date.now()
  for (const [sessionId, session] of sessionStore.entries()) {
    if (now - session.lastActivity > SESSION_CONFIG.TIMEOUT_MS) {
      sessionStore.delete(sessionId)
    }
  }
}, SESSION_CONFIG.CLEANUP_INTERVAL_MS)

// Export middleware combinations
export const requireAuth = authMiddleware({ requireAuth: true })
export const requireVerifiedAuth = authMiddleware({ requireAuth: true, requireVerified: true })
export const requireAdmin = authMiddleware({ requireAuth: true, allowedRoles: ['admin'] })
export const requireCustomerOrVA = authMiddleware({ requireAuth: true, allowedRoles: ['customer', 'va'] })

// Export with security headers
export const withSecurity = (config: AuthMiddlewareConfig = {}) => [
  securityHeaders(),
  authMiddleware(config)
]