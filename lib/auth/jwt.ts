// 🔒 JORDAN'S JWT TOKEN MANAGEMENT - Enterprise-grade token handling
// Secure JWT generation, validation, and refresh with comprehensive security controls

import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken'
import { randomBytes, createHash } from 'crypto'
import type { User } from '../database/schema'
import { AuthenticationError, ValidationError } from '../utils/errors'
import { logger } from '../utils/logger'

// JWT Configuration
const JWT_CONFIG = {
  ACCESS_TOKEN_EXPIRES: '15m', // Short-lived access tokens
  REFRESH_TOKEN_EXPIRES: '7d', // Longer-lived refresh tokens  
  ISSUER: 'DirectoryBolt',
  AUDIENCE: 'directorybolt-api',
  ALGORITHM: 'HS256' as const,
  REFRESH_TOKEN_LENGTH: 32
} as const

// Token types for type safety
export type TokenType = 'access' | 'refresh' | 'password_reset' | 'email_verification'

export interface TokenPayload {
  sub: string // User ID
  email: string
  role: UserRole
  tier: string
  iat: number
  exp: number
  iss: string
  aud: string
  type: TokenType
  sessionId?: string
}

export interface RefreshTokenRecord {
  id: string
  userId: string
  tokenHash: string
  deviceInfo: string
  ipAddress: string
  createdAt: Date
  expiresAt: Date
  lastUsedAt: Date
  isActive: boolean
}

export type UserRole = 'customer' | 'admin' | 'va'


// JWT Token Management Class
export class JWTManager {
  private static instance: JWTManager
  private accessTokenSecret: string
  private refreshTokenSecret: string

  private constructor() {
    this.accessTokenSecret = this.getSecret('JWT_ACCESS_SECRET')
    this.refreshTokenSecret = this.getSecret('JWT_REFRESH_SECRET')
  }

  public static getInstance(): JWTManager {
    if (!JWTManager.instance) {
      JWTManager.instance = new JWTManager()
    }
    return JWTManager.instance
  }

  private getSecret(envVar: string): string {
    const secret = process.env[envVar]
    if (!secret) {
      throw new Error(`${envVar} environment variable is required`)
    }
    if (secret.length < 64) {
      throw new Error(`${envVar} must be at least 64 characters long`)
    }
    return secret
  }

  /**
   * Generate access token with user information
   */
  public generateAccessToken(
    user: User, 
    sessionId?: string,
    customExpiry?: string
  ): string {
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: this.getUserRole(user),
      tier: user.subscription_tier,
      iss: JWT_CONFIG.ISSUER,
      aud: JWT_CONFIG.AUDIENCE,
      type: 'access',
      ...(sessionId && { sessionId })
    }

    const options = {
      expiresIn: customExpiry || JWT_CONFIG.ACCESS_TOKEN_EXPIRES,
      algorithm: JWT_CONFIG.ALGORITHM as 'HS256'
    }

    try {
      const token = jwt.sign(payload, this.accessTokenSecret, {
        expiresIn: customExpiry || JWT_CONFIG.ACCESS_TOKEN_EXPIRES,
        algorithm: 'HS256'
      } as any)
      
      logger.info('Access token generated', {
        metadata: { 
          userId: user.id, 
          email: user.email,
          role: payload.role,
          sessionId 
        }
      })
      
      return token
    } catch (error) {
      logger.error('Failed to generate access token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { userId: user.id, email: user.email }
      })
      throw new Error('Token generation failed')
    }
  }

  /**
   * Generate refresh token for long-term authentication
   */
  public async generateRefreshToken(
    user: User,
    deviceInfo: string,
    ipAddress: string
  ): Promise<{ token: string; record: RefreshTokenRecord }> {
    const tokenValue = this.generateSecureToken()
    const tokenHash = this.hashToken(tokenValue)
    
    const record: RefreshTokenRecord = {
      id: `rt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      tokenHash,
      deviceInfo: this.sanitizeDeviceInfo(deviceInfo),
      ipAddress,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      lastUsedAt: new Date(),
      isActive: true
    }

    // Store refresh token record in database
    await this.storeRefreshToken(record)

    logger.info('Refresh token generated', {
      metadata: { 
        userId: user.id, 
        tokenId: record.id,
        deviceInfo: record.deviceInfo,
        ipAddress 
      }
    })

    return { token: tokenValue, record }
  }

  /**
   * Validate and decode access token
   */
  public async validateAccessToken(token: string): Promise<TokenPayload> {
    if (!token) {
      throw new AuthenticationError('Access token is required', 'TOKEN_MISSING')
    }

    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        algorithms: [JWT_CONFIG.ALGORITHM],
        issuer: JWT_CONFIG.ISSUER,
        audience: JWT_CONFIG.AUDIENCE
      }) as TokenPayload

      // Verify token type
      if (decoded.type !== 'access') {
        throw new AuthenticationError('Invalid token type', 'INVALID_TOKEN_TYPE')
      }

      // Check if user still exists and is active
      await this.validateTokenUser(decoded.sub)

      return decoded
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new AuthenticationError('Access token expired', 'TOKEN_EXPIRED')
      }
      if (error instanceof JsonWebTokenError) {
        throw new AuthenticationError('Invalid access token', 'INVALID_TOKEN')
      }
      throw error
    }
  }

  /**
   * Validate refresh token and generate new access token
   */
  public async refreshAccessToken(
    refreshToken: string,
    ipAddress: string,
    deviceInfo: string
  ): Promise<{ accessToken: string; newRefreshToken?: string; user: User }> {
    if (!refreshToken) {
      throw new AuthenticationError('Refresh token is required', 'TOKEN_MISSING')
    }

    const tokenHash = this.hashToken(refreshToken)
    const record = await this.getRefreshTokenRecord(tokenHash)

    if (!record || !record.isActive || record.expiresAt < new Date()) {
      throw new AuthenticationError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN')
    }

    // Get user information
    const user = await this.getUserById(record.userId)
    if (!user || !user.is_verified) {
      throw new AuthenticationError('User not found or not verified', 'USER_NOT_FOUND')
    }

    // Update last used timestamp
    await this.updateRefreshTokenUsage(record.id, ipAddress)

    // Generate new access token
    const accessToken = this.generateAccessToken(user)

    // Optional: Generate new refresh token for token rotation
    let newRefreshToken: string | undefined
    if (this.shouldRotateRefreshToken(record)) {
      const { token } = await this.generateRefreshToken(user, deviceInfo, ipAddress)
      newRefreshToken = token
      
      // Invalidate old refresh token
      await this.invalidateRefreshToken(record.id)
    }

    logger.info('Access token refreshed', {
      metadata: { 
        userId: user.id, 
        tokenId: record.id,
        rotated: !!newRefreshToken 
      }
    })

    return { accessToken, newRefreshToken, user }
  }

  /**
   * Generate password reset token
   */
  public generatePasswordResetToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      type: 'password_reset' as TokenType,
      iss: JWT_CONFIG.ISSUER,
      aud: JWT_CONFIG.AUDIENCE
    }

    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: '1h', // Password reset tokens expire in 1 hour
      algorithm: JWT_CONFIG.ALGORITHM
    } as any)
  }

  /**
   * Validate password reset token
   */
  public async validatePasswordResetToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        algorithms: [JWT_CONFIG.ALGORITHM],
        issuer: JWT_CONFIG.ISSUER,
        audience: JWT_CONFIG.AUDIENCE
      }) as TokenPayload

      if (decoded.type !== 'password_reset') {
        throw new AuthenticationError('Invalid token type', 'INVALID_TOKEN_TYPE')
      }

      return decoded
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new AuthenticationError('Password reset token expired', 'TOKEN_EXPIRED')
      }
      if (error instanceof JsonWebTokenError) {
        throw new AuthenticationError('Invalid password reset token', 'INVALID_TOKEN')
      }
      throw error
    }
  }

  /**
   * Generate email verification token
   */
  public generateEmailVerificationToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      type: 'email_verification' as TokenType,
      iss: JWT_CONFIG.ISSUER,
      aud: JWT_CONFIG.AUDIENCE
    }

    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: '24h', // Email verification tokens expire in 24 hours
      algorithm: JWT_CONFIG.ALGORITHM
    } as any)
  }

  /**
   * Invalidate all refresh tokens for a user (logout from all devices)
   */
  public async invalidateUserTokens(userId: string): Promise<void> {
    await this.invalidateAllUserRefreshTokens(userId)
    
    logger.info('All user tokens invalidated', {
      metadata: { userId }
    })
  }

  /**
   * Invalidate specific refresh token (logout from one device)
   */
  public async invalidateRefreshToken(tokenId: string): Promise<void> {
    // TODO: Implement database update
    logger.info('Refresh token invalidated', {
      metadata: { tokenId }
    })
  }

  /**
   * Get user role for authorization
   */
  private getUserRole(user: User): UserRole {
    // Check if user is admin (based on email domain or specific flag)
    if (user.email.endsWith('@directorybolt.com')) {
      return 'admin'
    }
    
    // Check for VA role (Virtual Assistant)
    // TODO: Add VA role logic based on subscription tier or specific flag
    if (user.subscription_tier === 'enterprise' && user.company_name?.toLowerCase().includes('assistant')) {
      return 'va'
    }
    
    return 'customer'
  }

  /**
   * Generate cryptographically secure token
   */
  private generateSecureToken(): string {
    return randomBytes(JWT_CONFIG.REFRESH_TOKEN_LENGTH).toString('hex')
  }

  /**
   * Hash token for secure storage
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  /**
   * Sanitize device information
   */
  private sanitizeDeviceInfo(deviceInfo: string): string {
    return deviceInfo.substring(0, 500).replace(/[<>]/g, '')
  }

  /**
   * Check if refresh token should be rotated
   */
  private shouldRotateRefreshToken(record: RefreshTokenRecord): boolean {
    const daysSinceCreation = (Date.now() - record.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceCreation > 3 // Rotate if token is older than 3 days
  }

  // Database operations (mock implementations - replace with actual database calls)
  private async storeRefreshToken(record: RefreshTokenRecord): Promise<void> {
    // TODO: Implement database storage
    // await db.refreshTokens.create({ data: record })
    logger.info('Refresh token stored', {
      metadata: { tokenId: record.id, userId: record.userId }
    })
  }

  private async getRefreshTokenRecord(tokenHash: string): Promise<RefreshTokenRecord | null> {
    // TODO: Implement database query
    // return await db.refreshTokens.findFirst({
    //   where: { tokenHash, isActive: true }
    // })
    
    // Mock implementation
    return null
  }

  private async updateRefreshTokenUsage(tokenId: string, ipAddress: string): Promise<void> {
    // TODO: Implement database update
    // await db.refreshTokens.update({
    //   where: { id: tokenId },
    //   data: { 
    //     lastUsedAt: new Date(),
    //     ipAddress
    //   }
    // })
    
    logger.info('Refresh token usage updated', {
      metadata: { tokenId, ipAddress }
    })
  }

  private async getUserById(userId: string): Promise<User | null> {
    // TODO: Implement database query
    // return await db.users.findFirst({ where: { id: userId } })
    
    // Mock user for development
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

  private async validateTokenUser(userId: string): Promise<void> {
    const user = await this.getUserById(userId)
    if (!user || !user.is_verified) {
      throw new AuthenticationError('User not found or not verified', 'USER_NOT_FOUND')
    }
  }

  private async invalidateAllUserRefreshTokens(userId: string): Promise<void> {
    // TODO: Implement database update
    // await db.refreshTokens.updateMany({
    //   where: { userId },
    //   data: { isActive: false }
    // })
    
    logger.info('All refresh tokens invalidated for user', {
      metadata: { userId }
    })
  }
}

// Export singleton instance
export const jwtManager = JWTManager.getInstance()

// Utility functions for middleware
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null
  
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null
  
  return parts[1]
}

export function extractTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = value
    return acc
  }, {} as Record<string, string>)
  
  return cookies.access_token || null
}

// Token expiry utilities
export function getTokenExpiry(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as any
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000)
    }
  } catch (error) {
    return null
  }
  return null
}

export function isTokenExpired(token: string): boolean {
  const expiry = getTokenExpiry(token)
  return expiry ? expiry < new Date() : true
}