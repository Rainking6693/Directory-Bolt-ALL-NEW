import { createClient } from '@supabase/supabase-js'
// import CryptoJS from 'crypto-js' // Install with: npm install crypto-js @types/crypto-js

// Simple encryption fallback for demo purposes
class SimpleCrypto {
  static encrypt(data: string, key: string): string {
    // In production, use proper encryption like crypto-js
    return Buffer.from(data).toString('base64')
  }
  
  static decrypt(encryptedData: string, key: string): string {
    // In production, use proper decryption like crypto-js
    return Buffer.from(encryptedData, 'base64').toString('utf8')
  }
}

interface DataRetentionPolicy {
  dataType: string
  retentionPeriod: number // days
  autoDelete: boolean
  archiveBefore: boolean
  description: string
}

interface GDPRRequest {
  requestId: string
  userId: string
  requestType: 'access' | 'portability' | 'deletion' | 'rectification'
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  requestedAt: Date
  completedAt?: Date
  requestData?: any
  responseData?: any
  notes?: string
}

interface UserConsent {
  userId: string
  consentType: string
  granted: boolean
  grantedAt: Date
  revokedAt?: Date
  ipAddress: string
  userAgent: string
  consentVersion: string
}

interface DataAuditLog {
  id: string
  userId?: string
  action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'anonymize'
  dataType: string
  recordId?: string
  timestamp: Date
  ipAddress: string
  userAgent: string
  details?: Record<string, any>
}

interface SecurityAlert {
  alertId: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: 'suspicious_activity' | 'data_breach' | 'unauthorized_access' | 'compliance_violation'
  description: string
  triggeredAt: Date
  userId?: string
  ipAddress?: string
  resolved: boolean
  resolvedAt?: Date
  actions: string[]
}

export class SecurityComplianceService {
  private supabase: any
  private encryptionKey: string

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production'
    this.initializeRetentionPolicies()
  }

  /**
   * Initialize default data retention policies
   */
  private async initializeRetentionPolicies(): Promise<void> {
    const defaultPolicies: DataRetentionPolicy[] = [
      {
        dataType: 'user_submissions',
        retentionPeriod: 2555, // 7 years for business records
        autoDelete: true,
        archiveBefore: true,
        description: 'Business directory submission records'
      },
      {
        dataType: 'user_activity_logs',
        retentionPeriod: 365, // 1 year for activity logs
        autoDelete: true,
        archiveBefore: false,
        description: 'User activity and audit logs'
      },
      {
        dataType: 'payment_records',
        retentionPeriod: 2555, // 7 years for financial records
        autoDelete: false,
        archiveBefore: true,
        description: 'Payment and billing records'
      },
      {
        dataType: 'marketing_data',
        retentionPeriod: 1095, // 3 years for marketing data
        autoDelete: true,
        archiveBefore: false,
        description: 'Marketing campaigns and user engagement data'
      },
      {
        dataType: 'support_tickets',
        retentionPeriod: 1825, // 5 years for support records
        autoDelete: true,
        archiveBefore: true,
        description: 'Customer support interactions and tickets'
      },
      {
        dataType: 'error_logs',
        retentionPeriod: 90, // 3 months for error logs
        autoDelete: true,
        archiveBefore: false,
        description: 'Application error logs and debugging information'
      }
    ]

    for (const policy of defaultPolicies) {
      await this.upsertRetentionPolicy(policy)
    }
  }

  /**
   * Create or update a data retention policy
   */
  async upsertRetentionPolicy(policy: DataRetentionPolicy): Promise<void> {
    try {
      await this.supabase
        .from('data_retention_policies')
        .upsert({
          data_type: policy.dataType,
          retention_period_days: policy.retentionPeriod,
          auto_delete: policy.autoDelete,
          archive_before_delete: policy.archiveBefore,
          description: policy.description,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'data_type'
        })
    } catch (error) {
      console.error('Failed to upsert retention policy:', error)
      throw error
    }
  }

  /**
   * Apply data retention policies (scheduled job)
   */
  async applyRetentionPolicies(): Promise<void> {
    try {
      const { data: policies, error } = await this.supabase
        .from('data_retention_policies')
        .select('*')
        .eq('auto_delete', true)

      if (error) throw error

      for (const policy of policies || []) {
        await this.applySingleRetentionPolicy(policy)
      }

      // Log retention policy execution
      await this.logDataAudit({
        action: 'delete',
        dataType: 'retention_policy_execution',
        timestamp: new Date(),
        ipAddress: 'system',
        userAgent: 'system',
        details: { policiesApplied: policies?.length || 0 }
      })

    } catch (error) {
      console.error('Failed to apply retention policies:', error)
      throw error
    }
  }

  /**
   * Apply a single retention policy
   */
  private async applySingleRetentionPolicy(policy: any): Promise<void> {
    const cutoffDate = new Date(
      Date.now() - policy.retention_period_days * 24 * 60 * 60 * 1000
    )

    try {
      switch (policy.data_type) {
        case 'user_submissions':
          await this.cleanupUserSubmissions(cutoffDate, policy.archive_before_delete)
          break
        case 'user_activity_logs':
          await this.cleanupActivityLogs(cutoffDate)
          break
        case 'marketing_data':
          await this.cleanupMarketingData(cutoffDate)
          break
        case 'support_tickets':
          await this.cleanupSupportTickets(cutoffDate, policy.archive_before_delete)
          break
        case 'error_logs':
          await this.cleanupErrorLogs(cutoffDate)
          break
        default:
          console.warn(`Unknown data type for retention: ${policy.data_type}`)
      }
    } catch (error) {
      console.error(`Failed to apply retention policy for ${policy.data_type}:`, error)
    }
  }

  /**
   * Process GDPR data request
   */
  async processGDPRRequest(request: Omit<GDPRRequest, 'requestId' | 'status' | 'requestedAt'>): Promise<string> {
    try {
      const requestId = `gdpr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const gdprRequest: GDPRRequest = {
        requestId,
        status: 'pending',
        requestedAt: new Date(),
        ...request
      }

      // Store the request
      await this.supabase
        .from('gdpr_requests')
        .insert({
          request_id: requestId,
          user_id: request.userId,
          request_type: request.requestType,
          status: 'pending',
          request_data: request.requestData,
          requested_at: new Date().toISOString()
        })

      // Process the request based on type
      switch (request.requestType) {
        case 'access':
          await this.processDataAccessRequest(gdprRequest)
          break
        case 'portability':
          await this.processDataPortabilityRequest(gdprRequest)
          break
        case 'deletion':
          await this.processDataDeletionRequest(gdprRequest)
          break
        case 'rectification':
          await this.processDataRectificationRequest(gdprRequest)
          break
      }

      return requestId

    } catch (error) {
      console.error('Failed to process GDPR request:', error)
      throw error
    }
  }

  /**
   * Process data access request (Article 15)
   */
  private async processDataAccessRequest(request: GDPRRequest): Promise<void> {
    try {
      const userData = await this.collectUserData(request.userId)
      
      await this.supabase
        .from('gdpr_requests')
        .update({
          status: 'completed',
          response_data: userData,
          completed_at: new Date().toISOString()
        })
        .eq('request_id', request.requestId)

      await this.logDataAudit({
        userId: request.userId,
        action: 'export',
        dataType: 'gdpr_access_request',
        timestamp: new Date(),
        ipAddress: 'system',
        userAgent: 'system',
        details: { requestId: request.requestId }
      })

    } catch (error) {
      await this.updateGDPRRequestStatus(request.requestId, 'rejected', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw error
    }
  }

  /**
   * Process data portability request (Article 20)
   */
  private async processDataPortabilityRequest(request: GDPRRequest): Promise<void> {
    try {
      const portableData = await this.generatePortableData(request.userId)
      
      await this.supabase
        .from('gdpr_requests')
        .update({
          status: 'completed',
          response_data: portableData,
          completed_at: new Date().toISOString()
        })
        .eq('request_id', request.requestId)

    } catch (error) {
      await this.updateGDPRRequestStatus(request.requestId, 'rejected', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw error
    }
  }

  /**
   * Process data deletion request (Article 17)
   */
  private async processDataDeletionRequest(request: GDPRRequest): Promise<void> {
    try {
      await this.deleteUserData(request.userId)
      
      await this.supabase
        .from('gdpr_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: 'User data has been permanently deleted'
        })
        .eq('request_id', request.requestId)

      await this.logDataAudit({
        userId: request.userId,
        action: 'delete',
        dataType: 'user_data_deletion',
        timestamp: new Date(),
        ipAddress: 'system',
        userAgent: 'system',
        details: { requestId: request.requestId, scope: 'complete_user_data' }
      })

    } catch (error) {
      await this.updateGDPRRequestStatus(request.requestId, 'rejected', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw error
    }
  }

  /**
   * Process data rectification request (Article 16)
   */
  private async processDataRectificationRequest(request: GDPRRequest): Promise<void> {
    try {
      if (request.requestData) {
        await this.updateUserData(request.userId, request.requestData)
      }
      
      await this.supabase
        .from('gdpr_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: 'User data has been updated as requested'
        })
        .eq('request_id', request.requestId)

    } catch (error) {
      await this.updateGDPRRequestStatus(request.requestId, 'rejected', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw error
    }
  }

  /**
   * Record user consent
   */
  async recordUserConsent(
    userId: string,
    consentType: string,
    granted: boolean,
    ipAddress: string,
    userAgent: string,
    consentVersion = '1.0'
  ): Promise<void> {
    try {
      const consent: UserConsent = {
        userId,
        consentType,
        granted,
        grantedAt: new Date(),
        ipAddress,
        userAgent,
        consentVersion
      }

      if (!granted) {
        consent.revokedAt = new Date()
      }

      await this.supabase
        .from('user_consents')
        .insert({
          user_id: userId,
          consent_type: consentType,
          granted,
          granted_at: consent.grantedAt.toISOString(),
          revoked_at: consent.revokedAt?.toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
          consent_version: consentVersion
        })

      await this.logDataAudit({
        userId,
        action: granted ? 'create' : 'update',
        dataType: 'user_consent',
        timestamp: new Date(),
        ipAddress,
        userAgent,
        details: { consentType, granted, version: consentVersion }
      })

    } catch (error) {
      console.error('Failed to record user consent:', error)
      throw error
    }
  }

  /**
   * Encrypt sensitive data
   */
  encryptData(data: string): string {
    try {
      return SimpleCrypto.encrypt(data, this.encryptionKey)
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  /**
   * Decrypt sensitive data
   */
  decryptData(encryptedData: string): string {
    try {
      return SimpleCrypto.decrypt(encryptedData, this.encryptionKey)
    } catch (error) {
      console.error('Decryption failed:', error)
      throw new Error('Failed to decrypt data')
    }
  }

  /**
   * Log data audit trail
   */
  async logDataAudit(audit: Omit<DataAuditLog, 'id'>): Promise<void> {
    try {
      const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      await this.supabase
        .from('data_audit_logs')
        .insert({
          id: auditId,
          user_id: audit.userId,
          action: audit.action,
          data_type: audit.dataType,
          record_id: audit.recordId,
          timestamp: audit.timestamp.toISOString(),
          ip_address: audit.ipAddress,
          user_agent: audit.userAgent,
          details: audit.details
        })

    } catch (error) {
      console.error('Failed to log data audit:', error)
      // Don't throw - audit logging should not break the main operation
    }
  }

  /**
   * Create security alert
   */
  async createSecurityAlert(alert: Omit<SecurityAlert, 'alertId' | 'triggeredAt' | 'resolved'>): Promise<void> {
    try {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      await this.supabase
        .from('security_alerts')
        .insert({
          alert_id: alertId,
          severity: alert.severity,
          type: alert.type,
          description: alert.description,
          user_id: alert.userId,
          ip_address: alert.ipAddress,
          triggered_at: new Date().toISOString(),
          resolved: false,
          actions: alert.actions
        })

      // Send immediate notification for critical alerts
      if (alert.severity === 'critical') {
        await this.sendCriticalAlertNotification(alertId, alert)
      }

    } catch (error) {
      console.error('Failed to create security alert:', error)
      throw error
    }
  }

  /**
   * Monitor for suspicious activity
   */
  async monitorSuspiciousActivity(userId: string, ipAddress: string, action: string): Promise<void> {
    try {
      // Check for rapid repeated actions
      const recentActions = await this.supabase
        .from('data_audit_logs')
        .select('timestamp')
        .eq('user_id', userId)
        .eq('action', action)
        .gte('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes

      if (recentActions.data && recentActions.data.length > 10) {
        await this.createSecurityAlert({
          severity: 'medium',
          type: 'suspicious_activity',
          description: `Rapid repeated ${action} actions detected`,
          userId,
          ipAddress,
          actions: ['monitor_user', 'rate_limit']
        })
      }

      // Check for access from multiple IPs
      const recentIPs = await this.supabase
        .from('data_audit_logs')
        .select('ip_address')
        .eq('user_id', userId)
        .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .neq('ip_address', ipAddress)

      if (recentIPs.data && recentIPs.data.length > 3) {
        await this.createSecurityAlert({
          severity: 'high',
          type: 'suspicious_activity',
          description: 'Access from multiple IP addresses detected',
          userId,
          ipAddress,
          actions: ['verify_identity', 'monitor_user']
        })
      }

    } catch (error) {
      console.error('Failed to monitor suspicious activity:', error)
    }
  }

  // Helper methods

  private async cleanupUserSubmissions(cutoffDate: Date, archive: boolean): Promise<void> {
    if (archive) {
      // Move to archive table first
      await this.supabase.rpc('archive_old_submissions', {
        cutoff_date: cutoffDate.toISOString()
      })
    }
    
    await this.supabase
      .from('submissions')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
  }

  private async cleanupActivityLogs(cutoffDate: Date): Promise<void> {
    await this.supabase
      .from('data_audit_logs')
      .delete()
      .lt('timestamp', cutoffDate.toISOString())
  }

  private async cleanupMarketingData(cutoffDate: Date): Promise<void> {
    await Promise.all([
      this.supabase
        .from('email_campaigns')
        .delete()
        .lt('created_at', cutoffDate.toISOString()),
      this.supabase
        .from('user_analytics')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
    ])
  }

  private async cleanupSupportTickets(cutoffDate: Date, archive: boolean): Promise<void> {
    if (archive) {
      await this.supabase.rpc('archive_old_support_tickets', {
        cutoff_date: cutoffDate.toISOString()
      })
    }
    
    await this.supabase
      .from('support_tickets')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
  }

  private async cleanupErrorLogs(cutoffDate: Date): Promise<void> {
    await this.supabase
      .from('error_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
  }

  private async collectUserData(userId: string): Promise<any> {
    // Collect all user data for GDPR access request
    const [profile, submissions, payments, consents] = await Promise.all([
      this.supabase.from('profiles').select('*').eq('id', userId),
      this.supabase.from('submissions').select('*').eq('user_id', userId),
      this.supabase.from('payments').select('*').eq('user_id', userId),
      this.supabase.from('user_consents').select('*').eq('user_id', userId)
    ])

    return {
      profile: profile.data,
      submissions: submissions.data,
      payments: payments.data,
      consents: consents.data,
      exportedAt: new Date().toISOString()
    }
  }

  private async generatePortableData(userId: string): Promise<any> {
    // Generate machine-readable data export
    const userData = await this.collectUserData(userId)
    
    return {
      format: 'JSON',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: userData
    }
  }

  private async deleteUserData(userId: string): Promise<void> {
    // Delete all user data (irreversible)
    await Promise.all([
      this.supabase.from('submissions').delete().eq('user_id', userId),
      this.supabase.from('user_consents').delete().eq('user_id', userId),
      this.supabase.from('api_usage').delete().eq('user_id', userId),
      this.supabase.from('profiles').delete().eq('id', userId)
    ])
  }

  private async updateUserData(userId: string, updates: any): Promise<void> {
    // Update user data for rectification requests
    await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
  }

  private async updateGDPRRequestStatus(
    requestId: string,
    status: string,
    additionalData?: any
  ): Promise<void> {
    await this.supabase
      .from('gdpr_requests')
      .update({
        status,
        completed_at: new Date().toISOString(),
        ...additionalData
      })
      .eq('request_id', requestId)
  }

  private async sendCriticalAlertNotification(alertId: string, alert: any): Promise<void> {
    // Implementation would send notifications to security team
    console.error('CRITICAL SECURITY ALERT:', alertId, alert)
  }
}

export const securityComplianceService = new SecurityComplianceService()
