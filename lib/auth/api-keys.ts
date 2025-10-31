// 🔒 JORDAN'S API KEY MANAGEMENT - Secure API key generation for AutoBolt extension
// Comprehensive API key system with rate limiting, permissions, and rotation

import { randomBytes, createHash, createHmac } from 'crypto'
import type { User, ApiKey, ApiPermission } from '../database/schema'
import { getUserRole, rbacManager, getTierRateLimit, type UserRole } from './rbac'
import { AuthenticationError, ValidationError, AuthorizationError } from '../utils/errors'
import { logger } from '../utils/logger'
import { apiKeyDatabase, type ApiKeyRecord } from '../database/api-key-schema'

// API Key configuration
const API_KEY_CONFIG = {
  KEY_LENGTH: 32, // 32 bytes = 64 hex characters
  PREFIX: 'db_', // DirectoryBolt prefix
  DEFAULT_RATE_LIMIT: 100, // requests per hour
  MAX_KEYS_PER_USER: 10,
  DEFAULT_EXPIRY_DAYS: 365, // 1 year
  HASH_ALGORITHM: 'sha256',
  ROTATION_WARNING_DAYS: 30 // Warn 30 days before expiry
} as const

// Rate limiting store (use Redis in production)
const apiKeyRateLimit = new Map<string, {
  count: number
  resetTime: number
  violations: number
}>()

export interface ApiKeyCreationRequest {
  name: string
  description?: string
  permissions: ApiPermission[]
  rateLimit?: number
  expiresInDays?: number
  ipWhitelist?: string[]
  referrerWhitelist?: string[]
}

export interface ApiKeyResponse {
  id: string
  name: string
  key: string // Only returned on creation
  keyPrefix: string
  description?: string
  permissions: ApiPermission[]
  rateLimit: number
  expiresAt?: Date
  createdAt: Date
  lastUsedAt?: Date
  isActive: boolean
  usage: {
    requestsToday: number
    requestsThisMonth: number
    totalRequests: number
  }
  security: {
    ipWhitelist?: string[]
    referrerWhitelist?: string[]
    createdFromIp: string
  }
}

export interface ApiKeyUsage {
  keyId: string
  timestamp: Date
  endpoint: string
  method: string
  ipAddress: string
  userAgent?: string
  responseStatus: number
  processingTimeMs: number
}

/**
 * API Key Manager Class
 */
export class ApiKeyManager {
  private static instance: ApiKeyManager

  public static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager()
    }
    return ApiKeyManager.instance
  }

  /**
   * Generate new API key for user
   */
  public async createApiKey(
    user: User,
    request: ApiKeyCreationRequest,
    createdFromIp: string
  ): Promise<{ apiKey: ApiKeyResponse; plainKey: string }> {
    // Validate user permissions
    const role = getUserRole(user)
    const context = rbacManager.createContext(user, role, undefined, createdFromIp)
    rbacManager.enforcePermission(context, 'apikeys:create')

    // Check tier limits
    const canCreate = rbacManager.canPerformAction(context, 'create_apikey')
    if (!canCreate.allowed) {
      throw new AuthorizationError(
        canCreate.reason || `API key limit reached: ${canCreate.limit}`,
        'API_KEY_LIMIT_EXCEEDED'
      )
    }

    // Validate current API key count
    const currentKeyCount = await this.getUserApiKeyCount(user.id)
    const tierLimits = rbacManager.getTierLimits(user.subscription_tier)
    
    if (currentKeyCount >= tierLimits.maxApiKeys) {
      throw new AuthorizationError(
        `Maximum API keys reached for ${user.subscription_tier} tier: ${tierLimits.maxApiKeys}`,
        'API_KEY_LIMIT_EXCEEDED'
      )
    }

    // Validate input
    await this.validateApiKeyRequest(request, user, role)

    // Generate secure API key
    const plainKey = this.generateApiKey()
    const keyHash = this.hashApiKey(plainKey)
    const keyPrefix = plainKey.substring(0, 12) + '...'

    const apiKeyRecord: ApiKey = {
      id: `ak_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: user.id,
      key_hash: keyHash,
      name: request.name.trim(),
      permissions: request.permissions,
      is_active: true,
      rate_limit_per_hour: request.rateLimit || this.getDefaultRateLimit(user.subscription_tier),
      requests_made_today: 0,
      created_from_ip: createdFromIp,
      created_at: new Date(),
      expires_at: request.expiresInDays ? 
        new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000) : 
        new Date(Date.now() + API_KEY_CONFIG.DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    }

    // Store API key
    await this.storeApiKey(apiKeyRecord, request)

    // Log API key creation
    logger.info('API key created', {
      metadata: {
        userId: user.id,
        keyId: apiKeyRecord.id,
        keyName: request.name,
        permissions: request.permissions,
        createdFromIp
      }
    })

    const response: ApiKeyResponse = {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      key: plainKey, // Only returned on creation
      keyPrefix,
      description: request.description,
      permissions: apiKeyRecord.permissions,
      rateLimit: apiKeyRecord.rate_limit_per_hour,
      expiresAt: apiKeyRecord.expires_at,
      createdAt: apiKeyRecord.created_at,
      lastUsedAt: apiKeyRecord.last_used_at,
      isActive: apiKeyRecord.is_active,
      usage: {
        requestsToday: 0,
        requestsThisMonth: 0,
        totalRequests: 0
      },
      security: {
        ipWhitelist: request.ipWhitelist,
        referrerWhitelist: request.referrerWhitelist,
        createdFromIp
      }
    }

    return { apiKey: response, plainKey }
  }

  /**
   * Validate API key and return key information
   */
  public async validateApiKey(key: string, ipAddress?: string, referrer?: string): Promise<{
    isValid: boolean
    apiKey?: ApiKey
    user?: User
    rateLimitStatus?: {
      allowed: boolean
      remaining: number
      resetTime: number
    }
  }> {
    if (!key || !key.startsWith(API_KEY_CONFIG.PREFIX)) {
      return { isValid: false }
    }

    const keyHash = this.hashApiKey(key)
    const apiKeyRecord = await this.getApiKeyByHash(keyHash)

    if (!apiKeyRecord || !apiKeyRecord.is_active) {
      return { isValid: false }
    }

    // Check expiry
    if (apiKeyRecord.expires_at && apiKeyRecord.expires_at < new Date()) {
      return { isValid: false }
    }

    // Get user
    const user = await this.getUserById(apiKeyRecord.user_id)
    if (!user || !user.is_verified) {
      return { isValid: false }
    }

    // Check IP whitelist
    if (ipAddress) {
      const ipWhitelist = await this.getApiKeyIpWhitelist(apiKeyRecord.id)
      if (ipWhitelist && ipWhitelist.length > 0) {
        if (!this.isIpWhitelisted(ipAddress, ipWhitelist)) {
          await this.logSecurityViolation(apiKeyRecord.id, 'ip_not_whitelisted', ipAddress)
          return { isValid: false }
        }
      }
    }

    // Check referrer whitelist
    if (referrer) {
      const referrerWhitelist = await this.getApiKeyReferrerWhitelist(apiKeyRecord.id)
      if (referrerWhitelist && referrerWhitelist.length > 0) {
        if (!this.isReferrerWhitelisted(referrer, referrerWhitelist)) {
          await this.logSecurityViolation(apiKeyRecord.id, 'referrer_not_whitelisted', ipAddress, { referrer })
          return { isValid: false }
        }
      }
    }

    // Rate limiting check
    const rateLimitStatus = this.checkRateLimit(apiKeyRecord.id, apiKeyRecord.rate_limit_per_hour)

    if (!rateLimitStatus.allowed) {
      await this.logSecurityViolation(apiKeyRecord.id, 'rate_limit_exceeded', ipAddress)
      return {
        isValid: false,
        rateLimitStatus
      }
    }

    // Update last used timestamp
    await this.updateLastUsed(apiKeyRecord.id)

    return {
      isValid: true,
      apiKey: apiKeyRecord,
      user,
      rateLimitStatus
    }
  }

  /**
   * Get user's API keys
   */
  public async getUserApiKeys(userId: string): Promise<ApiKeyResponse[]> {
    const apiKeys = await this.getApiKeysByUserId(userId)
    
    return Promise.all(apiKeys.map(async (key) => {
      const usage = await this.getApiKeyUsage(key.id)
      
      return {
        id: key.id,
        name: key.name,
        key: '', // Never return actual key
        keyPrefix: key.key_hash.substring(0, 8) + '...',
        permissions: key.permissions,
        rateLimit: key.rate_limit_per_hour,
        expiresAt: key.expires_at,
        createdAt: key.created_at,
        lastUsedAt: key.last_used_at,
        isActive: key.is_active,
        usage,
        security: {
          createdFromIp: key.created_from_ip
        }
      } as ApiKeyResponse
    }))
  }

  /**
   * Rotate API key (generate new key, invalidate old)
   */
  public async rotateApiKey(
    userId: string,
    keyId: string,
    userRole: UserRole
  ): Promise<{ newKey: string; keyId: string }> {
    const context = rbacManager.createContext(
      { id: userId } as User, 
      userRole
    )
    rbacManager.enforcePermission(context, 'apikeys:create')

    const apiKey = await this.getApiKeyById(keyId)
    if (!apiKey || apiKey.user_id !== userId) {
      throw new AuthenticationError('API key not found', 'API_KEY_NOT_FOUND')
    }

    // Generate new key
    const newPlainKey = this.generateApiKey()
    const newKeyHash = this.hashApiKey(newPlainKey)

    // Update key in database
    await this.updateApiKeyHash(keyId, newKeyHash)

    // Log rotation
    logger.info('API key rotated', {
      metadata: {
        userId,
        keyId,
        keyName: apiKey.name
      }
    })

    return { newKey: newPlainKey, keyId }
  }

  /**
   * Revoke API key
   */
  public async revokeApiKey(userId: string, keyId: string, userRole: UserRole): Promise<void> {
    const context = rbacManager.createContext(
      { id: userId } as User, 
      userRole
    )
    rbacManager.enforcePermission(context, 'apikeys:delete')

    const apiKey = await this.getApiKeyById(keyId)
    if (!apiKey || apiKey.user_id !== userId) {
      throw new AuthenticationError('API key not found', 'API_KEY_NOT_FOUND')
    }

    await this.deactivateApiKey(keyId)

    logger.info('API key revoked', {
      metadata: {
        userId,
        keyId,
        keyName: apiKey.name
      }
    })
  }

  /**
   * Track API key usage
   */
  public async trackUsage(
    keyId: string,
    endpoint: string,
    method: string,
    ipAddress: string,
    responseStatus: number,
    processingTimeMs: number,
    userAgent?: string
  ): Promise<void> {
    const usage: ApiKeyUsage = {
      keyId,
      timestamp: new Date(),
      endpoint,
      method,
      ipAddress,
      userAgent,
      responseStatus,
      processingTimeMs
    }

    await this.storeUsage(usage)
    await this.updateUsageCounters(keyId)
  }

  /**
   * Get API key analytics
   */
  public async getKeyAnalytics(keyId: string, userId: string): Promise<{
    requests: {
      today: number
      thisWeek: number
      thisMonth: number
      total: number
    }
    endpoints: Array<{
      path: string
      count: number
      avgResponseTime: number
    }>
    errors: {
      total: number
      rate: number
      commonErrors: Array<{ status: number; count: number }>
    }
    performance: {
      avgResponseTime: number
      p95ResponseTime: number
      slowestEndpoint: string
    }
  }> {
    // Verify ownership
    const apiKey = await this.getApiKeyById(keyId)
    if (!apiKey || apiKey.user_id !== userId) {
      throw new AuthenticationError('API key not found', 'API_KEY_NOT_FOUND')
    }

    return await this.calculateAnalytics(keyId)
  }

  // Private helper methods
  private generateApiKey(): string {
    const randomPart = randomBytes(API_KEY_CONFIG.KEY_LENGTH).toString('hex')
    return `${API_KEY_CONFIG.PREFIX}${randomPart}`
  }

  private hashApiKey(key: string): string {
    return createHash(API_KEY_CONFIG.HASH_ALGORITHM).update(key).digest('hex')
  }

  private getDefaultRateLimit(tier: string): number {
    const tierLimits = getTierRateLimit(tier)
    return tierLimits.requestsPerHour
  }

  private checkRateLimit(keyId: string, limit: number): {
    allowed: boolean
    remaining: number
    resetTime: number
  } {
    const now = Date.now()
    const windowMs = 60 * 60 * 1000 // 1 hour
    const key = `apikey:${keyId}`
    
    const existing = apiKeyRateLimit.get(key)
    
    if (!existing || now > existing.resetTime) {
      // First request or window expired
      const resetTime = now + windowMs
      apiKeyRateLimit.set(key, { count: 1, resetTime, violations: 0 })
      return { allowed: true, remaining: limit - 1, resetTime }
    }
    
    if (existing.count >= limit) {
      existing.violations++
      return { allowed: false, remaining: 0, resetTime: existing.resetTime }
    }
    
    existing.count++
    return { 
      allowed: true, 
      remaining: limit - existing.count, 
      resetTime: existing.resetTime 
    }
  }

  private isIpWhitelisted(ipAddress: string, whitelist: string[]): boolean {
    return whitelist.some(whitelistedIp => {
      // Support CIDR notation and exact matches
      if (whitelistedIp.includes('/')) {
        // CIDR check (simplified)
        return this.isIpInCidr(ipAddress, whitelistedIp)
      }
      return ipAddress === whitelistedIp
    })
  }

  private isReferrerWhitelisted(referrer: string, whitelist: string[]): boolean {
    try {
      const referrerUrl = new URL(referrer)
      return whitelist.some(whitelistedReferrer => {
        return referrerUrl.hostname === whitelistedReferrer ||
               referrerUrl.hostname.endsWith(`.${whitelistedReferrer}`)
      })
    } catch {
      return false
    }
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    // Simplified CIDR check - use proper library in production
    const [network, prefixLength] = cidr.split('/')
    if (!prefixLength) return ip === network
    
    // This is a very basic implementation
    // In production, use a proper IP/CIDR library
    return ip.startsWith(network.split('.').slice(0, Math.floor(parseInt(prefixLength) / 8)).join('.'))
  }

  private async validateApiKeyRequest(
    request: ApiKeyCreationRequest,
    user: User,
    role: UserRole
  ): Promise<void> {
    // Name validation
    if (!request.name || request.name.trim().length < 1) {
      throw new ValidationError('API key name is required', 'name', 'REQUIRED')
    }
    
    if (request.name.trim().length > 100) {
      throw new ValidationError('API key name too long', 'name', 'TOO_LONG')
    }

    // Check for duplicate names
    const existingKeys = await this.getApiKeysByUserId(user.id)
    if (existingKeys.some(key => key.name === request.name.trim())) {
      throw new ValidationError('API key name already exists', 'name', 'DUPLICATE_NAME')
    }

    // Permissions validation
    if (!request.permissions || request.permissions.length === 0) {
      throw new ValidationError('At least one permission is required', 'permissions', 'REQUIRED')
    }

    const rolePermissions = rbacManager.getRolePermissions(role)
    const invalidPermissions = request.permissions.filter(perm => 
      !this.isValidApiPermission(perm, rolePermissions)
    )

    if (invalidPermissions.length > 0) {
      throw new ValidationError(
        `Invalid permissions: ${invalidPermissions.join(', ')}`,
        'permissions',
        'INVALID_PERMISSIONS'
      )
    }

    // Rate limit validation
    if (request.rateLimit) {
      const tierLimits = rbacManager.getTierLimits(user.subscription_tier)
      const maxRateLimit = tierLimits.maxApiKeys * 100 // Adjust based on tier
      
      if (request.rateLimit > maxRateLimit) {
        throw new ValidationError(
          `Rate limit too high for ${user.subscription_tier} tier`,
          'rateLimit',
          'RATE_LIMIT_TOO_HIGH'
        )
      }
    }
  }

  private isValidApiPermission(permission: ApiPermission, rolePermissions: any[]): boolean {
    // Map API permissions to RBAC permissions
    const permissionMap: Record<ApiPermission, string[]> = {
      'read_directories': ['directories:read'],
      'create_submissions': ['submissions:create'],
      'read_submissions': ['submissions:read'],
      'read_profile': ['profile:read'],
      'admin_access': ['system:admin']
    }

    const requiredPerms = permissionMap[permission] || []
    return requiredPerms.every(perm => rolePermissions.includes(perm))
  }

  // Database operations - Complete implementation with encryption and security
  private async storeApiKey(apiKey: ApiKey, request: ApiKeyCreationRequest): Promise<void> {
    const apiKeyRecord: ApiKeyRecord = {
      ...apiKey,
      description: request.description
    }

    await apiKeyDatabase.createApiKey(
      apiKeyRecord,
      request.ipWhitelist,
      request.referrerWhitelist
    )

    logger.info('API key stored in database', {
      metadata: { keyId: apiKey.id, userId: apiKey.user_id }
    })
  }

  private async getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
    const record = await apiKeyDatabase.getApiKeyByHash(keyHash)
    return record
  }

  private async getApiKeyById(keyId: string): Promise<ApiKey | null> {
    const record = await apiKeyDatabase.getApiKeyById(keyId)
    return record
  }

  private async getApiKeysByUserId(userId: string): Promise<ApiKey[]> {
    const records = await apiKeyDatabase.getApiKeysByUserId(userId)
    return records
  }

  private async getUserById(userId: string): Promise<User | null> {
    return await apiKeyDatabase.getUserById(userId)
  }

  private async getUserApiKeyCount(userId: string): Promise<number> {
    const keys = await this.getApiKeysByUserId(userId)
    return keys.filter(key => key.is_active).length
  }

  private async getApiKeyIpWhitelist(keyId: string): Promise<string[] | null> {
    const whitelist = await apiKeyDatabase.getApiKeyIpWhitelist(keyId)
    return whitelist.length > 0 ? whitelist : null
  }

  private async getApiKeyReferrerWhitelist(keyId: string): Promise<string[] | null> {
    const whitelist = await apiKeyDatabase.getApiKeyReferrerWhitelist(keyId)
    return whitelist.length > 0 ? whitelist : null
  }

  private async updateLastUsed(keyId: string): Promise<void> {
    await apiKeyDatabase.updateLastUsed(keyId)
    logger.info('API key last used updated', { metadata: { keyId } })
  }

  private async updateApiKeyHash(keyId: string, newKeyHash: string): Promise<void> {
    await apiKeyDatabase.updateApiKeyHash(keyId, newKeyHash)
    logger.info('API key hash updated', { metadata: { keyId } })
  }

  private async deactivateApiKey(keyId: string): Promise<void> {
    await apiKeyDatabase.deactivateApiKey(keyId)
    logger.info('API key deactivated', { metadata: { keyId } })
  }

  private async storeUsage(usage: ApiKeyUsage): Promise<void> {
    await apiKeyDatabase.storeUsage({
      keyId: usage.keyId,
      timestamp: usage.timestamp,
      endpoint: usage.endpoint,
      method: usage.method,
      ipAddress: usage.ipAddress,
      userAgent: usage.userAgent,
      responseStatus: usage.responseStatus,
      processingTimeMs: usage.processingTimeMs
    })

    logger.info('API key usage tracked', {
      metadata: { 
        keyId: usage.keyId, 
        endpoint: usage.endpoint,
        status: usage.responseStatus 
      }
    })
  }

  private async updateUsageCounters(keyId: string): Promise<void> {
    await apiKeyDatabase.updateUsageCounters(keyId)
    logger.info('Usage counters updated', { metadata: { keyId } })
  }

  private async getApiKeyUsage(keyId: string): Promise<{
    requestsToday: number
    requestsThisMonth: number
    totalRequests: number
  }> {
    return await apiKeyDatabase.getApiKeyUsage(keyId)
  }

  private async calculateAnalytics(keyId: string): Promise<any> {
    const usage = await this.getApiKeyUsage(keyId)
    
    // Basic analytics implementation - can be enhanced with more complex queries
    return {
      requests: {
        today: usage.requestsToday,
        thisWeek: usage.requestsToday * 7, // Approximation
        thisMonth: usage.requestsThisMonth,
        total: usage.totalRequests
      },
      endpoints: [], // TODO: Implement endpoint-specific analytics
      errors: {
        total: 0, // TODO: Query error rates from usage table
        rate: 0,
        commonErrors: []
      },
      performance: {
        avgResponseTime: 0, // TODO: Calculate from usage table
        p95ResponseTime: 0,
        slowestEndpoint: ''
      }
    }
  }

  private async logSecurityViolation(
    keyId: string,
    violationType: string,
    ipAddress?: string,
    metadata?: any
  ): Promise<void> {
    // Map violation type to database enum
    const dbViolationType = violationType as 'rate_limit' | 'ip_restriction' | 'referrer_restriction' | 'expired_key' | 'invalid_key'
    
    await apiKeyDatabase.logSecurityEvent(
      keyId,
      'violation',
      dbViolationType,
      ipAddress,
      metadata
    )

    logger.warn('API key security violation', {
      metadata: {
        keyId,
        violationType,
        ipAddress,
        ...metadata
      }
    })
  }
}

// Export singleton instance
export const apiKeyManager = ApiKeyManager.getInstance()

// Utility functions for API key validation
export function extractApiKeyFromRequest(headers: Record<string, string | string[] | undefined>): string | null {
  // Check X-API-Key header
  const apiKey = headers['x-api-key'] || headers['X-API-Key']
  if (typeof apiKey === 'string') {
    return apiKey
  }

  // Check Authorization header with API key scheme
  const auth = headers.authorization || headers.Authorization
  if (typeof auth === 'string' && auth.startsWith('ApiKey ')) {
    return auth.substring(7)
  }

  return null
}

export function generateApiKeyPrefix(): string {
  return API_KEY_CONFIG.PREFIX
}

export function isValidApiKeyFormat(key: string): boolean {
  if (!key) return false
  if (!key.startsWith(API_KEY_CONFIG.PREFIX)) return false
  
  const keyPart = key.substring(API_KEY_CONFIG.PREFIX.length)
  return keyPart.length === API_KEY_CONFIG.KEY_LENGTH * 2 && /^[a-f0-9]+$/.test(keyPart)
}