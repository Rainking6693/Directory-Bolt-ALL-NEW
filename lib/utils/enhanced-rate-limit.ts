// 🔒 ENHANCED RATE LIMITING - Multi-tier rate limiting with abuse prevention
// Advanced rate limiting with user tiers, adaptive limits, and comprehensive abuse detection

import { logger } from './logger'
import { RateLimitError } from './errors'

export interface RateLimitTier {
  name: string
  limits: {
    requestsPerMinute: number
    requestsPerHour: number
    requestsPerDay: number
    burstLimit: number
    concurrentRequests: number
  }
  features: {
    priority: number
    cacheTTL: number
    queuePosition: 'front' | 'normal' | 'back'
    bypassCooldown: boolean
  }
}

export interface RateLimitContext {
  userId?: string
  apiKey?: string
  ipAddress: string
  userAgent: string
  endpoint: string
  tier: string
  timestamp: number
  requestSize?: number
  cost?: number // For weighted rate limiting
}

export interface RateLimitResult {
  allowed: boolean
  tier: string
  limits: RateLimitTier['limits']
  remaining: {
    minute: number
    hour: number
    day: number
    burst: number
    concurrent: number
  }
  resetTimes: {
    minute: number
    hour: number
    day: number
    burst: number
  }
  retryAfter?: number
  reason?: string
  warnings?: string[]
  suspicionScore: number
}

export interface AbuseDetectionResult {
  isSuspicious: boolean
  score: number
  reasons: string[]
  actions: ('warn' | 'throttle' | 'block' | 'captcha' | 'review')[]
  confidence: number
}

// Rate limit tiers configuration
export const RATE_LIMIT_TIERS: Record<string, RateLimitTier> = {
  free: {
    name: 'Free Tier',
    limits: {
      requestsPerMinute: 5,
      requestsPerHour: 50,
      requestsPerDay: 200,
      burstLimit: 10,
      concurrentRequests: 2
    },
    features: {
      priority: 3,
      cacheTTL: 300, // 5 minutes
      queuePosition: 'back',
      bypassCooldown: false
    }
  },
  basic: {
    name: 'Basic Tier',
    limits: {
      requestsPerMinute: 15,
      requestsPerHour: 200,
      requestsPerDay: 1000,
      burstLimit: 25,
      concurrentRequests: 5
    },
    features: {
      priority: 2,
      cacheTTL: 180, // 3 minutes
      queuePosition: 'normal',
      bypassCooldown: false
    }
  },
  premium: {
    name: 'Premium Tier',
    limits: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      burstLimit: 100,
      concurrentRequests: 15
    },
    features: {
      priority: 1,
      cacheTTL: 60, // 1 minute
      queuePosition: 'front',
      bypassCooldown: true
    }
  },
  enterprise: {
    name: 'Enterprise Tier',
    limits: {
      requestsPerMinute: 200,
      requestsPerHour: 5000,
      requestsPerDay: 50000,
      burstLimit: 500,
      concurrentRequests: 50
    },
    features: {
      priority: 0,
      cacheTTL: 30, // 30 seconds
      queuePosition: 'front',
      bypassCooldown: true
    }
  },
  internal: {
    name: 'Internal/Admin',
    limits: {
      requestsPerMinute: 1000,
      requestsPerHour: 10000,
      requestsPerDay: 100000,
      burstLimit: 2000,
      concurrentRequests: 100
    },
    features: {
      priority: -1,
      cacheTTL: 0, // No cache
      queuePosition: 'front',
      bypassCooldown: true
    }
  }
}

// Endpoint-specific rate limit multipliers
export const ENDPOINT_MULTIPLIERS: Record<string, number> = {
  '/api/analyze': 1.0,        // Standard rate
  '/api/submit': 0.5,         // Stricter for submissions
  '/api/auth/login': 2.0,     // More lenient for auth
  '/api/auth/register': 0.3,  // Very strict for registration
  '/api/status': 5.0,         // Very lenient for status checks
  '/api/directories': 3.0,    // Lenient for directory browsing
  '/api/payments': 0.8        // Slightly strict for payments
}

// IP ranges for special handling
const TRUSTED_IP_RANGES = [
  '127.0.0.1',      // Localhost
  '10.0.0.0/8',     // Internal network
  '172.16.0.0/12',  // Internal network
  '192.168.0.0/16', // Internal network
]

const SUSPICIOUS_IP_RANGES = [
  // Add known bot/scraper IP ranges
  '169.254.0.0/16', // AWS metadata
]

export class EnhancedRateLimit {
  private requestStore: Map<string, any>
  private concurrentRequests: Map<string, Set<string>>
  private suspiciousActivity: Map<string, any>
  private blocklist: Map<string, { until: number; reason: string }>
  private allowlist: Set<string>
  private adaptiveLimits: Map<string, any>
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    this.requestStore = new Map()
    this.concurrentRequests = new Map()
    this.suspiciousActivity = new Map()
    this.blocklist = new Map()
    this.allowlist = new Set()
    this.adaptiveLimits = new Map()

    // Initialize trusted IPs
    TRUSTED_IP_RANGES.forEach(ip => this.allowlist.add(ip))

    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  async checkRateLimit(context: RateLimitContext): Promise<RateLimitResult> {
    const startTime = Date.now()
    
    try {
      // Check if IP is blocked
      const blockCheck = this.checkBlocklist(context.ipAddress)
      if (!blockCheck.allowed) {
        return {
          allowed: false,
          tier: context.tier,
          limits: RATE_LIMIT_TIERS[context.tier].limits,
          remaining: this.getZeroRemaining(),
          resetTimes: this.getResetTimes(),
          retryAfter: Math.ceil((blockCheck.until! - Date.now()) / 1000),
          reason: `IP blocked: ${blockCheck.reason}`,
          suspicionScore: 100
        }
      }

      // Check allowlist
      if (this.allowlist.has(context.ipAddress)) {
        return this.getAllowedResult(context, 'Allowlisted IP')
      }

      // Perform abuse detection
      const abuseResult = await this.detectAbuse(context)
      
      if (abuseResult.isSuspicious && abuseResult.score > 80) {
        // Block suspicious activity immediately
        this.blockIP(context.ipAddress, 'Suspicious activity detected', 24 * 60 * 60 * 1000) // 24 hours
        
        return {
          allowed: false,
          tier: context.tier,
          limits: RATE_LIMIT_TIERS[context.tier].limits,
          remaining: this.getZeroRemaining(),
          resetTimes: this.getResetTimes(),
          reason: 'Suspicious activity detected',
          suspicionScore: abuseResult.score
        }
      }

      // Get tier configuration
      const tierConfig = RATE_LIMIT_TIERS[context.tier] || RATE_LIMIT_TIERS.free
      
      // Apply endpoint multipliers
      const endpointMultiplier = ENDPOINT_MULTIPLIERS[context.endpoint] || 1.0
      const adjustedLimits = this.applyMultiplier(tierConfig.limits, endpointMultiplier)

      // Apply adaptive limits based on system load
      const adaptiveLimits = this.getAdaptiveLimits(context, adjustedLimits)

      // Check rate limits
      const rateLimitResult = await this.checkAllLimits(context, adaptiveLimits)

      // Apply abuse score adjustments
      if (abuseResult.isSuspicious) {
        rateLimitResult.suspicionScore = abuseResult.score
        rateLimitResult.warnings = abuseResult.reasons
        
        // Reduce limits for suspicious users
        if (abuseResult.score > 50) {
          const reduction = abuseResult.score / 100 * 0.5 // Up to 50% reduction
          rateLimitResult.remaining = this.reduceLimits(rateLimitResult.remaining, reduction)
        }
      }

      // Log significant events
      if (!rateLimitResult.allowed || abuseResult.isSuspicious) {
        logger.warn('Rate limit or abuse detection triggered', {
          metadata: {
            ipAddress: context.ipAddress,
            tier: context.tier,
            endpoint: context.endpoint,
            allowed: rateLimitResult.allowed,
            suspicionScore: abuseResult.score,
            reasons: abuseResult.reasons,
            processingTime: Date.now() - startTime
          }
        })
      }

      return rateLimitResult

    } catch (error) {
      logger.error('Rate limit check failed', {
        metadata: {
          ipAddress: context.ipAddress,
          tier: context.tier,
          endpoint: context.endpoint,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : new Error(String(error)))

      // Fail open with basic limits
      return this.getFailsafeResult(context)
    }
  }

  private async detectAbuse(context: RateLimitContext): Promise<AbuseDetectionResult> {
    let score = 0
    const reasons: string[] = []
    const actions: AbuseDetectionResult['actions'] = []

    // Check request patterns
    const ipKey = context.ipAddress
    const activity = this.suspiciousActivity.get(ipKey) || {
      requests: [],
      userAgents: new Set(),
      endpoints: new Map(),
      firstSeen: Date.now(),
      totalRequests: 0
    }

    activity.requests.push(context.timestamp)
    activity.userAgents.add(context.userAgent)
    activity.totalRequests++

    const endpointCount = activity.endpoints.get(context.endpoint) || 0
    activity.endpoints.set(context.endpoint, endpointCount + 1)

    // Pattern 1: Rapid fire requests
    const recentRequests = activity.requests.filter((t: number) => 
      context.timestamp - t < 60000 // Last minute
    ).length

    if (recentRequests > 30) {
      score += 30
      reasons.push('Rapid fire requests detected')
      actions.push('throttle')
    }

    // Pattern 2: Multiple user agents from same IP
    if (activity.userAgents.size > 5 && activity.totalRequests > 20) {
      score += 25
      reasons.push('Multiple user agents from same IP')
      actions.push('warn')
    }

    // Pattern 3: Bot-like user agent
    const userAgent = context.userAgent.toLowerCase()
    const botPatterns = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python', 'requests']
    const hasBotPattern = botPatterns.some(pattern => userAgent.includes(pattern))
    const hasLegitimateBot = ['googlebot', 'bingbot', 'facebookexternalhit'].some(bot => 
      userAgent.includes(bot)
    )

    if (hasBotPattern && !hasLegitimateBot) {
      score += 20
      reasons.push('Bot-like user agent detected')
      actions.push('captcha')
    }

    // Pattern 4: Suspicious endpoint patterns
    const analyzeRequests = activity.endpoints.get('/api/analyze') || 0
    if (analyzeRequests > 20 && (Date.now() - activity.firstSeen) < 3600000) { // 20 requests in 1 hour
      score += 20
      reasons.push('Excessive analysis requests')
      actions.push('throttle')
    }

    // Pattern 5: Known suspicious IP ranges
    if (SUSPICIOUS_IP_RANGES.some(range => context.ipAddress.startsWith(range.split('/')[0]))) {
      score += 15
      reasons.push('Request from suspicious IP range')
      actions.push('review')
    }

    // Pattern 6: No referrer and suspicious patterns
    if (!context.userAgent || context.userAgent.length < 10) {
      score += 10
      reasons.push('Minimal or missing user agent')
    }

    // Pattern 7: Sequential IP addresses (potential botnet)
    const ipParts = context.ipAddress.split('.')
    if (ipParts.length === 4) {
      const lastOctet = parseInt(ipParts[3])
      const baseIP = ipParts.slice(0, 3).join('.')
      
      // Check for recent requests from similar IPs
      let sequentialIPs = 0
      for (let i = Math.max(0, lastOctet - 10); i <= Math.min(255, lastOctet + 10); i++) {
        const testIP = `${baseIP}.${i}`
        if (this.suspiciousActivity.has(testIP) && testIP !== context.ipAddress) {
          sequentialIPs++
        }
      }
      
      if (sequentialIPs > 3) {
        score += 25
        reasons.push('Sequential IP addresses detected (potential botnet)')
        actions.push('block')
      }
    }

    // Pattern 8: Time-based patterns
    const requestTimes = activity.requests.slice(-10) // Last 10 requests
    if (requestTimes.length >= 5) {
      const intervals = []
      for (let i = 1; i < requestTimes.length; i++) {
        intervals.push(requestTimes[i] - requestTimes[i - 1])
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const stdDev = Math.sqrt(intervals.reduce((sum, interval) => 
        sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length)
      
      // Very consistent intervals suggest automation
      if (stdDev < avgInterval * 0.1 && avgInterval < 10000) { // Less than 10% variation and < 10s intervals
        score += 20
        reasons.push('Highly consistent request timing (automation detected)')
        actions.push('captcha')
      }
    }

    // Update activity tracking
    this.suspiciousActivity.set(ipKey, activity)

    // Determine final actions based on score
    if (score >= 80) {
      actions.push('block')
    } else if (score >= 60) {
      actions.push('throttle')
    } else if (score >= 40) {
      actions.push('captcha')
    } else if (score >= 20) {
      actions.push('warn')
    }

    return {
      isSuspicious: score > 30,
      score,
      reasons,
      actions: Array.from(new Set(actions)), // Remove duplicates
      confidence: Math.min(100, score * 1.2)
    }
  }

  private async checkAllLimits(
    context: RateLimitContext, 
    limits: RateLimitTier['limits']
  ): Promise<RateLimitResult> {
    const identifier = this.getIdentifier(context)
    const now = Date.now()

    // Initialize tracking data
    const key = `${identifier}:${context.endpoint}`
    let data = this.requestStore.get(key) || {
      minute: { count: 0, resetTime: now + 60 * 1000 },
      hour: { count: 0, resetTime: now + 60 * 60 * 1000 },
      day: { count: 0, resetTime: now + 24 * 60 * 60 * 1000 },
      burst: { count: 0, resetTime: now + 10 * 1000 }, // 10 second burst window
    }

    // Reset windows if expired
    if (now > data.minute.resetTime) {
      data.minute = { count: 0, resetTime: now + 60 * 1000 }
    }
    if (now > data.hour.resetTime) {
      data.hour = { count: 0, resetTime: now + 60 * 60 * 1000 }
    }
    if (now > data.day.resetTime) {
      data.day = { count: 0, resetTime: now + 24 * 60 * 60 * 1000 }
    }
    if (now > data.burst.resetTime) {
      data.burst = { count: 0, resetTime: now + 10 * 1000 }
    }

    // Check concurrent requests
    const concurrentKey = `${identifier}:concurrent`
    const currentConcurrent = this.concurrentRequests.get(concurrentKey) || new Set()
    const requestId = `${now}:${Math.random()}`

    // Check all limits
    const checks = [
      { period: 'minute', current: data.minute.count, limit: limits.requestsPerMinute },
      { period: 'hour', current: data.hour.count, limit: limits.requestsPerHour },
      { period: 'day', current: data.day.count, limit: limits.requestsPerDay },
      { period: 'burst', current: data.burst.count, limit: limits.burstLimit },
      { period: 'concurrent', current: currentConcurrent.size, limit: limits.concurrentRequests }
    ]

    // Find the first limit that would be exceeded
    for (const check of checks) {
      if (check.current >= check.limit) {
        const resetTime = check.period === 'concurrent' ? now + 1000 : 
                         data[check.period as keyof typeof data]?.resetTime || now + 1000
        
        return {
          allowed: false,
          tier: context.tier,
          limits,
          remaining: this.calculateRemaining(data, limits, currentConcurrent.size),
          resetTimes: this.getResetTimes(data),
          retryAfter: Math.ceil((resetTime - now) / 1000),
          reason: `${check.period} limit exceeded (${check.current}/${check.limit})`,
          suspicionScore: 0
        }
      }
    }

    // All checks passed - increment counters
    data.minute.count++
    data.hour.count++
    data.day.count++
    data.burst.count++
    currentConcurrent.add(requestId)

    // Store updated data
    this.requestStore.set(key, data)
    this.concurrentRequests.set(concurrentKey, currentConcurrent)

    // Clean up concurrent requests after a short delay
    setTimeout(() => {
      const concurrent = this.concurrentRequests.get(concurrentKey)
      if (concurrent) {
        concurrent.delete(requestId)
        if (concurrent.size === 0) {
          this.concurrentRequests.delete(concurrentKey)
        }
      }
    }, 30000) // 30 seconds

    return {
      allowed: true,
      tier: context.tier,
      limits,
      remaining: this.calculateRemaining(data, limits, currentConcurrent.size),
      resetTimes: this.getResetTimes(data),
      suspicionScore: 0
    }
  }

  private checkBlocklist(ipAddress: string): { allowed: boolean; until?: number; reason?: string } {
    const blocked = this.blocklist.get(ipAddress)
    if (!blocked) return { allowed: true }
    
    if (Date.now() > blocked.until) {
      this.blocklist.delete(ipAddress)
      return { allowed: true }
    }
    
    return { allowed: false, until: blocked.until, reason: blocked.reason }
  }

  private blockIP(ipAddress: string, reason: string, durationMs: number): void {
    this.blocklist.set(ipAddress, {
      until: Date.now() + durationMs,
      reason
    })
    
    logger.warn('IP address blocked', {
      metadata: { ipAddress, reason, durationMs }
    })
  }

  private getIdentifier(context: RateLimitContext): string {
    // Use userId if available, otherwise use IP
    return context.userId || context.apiKey || context.ipAddress
  }

  private applyMultiplier(limits: RateLimitTier['limits'], multiplier: number): RateLimitTier['limits'] {
    return {
      requestsPerMinute: Math.floor(limits.requestsPerMinute * multiplier),
      requestsPerHour: Math.floor(limits.requestsPerHour * multiplier),
      requestsPerDay: Math.floor(limits.requestsPerDay * multiplier),
      burstLimit: Math.floor(limits.burstLimit * multiplier),
      concurrentRequests: limits.concurrentRequests // Don't multiply concurrent
    }
  }

  private getAdaptiveLimits(context: RateLimitContext, baseLimits: RateLimitTier['limits']): RateLimitTier['limits'] {
    // Implement adaptive rate limiting based on system load, time of day, etc.
    const loadFactor = this.getSystemLoadFactor()
    const timeFactor = this.getTimeOfDayFactor()
    
    const adjustmentFactor = Math.min(loadFactor, timeFactor)
    
    return this.applyMultiplier(baseLimits, adjustmentFactor)
  }

  private getSystemLoadFactor(): number {
    // In production, this would check actual system metrics
    // For now, return a value between 0.5 and 1.0
    const activeRequests = this.concurrentRequests.size
    if (activeRequests > 100) return 0.5
    if (activeRequests > 50) return 0.7
    return 1.0
  }

  private getTimeOfDayFactor(): number {
    // Adjust limits based on time of day (higher limits during off-peak)
    const hour = new Date().getHours()
    if (hour >= 2 && hour <= 6) return 1.5 // Off-peak hours
    if (hour >= 9 && hour <= 17) return 0.8 // Peak business hours
    return 1.0
  }

  private calculateRemaining(
    data: any, 
    limits: RateLimitTier['limits'], 
    concurrent: number
  ): RateLimitResult['remaining'] {
    return {
      minute: Math.max(0, limits.requestsPerMinute - data.minute.count),
      hour: Math.max(0, limits.requestsPerHour - data.hour.count),
      day: Math.max(0, limits.requestsPerDay - data.day.count),
      burst: Math.max(0, limits.burstLimit - data.burst.count),
      concurrent: Math.max(0, limits.concurrentRequests - concurrent)
    }
  }

  private getResetTimes(data?: any): RateLimitResult['resetTimes'] {
    const now = Date.now()
    return {
      minute: data?.minute?.resetTime || now + 60 * 1000,
      hour: data?.hour?.resetTime || now + 60 * 60 * 1000,
      day: data?.day?.resetTime || now + 24 * 60 * 60 * 1000,
      burst: data?.burst?.resetTime || now + 10 * 1000
    }
  }

  private getZeroRemaining(): RateLimitResult['remaining'] {
    return { minute: 0, hour: 0, day: 0, burst: 0, concurrent: 0 }
  }

  private getAllowedResult(context: RateLimitContext, reason: string): RateLimitResult {
    const limits = RATE_LIMIT_TIERS[context.tier].limits
    return {
      allowed: true,
      tier: context.tier,
      limits,
      remaining: {
        minute: limits.requestsPerMinute,
        hour: limits.requestsPerHour,
        day: limits.requestsPerDay,
        burst: limits.burstLimit,
        concurrent: limits.concurrentRequests
      },
      resetTimes: this.getResetTimes(),
      reason,
      suspicionScore: 0
    }
  }

  private getFailsafeResult(context: RateLimitContext): RateLimitResult {
    // Fallback to basic free tier limits on errors
    const limits = RATE_LIMIT_TIERS.free.limits
    return {
      allowed: true,
      tier: 'free',
      limits,
      remaining: {
        minute: Math.floor(limits.requestsPerMinute / 2),
        hour: Math.floor(limits.requestsPerHour / 2),
        day: Math.floor(limits.requestsPerDay / 2),
        burst: Math.floor(limits.burstLimit / 2),
        concurrent: Math.floor(limits.concurrentRequests / 2)
      },
      resetTimes: this.getResetTimes(),
      reason: 'Failsafe mode - reduced limits applied',
      suspicionScore: 0
    }
  }

  private reduceLimits(remaining: RateLimitResult['remaining'], reductionFactor: number): RateLimitResult['remaining'] {
    return {
      minute: Math.floor(remaining.minute * (1 - reductionFactor)),
      hour: Math.floor(remaining.hour * (1 - reductionFactor)),
      day: Math.floor(remaining.day * (1 - reductionFactor)),
      burst: Math.floor(remaining.burst * (1 - reductionFactor)),
      concurrent: Math.floor(remaining.concurrent * (1 - reductionFactor))
    }
  }

  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    // Clean up request store
    for (const [key, data] of Array.from(this.requestStore.entries())) {
      const allExpired = data.day?.resetTime < now && 
                        data.hour?.resetTime < now && 
                        data.minute?.resetTime < now &&
                        data.burst?.resetTime < now
      
      if (allExpired) {
        this.requestStore.delete(key)
        cleaned++
      }
    }

    // Clean up suspicious activity (keep for 24 hours)
    for (const [ip, activity] of Array.from(this.suspiciousActivity.entries())) {
      if (now - activity.firstSeen > 24 * 60 * 60 * 1000) {
        this.suspiciousActivity.delete(ip)
        cleaned++
      }
    }

    // Clean up expired blocks
    for (const [ip, block] of Array.from(this.blocklist.entries())) {
      if (now > block.until) {
        this.blocklist.delete(ip)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.info('Rate limit cleanup completed', { metadata: { cleaned } })
    }
  }

  // Public methods for management
  public addToAllowlist(ip: string): void {
    this.allowlist.add(ip)
    logger.info('IP added to allowlist', { metadata: { ip } })
  }

  public removeFromAllowlist(ip: string): void {
    this.allowlist.delete(ip)
    logger.info('IP removed from allowlist', { metadata: { ip } })
  }

  public getStats(): {
    activeRequests: number
    blockedIPs: number
    suspiciousIPs: number
    allowlistedIPs: number
    totalRequests: number
  } {
    return {
      activeRequests: this.requestStore.size,
      blockedIPs: this.blocklist.size,
      suspiciousIPs: this.suspiciousActivity.size,
      allowlistedIPs: this.allowlist.size,
      totalRequests: Array.from(this.requestStore.values()).reduce((sum, data) => 
        sum + (data.day?.count || 0), 0)
    }
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.requestStore.clear()
    this.concurrentRequests.clear()
    this.suspiciousActivity.clear()
    this.blocklist.clear()
    this.allowlist.clear()
    this.adaptiveLimits.clear()
  }
}

// Global enhanced rate limiter instance
export const enhancedRateLimit = new EnhancedRateLimit()

// Helper function to get client IP with proxy support
export function getClientIP(req: any): string {
  const forwarded = req.headers['x-forwarded-for']
  const real = req.headers['x-real-ip']
  const cloudflare = req.headers['cf-connecting-ip']
  
  return (
    cloudflare ||
    real ||
    (forwarded && forwarded.split(',')[0].trim()) ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

// Helper function to determine user tier
export function determineUserTier(user: any, apiKey: any): string {
  if (user?.role === 'admin' || user?.role === 'internal') return 'internal'
  if (user?.subscription === 'enterprise' || apiKey?.tier === 'enterprise') return 'enterprise'
  if (user?.subscription === 'premium' || apiKey?.tier === 'premium') return 'premium'
  if (user?.subscription === 'basic' || apiKey?.tier === 'basic') return 'basic'
  return 'free'
}