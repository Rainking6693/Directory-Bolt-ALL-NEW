// 🔒 JORDAN'S SESSION MANAGEMENT - Advanced session handling with multi-device support
// Comprehensive session tracking, timeout handling, and security monitoring

import { randomBytes, createHash } from 'crypto'
import type { User } from '../database/schema'
import { AuthenticationError } from '../utils/errors'
import { logger } from '../utils/logger'

// Session configuration
const SESSION_CONFIG = {
  DEFAULT_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  EXTENDED_TIMEOUT_MS: 8 * 60 * 60 * 1000, // 8 hours (for "remember me")
  MAX_SESSIONS_PER_USER: 10,
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  ACTIVITY_UPDATE_THRESHOLD_MS: 60 * 1000, // Only update activity once per minute
  MAX_INACTIVE_SESSIONS: 50, // Maximum inactive sessions to keep
  SESSION_ID_LENGTH: 32
} as const

export interface SessionData {
  id: string
  userId: string
  deviceInfo: {
    userAgent: string
    ip: string
    device: string
    browser: string
    os: string
    isMobile: boolean
  }
  security: {
    ipAddress: string
    userAgent: string
    createdAt: Date
    lastActivity: Date
    lastIpChange?: Date
    loginMethod: 'password' | 'refresh' | 'api_key'
    twoFactorVerified: boolean
    isRemembered: boolean
  }
  status: 'active' | 'inactive' | 'expired' | 'revoked'
  timeoutMs: number
  metadata: Record<string, any>
}

export interface SessionActivity {
  sessionId: string
  timestamp: Date
  action: string
  ipAddress: string
  userAgent?: string
  endpoint?: string
  success: boolean
}

export interface ActiveSession {
  id: string
  deviceInfo: string
  location: string
  lastActivity: Date
  isCurrentSession: boolean
  status: 'active' | 'inactive'
}

// Session storage (use Redis or database in production)
const sessionStore = new Map<string, SessionData>()
const activityLog = new Map<string, SessionActivity[]>()
const userSessions = new Map<string, Set<string>>() // userId -> Set of sessionIds

/**
 * Session Manager Class
 */
export class SessionManager {
  private static instance: SessionManager
  private cleanupInterval: NodeJS.Timeout

  private constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions()
    }, SESSION_CONFIG.CLEANUP_INTERVAL_MS)
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager()
    }
    return SessionManager.instance
  }

  /**
   * Create new session
   */
  public async createSession(
    user: User,
    deviceInfo: {
      userAgent: string
      ip: string
    },
    options: {
      rememberMe?: boolean
      loginMethod?: 'password' | 'refresh' | 'api_key'
      twoFactorVerified?: boolean
    } = {}
  ): Promise<SessionData> {
    const sessionId = this.generateSessionId()
    const now = new Date()
    
    // Parse device information
    const parsedDevice = this.parseDeviceInfo(deviceInfo.userAgent)
    
    const session: SessionData = {
      id: sessionId,
      userId: user.id,
      deviceInfo: {
        userAgent: deviceInfo.userAgent,
        ip: deviceInfo.ip,
        device: parsedDevice.device,
        browser: parsedDevice.browser,
        os: parsedDevice.os,
        isMobile: parsedDevice.isMobile
      },
      security: {
        ipAddress: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        createdAt: now,
        lastActivity: now,
        loginMethod: options.loginMethod || 'password',
        twoFactorVerified: options.twoFactorVerified || false,
        isRemembered: options.rememberMe || false
      },
      status: 'active',
      timeoutMs: options.rememberMe ? 
        SESSION_CONFIG.EXTENDED_TIMEOUT_MS : 
        SESSION_CONFIG.DEFAULT_TIMEOUT_MS,
      metadata: {}
    }

    // Enforce session limits per user
    await this.enforceSessionLimits(user.id)
    
    // Store session
    sessionStore.set(sessionId, session)
    
    // Update user session tracking
    if (!userSessions.has(user.id)) {
      userSessions.set(user.id, new Set())
    }
    userSessions.get(user.id)!.add(sessionId)

    // Log session creation
    await this.logSessionActivity(sessionId, 'session_created', deviceInfo.ip, deviceInfo.userAgent)

    logger.info('Session created', {
      metadata: {
        sessionId,
        userId: user.id,
        ip: deviceInfo.ip,
        device: parsedDevice.device,
        browser: parsedDevice.browser,
        rememberMe: options.rememberMe
      }
    })

    return session
  }

  /**
   * Get session by ID
   */
  public async getSession(sessionId: string): Promise<SessionData | null> {
    const session = sessionStore.get(sessionId)
    
    if (!session) {
      return null
    }

    // Check if session is expired
    if (this.isSessionExpired(session)) {
      await this.expireSession(sessionId, 'timeout')
      return null
    }

    return session
  }

  /**
   * Update session activity
   */
  public async updateActivity(
    sessionId: string,
    ipAddress: string,
    action?: string,
    endpoint?: string,
    userAgent?: string
  ): Promise<void> {
    const session = sessionStore.get(sessionId)
    
    if (!session || session.status !== 'active') {
      return
    }

    const now = new Date()
    
    // Only update if enough time has passed (to avoid excessive updates)
    if (now.getTime() - session.security.lastActivity.getTime() < SESSION_CONFIG.ACTIVITY_UPDATE_THRESHOLD_MS) {
      return
    }

    // Check for IP address change
    if (session.security.ipAddress !== ipAddress) {
      session.security.lastIpChange = now
      session.security.ipAddress = ipAddress
      
      // Log suspicious activity
      logger.warn('Session IP address changed', {
        metadata: {
          sessionId,
          userId: session.userId,
          oldIp: session.security.ipAddress,
          newIp: ipAddress,
          timeSinceLastActivity: now.getTime() - session.security.lastActivity.getTime()
        }
      })
      
      // Optionally revoke session on IP change for high security
      if (this.shouldRevokeOnIpChange(session)) {
        await this.revokeSession(sessionId, 'suspicious_activity')
        return
      }
    }

    // Update activity
    session.security.lastActivity = now
    
    // Log activity
    if (action) {
      await this.logSessionActivity(sessionId, action, ipAddress, userAgent, endpoint, true)
    }
  }

  /**
   * Validate session and check security
   */
  public async validateSession(
    sessionId: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<{ isValid: boolean; session?: SessionData; reason?: string }> {
    const session = await this.getSession(sessionId)
    
    if (!session) {
      return { isValid: false, reason: 'session_not_found' }
    }

    if (session.status !== 'active') {
      return { isValid: false, reason: 'session_inactive' }
    }

    if (this.isSessionExpired(session)) {
      await this.expireSession(sessionId, 'timeout')
      return { isValid: false, reason: 'session_expired' }
    }

    // Security checks
    if (this.isSecurityViolation(session, ipAddress, userAgent)) {
      await this.revokeSession(sessionId, 'security_violation')
      return { isValid: false, reason: 'security_violation' }
    }

    // Update activity
    await this.updateActivity(sessionId, ipAddress, 'validation', undefined, userAgent)

    return { isValid: true, session }
  }

  /**
   * Get user's active sessions
   */
  public async getUserSessions(userId: string): Promise<ActiveSession[]> {
    const sessionIds = userSessions.get(userId) || new Set()
    const activeSessions: ActiveSession[] = []

    for (const sessionId of sessionIds) {
      const session = sessionStore.get(sessionId)
      if (!session || session.status !== 'active') {
        continue
      }

      if (this.isSessionExpired(session)) {
        await this.expireSession(sessionId, 'timeout')
        continue
      }

      activeSessions.push({
        id: sessionId,
        deviceInfo: `${session.deviceInfo.browser} on ${session.deviceInfo.os}`,
        location: this.getLocationFromIp(session.security.ipAddress),
        lastActivity: session.security.lastActivity,
        isCurrentSession: false, // This should be set by the caller
        status: 'active'
      })
    }

    return activeSessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
  }

  /**
   * Revoke specific session
   */
  public async revokeSession(sessionId: string, reason: string = 'manual'): Promise<boolean> {
    const session = sessionStore.get(sessionId)
    
    if (!session) {
      return false
    }

    // Update session status
    session.status = 'revoked'
    session.metadata.revokedAt = new Date()
    session.metadata.revokeReason = reason

    // Remove from user sessions
    const userSessionSet = userSessions.get(session.userId)
    if (userSessionSet) {
      userSessionSet.delete(sessionId)
    }

    // Log revocation
    await this.logSessionActivity(sessionId, 'session_revoked', session.security.ipAddress, undefined, undefined, true, { reason })

    logger.info('Session revoked', {
      metadata: {
        sessionId,
        userId: session.userId,
        reason,
        deviceInfo: session.deviceInfo.device
      }
    })

    return true
  }

  /**
   * Revoke all user sessions except current
   */
  public async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const sessionIds = userSessions.get(userId) || new Set()
    let revokedCount = 0

    for (const sessionId of sessionIds) {
      if (sessionId === exceptSessionId) {
        continue
      }

      const success = await this.revokeSession(sessionId, 'bulk_revoke')
      if (success) {
        revokedCount++
      }
    }

    logger.info('Bulk session revocation', {
      metadata: {
        userId,
        revokedCount,
        exceptSessionId
      }
    })

    return revokedCount
  }

  /**
   * Get session statistics
   */
  public getSessionStats(): {
    totalSessions: number
    activeSessions: number
    expiredSessions: number
    revokedSessions: number
    uniqueUsers: number
  } {
    const sessions = Array.from(sessionStore.values())
    const activeUsers = new Set<string>()

    const stats = sessions.reduce((acc, session) => {
      acc.totalSessions++
      
      switch (session.status) {
        case 'active':
          if (!this.isSessionExpired(session)) {
            acc.activeSessions++
            activeUsers.add(session.userId)
          } else {
            acc.expiredSessions++
          }
          break
        case 'expired':
          acc.expiredSessions++
          break
        case 'revoked':
          acc.revokedSessions++
          break
      }

      return acc
    }, {
      totalSessions: 0,
      activeSessions: 0,
      expiredSessions: 0,
      revokedSessions: 0
    })

    return {
      ...stats,
      uniqueUsers: activeUsers.size
    }
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now()
    let cleanedCount = 0

    for (const [sessionId, session] of sessionStore.entries()) {
      if (this.isSessionExpired(session) || session.status === 'expired') {
        await this.expireSession(sessionId, 'cleanup')
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info('Session cleanup completed', {
        metadata: { cleanedCount }
      })
    }
  }

  /**
   * Destroy session manager (cleanup)
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }

  // Private helper methods
  private generateSessionId(): string {
    return randomBytes(SESSION_CONFIG.SESSION_ID_LENGTH).toString('hex')
  }

  private isSessionExpired(session: SessionData): boolean {
    const now = Date.now()
    const lastActivity = session.security.lastActivity.getTime()
    return (now - lastActivity) > session.timeoutMs
  }

  private async expireSession(sessionId: string, reason: string): Promise<void> {
    const session = sessionStore.get(sessionId)
    if (!session) return

    session.status = 'expired'
    session.metadata.expiredAt = new Date()
    session.metadata.expireReason = reason

    // Remove from user sessions
    const userSessionSet = userSessions.get(session.userId)
    if (userSessionSet) {
      userSessionSet.delete(sessionId)
    }

    // Remove from store after delay (for audit purposes)
    setTimeout(() => {
      sessionStore.delete(sessionId)
      activityLog.delete(sessionId)
    }, 24 * 60 * 60 * 1000) // Keep for 24 hours
  }

  private async enforceSessionLimits(userId: string): Promise<void> {
    const userSessionSet = userSessions.get(userId) || new Set()
    
    if (userSessionSet.size >= SESSION_CONFIG.MAX_SESSIONS_PER_USER) {
      // Find oldest session and revoke it
      let oldestSession: SessionData | null = null
      let oldestSessionId: string | null = null

      for (const sessionId of userSessionSet) {
        const session = sessionStore.get(sessionId)
        if (!session) continue

        if (!oldestSession || session.security.lastActivity < oldestSession.security.lastActivity) {
          oldestSession = session
          oldestSessionId = sessionId
        }
      }

      if (oldestSessionId) {
        await this.revokeSession(oldestSessionId, 'session_limit_exceeded')
      }
    }
  }

  private parseDeviceInfo(userAgent: string): {
    device: string
    browser: string
    os: string
    isMobile: boolean
  } {
    // Simplified user agent parsing (use a proper library in production)
    const ua = userAgent.toLowerCase()
    
    const isMobile = /mobile|android|iphone|ipad|tablet/.test(ua)
    
    let browser = 'Unknown'
    if (ua.includes('chrome')) browser = 'Chrome'
    else if (ua.includes('firefox')) browser = 'Firefox'
    else if (ua.includes('safari')) browser = 'Safari'
    else if (ua.includes('edge')) browser = 'Edge'

    let os = 'Unknown'
    if (ua.includes('windows')) os = 'Windows'
    else if (ua.includes('mac')) os = 'macOS'
    else if (ua.includes('linux')) os = 'Linux'
    else if (ua.includes('android')) os = 'Android'
    else if (ua.includes('ios')) os = 'iOS'

    const device = isMobile ? 'Mobile' : 'Desktop'

    return { device, browser, os, isMobile }
  }

  private isSecurityViolation(session: SessionData, ipAddress: string, userAgent?: string): boolean {
    // Check for dramatic IP changes (different countries/regions)
    // This is a simplified check - use proper geolocation service
    if (this.isDramaticIpChange(session.security.ipAddress, ipAddress)) {
      return true
    }

    // Check for user agent changes (potential session hijacking)
    if (userAgent && this.isUserAgentSuspicious(session.security.userAgent, userAgent)) {
      return true
    }

    return false
  }

  private shouldRevokeOnIpChange(session: SessionData): boolean {
    // Only revoke on IP change for highly sensitive operations
    // or if 2FA is not verified
    return !session.security.twoFactorVerified
  }

  private isDramaticIpChange(oldIp: string, newIp: string): boolean {
    // Simplified check - compare first two octets for IPv4
    const oldParts = oldIp.split('.')
    const newParts = newIp.split('.')
    
    if (oldParts.length === 4 && newParts.length === 4) {
      return oldParts[0] !== newParts[0] || oldParts[1] !== newParts[1]
    }

    return oldIp !== newIp
  }

  private isUserAgentSuspicious(oldUA: string, newUA: string): boolean {
    // Check if the user agent has changed significantly
    const oldBrowser = this.parseDeviceInfo(oldUA)
    const newBrowser = this.parseDeviceInfo(newUA)

    return oldBrowser.browser !== newBrowser.browser || 
           oldBrowser.os !== newBrowser.os ||
           oldBrowser.isMobile !== newBrowser.isMobile
  }

  private getLocationFromIp(ipAddress: string): string {
    // Simplified location detection (use proper geolocation service)
    if (ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress === '127.0.0.1') {
      return 'Local Network'
    }
    return 'Unknown Location'
  }

  private async logSessionActivity(
    sessionId: string,
    action: string,
    ipAddress: string,
    userAgent?: string,
    endpoint?: string,
    success: boolean = true,
    metadata?: any
  ): Promise<void> {
    const activity: SessionActivity = {
      sessionId,
      timestamp: new Date(),
      action,
      ipAddress,
      userAgent,
      endpoint,
      success
    }

    // Store activity log
    if (!activityLog.has(sessionId)) {
      activityLog.set(sessionId, [])
    }
    
    const sessionActivities = activityLog.get(sessionId)!
    sessionActivities.push(activity)
    
    // Keep only last 100 activities per session
    if (sessionActivities.length > 100) {
      sessionActivities.shift()
    }

    // Log to application logger
    logger.info('Session activity logged', {
      metadata: {
        sessionId: sessionId.substring(0, 8) + '...',
        action,
        ipAddress,
        success,
        ...metadata
      }
    })
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance()

// Utility functions
export function generateSecureSessionId(): string {
  return randomBytes(32).toString('hex')
}

export function hashSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex')
}

// Clean shutdown handler
process.on('SIGTERM', () => {
  sessionManager.destroy()
})

process.on('SIGINT', () => {
  sessionManager.destroy()
})