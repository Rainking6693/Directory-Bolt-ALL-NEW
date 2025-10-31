// 🔒 TIER MANAGEMENT SERVICE
// Comprehensive user tier management with usage tracking and limits enforcement

import type { 
  UserWithAnalysisTier, 
  AnalysisJob,
  UserAnalysisUsage,
  TierUpgradeEvent,
  SubscriptionTier, 
  AnalysisType,
  LimitType 
} from '../database/tier-schema'
import { 
  ANALYSIS_TIERS, 
  getTierConfig, 
  canAccessFeature, 
  getMonthlyLimit,
  getCostLimits,
  getNextTier
} from '../database/tier-schema'
import { logger } from '../utils/logger'

export class TierManagementService {
  
  /**
   * Validate if user can perform an analysis based on their tier
   */
  async validateAnalysisAccess(
    userId: string, 
    analysisType: AnalysisType
  ): Promise<{
    canAccess: boolean
    reason?: string
    limitType?: LimitType
    upgradeRequired?: SubscriptionTier
    usage?: UserAnalysisUsage
  }> {
    try {
      const user = await this.getUserWithTierInfo(userId)
      if (!user) {
        return { canAccess: false, reason: 'User not found' }
      }

      const tierConfig = getTierConfig(user.subscription_tier as SubscriptionTier)
      const currentUsage = await this.getCurrentMonthUsage(userId)

      // Check if user can access this analysis type
      const hasFeatureAccess = this.checkFeatureAccess(user.subscription_tier as SubscriptionTier, analysisType)
      if (!hasFeatureAccess.canAccess) {
        return {
          canAccess: false,
          reason: hasFeatureAccess.reason,
          limitType: 'feature_access',
          upgradeRequired: hasFeatureAccess.upgradeRequired
        }
      }

      // Check monthly analysis limit
      const monthlyLimit = getMonthlyLimit(user.subscription_tier as SubscriptionTier)
      if (monthlyLimit !== -1 && currentUsage.total_analyses >= monthlyLimit) {
        return {
          canAccess: false,
          reason: `Monthly analysis limit of ${monthlyLimit} reached`,
          limitType: 'monthly_analyses',
          upgradeRequired: getNextTier(user.subscription_tier as SubscriptionTier) || undefined
        }
      }

      // Check monthly cost limit
      const costLimits = getCostLimits(user.subscription_tier as SubscriptionTier)
      if (currentUsage.total_ai_cost >= costLimits.monthlyAiCostLimit) {
        return {
          canAccess: false,
          reason: `Monthly AI cost limit of $${(costLimits.monthlyAiCostLimit / 100).toFixed(2)} reached`,
          limitType: 'monthly_cost',
          upgradeRequired: getNextTier(user.subscription_tier as SubscriptionTier) || undefined
        }
      }

      return { 
        canAccess: true
      }

    } catch (error) {
      logger.error('Error validating analysis access', { 
        userId, 
        analysisType, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      
      return { 
        canAccess: false, 
        reason: 'Validation error occurred' 
      }
    }
  }

  /**
   * Check if user has access to specific analysis features
   */
  private checkFeatureAccess(tier: SubscriptionTier, analysisType: AnalysisType): {
    canAccess: boolean
    reason?: string
    upgradeRequired?: SubscriptionTier
  } {
    const tierConfig = getTierConfig(tier)

    switch (analysisType) {
      case 'basic_extraction':
        return { canAccess: tierConfig.features.basicExtraction }
      
      case 'ai_competitor_analysis':
        if (!tierConfig.features.aiCompetitorAnalysis) {
          return {
            canAccess: false,
            reason: 'AI Competitor Analysis requires Starter plan or higher',
            upgradeRequired: tier === 'free' ? 'starter' : getNextTier(tier) || undefined
          }
        }
        return { canAccess: true }
      
      case 'advanced_insights':
        if (!tierConfig.features.advancedInsights) {
          return {
            canAccess: false,
            reason: 'Advanced Insights requires Growth plan or higher',
            upgradeRequired: tier === 'free' ? 'growth' : tier === 'starter' ? 'growth' : getNextTier(tier) || undefined
          }
        }
        return { canAccess: true }
      
      case 'full_analysis':
        // Full analysis requires all features
        if (!tierConfig.features.aiCompetitorAnalysis) {
          return {
            canAccess: false,
            reason: 'Full Analysis requires Starter plan or higher',
            upgradeRequired: 'starter'
          }
        }
        if (!tierConfig.features.advancedInsights) {
          return {
            canAccess: false,
            reason: 'Full Analysis requires Growth plan or higher', 
            upgradeRequired: 'growth'
          }
        }
        return { canAccess: true }
      
      default:
        return { canAccess: false, reason: 'Unknown analysis type' }
    }
  }

  /**
   * Get current month usage for a user
   */
  async getCurrentMonthUsage(userId: string): Promise<{
    total_analyses: number
    basic_extractions: number
    ai_competitor_analyses: number
    advanced_insights: number
    total_ai_cost: number
    openai_cost: number
    anthropic_cost: number
  }> {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    // TODO: Implement actual database query
    // const usage = await db.userAnalysisUsage.findFirst({
    //   where: { user_id: userId, year, month }
    // })

    // Mock usage data for development
    const mockUsage = {
      total_analyses: Math.floor(Math.random() * 20),
      basic_extractions: Math.floor(Math.random() * 10),
      ai_competitor_analyses: Math.floor(Math.random() * 8),
      advanced_insights: Math.floor(Math.random() * 5),
      total_ai_cost: Math.floor(Math.random() * 2000), // In cents
      openai_cost: Math.floor(Math.random() * 1200),
      anthropic_cost: Math.floor(Math.random() * 800)
    }

    return mockUsage
  }

  /**
   * Consume analysis usage and track costs
   */
  async consumeAnalysisUsage(
    userId: string,
    analysisType: AnalysisType,
    aiCost: number, // In cents
    openaiCost: number = 0,
    anthropicCost: number = 0
  ): Promise<void> {
    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1

      // TODO: Implement database update
      // await db.userAnalysisUsage.upsert({
      //   where: { user_id_year_month: { user_id: userId, year, month } },
      //   update: {
      //     [this.getUsageFieldName(analysisType)]: { increment: 1 },
      //     total_ai_cost: { increment: aiCost },
      //     openai_cost: { increment: openaiCost },
      //     anthropic_cost: { increment: anthropicCost },
      //     updated_at: new Date()
      //   },
      //   create: {
      //     user_id: userId,
      //     year,
      //     month,
      //     [this.getUsageFieldName(analysisType)]: 1,
      //     total_ai_cost: aiCost,
      //     openai_cost: openaiCost,
      //     anthropic_cost: anthropicCost,
      //     subscription_tier: 'free', // Will be updated from user record
      //     tier_limit_reached: false,
      //     upgrade_prompted: false,
      //     upgrade_completed: false
      //   }
      // })

      logger.info('Analysis usage consumed', {
        userId,
        analysisType,
        aiCost,
        openaiCost,
        anthropicCost,
        year,
        month
      })

    } catch (error) {
      logger.error('Error consuming analysis usage', {
        userId,
        analysisType,
        aiCost,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Check if user is approaching limits and should see upgrade prompts
   */
  async checkUpgradePrompts(userId: string): Promise<{
    shouldPrompt: boolean
    promptType: 'approaching_limit' | 'limit_reached' | 'feature_locked'
    message: string
    currentTier: SubscriptionTier
    recommendedTier: SubscriptionTier
    usage: any
  } | null> {
    try {
      const user = await this.getUserWithTierInfo(userId)
      if (!user) return null

      const usage = await this.getCurrentMonthUsage(userId)
      const tierConfig = getTierConfig(user.subscription_tier as SubscriptionTier)
      const nextTier = getNextTier(user.subscription_tier as SubscriptionTier)
      
      if (!nextTier) return null // Enterprise users don't need upgrades

      const monthlyLimit = getMonthlyLimit(user.subscription_tier as SubscriptionTier)
      const costLimits = getCostLimits(user.subscription_tier as SubscriptionTier)

      // Check if approaching monthly analysis limit (80% threshold)
      if (monthlyLimit !== -1 && usage.total_analyses >= monthlyLimit * 0.8) {
        return {
          shouldPrompt: true,
          promptType: usage.total_analyses >= monthlyLimit ? 'limit_reached' : 'approaching_limit',
          message: usage.total_analyses >= monthlyLimit 
            ? `You've reached your monthly limit of ${monthlyLimit} analyses. Upgrade to continue.`
            : `You've used ${usage.total_analyses} of ${monthlyLimit} analyses this month. Consider upgrading for more capacity.`,
          currentTier: user.subscription_tier as SubscriptionTier,
          recommendedTier: nextTier,
          usage
        }
      }

      // Check if approaching monthly cost limit (80% threshold)
      if (usage.total_ai_cost >= costLimits.monthlyAiCostLimit * 0.8) {
        const costLimit = costLimits.monthlyAiCostLimit / 100
        const currentCost = usage.total_ai_cost / 100
        
        return {
          shouldPrompt: true,
          promptType: usage.total_ai_cost >= costLimits.monthlyAiCostLimit ? 'limit_reached' : 'approaching_limit',
          message: usage.total_ai_cost >= costLimits.monthlyAiCostLimit
            ? `You've reached your monthly AI cost limit of $${costLimit.toFixed(2)}. Upgrade to continue.`
            : `You've used $${currentCost.toFixed(2)} of $${costLimit.toFixed(2)} in AI costs this month.`,
          currentTier: user.subscription_tier as SubscriptionTier,
          recommendedTier: nextTier,
          usage
        }
      }

      return null

    } catch (error) {
      logger.error('Error checking upgrade prompts', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Record a tier upgrade event
   */
  async recordTierUpgrade(
    userId: string,
    fromTier: SubscriptionTier,
    toTier: SubscriptionTier,
    source: string,
    limitType?: LimitType,
    upgradeAmount?: number
  ): Promise<void> {
    try {
      const now = new Date()
      
      // TODO: Implement database save
      // const upgradeEvent: Omit<TierUpgradeEvent, 'id' | 'created_at'> = {
      //   user_id: userId,
      //   from_tier: fromTier,
      //   to_tier: toTier,
      //   upgrade_source: source as any,
      //   triggered_by_limit: !!limitType,
      //   limit_type: limitType,
      //   analyses_used_when_triggered: 0, // Get from current usage
      //   cost_spent_when_triggered: 0, // Get from current usage
      //   prompt_shown_at: now,
      //   upgrade_completed_at: now,
      //   conversion_time_minutes: 0,
      //   upgrade_amount: upgradeAmount || 0
      // }
      // 
      // await db.tierUpgradeEvents.create({ data: upgradeEvent })

      logger.info('Tier upgrade recorded', {
        userId,
        fromTier,
        toTier,
        source,
        limitType,
        upgradeAmount
      })

    } catch (error) {
      logger.error('Error recording tier upgrade', {
        userId,
        fromTier,
        toTier,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Reset monthly usage counters (called on billing cycle)
   */
  async resetMonthlyUsage(userId: string): Promise<void> {
    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1

      // TODO: Implement database update to reset counters
      // await db.users.update({
      //   where: { id: userId },
      //   data: {
      //     ai_analyses_used_this_month: 0,
      //     total_ai_cost_this_month: 0,
      //     last_analysis_reset_at: now
      //   }
      // })

      logger.info('Monthly usage reset', { userId, year, month })

    } catch (error) {
      logger.error('Error resetting monthly usage', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Get usage field name for database updates
   */
  private getUsageFieldName(analysisType: AnalysisType): string {
    switch (analysisType) {
      case 'basic_extraction': return 'basic_extractions_used'
      case 'ai_competitor_analysis': return 'ai_competitor_analyses_used'
      case 'advanced_insights': return 'advanced_insights_used'
      case 'full_analysis': return 'ai_competitor_analyses_used' // Full analysis counts as competitor analysis
      default: return 'basic_extractions_used'
    }
  }

  /**
   * Get user with tier information (mock implementation)
   */
  private async getUserWithTierInfo(userId: string): Promise<UserWithAnalysisTier | null> {
    // TODO: Implement actual database query
    // return await db.users.findFirst({ where: { id: userId } })

    // Mock user for development
    if (userId === 'usr_test_123') {
      return {
        id: userId,
        email: 'test@directorybolt.com',
        password_hash: 'hashed',
        full_name: 'Test User',
        company_name: 'Test Company',
        subscription_tier: 'free', // Start with free tier to test upgrades
        credits_remaining: 25,
        is_verified: true,
        failed_login_attempts: 0,
        created_at: new Date('2024-01-01'),
        updated_at: new Date(),
        directories_used_this_period: 10,
        directory_limit: 100,
        // Analysis tier fields
        ai_analyses_used_this_month: 2,
        ai_analysis_limit: 3,
        last_analysis_reset_at: new Date(),
        has_basic_extraction: true,
        has_ai_competitor_analysis: false,
        has_advanced_insights: false,
        has_priority_processing: false,
        total_ai_cost_this_month: 150, // $1.50 in cents
        ai_cost_limit: 500 // $5.00 in cents
      } as UserWithAnalysisTier
    }

    return null
  }

  /**
   * Get tier comparison for upgrade prompts
   */
  getTierComparison(currentTier: SubscriptionTier, targetTier: SubscriptionTier) {
    const current = getTierConfig(currentTier)
    const target = getTierConfig(targetTier)

    return {
      current: {
        name: current.name,
        limit: current.monthlyAnalysisLimit,
        features: current.features
      },
      target: {
        name: target.name,
        limit: target.monthlyAnalysisLimit,
        features: target.features
      },
      improvements: {
        analysisLimit: target.monthlyAnalysisLimit === -1 ? 'Unlimited' : `${target.monthlyAnalysisLimit - current.monthlyAnalysisLimit} more analyses`,
        newFeatures: Object.entries(target.features)
          .filter(([key, value]) => value && !current.features[key as keyof typeof current.features])
          .map(([key]) => key)
      }
    }
  }
}

// Export singleton instance
export const tierManager = new TierManagementService()
