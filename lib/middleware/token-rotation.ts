// @ts-nocheck
// 🔄 TOKEN ROTATION MIDDLEWARE - AUTH-005
// Automatic JWT token refresh and rotation system
// Implements secure token lifecycle management with automatic renewal

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Token configuration
const TOKEN_CONFIG = {
  // Token lifespans
  accessTokenExpiry: '15m',      // 15 minutes
  refreshTokenExpiry: '7d',      // 7 days
  rotationThreshold: 5 * 60 * 1000, // Rotate if less than 5 minutes remaining
  
  // Security settings
  issuer: 'directorybolt.com',
  audience: 'directorybolt-users',
  algorithm: 'HS256' as const,
  
  // Secrets (from environment)
  accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'fallback-access-secret',
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
  
  // Token storage (use Redis in production)
  refreshTokenStore: new Map<string, RefreshTokenData>(),
  
  // Cleanup interval
  cleanupInterval: 60 * 60 * 1000, // 1 hour
};

// Token interfaces
interface TokenPayload {
  sub: string;           // User ID
  email: string;
  role: string;
  userType: 'customer' | 'staff';
  permissions: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  jti: string;           // JWT ID for tracking
}

interface RefreshTokenData {
  userId: string;
  tokenId: string;
  issuedAt: number;
  expiresAt: number;
  lastUsed: number;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  rotationCount: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

// Token manager class
class TokenManager {
  private static instance: TokenManager;
  private cleanupTimer: NodeJS.Timeout | null = null;
  
  constructor() {
    this.startCleanupTimer();
  }
  
  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }
  
  // Generate new token pair
  generateTokenPair(
    userId: string,
    email: string,
    role: string,
    userType: 'customer' | 'staff',
    permissions: string[],
    ipAddress: string,
    userAgent: string
  ): TokenPair {
    const tokenId = this.generateTokenId();
    const now = Math.floor(Date.now() / 1000);
    
    // Create access token payload
    const accessPayload: TokenPayload = {
      sub: userId,
      email,
      role,
      userType,
      permissions,
      iat: now,
      exp: now + this.parseExpiry(TOKEN_CONFIG.accessTokenExpiry),
      iss: TOKEN_CONFIG.issuer,
      aud: TOKEN_CONFIG.audience,
      jti: tokenId
    };
    
    // Generate tokens
    const accessToken = jwt.sign(accessPayload, TOKEN_CONFIG.accessTokenSecret, {
      algorithm: TOKEN_CONFIG.algorithm
    });
    
    const refreshToken = this.generateRefreshToken(tokenId, userId);
    
    // Store refresh token data
    const refreshTokenData: RefreshTokenData = {
      userId,
      tokenId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + this.parseExpiry(TOKEN_CONFIG.refreshTokenExpiry) * 1000,
      lastUsed: Date.now(),
      ipAddress,
      userAgent,
      isActive: true,
      rotationCount: 0
    };
    
    TOKEN_CONFIG.refreshTokenStore.set(tokenId, refreshTokenData);
    
    console.log('✅ Token pair generated', {
      userId,
      tokenId,
      userType,
      expiresAt: new Date(refreshTokenData.expiresAt).toISOString()
    });
    
    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(TOKEN_CONFIG.accessTokenExpiry),
      tokenType: 'Bearer'
    };
  }
  
  // Validate and decode access token
  validateAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, TOKEN_CONFIG.accessTokenSecret, {
        algorithms: [TOKEN_CONFIG.algorithm],
        issuer: TOKEN_CONFIG.issuer,
        audience: TOKEN_CONFIG.audience
      }) as TokenPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.log('🔄 Access token expired, rotation needed');
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.warn('⚠️ Invalid access token', { error: error.message });
      }
      return null;
    }
  }
  
  // Check if token needs rotation
  shouldRotateToken(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as TokenPayload;
      if (!decoded || !decoded.exp) return true;
      
      const expiresAt = decoded.exp * 1000;
      const timeUntilExpiry = expiresAt - Date.now();
      
      return timeUntilExpiry < TOKEN_CONFIG.rotationThreshold;
    } catch (error) {
      return true; // Rotate if we can't decode
    }
  }
  
  // Rotate tokens using refresh token
  async rotateTokens(refreshToken: string, ipAddress: string, userAgent: string): Promise<TokenPair | null> {
    try {
      // Decode refresh token to get token ID
      const decoded = jwt.verify(refreshToken, TOKEN_CONFIG.refreshTokenSecret) as { jti: string };
      const tokenId = decoded.jti;
      
      // Get refresh token data
      const refreshData = TOKEN_CONFIG.refreshTokenStore.get(tokenId);
      if (!refreshData || !refreshData.isActive) {
        console.warn('⚠️ Invalid or inactive refresh token', { tokenId });
        return null;
      }
      
      // Check if refresh token is expired
      if (Date.now() > refreshData.expiresAt) {
        console.warn('⚠️ Refresh token expired', { tokenId });
        this.revokeRefreshToken(tokenId);
        return null;
      }
      
      // Security check: IP and user agent validation (optional)
      if (process.env.STRICT_TOKEN_VALIDATION === 'true') {
        if (refreshData.ipAddress !== ipAddress) {
          console.warn('⚠️ IP address mismatch during token rotation', {
            tokenId,
            originalIP: refreshData.ipAddress,
            currentIP: ipAddress
          });
          // Optionally revoke token for security
          // this.revokeRefreshToken(tokenId);
          // return null;
        }
      }
      
      // Get user data for new tokens
      const userData = await this.getUserData(refreshData.userId);
      if (!userData) {
        console.warn('⚠️ User not found during token rotation', { userId: refreshData.userId });
        return null;
      }
      
      // Update refresh token usage
      refreshData.lastUsed = Date.now();
      refreshData.rotationCount++;
      TOKEN_CONFIG.refreshTokenStore.set(tokenId, refreshData);
      
      // Generate new token pair
      const newTokenPair = this.generateTokenPair(
        userData.id,
        userData.email,
        userData.role,
        userData.userType,
        userData.permissions,
        ipAddress,
        userAgent
      );
      
      // Revoke old refresh token
      this.revokeRefreshToken(tokenId);
      
      console.log('🔄 Tokens rotated successfully', {
        userId: userData.id,
        oldTokenId: tokenId,
        rotationCount: refreshData.rotationCount
      });
      
      return newTokenPair;
      
    } catch (error) {
      console.error('❌ Token rotation failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }
  
  // Revoke refresh token
  revokeRefreshToken(tokenId: string): boolean {
    const refreshData = TOKEN_CONFIG.refreshTokenStore.get(tokenId);
    if (refreshData) {
      refreshData.isActive = false;
      TOKEN_CONFIG.refreshTokenStore.set(tokenId, refreshData);
      
      console.log('🗑️ Refresh token revoked', { tokenId });
      return true;
    }
    return false;
  }
  
  // Revoke all user tokens
  revokeAllUserTokens(userId: string): number {
    let revokedCount = 0;
    
    for (const [tokenId, refreshData] of TOKEN_CONFIG.refreshTokenStore.entries()) {
      if (refreshData.userId === userId && refreshData.isActive) {
        refreshData.isActive = false;
        TOKEN_CONFIG.refreshTokenStore.set(tokenId, refreshData);
        revokedCount++;
      }
    }
    
    console.log('🗑️ All user tokens revoked', { userId, revokedCount });
    return revokedCount;
  }
  
  // Get active tokens for user
  getUserActiveTokens(userId: string): RefreshTokenData[] {
    const userTokens: RefreshTokenData[] = [];
    const now = Date.now();
    
    for (const refreshData of TOKEN_CONFIG.refreshTokenStore.values()) {
      if (refreshData.userId === userId && refreshData.isActive && now < refreshData.expiresAt) {
        userTokens.push(refreshData);
      }
    }
    
    return userTokens;
  }
  
  // Generate secure token ID
  private generateTokenId(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  // Generate refresh token
  private generateRefreshToken(tokenId: string, userId: string): string {
    const payload = {
      jti: tokenId,
      sub: userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    };
    
    return jwt.sign(payload, TOKEN_CONFIG.refreshTokenSecret, {
      algorithm: TOKEN_CONFIG.algorithm,
      expiresIn: TOKEN_CONFIG.refreshTokenExpiry
    });
  }
  
  // Parse expiry string to seconds
  private parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 900; // 15 minutes default
    }
  }
  
  // Get user data (mock implementation)
  private async getUserData(userId: string): Promise<{
    id: string;
    email: string;
    role: string;
    userType: 'customer' | 'staff';
    permissions: string[];
  } | null> {
    // TODO: Implement actual user data retrieval
    // This would typically query the database
    
    // Mock user data for development
    if (userId === 'staff-user') {
      return {
        id: userId,
        email: 'ben.stone@directorybolt.com',
        role: 'manager',
        userType: 'staff',
        permissions: ['queue', 'processing', 'analytics', 'support']
      };
    }
    
    // Mock customer user
    return {
      id: userId,
      email: 'customer@example.com',
      role: 'professional',
      userType: 'customer',
      permissions: ['premium_features', 'priority_support']
    };
  }
  
  // Cleanup expired tokens
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [tokenId, refreshData] of TOKEN_CONFIG.refreshTokenStore.entries()) {
      if (now > refreshData.expiresAt) {
        TOKEN_CONFIG.refreshTokenStore.delete(tokenId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log('🧹 Cleaned up expired tokens', {
        cleanedCount,
        remainingTokens: TOKEN_CONFIG.refreshTokenStore.size
      });
    }
  }
  
  // Start automatic cleanup timer
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredTokens();
    }, TOKEN_CONFIG.cleanupInterval);
  }
  
  // Stop cleanup timer
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Middleware for automatic token rotation
export function withTokenRotation() {
  return function middleware(
    handler: (req: NextApiRequest & { user?: TokenPayload; newTokens?: TokenPair }, res: NextApiResponse) => Promise<void> | void
  ) {
    return async function wrappedHandler(
      req: NextApiRequest & { user?: TokenPayload; newTokens?: TokenPair },
      res: NextApiResponse
    ) {
      const tokenManager = TokenManager.getInstance();
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const accessToken = authHeader.substring(7);
        
        // Validate current token
        const tokenPayload = tokenManager.validateAccessToken(accessToken);
        
        if (tokenPayload) {
          // Token is valid, attach user data
          req.user = tokenPayload;
          
          // Check if token needs rotation
          if (tokenManager.shouldRotateToken(accessToken)) {
            const refreshToken = req.headers['x-refresh-token'] as string;
            
            if (refreshToken) {
              const clientIP = getClientIP(req);
              const userAgent = req.headers['user-agent'] || '';
              
              const newTokens = await tokenManager.rotateTokens(refreshToken, clientIP, userAgent);
              
              if (newTokens) {
                req.newTokens = newTokens;
                
                // Set new tokens in response headers
                res.setHeader('X-New-Access-Token', newTokens.accessToken);
                res.setHeader('X-New-Refresh-Token', newTokens.refreshToken);
                res.setHeader('X-Token-Rotated', 'true');
                
                console.log('🔄 Token rotation completed', {
                  userId: tokenPayload.sub,
                  newExpiresIn: newTokens.expiresIn
                });
              }
            }
          }
        } else {
          // Token is invalid or expired
          return res.status(401).json({
            error: 'Authentication Required',
            message: 'Access token is invalid or expired. Please refresh your token.',
            code: 'TOKEN_INVALID'
          });
        }
      }
      
      // Continue to the actual handler
      return handler(req, res);
    };
  };
}

// Token refresh endpoint helper
export async function handleTokenRefresh(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Refresh token is required'
    });
  }
  
  const tokenManager = TokenManager.getInstance();
  const clientIP = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  
  const newTokens = await tokenManager.rotateTokens(refreshToken, clientIP, userAgent);
  
  if (newTokens) {
    res.status(200).json({
      success: true,
      data: newTokens
    });
  } else {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired refresh token'
    });
  }
}

// Get client IP address
function getClientIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  
  if (typeof realIP === 'string') {
    return realIP;
  }
  
  if (typeof cfConnectingIP === 'string') {
    return cfConnectingIP;
  }
  
  return req.socket.remoteAddress || 'unknown';
}

// Export token manager for direct use
export { TokenManager, TOKEN_CONFIG };
export type { TokenPayload, RefreshTokenData, TokenPair };