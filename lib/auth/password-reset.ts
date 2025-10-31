// 🔒 JORDAN'S PASSWORD RESET SYSTEM - Secure password recovery flow
// Comprehensive password reset with secure token generation and validation

import bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'crypto'
import type { User } from '../database/schema'
import { jwtManager } from './jwt'
import { AuthenticationError, ValidationError } from '../utils/errors'
import { validatePassword, validateEmail } from '../utils/validation'
import { logger } from '../utils/logger'

// Password reset configuration
const RESET_CONFIG = {
  TOKEN_EXPIRES_MS: 60 * 60 * 1000, // 1 hour
  MAX_RESET_ATTEMPTS: 5,
  RESET_WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours
  MIN_TIME_BETWEEN_REQUESTS: 5 * 60 * 1000, // 5 minutes
  TOKEN_LENGTH: 32
} as const

// Reset attempt tracking (use Redis in production)
const resetAttempts = new Map<string, {
  count: number
  resetTime: number
  lastRequestTime: number
}>()

export interface PasswordResetRequest {
  email: string
  token: string
  newPassword: string
  clientIp: string
  userAgent: string
}

export interface ResetTokenRecord {
  id: string
  userId: string
  tokenHash: string
  createdAt: Date
  expiresAt: Date
  isUsed: boolean
  attempts: number
  clientIp: string
  userAgent: string
}

/**
 * Password Reset Manager Class
 */
export class PasswordResetManager {
  private static instance: PasswordResetManager

  public static getInstance(): PasswordResetManager {
    if (!PasswordResetManager.instance) {
      PasswordResetManager.instance = new PasswordResetManager()
    }
    return PasswordResetManager.instance
  }

  /**
   * Initiate password reset process
   */
  public async requestPasswordReset(
    email: string,
    clientIp: string,
    userAgent: string
  ): Promise<{ success: boolean; message: string; requestId: string }> {
    const requestId = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      // Validate email format
      const emailValidation = validateEmail(email)
      if (!emailValidation.isValid) {
        throw new ValidationError('Invalid email format', 'email', 'INVALID_EMAIL')
      }

      const sanitizedEmail = emailValidation.sanitizedData!

      // Check rate limiting
      const rateLimitKey = `reset:${clientIp}:${sanitizedEmail}`
      if (!this.checkResetRateLimit(rateLimitKey)) {
        logger.warn('Password reset rate limit exceeded', {
          requestId,
          metadata: { email: sanitizedEmail, clientIp }
        })
        
        // Return success to prevent email enumeration
        return {
          success: true,
          message: 'If an account with this email exists, you will receive password reset instructions.',
          requestId
        }
      }

      // Find user by email
      const user = await this.getUserByEmail(sanitizedEmail)
      
      if (!user) {
        // Log attempt but don't reveal that email doesn't exist
        await this.logResetAttempt(sanitizedEmail, clientIp, userAgent, false, 'USER_NOT_FOUND', requestId)
        
        // Return success to prevent email enumeration
        return {
          success: true,
          message: 'If an account with this email exists, you will receive password reset instructions.',
          requestId
        }
      }

      if (!user.is_verified) {
        await this.logResetAttempt(sanitizedEmail, clientIp, userAgent, false, 'USER_NOT_VERIFIED', requestId)
        throw new AuthenticationError('Please verify your email address first', 'EMAIL_NOT_VERIFIED')
      }

      // Generate secure reset token
      const resetToken = this.generateResetToken()
      const tokenHash = this.hashToken(resetToken)

      // Create reset record
      const resetRecord: ResetTokenRecord = {
        id: `rst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        tokenHash,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + RESET_CONFIG.TOKEN_EXPIRES_MS),
        isUsed: false,
        attempts: 0,
        clientIp,
        userAgent: userAgent.substring(0, 500)
      }

      // Store reset token
      await this.storeResetToken(resetRecord)

      // Send reset email
      await this.sendPasswordResetEmail(user, resetToken, requestId)

      // Log successful reset initiation
      await this.logResetAttempt(sanitizedEmail, clientIp, userAgent, true, 'RESET_INITIATED', requestId)

      logger.info('Password reset initiated', {
        requestId,
        metadata: { 
          userId: user.id, 
          email: sanitizedEmail, 
          resetId: resetRecord.id 
        }
      })

      return {
        success: true,
        message: 'Password reset instructions have been sent to your email address.',
        requestId
      }

    } catch (error) {
      logger.error('Password reset initiation failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { email, clientIp }
      })

      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        throw error
      }

      throw new Error('Failed to process password reset request')
    }
  }

  /**
   * Validate password reset token
   */
  public async validateResetToken(token: string): Promise<{
    isValid: boolean
    userId?: string
    email?: string
    expiresAt?: Date
  }> {
    if (!token || token.length !== RESET_CONFIG.TOKEN_LENGTH * 2) {
      return { isValid: false }
    }

    const tokenHash = this.hashToken(token)
    const resetRecord = await this.getResetTokenRecord(tokenHash)

    if (!resetRecord) {
      return { isValid: false }
    }

    if (resetRecord.isUsed) {
      return { isValid: false }
    }

    if (resetRecord.expiresAt < new Date()) {
      return { isValid: false }
    }

    if (resetRecord.attempts >= 3) {
      // Too many validation attempts
      return { isValid: false }
    }

    // Get user information
    const user = await this.getUserById(resetRecord.userId)
    if (!user) {
      return { isValid: false }
    }

    // Increment attempts
    await this.incrementResetAttempts(resetRecord.id)

    return {
      isValid: true,
      userId: user.id,
      email: user.email,
      expiresAt: resetRecord.expiresAt
    }
  }

  /**
   * Complete password reset process
   */
  public async resetPassword(
    token: string,
    newPassword: string,
    clientIp: string,
    userAgent: string
  ): Promise<{ success: boolean; message: string; requestId: string }> {
    const requestId = `reset_complete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      // Validate new password
      const passwordValidation = validatePassword(newPassword)
      if (!passwordValidation.isValid) {
        const firstError = passwordValidation.errors[0]
        throw new ValidationError(firstError.message, firstError.field, firstError.code)
      }

      // Validate token
      const tokenValidation = await this.validateResetToken(token)
      if (!tokenValidation.isValid || !tokenValidation.userId) {
        throw new AuthenticationError('Invalid or expired reset token', 'INVALID_RESET_TOKEN')
      }

      const user = await this.getUserById(tokenValidation.userId)
      if (!user) {
        throw new AuthenticationError('User not found', 'USER_NOT_FOUND')
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword)

      // Update user password
      await this.updateUserPassword(user.id, passwordHash, requestId)

      // Mark token as used
      const tokenHash = this.hashToken(token)
      await this.markTokenAsUsed(tokenHash, requestId)

      // Invalidate all existing refresh tokens for security
      await this.invalidateUserTokens(user.id)

      // Send confirmation email
      await this.sendPasswordChangeConfirmation(user, clientIp, requestId)

      // Log successful password reset
      await this.logResetAttempt(
        user.email, 
        clientIp, 
        userAgent, 
        true, 
        'RESET_COMPLETED', 
        requestId
      )

      logger.info('Password reset completed', {
        requestId,
        metadata: { 
          userId: user.id, 
          email: user.email,
          clientIp 
        }
      })

      return {
        success: true,
        message: 'Your password has been successfully updated. Please log in with your new password.',
        requestId
      }

    } catch (error) {
      logger.error('Password reset completion failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { clientIp }
      })

      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        throw error
      }

      throw new Error('Failed to reset password')
    }
  }

  /**
   * Clean up expired reset tokens
   */
  public async cleanupExpiredTokens(): Promise<number> {
    try {
      const deletedCount = await this.deleteExpiredTokens()
      
      logger.info('Expired reset tokens cleaned up', {
        metadata: { deletedCount }
      })

      return deletedCount
    } catch (error) {
      logger.error('Failed to cleanup expired tokens', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return 0
    }
  }

  /**
   * Get reset attempt statistics for monitoring
   */
  public getResetAttemptStats(): {
    totalAttempts: number
    rateLimitedIps: number
    oldestAttempt: number
  } {
    const attempts = Array.from(resetAttempts.values())
    const now = Date.now()
    const activeAttempts = attempts.filter(attempt => 
      now < attempt.resetTime
    )

    return {
      totalAttempts: activeAttempts.reduce((sum, attempt) => sum + attempt.count, 0),
      rateLimitedIps: activeAttempts.length,
      oldestAttempt: Math.min(...activeAttempts.map(attempt => attempt.resetTime)) || 0
    }
  }

  // Private helper methods
  private checkResetRateLimit(key: string): boolean {
    const now = Date.now()
    const attempts = resetAttempts.get(key)

    if (!attempts || now > attempts.resetTime) {
      // First attempt or window expired
      resetAttempts.set(key, { 
        count: 1, 
        resetTime: now + RESET_CONFIG.RESET_WINDOW_MS,
        lastRequestTime: now
      })
      return true
    }

    // Check minimum time between requests
    if (now - attempts.lastRequestTime < RESET_CONFIG.MIN_TIME_BETWEEN_REQUESTS) {
      return false
    }

    if (attempts.count >= RESET_CONFIG.MAX_RESET_ATTEMPTS) {
      return false
    }

    attempts.count++
    attempts.lastRequestTime = now
    return true
  }

  private generateResetToken(): string {
    return randomBytes(RESET_CONFIG.TOKEN_LENGTH).toString('hex')
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12
    return await bcrypt.hash(password, saltRounds)
  }

  // Database operations (mock implementations - replace with actual database calls)
  private async getUserByEmail(email: string): Promise<User | null> {
    // TODO: Implement actual database query
    if (email === 'test@directorybolt.com') {
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

  private async getUserById(userId: string): Promise<User | null> {
    // TODO: Implement actual database query
    if (userId === 'usr_test_123') {
      return await this.getUserByEmail('test@directorybolt.com')
    }
    return null
  }

  private async storeResetToken(record: ResetTokenRecord): Promise<void> {
    // TODO: Implement database storage
    logger.info('Reset token stored', {
      metadata: { resetId: record.id, userId: record.userId }
    })
  }

  private async getResetTokenRecord(tokenHash: string): Promise<ResetTokenRecord | null> {
    // TODO: Implement database query
    // Mock implementation
    return null
  }

  private async incrementResetAttempts(resetId: string): Promise<void> {
    // TODO: Implement database update
    logger.info('Reset token attempts incremented', {
      metadata: { resetId }
    })
  }

  private async updateUserPassword(userId: string, passwordHash: string, requestId: string): Promise<void> {
    // TODO: Implement database update
    logger.info('User password updated', {
      requestId,
      metadata: { userId }
    })
  }

  private async markTokenAsUsed(tokenHash: string, requestId: string): Promise<void> {
    // TODO: Implement database update
    logger.info('Reset token marked as used', {
      requestId,
      metadata: { tokenHash: tokenHash.substring(0, 8) + '...' }
    })
  }

  private async invalidateUserTokens(userId: string): Promise<void> {
    // Invalidate refresh tokens
    await jwtManager.invalidateUserTokens(userId)
    
    logger.info('User tokens invalidated for security', {
      metadata: { userId }
    })
  }

  private async deleteExpiredTokens(): Promise<number> {
    // TODO: Implement database cleanup
    return 0
  }

  // Email service methods
  private async sendPasswordResetEmail(
    user: User,
    resetToken: string,
    requestId: string
  ): Promise<void> {
    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
    
    const emailContent = {
      to: user.email,
      subject: 'Reset Your DirectoryBolt Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hello ${user.full_name},</p>
          
          <p>We received a request to reset your DirectoryBolt account password.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Reset Instructions:</strong></p>
            <ol>
              <li>Click the reset button below</li>
              <li>Enter your new password</li>
              <li>Confirm the change</li>
            </ol>
          </div>
          
          <a href="${resetUrl}" 
             style="background: #dc3545; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
            Reset Password
          </a>
          
          <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour for security reasons.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            If you didn't request this password reset, please ignore this email. Your password will not be changed.
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            DirectoryBolt Security Team<br>
            Request ID: ${requestId}
          </p>
        </div>
      `
    }

    // TODO: Implement actual email sending
    logger.info('Password reset email sent', {
      requestId,
      metadata: { email: user.email, resetUrl }
    })
  }

  private async sendPasswordChangeConfirmation(
    user: User,
    clientIp: string,
    requestId: string
  ): Promise<void> {
    const emailContent = {
      to: user.email,
      subject: 'DirectoryBolt Password Changed',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Successfully Changed</h2>
          <p>Hello ${user.full_name},</p>
          
          <p>Your DirectoryBolt account password has been successfully changed.</p>
          
          <div style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <strong>Security Information:</strong>
            <ul style="margin: 10px 0;">
              <li>Time: ${new Date().toISOString()}</li>
              <li>IP Address: ${clientIp}</li>
            </ul>
          </div>
          
          <p><strong>What happens next?</strong></p>
          <ul>
            <li>All existing sessions have been logged out for security</li>
            <li>Please log in with your new password</li>
            <li>Consider enabling two-factor authentication</li>
          </ul>
          
          <p style="color: #856404; background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px;">
            <strong>Didn't make this change?</strong><br>
            If you didn't change your password, please contact our security team immediately.
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            DirectoryBolt Security Team<br>
            Request ID: ${requestId}
          </p>
        </div>
      `
    }

    // TODO: Implement actual email sending
    logger.info('Password change confirmation sent', {
      requestId,
      metadata: { email: user.email, clientIp }
    })
  }

  // Audit logging
  private async logResetAttempt(
    email: string,
    clientIp: string,
    userAgent: string,
    success: boolean,
    reason: string,
    requestId: string
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: 'password_reset_attempt',
      email,
      ip_address: clientIp,
      user_agent: userAgent.substring(0, 500),
      success,
      reason,
      request_id: requestId
    }

    logger.info('Password reset attempt logged', {
      requestId,
      metadata: { email, success, reason }
    })

    // TODO: Save to audit log database
  }
}

// Export singleton instance
export const passwordResetManager = PasswordResetManager.getInstance()

// Utility functions
export function generateSecurePassword(): string {
  const length = 16
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  
  return password
}

// Password strength checker
export function checkPasswordStrength(password: string): {
  score: number
  feedback: string[]
  isStrong: boolean
} {
  const feedback: string[] = []
  let score = 0

  // Length check
  if (password.length >= 8) score += 1
  else feedback.push('Use at least 8 characters')
  
  if (password.length >= 12) score += 1
  else feedback.push('Use 12+ characters for better security')

  // Character variety
  if (/[a-z]/.test(password)) score += 1
  else feedback.push('Add lowercase letters')

  if (/[A-Z]/.test(password)) score += 1
  else feedback.push('Add uppercase letters')

  if (/\d/.test(password)) score += 1
  else feedback.push('Add numbers')

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1
  else feedback.push('Add special characters (!@#$%^&*)')

  // Common patterns
  if (!/(.)\1{2,}/.test(password)) score += 1
  else feedback.push('Avoid repeating characters')

  const isStrong = score >= 5
  
  return { score, feedback, isStrong }
}