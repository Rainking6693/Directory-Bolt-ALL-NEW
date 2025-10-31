/**
 * API Key Management System
 * Handles secure API key validation, rotation, and access control
 */

import crypto from 'crypto'
import { logger } from '../utils/logger'
import { getSecureEnvVar } from '../utils/env-validator'

// API Key types and their configurations
const API_KEY_TYPES = {
  ADMIN: {
    prefix: 'dba_',
    minLength: 32,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    permissions: ['admin:read', 'admin:write', 'admin:delete', 'staff:read', 'staff:write']
  },
  STAFF: {
    prefix: 'dbs_',
    minLength: 32,
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
    permissions: ['staff:read', 'staff:write', 'customer:read']
  },
  CUSTOMER: {
    prefix: 'dbc_',
    minLength: 24,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    permissions: ['customer:read', 'customer:write']
  },
  AUTOBOLT: {
    prefix: 'dbb_',
    minLength: 40,
    maxAge: 180 * 24 * 60 * 60 * 1000, // 6 months
    permissions: ['autobolt:read', 'autobolt:write', 'queue:read', 'queue:write']
  },
  WEBHOOK: {
    prefix: 'dbw_',
    minLength: 32,
    maxAge: null, // Never expires unless manually rotated
    permissions: ['webhook:write']
  }
}

// Rate limiting configuration per API key type
const RATE_LIMITS = {
  ADMIN: { requests: 1000, window: 60 * 1000 }, // 1000/minute
  STAFF: { requests: 500, window: 60 * 1000 },  // 500/minute
  CUSTOMER: { requests: 100, window: 60 * 1000 }, // 100/minute
  AUTOBOLT: { requests: 200, window: 60 * 1000 }, // 200/minute
  WEBHOOK: { requests: 50, window: 60 * 1000 }    // 50/minute
}

// In-memory rate limiting store (in production, use Redis)
const rateLimitStore = new Map()

/**
 * API Key Manager Class
 */
export class ApiKeyManager {
  constructor() {
    this.keyStore = new Map() // In production, use database
    this.initializeFromEnvironment()
  }

  /**
   * Initialize API keys from environment variables
   */
  initializeFromEnvironment() {
    try {
      // Load existing API keys from environment
      const adminKey = process.env.ADMIN_API_KEY
      const staffKey = process.env.STAFF_API_KEY
      const customerKey = process.env.CUSTOMER_API_KEY
      const autoboltKey = process.env.AUTOBOLT_API_KEY

      if (adminKey) {
        this.keyStore.set(adminKey, {
          type: 'ADMIN',
          createdAt: new Date(),
          lastUsed: null,
          usageCount: 0,
          permissions: API_KEY_TYPES.ADMIN.permissions,
          active: true
        })
      }

      if (staffKey) {
        this.keyStore.set(staffKey, {
          type: 'STAFF',
          createdAt: new Date(),
          lastUsed: null,
          usageCount: 0,
          permissions: API_KEY_TYPES.STAFF.permissions,
          active: true
        })
      }

      if (customerKey) {
        this.keyStore.set(customerKey, {
          type: 'CUSTOMER',
          createdAt: new Date(),
          lastUsed: null,
          usageCount: 0,
          permissions: API_KEY_TYPES.CUSTOMER.permissions,
          active: true
        })
      }

      if (autoboltKey) {
        this.keyStore.set(autoboltKey, {
          type: 'AUTOBOLT',
          createdAt: new Date(),
          lastUsed: null,
          usageCount: 0,
          permissions: API_KEY_TYPES.AUTOBOLT.permissions,
          active: true
        })
      }

      logger.info('API Key Manager initialized', {
        metadata: { loadedKeys: this.keyStore.size }
      })

    } catch (error) {
      logger.error('Failed to initialize API Key Manager from environment', {
        metadata: { error: error.message }
      })
    }
  }

  /**
   * Generate a new API key
   */
  generateApiKey(type, metadata = {}) {
    if (!API_KEY_TYPES[type]) {
      throw new Error(`Invalid API key type: ${type}`)
    }

    const config = API_KEY_TYPES[type]
    const randomBytes = crypto.randomBytes(32)
    const timestamp = Date.now().toString(36)
    const random = randomBytes.toString('hex').substring(0, config.minLength - config.prefix.length - timestamp.length)
    
    const apiKey = `${config.prefix}${timestamp}_${random}`

    // Store key metadata
    this.keyStore.set(apiKey, {
      type,
      createdAt: new Date(),
      lastUsed: null,
      usageCount: 0,
      permissions: config.permissions,
      active: true,
      metadata: {
        ...metadata,
        generatedBy: 'system',
        environment: process.env.NODE_ENV || 'unknown'
      }
    })

    logger.info('New API key generated', {
      metadata: {
        type,
        keyPrefix: apiKey.substring(0, 12) + '***',
        permissions: config.permissions.length
      }
    })

    return apiKey
  }

  /**
   * Validate API key and check permissions
   */
  async validateApiKey(apiKey, requiredPermission = null, clientInfo = {}) {
    try {
      // Basic format validation
      if (!apiKey || typeof apiKey !== 'string') {
        return { valid: false, error: 'Invalid API key format' }
      }

      // Check if key exists in store
      const keyData = this.keyStore.get(apiKey)
      if (!keyData) {
        logger.warn('API key validation failed - key not found', {
          metadata: { 
            keyPrefix: apiKey.substring(0, 12) + '***',
            clientIp: clientInfo.ip,
            userAgent: clientInfo.userAgent
          }
        })
        return { valid: false, error: 'Invalid API key' }
      }

      // Check if key is active
      if (!keyData.active) {
        logger.warn('API key validation failed - key inactive', {
          metadata: { 
            keyPrefix: apiKey.substring(0, 12) + '***',
            type: keyData.type
          }
        })
        return { valid: false, error: 'API key inactive' }
      }

      // Check expiration
      const config = API_KEY_TYPES[keyData.type]
      if (config.maxAge) {
        const keyAge = Date.now() - keyData.createdAt.getTime()
        if (keyAge > config.maxAge) {
          logger.warn('API key validation failed - key expired', {
            metadata: { 
              keyPrefix: apiKey.substring(0, 12) + '***',
              type: keyData.type,
              age: Math.floor(keyAge / (24 * 60 * 60 * 1000)) + ' days'
            }
          })
          return { valid: false, error: 'API key expired' }
        }
      }

      // Check rate limiting
      const rateLimitResult = await this.checkRateLimit(apiKey, keyData.type, clientInfo)
      if (!rateLimitResult.allowed) {
        return { 
          valid: false, 
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        }
      }

      // Check permissions if required
      if (requiredPermission && !keyData.permissions.includes(requiredPermission)) {
        logger.warn('API key validation failed - insufficient permissions', {
          metadata: { 
            keyPrefix: apiKey.substring(0, 12) + '***',
            type: keyData.type,
            required: requiredPermission,
            available: keyData.permissions
          }
        })
        return { valid: false, error: 'Insufficient permissions' }
      }

      // Update usage statistics
      keyData.lastUsed = new Date()
      keyData.usageCount += 1

      logger.info('API key validation successful', {
        metadata: {
          keyPrefix: apiKey.substring(0, 12) + '***',
          type: keyData.type,
          permission: requiredPermission,
          usageCount: keyData.usageCount
        }
      })

      return {
        valid: true,
        type: keyData.type,
        permissions: keyData.permissions,
        metadata: keyData.metadata
      }

    } catch (error) {
      logger.error('API key validation error', {
        metadata: { error: error.message }
      })
      return { valid: false, error: 'Validation error' }
    }
  }

  /**
   * Check rate limiting for API key
   */
  async checkRateLimit(apiKey, keyType, clientInfo = {}) {
    const config = RATE_LIMITS[keyType]
    if (!config) {
      return { allowed: true }
    }

    const now = Date.now()
    const windowStart = now - config.window
    const keyIdentifier = `${apiKey}_${clientInfo.ip || 'unknown'}`

    // Get existing requests for this key in the current window
    let requests = rateLimitStore.get(keyIdentifier) || []
    
    // Remove requests outside the current window
    requests = requests.filter(timestamp => timestamp > windowStart)

    // Check if limit is exceeded
    if (requests.length >= config.requests) {
      const oldestRequest = Math.min(...requests)
      const retryAfter = Math.ceil((oldestRequest + config.window - now) / 1000)

      logger.warn('Rate limit exceeded', {
        metadata: {
          keyPrefix: apiKey.substring(0, 12) + '***',
          keyType,
          requestCount: requests.length,
          limit: config.requests,
          retryAfter
        }
      })

      return { 
        allowed: false, 
        retryAfter,
        remaining: 0,
        resetTime: oldestRequest + config.window
      }
    }

    // Add current request
    requests.push(now)
    rateLimitStore.set(keyIdentifier, requests)

    return { 
      allowed: true, 
      remaining: config.requests - requests.length,
      resetTime: now + config.window
    }
  }

  /**
   * Rotate API key (create new, mark old as inactive)
   */
  async rotateApiKey(oldApiKey, reason = 'manual rotation') {
    try {
      const keyData = this.keyStore.get(oldApiKey)
      if (!keyData) {
        throw new Error('API key not found')
      }

      // Generate new key of the same type
      const newApiKey = this.generateApiKey(keyData.type, {
        ...keyData.metadata,
        rotatedFrom: oldApiKey.substring(0, 12) + '***',
        rotationReason: reason,
        rotatedAt: new Date().toISOString()
      })

      // Mark old key as inactive (don't delete for audit trail)
      keyData.active = false
      keyData.deactivatedAt = new Date()
      keyData.deactivationReason = reason

      logger.info('API key rotated successfully', {
        metadata: {
          oldKeyPrefix: oldApiKey.substring(0, 12) + '***',
          newKeyPrefix: newApiKey.substring(0, 12) + '***',
          type: keyData.type,
          reason
        }
      })

      return {
        success: true,
        newApiKey,
        type: keyData.type,
        permissions: keyData.permissions
      }

    } catch (error) {
      logger.error('API key rotation failed', {
        metadata: { error: error.message }
      })
      return { success: false, error: error.message }
    }
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(apiKey, reason = 'manual revocation') {
    try {
      const keyData = this.keyStore.get(apiKey)
      if (!keyData) {
        return { success: false, error: 'API key not found' }
      }

      keyData.active = false
      keyData.revokedAt = new Date()
      keyData.revocationReason = reason

      logger.info('API key revoked', {
        metadata: {
          keyPrefix: apiKey.substring(0, 12) + '***',
          type: keyData.type,
          reason
        }
      })

      return { success: true }

    } catch (error) {
      logger.error('API key revocation failed', {
        metadata: { error: error.message }
      })
      return { success: false, error: error.message }
    }
  }

  /**
   * Get API key statistics
   */
  getKeyStatistics() {
    const stats = {
      total: this.keyStore.size,
      active: 0,
      inactive: 0,
      byType: {},
      totalUsage: 0
    }

    for (const [key, data] of this.keyStore.entries()) {
      if (data.active) {
        stats.active++
      } else {
        stats.inactive++
      }

      if (!stats.byType[data.type]) {
        stats.byType[data.type] = { count: 0, usage: 0 }
      }
      stats.byType[data.type].count++
      stats.byType[data.type].usage += data.usageCount

      stats.totalUsage += data.usageCount
    }

    return stats
  }

  /**
   * Clean up expired rate limit entries
   */
  cleanupRateLimitStore() {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, requests] of rateLimitStore.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > now - 3600000) // Keep 1 hour
      if (validRequests.length === 0) {
        rateLimitStore.delete(key)
        cleanedCount++
      } else if (validRequests.length < requests.length) {
        rateLimitStore.set(key, validRequests)
      }
    }

    if (cleanedCount > 0) {
      logger.info('Rate limit store cleaned', {
        metadata: { cleanedEntries: cleanedCount }
      })
    }
  }
}

// Export singleton instance
export const apiKeyManager = new ApiKeyManager()

/**
 * Middleware for API key validation
 */
export function requireApiKey(requiredPermission = null) {
  return async (req, res, next) => {
    try {
      const apiKey = req.headers['x-api-key'] || 
                    req.headers['authorization']?.replace('Bearer ', '') ||
                    req.query.api_key

      if (!apiKey) {
        return res.status(401).json({
          error: 'API key required',
          message: 'Provide API key in x-api-key header or authorization bearer token'
        })
      }

      const clientInfo = {
        ip: req.socket?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      }

      const validation = await apiKeyManager.validateApiKey(apiKey, requiredPermission, clientInfo)

      if (!validation.valid) {
        const statusCode = validation.error === 'Rate limit exceeded' ? 429 : 401
        const response = {
          error: validation.error,
          message: 'API key validation failed'
        }

        if (validation.retryAfter) {
          response.retryAfter = validation.retryAfter
          res.setHeader('Retry-After', validation.retryAfter)
        }

        return res.status(statusCode).json(response)
      }

      // Attach key info to request
      req.apiKey = {
        type: validation.type,
        permissions: validation.permissions,
        metadata: validation.metadata
      }

      next()

    } catch (error) {
      logger.error('API key middleware error', {
        metadata: { error: error.message }
      })
      return res.status(500).json({
        error: 'Authentication error',
        message: 'API key validation failed'
      })
    }
  }
}

/**
 * Periodic cleanup function
 */
setInterval(() => {
  apiKeyManager.cleanupRateLimitStore()
}, 5 * 60 * 1000) // Clean every 5 minutes