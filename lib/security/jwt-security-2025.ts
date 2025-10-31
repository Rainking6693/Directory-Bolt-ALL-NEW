/**
 * JWT Security Implementation - 2025 Best Practices
 * Features: Short-lived access tokens, refresh token rotation, secure storage
 */

import jwt from 'jsonwebtoken';
import { NextApiRequest, NextApiResponse } from 'next';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

interface JWTPayload {
  customerId: string;
  packageType: string;
  permissions: string[];
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

interface RefreshTokenData {
  customerId: string;
  tokenFamily: string;
  version: number;
  createdAt: number;
  lastUsed: number;
}

class JWTSecurityManager {
  private readonly ACCESS_TOKEN_EXPIRY = '15m';  // 15 minutes
  private readonly REFRESH_TOKEN_EXPIRY = '7d';   // 7 days
  private readonly ISSUER = 'DirectoryBolt-API';
  private readonly AUDIENCE = 'DirectoryBolt-Extension';
  
  private activeRefreshTokens = new Map<string, RefreshTokenData>();
  private revokedTokens = new Set<string>(); // JWT IDs of revoked tokens
  private tokenFamilies = new Map<string, Set<string>>(); // customerId -> Set of tokenFamily IDs

  constructor(
    private accessTokenSecret: string,
    private refreshTokenSecret: string
  ) {
    if (!accessTokenSecret || !refreshTokenSecret) {
      throw new Error('JWT secrets are required');
    }

    // Clean up expired tokens every hour
    setInterval(() => this.cleanupExpiredTokens(), 60 * 60 * 1000);
  }

  generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>): TokenPair {
    const tokenFamily = this.generateTokenFamily();
    const jti = this.generateJTI(); // Unique token identifier
    
    // Generate short-lived access token
    const accessToken = jwt.sign(
      {
        ...payload,
        jti,
        tokenFamily,
        type: 'access'
      },
      this.accessTokenSecret,
      {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        issuer: this.ISSUER,
        audience: this.AUDIENCE,
        algorithm: 'HS256'
      }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      {
        customerId: payload.customerId,
        tokenFamily,
        type: 'refresh',
        jti: this.generateJTI()
      },
      this.refreshTokenSecret,
      {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        issuer: this.ISSUER,
        audience: this.AUDIENCE,
        algorithm: 'HS256'
      }
    );

    // Store refresh token data for rotation tracking
    const refreshTokenData: RefreshTokenData = {
      customerId: payload.customerId,
      tokenFamily,
      version: 1,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };
    
    this.activeRefreshTokens.set(tokenFamily, refreshTokenData);
    
    // Track token family for customer
    if (!this.tokenFamilies.has(payload.customerId)) {
      this.tokenFamilies.set(payload.customerId, new Set());
    }
    this.tokenFamilies.get(payload.customerId)!.add(tokenFamily);

    console.log(`🔑 Generated token pair for customer: ${payload.customerId} (family: ${tokenFamily})`);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      tokenType: 'Bearer'
    };
  }

  verifyAccessToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.ISSUER,
        audience: this.AUDIENCE,
        algorithms: ['HS256']
      }) as JWTPayload & { jti: string; type: string };

      // Check if token is revoked
      if (this.revokedTokens.has(decoded.jti)) {
        console.warn(`⚠️ Attempted use of revoked token: ${decoded.jti}`);
        return null;
      }

      // Verify token type
      if (decoded.type !== 'access') {
        console.warn(`⚠️ Invalid token type: ${decoded.type}`);
        return null;
      }

      return decoded;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Access token verification failed:', message);
      return null;
    }
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair | null> {
    try {
      const decoded = jwt.verify(refreshToken, this.refreshTokenSecret, {
        issuer: this.ISSUER,
        audience: this.AUDIENCE,
        algorithms: ['HS256']
      }) as any;

      // Verify token type
      if (decoded.type !== 'refresh') {
        console.warn(`⚠️ Invalid refresh token type: ${decoded.type}`);
        return null;
      }

      const tokenData = this.activeRefreshTokens.get(decoded.tokenFamily);
      if (!tokenData) {
        console.warn(`⚠️ Refresh token family not found: ${decoded.tokenFamily}`);
        return null;
      }

      // Check if refresh token family is still valid
      if (tokenData.customerId !== decoded.customerId) {
        console.warn(`⚠️ Customer ID mismatch for refresh token`);
        this.revokeTokenFamily(decoded.tokenFamily);
        return null;
      }

      // Rotate refresh token (invalidate old one, create new token pair)
      this.revokeTokenFamily(decoded.tokenFamily);

      // Get customer data for new token generation
      const customerData = await this.getCustomerDataForToken(decoded.customerId);
      if (!customerData) {
        console.error(`❌ Customer data not found for token refresh: ${decoded.customerId}`);
        return null;
      }

      console.log(`🔄 Token refresh successful for customer: ${decoded.customerId}`);
      return this.generateTokenPair(customerData);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Refresh token verification failed:', message);
      return null;
    }
  }

  revokeTokenFamily(tokenFamily: string): void {
    const tokenData = this.activeRefreshTokens.get(tokenFamily);
    if (tokenData) {
      // Remove from active tokens
      this.activeRefreshTokens.delete(tokenFamily);
      
      // Remove from customer's token families
      const customerFamilies = this.tokenFamilies.get(tokenData.customerId);
      if (customerFamilies) {
        customerFamilies.delete(tokenFamily);
        if (customerFamilies.size === 0) {
          this.tokenFamilies.delete(tokenData.customerId);
        }
      }
      
      console.log(`🗑️ Revoked token family: ${tokenFamily} for customer: ${tokenData.customerId}`);
    }
  }

  revokeAllCustomerTokens(customerId: string): void {
    const customerFamilies = this.tokenFamilies.get(customerId);
    if (customerFamilies) {
      for (const tokenFamily of customerFamilies) {
        this.activeRefreshTokens.delete(tokenFamily);
      }
      this.tokenFamilies.delete(customerId);
      console.log(`🗑️ Revoked all tokens for customer: ${customerId}`);
    }
  }

  // Middleware for protecting API routes
  async authenticateRequest(req: NextApiRequest): Promise<JWTPayload | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    return this.verifyAccessToken(token);
  }

  // Helper method to get customer data (would integrate with your customer service)
  private async getCustomerDataForToken(customerId: string): Promise<Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'> | null> {
    try {
      // This would integrate with your SupabaseService
      // For now, return basic structure - you'd fetch real customer data
      return {
        customerId,
        packageType: 'starter', // Would be fetched from database
        permissions: ['read:directories', 'submit:business'] // Based on package type
      };
    } catch (error) {
      console.error('❌ Failed to get customer data for token:', error);
      return null;
    }
  }

  private generateTokenFamily(): string {
    return `tf_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateJTI(): string {
    return `jti_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private cleanupExpiredTokens(): void {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    let cleaned = 0;
    for (const [tokenFamily, tokenData] of this.activeRefreshTokens.entries()) {
      if (now - tokenData.createdAt > sevenDaysMs) {
        this.revokeTokenFamily(tokenFamily);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 JWT cleanup: removed ${cleaned} expired token families`);
    }
  }

  // Security monitoring
  getSecurityStats() {
    return {
      activeRefreshTokens: this.activeRefreshTokens.size,
      revokedTokenJTIs: this.revokedTokens.size,
      activeCustomers: this.tokenFamilies.size,
      totalTokenFamilies: Array.from(this.tokenFamilies.values()).reduce((sum, families) => sum + families.size, 0)
    };
  }

  // Create secure HTTP-only cookie options
  getSecureCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    };
  }
}

// Export singleton instance
const jwtManager = new JWTSecurityManager(
  process.env.JWT_ACCESS_SECRET || 'your-access-secret-change-this',
  process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-this'
);

export default jwtManager;
export { JWTSecurityManager, type JWTPayload, type TokenPair };