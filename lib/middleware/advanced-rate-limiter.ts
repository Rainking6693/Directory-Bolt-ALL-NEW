/**
 * Advanced Rate Limiting Middleware - 2025 Best Practices
 * Implements multi-tier rate limiting with IP-based, user-based, and endpoint-specific limits
 * Features: sliding window, token bucket, automatic threat detection
 */

import { NextApiRequest, NextApiResponse } from 'next';

interface RateLimitConfig {
  windowMs: number;           // Time window in milliseconds
  maxRequests: number;        // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: NextApiRequest) => string;
  skipIf?: (req: NextApiRequest) => boolean;
  onLimitReached?: (req: NextApiRequest, res: NextApiResponse) => void;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  tokenBucket: number;
  lastRefill: number;
  suspiciousActivity: number;
}

class AdvancedRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private suspiciousIPs = new Set<string>();
  private blockedIPs = new Map<string, number>(); // IP -> unblock timestamp
  
  constructor(private config: RateLimitConfig) {
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  async limit(req: NextApiRequest, res: NextApiResponse): Promise<boolean> {
    const key = this.config.keyGenerator?.(req) || this.getDefaultKey(req);
    const ip = this.getClientIP(req);
    
    // Check if IP is blocked
    if (this.isIPBlocked(ip)) {
      this.sendRateLimitResponse(res, 'IP temporarily blocked due to suspicious activity', 429);
      return false;
    }

    // Check if IP is marked as suspicious
    if (this.suspiciousIPs.has(ip)) {
      // Apply stricter limits for suspicious IPs
      return this.checkSuspiciousIPLimits(req, res, key);
    }

    // Skip if configured to do so
    if (this.config.skipIf?.(req)) {
      return true;
    }

    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        tokenBucket: this.config.maxRequests,
        lastRefill: now,
        suspiciousActivity: 0
      };
      this.store.set(key, entry);
    }

    // Token bucket refill (for burst handling)
    this.refillTokenBucket(entry, now);

    // Reset window if expired
    if (now > entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + this.config.windowMs;
      entry.suspiciousActivity = Math.max(0, entry.suspiciousActivity - 1);
    }

    // Check limits
    if (entry.count >= this.config.maxRequests || entry.tokenBucket <= 0) {
      entry.suspiciousActivity += 1;
      
      // Mark IP as suspicious if repeated violations
      if (entry.suspiciousActivity >= 3) {
        this.suspiciousIPs.add(ip);
        console.warn(`🚨 IP marked as suspicious: ${ip} (key: ${key})`);
      }

      // Block IP if extremely suspicious
      if (entry.suspiciousActivity >= 10) {
        this.blockedIPs.set(ip, now + (30 * 60 * 1000)); // Block for 30 minutes
        console.error(`🚫 IP blocked: ${ip} for 30 minutes`);
      }

      this.sendRateLimitResponse(res, 'Rate limit exceeded', 429);
      return false;
    }

    // Increment counters
    entry.count += 1;
    entry.tokenBucket -= 1;

    // Add rate limit headers
    this.addRateLimitHeaders(res, entry);

    return true;
  }

  private checkSuspiciousIPLimits(req: NextApiRequest, res: NextApiResponse, key: string): boolean {
    // Apply 10x stricter limits for suspicious IPs
    const strictConfig = {
      ...this.config,
      maxRequests: Math.max(1, Math.floor(this.config.maxRequests / 10))
    };

    const entry = this.store.get(key);
    if (entry && entry.count >= strictConfig.maxRequests) {
      this.sendRateLimitResponse(res, 'Rate limit exceeded - suspicious activity detected', 429);
      return false;
    }

    return true;
  }

  private refillTokenBucket(entry: RateLimitEntry, now: number): void {
    const timePassed = now - entry.lastRefill;
    const tokensToAdd = Math.floor(timePassed / 1000); // 1 token per second
    
    entry.tokenBucket = Math.min(
      this.config.maxRequests,
      entry.tokenBucket + tokensToAdd
    );
    entry.lastRefill = now;
  }

  private isIPBlocked(ip: string): boolean {
    const blockedUntil = this.blockedIPs.get(ip);
    if (!blockedUntil) return false;
    
    if (Date.now() > blockedUntil) {
      this.blockedIPs.delete(ip);
      this.suspiciousIPs.delete(ip);
      return false;
    }
    
    return true;
  }

  private getClientIP(req: NextApiRequest): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const ip = forwarded?.split(',')[0]?.trim() || 
               req.headers['x-real-ip'] as string ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               'unknown';
    return ip;
  }

  private getDefaultKey(req: NextApiRequest): string {
    const ip = this.getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const endpoint = req.url || '';
    
    // Create composite key for more granular rate limiting
    return `${ip}:${endpoint}:${Buffer.from(userAgent).toString('base64').slice(0, 10)}`;
  }

  private addRateLimitHeaders(res: NextApiResponse, entry: RateLimitEntry): void {
    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const resetTime = Math.ceil(entry.resetTime / 1000);
    
    res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);
    res.setHeader('X-RateLimit-Window', this.config.windowMs / 1000);
  }

  private sendRateLimitResponse(res: NextApiResponse, message: string, status: number): void {
    res.status(status).json({
      error: message,
      retryAfter: Math.ceil(this.config.windowMs / 1000),
      timestamp: new Date().toISOString()
    });
  }

  private cleanup(): void {
    const now = Date.now();
    
    // Clean expired rate limit entries
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime + this.config.windowMs) {
        this.store.delete(key);
      }
    }

    // Clean expired blocked IPs
    for (const [ip, blockedUntil] of this.blockedIPs.entries()) {
      if (now > blockedUntil) {
        this.blockedIPs.delete(ip);
        this.suspiciousIPs.delete(ip);
      }
    }

    console.log(`🧹 Rate limiter cleanup: ${this.store.size} active entries, ${this.blockedIPs.size} blocked IPs`);
  }

  // Get statistics for monitoring
  getStats() {
    return {
      activeKeys: this.store.size,
      suspiciousIPs: this.suspiciousIPs.size,
      blockedIPs: this.blockedIPs.size,
      totalRequests: Array.from(this.store.values()).reduce((sum, entry) => sum + entry.count, 0)
    };
  }
}

// Pre-configured rate limiters for different use cases
export const extensionRateLimiter = new AdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,          // 100 requests per 15 minutes per IP+endpoint
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || 
               req.connection?.remoteAddress || 'unknown';
    const customerId = req.body?.customerId || req.query?.customerId || 'anonymous';
    return `extension:${ip}:${customerId}`;
  }
});

export const apiRateLimiter = new AdvancedRateLimiter({
  windowMs: 60 * 1000,      // 1 minute
  maxRequests: 60,          // 60 requests per minute
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || 
               req.connection?.remoteAddress || 'unknown';
    return `api:${ip}`;
  }
});

export const customerLookupRateLimiter = new AdvancedRateLimiter({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  maxRequests: 50,          // 50 lookups per 5 minutes
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || 
               req.connection?.remoteAddress || 'unknown';
    return `lookup:${ip}`;
  }
});

export { AdvancedRateLimiter };