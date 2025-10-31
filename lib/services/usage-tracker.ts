import { logger } from '../utils/logger'

export interface UsageRecord {
  id: string
  userId?: string
  sessionId: string
  endpoint: string
  method: string
  tier: string
  tokensUsed: number
  cost: number
  success: boolean
  timestamp: Date
  responseTime?: number
  errorMessage?: string
}

export interface UsageStats {
  dailyRequests: number
  monthlyRequests: number
  dailyTokens: number
  monthlyTokens: number
  dailyCost: number
  monthlyCost: number
  lastRequest: Date | null
}

export interface TierLimits {
  dailyRequests: number
  monthlyRequests: number
  maxTokensPerRequest: number
  maxCostPerMonth: number
}

// Define tier limits for usage tracking
const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    dailyRequests: 10,
    monthlyRequests: 100,
    maxTokensPerRequest: 2000,
    maxCostPerMonth: 10
  },
  starter: {
    dailyRequests: 100,
    monthlyRequests: 1000,
    maxTokensPerRequest: 5000,
    maxCostPerMonth: 50
  },
  growth: {
    dailyRequests: 300,
    monthlyRequests: 5000,
    maxTokensPerRequest: 10000,
    maxCostPerMonth: 200
  },
  professional: {
    dailyRequests: 1000,
    monthlyRequests: 15000,
    maxTokensPerRequest: 25000,
    maxCostPerMonth: 800
  },
  enterprise: {
    dailyRequests: 2000,
    monthlyRequests: 20000,
    maxTokensPerRequest: 50000,
    maxCostPerMonth: 2000
  }
}

export class UsageTracker {
  private static instance: UsageTracker
  private usageRecords: Map<string, UsageRecord[]> = new Map()
  
  public static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker()
    }
    return UsageTracker.instance
  }

  /**
   * Track API usage
   */
  async trackUsage(record: Omit<UsageRecord, 'id' | 'timestamp'>): Promise<void> {
    try {
      const usageRecord: UsageRecord = {
        ...record,
        id: this.generateId(),
        timestamp: new Date()
      }

      // Store in memory (in production, this would go to a database)
      const key = record.userId || record.sessionId
      const userRecords = this.usageRecords.get(key) || []
      userRecords.push(usageRecord)
      this.usageRecords.set(key, userRecords)

      logger.info('Usage tracked', {
        metadata: {
          userId: record.userId,
          sessionId: record.sessionId,
          tier: record.tier,
          endpoint: record.endpoint,
          tokensUsed: record.tokensUsed,
          cost: record.cost,
          success: record.success
        }
      })

    } catch (error) {
      logger.error('Failed to track usage', {}, error as Error)
    }
  }

  /**
   * Check if user can make request based on tier limits
   */
  async canMakeRequest(
    userId: string | undefined, 
    sessionId: string, 
    tier: string,
    estimatedTokens: number = 0
  ): Promise<{ allowed: boolean; reason?: string; limits?: TierLimits }> {
    try {
      const tierLimits = TIER_LIMITS[tier] || TIER_LIMITS.free
      const stats = await this.getUserStats(userId || sessionId)

      // Check daily request limit
      if (stats.dailyRequests >= tierLimits.dailyRequests) {
        return {
          allowed: false,
          reason: `Daily request limit exceeded (${tierLimits.dailyRequests} requests)`,
          limits: tierLimits
        }
      }

      // Check monthly request limit
      if (stats.monthlyRequests >= tierLimits.monthlyRequests) {
        return {
          allowed: false,
          reason: `Monthly request limit exceeded (${tierLimits.monthlyRequests} requests)`,
          limits: tierLimits
        }
      }

      // Check token limit for this request
      if (estimatedTokens > tierLimits.maxTokensPerRequest) {
        return {
          allowed: false,
          reason: `Request too large (${estimatedTokens} tokens, max ${tierLimits.maxTokensPerRequest})`,
          limits: tierLimits
        }
      }

      // Check monthly cost limit
      const estimatedCost = estimatedTokens * 0.00002 // Rough GPT-4 pricing
      if (stats.monthlyCost + estimatedCost > tierLimits.maxCostPerMonth) {
        return {
          allowed: false,
          reason: `Monthly cost limit would be exceeded ($${tierLimits.maxCostPerMonth})`,
          limits: tierLimits
        }
      }

      return { allowed: true, limits: tierLimits }

    } catch (error) {
      logger.error('Failed to check usage limits', {}, error as Error)
      return { allowed: false, reason: 'Unable to verify usage limits' }
    }
  }

  /**
   * Get user usage statistics
   */
  async getUserStats(userKey: string): Promise<UsageStats> {
    try {
      const records = this.usageRecords.get(userKey) || []
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      // Filter records for today and this month
      const todayRecords = records.filter(r => r.timestamp >= today)
      const monthRecords = records.filter(r => r.timestamp >= thisMonth)

      const stats: UsageStats = {
        dailyRequests: todayRecords.length,
        monthlyRequests: monthRecords.length,
        dailyTokens: todayRecords.reduce((sum, r) => sum + r.tokensUsed, 0),
        monthlyTokens: monthRecords.reduce((sum, r) => sum + r.tokensUsed, 0),
        dailyCost: todayRecords.reduce((sum, r) => sum + r.cost, 0),
        monthlyCost: monthRecords.reduce((sum, r) => sum + r.cost, 0),
        lastRequest: records.length > 0 ? records[records.length - 1].timestamp : null
      }

      return stats

    } catch (error) {
      logger.error('Failed to get user stats', {}, error as Error)
      return {
        dailyRequests: 0,
        monthlyRequests: 0,
        dailyTokens: 0,
        monthlyTokens: 0,
        dailyCost: 0,
        monthlyCost: 0,
        lastRequest: null
      }
    }
  }

  /**
   * Get tier limits for a specific tier
   */
  getTierLimits(tier: string): TierLimits {
    return TIER_LIMITS[tier] || TIER_LIMITS.free
  }

  /**
   * Calculate estimated cost for tokens
   */
  calculateCost(tokens: number, model: string = 'gpt-4'): number {
    const pricing = {
      'gpt-4': 0.00003, // $0.03 per 1K tokens
      'gpt-3.5-turbo': 0.000002 // $0.002 per 1K tokens
    }

    return tokens * (pricing[model as keyof typeof pricing] || pricing['gpt-4'])
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Clean up old records (keep last 30 days)
   */
  async cleanupOldRecords(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      for (const [userKey, records] of this.usageRecords.entries()) {
        const recentRecords = records.filter(r => r.timestamp >= thirtyDaysAgo)
        this.usageRecords.set(userKey, recentRecords)
      }

      logger.info('Old usage records cleaned up')

    } catch (error) {
      logger.error('Failed to cleanup old records', {}, error as Error)
    }
  }

  /**
   * Get usage summary for monitoring
   */
  async getUsageSummary(): Promise<{
    totalUsers: number
    totalRequests: number
    totalTokens: number
    totalCost: number
    tierBreakdown: Record<string, number>
  }> {
    try {
      let totalRequests = 0
      let totalTokens = 0
      let totalCost = 0
      const tierBreakdown: Record<string, number> = {}

      for (const records of this.usageRecords.values()) {
        totalRequests += records.length
        totalTokens += records.reduce((sum, r) => sum + r.tokensUsed, 0)
        totalCost += records.reduce((sum, r) => sum + r.cost, 0)

        // Count by tier
        for (const record of records) {
          tierBreakdown[record.tier] = (tierBreakdown[record.tier] || 0) + 1
        }
      }

      return {
        totalUsers: this.usageRecords.size,
        totalRequests,
        totalTokens,
        totalCost,
        tierBreakdown
      }

    } catch (error) {
      logger.error('Failed to get usage summary', {}, error as Error)
      return {
        totalUsers: 0,
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        tierBreakdown: {}
      }
    }
  }
}

export default UsageTracker
