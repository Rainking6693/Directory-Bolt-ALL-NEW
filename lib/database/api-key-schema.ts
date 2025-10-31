// 🔒 JORDAN'S API KEY DATABASE SCHEMA - Secure API key storage with encryption
// Complete database implementation for API key management with audit trails

import '../utils/node-polyfills'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { logger } from '../utils/logger'
import type { User, ApiKey, ApiPermission, AuditLog } from './schema'

// Encryption configuration
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
  saltLength: 32
} as const

// Extended API key interface for database operations
export interface ApiKeyRecord extends Omit<ApiKey, 'key_hash'> {
  key_hash: string
  encrypted_key?: string // For development/testing only - never store production keys
  encryption_iv?: string
  encryption_salt?: string
  ip_whitelist?: string[]
  referrer_whitelist?: string[]
  description?: string
}

export interface ApiKeyUsageRecord {
  id: string
  api_key_id: string
  timestamp: Date
  endpoint: string
  method: string
  ip_address: string
  user_agent?: string
  response_status: number
  processing_time_ms: number
  rate_limit_hit: boolean
  created_at: Date
}

export interface ApiKeySecurityLog {
  id: string
  api_key_id: string
  event_type: 'violation' | 'rotation' | 'creation' | 'revocation' | 'usage'
  violation_type?: 'rate_limit' | 'ip_restriction' | 'referrer_restriction' | 'expired_key' | 'invalid_key'
  ip_address?: string
  user_agent?: string
  metadata?: Record<string, any>
  created_at: Date
}

/**
 * API Key Database Manager - Handles all database operations for API keys
 */
export class ApiKeyDatabase {
  private supabase: SupabaseClient | null = null
  private encryptionKey: Buffer | null = null
  private isSupabaseEnabled: boolean
  private static instance: ApiKeyDatabase

  constructor() {
    this.isSupabaseEnabled = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    if (this.isSupabaseEnabled) {
      this.supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: { persistSession: false },
          db: { schema: 'public' }
        }
      )
    }

    // Initialize encryption key from environment variable
    this.initializeEncryption()
  }

  public static getInstance(): ApiKeyDatabase {
    if (!ApiKeyDatabase.instance) {
      ApiKeyDatabase.instance = new ApiKeyDatabase()
    }
    return ApiKeyDatabase.instance
  }

  private initializeEncryption(): void {
    const encryptionKey = process.env.API_KEY_ENCRYPTION_KEY
    if (encryptionKey) {
      // Derive a 256-bit key from the environment variable
      this.encryptionKey = createHash('sha256').update(encryptionKey).digest()
    } else {
      logger.warn('API_KEY_ENCRYPTION_KEY not set - API key encryption disabled')
    }
  }

  /**
   * Encrypt sensitive data for storage
   */
  private encrypt(text: string): { encrypted: string; iv: string; salt: string } | null {
    if (!this.encryptionKey) return null

    try {
      const iv = randomBytes(ENCRYPTION_CONFIG.ivLength)
      const salt = randomBytes(ENCRYPTION_CONFIG.saltLength)
      const cipher = createCipheriv(ENCRYPTION_CONFIG.algorithm, this.encryptionKey, iv)
      
      let encrypted = cipher.update(text, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      const authTag = cipher.getAuthTag()
      
      return {
        encrypted: encrypted + authTag.toString('hex'),
        iv: iv.toString('hex'),
        salt: salt.toString('hex')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Encryption failed', { error: message })
      return null
    }
  }

  /**
   * Decrypt sensitive data from storage
   */
  private decrypt(encryptedData: string, iv: string, salt: string): string | null {
    if (!this.encryptionKey) return null

    try {
      const authTagLength = ENCRYPTION_CONFIG.tagLength * 2 // hex encoding
      const encrypted = encryptedData.slice(0, -authTagLength)
      const authTag = Buffer.from(encryptedData.slice(-authTagLength), 'hex')
      
      const decipher = createDecipheriv(ENCRYPTION_CONFIG.algorithm, this.encryptionKey, Buffer.from(iv, 'hex'))
      decipher.setAuthTag(authTag)
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Decryption failed', { error: message })
      return null
    }
  }

  /**
   * Create API key record in database
   */
  async createApiKey(apiKey: ApiKeyRecord, ipWhitelist?: string[], referrerWhitelist?: string[]): Promise<void> {
    if (!this.supabase) {
      throw new Error('Database connection not available')
    }

    try {
      // Insert main API key record
      const { error: keyError } = await this.supabase
        .from('api_keys')
        .insert({
          id: apiKey.id,
          user_id: apiKey.user_id,
          key_hash: apiKey.key_hash,
          name: apiKey.name,
          description: apiKey.description,
          permissions: apiKey.permissions,
          is_active: apiKey.is_active,
          rate_limit_per_hour: apiKey.rate_limit_per_hour,
          requests_made_today: apiKey.requests_made_today || 0,
          last_used_at: apiKey.last_used_at,
          created_from_ip: apiKey.created_from_ip,
          created_at: apiKey.created_at,
          expires_at: apiKey.expires_at
        })

      if (keyError) {
        throw new Error(`Failed to create API key: ${keyError.message}`)
      }

      // Insert IP whitelist if provided
      if (ipWhitelist && ipWhitelist.length > 0) {
        const { error: ipError } = await this.supabase
          .from('api_key_ip_whitelist')
          .insert(
            ipWhitelist.map(ip => ({
              id: `ip_${apiKey.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              api_key_id: apiKey.id,
              ip_address: ip,
              created_at: new Date()
            }))
          )

        if (ipError) {
          logger.warn('Failed to insert IP whitelist', { metadata: { error: ipError.message, keyId: apiKey.id } })
        }
      }

      // Insert referrer whitelist if provided
      if (referrerWhitelist && referrerWhitelist.length > 0) {
        const { error: referrerError } = await this.supabase
          .from('api_key_referrer_whitelist')
          .insert(
            referrerWhitelist.map(referrer => ({
              id: `ref_${apiKey.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              api_key_id: apiKey.id,
              referrer_domain: referrer,
              created_at: new Date()
            }))
          )

        if (referrerError) {
          logger.warn('Failed to insert referrer whitelist', { metadata: { error: referrerError.message, keyId: apiKey.id } })
        }
      }

      // Log creation in security log
      await this.logSecurityEvent(apiKey.id, 'creation', undefined, apiKey.created_from_ip, {
        keyName: apiKey.name,
        permissions: apiKey.permissions
      })

      logger.info('API key created in database', { metadata: { keyId: apiKey.id, userId: apiKey.user_id } })

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to create API key in database', { 
        metadata: {
          error: message, 
          keyId: apiKey.id 
        }
      })
      throw error
    }
  }

  /**
   * Get API key by hash
   */
  async getApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    if (!this.supabase) {
      return null
    }

    try {
      const { data, error } = await this.supabase
        .from('api_keys')
        .select('*')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        return null
      }

      return this.mapDatabaseRecordToApiKey(data)

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to get API key by hash', { error: message })
      return null
    }
  }

  /**
   * Get API key by ID
   */
  async getApiKeyById(keyId: string): Promise<ApiKeyRecord | null> {
    if (!this.supabase) {
      return null
    }

    try {
      const { data, error } = await this.supabase
        .from('api_keys')
        .select('*')
        .eq('id', keyId)
        .single()

      if (error || !data) {
        return null
      }

      return this.mapDatabaseRecordToApiKey(data)

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to get API key by ID', { metadata: { error: message, keyId } })
      return null
    }
  }

  /**
   * Get all API keys for a user
   */
  async getApiKeysByUserId(userId: string): Promise<ApiKeyRecord[]> {
    if (!this.supabase) {
      return []
    }

    try {
      const { data, error } = await this.supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Failed to get user API keys', { error: message, userId })
        return []
      }

      return data?.map(record => this.mapDatabaseRecordToApiKey(record)) || []

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to get user API keys', { error: message, userId })
      return []
    }
  }

  /**
   * Update API key hash (for rotation)
   */
  async updateApiKeyHash(keyId: string, newKeyHash: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Database connection not available')
    }

    try {
      const { error } = await this.supabase
        .from('api_keys')
        .update({ 
          key_hash: newKeyHash,
          updated_at: new Date()
        })
        .eq('id', keyId)

      if (error) {
        throw new Error(`Failed to update API key hash: ${error.message}`)
      }

      // Log rotation in security log
      await this.logSecurityEvent(keyId, 'rotation')

      logger.info('API key hash updated', { metadata: { keyId } })

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to update API key hash', { metadata: { error: message, keyId } })
      throw error
    }
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(keyId: string): Promise<void> {
    if (!this.supabase) {
      return
    }

    try {
      const { error } = await this.supabase
        .from('api_keys')
        .update({ 
          last_used_at: new Date(),
          updated_at: new Date()
        })
        .eq('id', keyId)

      if (error) {
        logger.warn('Failed to update last used timestamp', { metadata: { error: error.message, keyId } })
      }

    } catch (error) {
      logger.warn('Failed to update last used timestamp', { metadata: { error: error instanceof Error ? error.message : String(error), keyId } })
    }
  }

  /**
   * Deactivate API key (soft delete)
   */
  async deactivateApiKey(keyId: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Database connection not available')
    }

    try {
      const { error } = await this.supabase
        .from('api_keys')
        .update({ 
          is_active: false,
          updated_at: new Date()
        })
        .eq('id', keyId)

      if (error) {
        throw new Error(`Failed to deactivate API key: ${error.message}`)
      }

      // Log revocation in security log
      await this.logSecurityEvent(keyId, 'revocation')

      logger.info('API key deactivated', { metadata: { keyId } })

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to deactivate API key', { metadata: { error: message, keyId } })
      throw error
    }
  }

  /**
   * Get IP whitelist for API key
   */
  async getApiKeyIpWhitelist(keyId: string): Promise<string[]> {
    if (!this.supabase) {
      return []
    }

    try {
      const { data, error } = await this.supabase
        .from('api_key_ip_whitelist')
        .select('ip_address')
        .eq('api_key_id', keyId)

      if (error) {
        logger.warn('Failed to get IP whitelist', { metadata: { error: error instanceof Error ? error.message : String(error), keyId } })
        return []
      }

      return data?.map(record => record.ip_address) || []

    } catch (error) {
      logger.warn('Failed to get IP whitelist', { metadata: { error: error instanceof Error ? error.message : String(error), keyId } })
      return []
    }
  }

  /**
   * Get referrer whitelist for API key
   */
  async getApiKeyReferrerWhitelist(keyId: string): Promise<string[]> {
    if (!this.supabase) {
      return []
    }

    try {
      const { data, error } = await this.supabase
        .from('api_key_referrer_whitelist')
        .select('referrer_domain')
        .eq('api_key_id', keyId)

      if (error) {
        logger.warn('Failed to get referrer whitelist', { metadata: { error: error instanceof Error ? error.message : String(error), keyId } })
        return []
      }

      return data?.map(record => record.referrer_domain) || []

    } catch (error) {
      logger.warn('Failed to get referrer whitelist', { metadata: { error: error instanceof Error ? error.message : String(error), keyId } })
      return []
    }
  }

  /**
   * Store API key usage record
   */
  async storeUsage(usage: {
    keyId: string
    timestamp: Date
    endpoint: string
    method: string
    ipAddress: string
    userAgent?: string
    responseStatus: number
    processingTimeMs: number
    rateLimitHit?: boolean
  }): Promise<void> {
    if (!this.supabase) {
      return
    }

    try {
      const { error } = await this.supabase
        .from('api_key_usage')
        .insert({
          id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          api_key_id: usage.keyId,
          timestamp: usage.timestamp,
          endpoint: usage.endpoint,
          method: usage.method,
          ip_address: usage.ipAddress,
          user_agent: usage.userAgent,
          response_status: usage.responseStatus,
          processing_time_ms: usage.processingTimeMs,
          rate_limit_hit: usage.rateLimitHit || false,
          created_at: new Date()
        })

      if (error) {
        logger.warn('Failed to store usage record', { metadata: { error: error instanceof Error ? error.message : String(error), keyId: usage.keyId } })
      }

    } catch (error) {
      logger.warn('Failed to store usage record', { metadata: { error: error instanceof Error ? error.message : String(error), keyId: usage.keyId } })
    }
  }

  /**
   * Update usage counters
   */
  async updateUsageCounters(keyId: string): Promise<void> {
    if (!this.supabase) {
      return
    }

    try {
      // Get current requests made today
      const { data, error } = await this.supabase
        .from('api_keys')
        .select('requests_made_today')
        .eq('id', keyId)
        .single()

      if (error || !data) {
        logger.warn('Failed to get current usage counter', { metadata: { error: error instanceof Error ? error.message : String(error), keyId } })
        return
      }

      const { error: updateError } = await this.supabase
        .from('api_keys')
        .update({ 
          requests_made_today: (data.requests_made_today || 0) + 1,
          updated_at: new Date()
        })
        .eq('id', keyId)

      if (updateError) {
        logger.warn('Failed to update usage counter', { metadata: { error: updateError.message, keyId } })
      }

    } catch (error) {
      logger.warn('Failed to update usage counters', { metadata: { error: error instanceof Error ? error.message : String(error), keyId } })
    }
  }

  /**
   * Get usage statistics for an API key
   */
  async getApiKeyUsage(keyId: string): Promise<{
    requestsToday: number
    requestsThisMonth: number
    totalRequests: number
  }> {
    if (!this.supabase) {
      return { requestsToday: 0, requestsThisMonth: 0, totalRequests: 0 }
    }

    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

      // Get today's requests
      const { data: todayData, error: todayError } = await this.supabase
        .from('api_key_usage')
        .select('id', { count: 'exact' })
        .eq('api_key_id', keyId)
        .gte('timestamp', today.toISOString())

      // Get this month's requests
      const { data: monthData, error: monthError } = await this.supabase
        .from('api_key_usage')
        .select('id', { count: 'exact' })
        .eq('api_key_id', keyId)
        .gte('timestamp', monthStart.toISOString())

      // Get total requests
      const { data: totalData, error: totalError } = await this.supabase
        .from('api_key_usage')
        .select('id', { count: 'exact' })
        .eq('api_key_id', keyId)

      return {
        requestsToday: todayError ? 0 : (todayData?.length || 0),
        requestsThisMonth: monthError ? 0 : (monthData?.length || 0),
        totalRequests: totalError ? 0 : (totalData?.length || 0)
      }

    } catch (error) {
      logger.warn('Failed to get usage statistics', { metadata: { error: error instanceof Error ? error.message : String(error), keyId } })
      return { requestsToday: 0, requestsThisMonth: 0, totalRequests: 0 }
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    keyId: string,
    eventType: 'violation' | 'rotation' | 'creation' | 'revocation' | 'usage',
    violationType?: 'rate_limit' | 'ip_restriction' | 'referrer_restriction' | 'expired_key' | 'invalid_key',
    ipAddress?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.supabase) {
      return
    }

    try {
      const { error } = await this.supabase
        .from('api_key_security_log')
        .insert({
          id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          api_key_id: keyId,
          event_type: eventType,
          violation_type: violationType,
          ip_address: ipAddress,
          metadata,
          created_at: new Date()
        })

      if (error) {
        logger.warn('Failed to log security event', { metadata: { error: error instanceof Error ? error.message : String(error), keyId, eventType } })
      }

    } catch (error) {
      logger.warn('Failed to log security event', { metadata: { error: error instanceof Error ? error.message : String(error), keyId, eventType } })
    }
  }

  /**
   * Get user by ID (needed for API key validation)
   */
  async getUserById(userId: string): Promise<User | null> {
    if (!this.supabase) {
      return null
    }

    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !data) {
        return null
      }

      return data as User

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to get user by ID', { error: message, userId })
      return null
    }
  }

  /**
   * Reset daily usage counters (called by scheduled job)
   */
  async resetDailyCounters(): Promise<void> {
    if (!this.supabase) {
      return
    }

    try {
      const { error } = await this.supabase
        .from('api_keys')
        .update({ 
          requests_made_today: 0,
          updated_at: new Date()
        })
        .neq('id', '') // Update all records

      if (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Failed to reset daily counters', { error: message })
      } else {
        logger.info('Daily API key counters reset')
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to reset daily counters', { error: message })
    }
  }

  /**
   * Map database record to API key interface
   */
  private mapDatabaseRecordToApiKey(record: any): ApiKeyRecord {
    return {
      id: record.id,
      user_id: record.user_id,
      key_hash: record.key_hash,
      name: record.name,
      description: record.description,
      permissions: record.permissions || [],
      is_active: record.is_active,
      rate_limit_per_hour: record.rate_limit_per_hour,
      requests_made_today: record.requests_made_today || 0,
      last_used_at: record.last_used_at ? new Date(record.last_used_at) : undefined,
      created_from_ip: record.created_from_ip,
      created_at: new Date(record.created_at),
      expires_at: record.expires_at ? new Date(record.expires_at) : undefined
    }
  }
}

// Export singleton instance
export const apiKeyDatabase = ApiKeyDatabase.getInstance()

// SQL Schema for Supabase (run these in SQL editor)
export const API_KEY_DATABASE_SCHEMA = `
-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    rate_limit_per_hour INTEGER NOT NULL DEFAULT 100,
    requests_made_today INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_from_ip VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- IP Whitelist table
CREATE TABLE IF NOT EXISTS api_key_ip_whitelist (
    id VARCHAR(255) PRIMARY KEY,
    api_key_id VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

-- Referrer Whitelist table
CREATE TABLE IF NOT EXISTS api_key_referrer_whitelist (
    id VARCHAR(255) PRIMARY KEY,
    api_key_id VARCHAR(255) NOT NULL,
    referrer_domain VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS api_key_usage (
    id VARCHAR(255) PRIMARY KEY,
    api_key_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    response_status INTEGER NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    rate_limit_hit BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

-- Security log table
CREATE TABLE IF NOT EXISTS api_key_security_log (
    id VARCHAR(255) PRIMARY KEY,
    api_key_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    violation_type VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active_expires ON api_keys(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_timestamp ON api_key_usage(api_key_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_api_key_security_log_key_type ON api_key_security_log(api_key_id, event_type);
CREATE INDEX IF NOT EXISTS idx_api_key_ip_whitelist_key ON api_key_ip_whitelist(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_referrer_whitelist_key ON api_key_referrer_whitelist(api_key_id);

-- Row Level Security (RLS) policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_referrer_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_security_log ENABLE ROW LEVEL SECURITY;

-- Policies for api_keys table
CREATE POLICY "Users can view their own API keys" ON api_keys 
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Service role can manage all API keys" ON api_keys 
    FOR ALL USING (true);

-- Policies for related tables
CREATE POLICY "Service role can manage IP whitelist" ON api_key_ip_whitelist 
    FOR ALL USING (true);

CREATE POLICY "Service role can manage referrer whitelist" ON api_key_referrer_whitelist 
    FOR ALL USING (true);

CREATE POLICY "Service role can manage usage records" ON api_key_usage 
    FOR ALL USING (true);

CREATE POLICY "Service role can manage security logs" ON api_key_security_log 
    FOR ALL USING (true);
`