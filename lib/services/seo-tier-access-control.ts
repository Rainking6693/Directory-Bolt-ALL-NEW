/**
 * SEO Tier-Based Access Control Service
 * 
 * Manages access control for SEO features based on user subscription tiers.
 * Provides feature gating, usage tracking, and tier-specific limitations
 * for DirectoryBolt's premium SEO intelligence features.
 * 
 * Features:
 * - Tier-based feature access control
 * - Usage tracking and limits
 * - Feature availability matrix
 * - Upgrade recommendations
 * - Analytics and reporting
 */

import { logger } from '../utils/logger'

export type UserTier = 'free' | 'professional' | 'enterprise'

export interface SEOFeature {
  id: string
  name: string
  description: string
  category: 'analysis' | 'research' | 'optimization' | 'monitoring'
  requiredTier: UserTier
  usageLimit?: {
    period: 'daily' | 'weekly' | 'monthly'
    limit: number
  }
  restrictions?: {
    maxCompetitors?: number
    maxKeywords?: number
    maxAnalysisDepth?: 'basic' | 'detailed' | 'comprehensive'
    cacheExpiryHours?: number
  }
}

export interface TierConfiguration {
  tier: UserTier
  features: string[]
  monthlyUsageLimits: {
    seoAnalysis: number
    competitorResearch: number
    contentOptimization: number
    keywordGapAnalysis: number
  }
  restrictions: {
    maxCompetitorsPerAnalysis: number
    maxKeywordsPerAnalysis: number
    analysisDepth: 'basic' | 'detailed' | 'comprehensive'
    cacheExpiryHours: number
    concurrentAnalyses: number
  }
  pricing: {
    monthly: number
    annual: number
  }
}

export interface UsageTracking {
  userId: string
  userTier: UserTier
  period: string // YYYY-MM format
  usage: {
    seoAnalysis: number
    competitorResearch: number
    contentOptimization: number
    keywordGapAnalysis: number
  }
  lastReset: Date
}

export interface AccessCheckResult {
  allowed: boolean
  reason?: string
  upgradeRequired?: boolean
  recommendedTier?: UserTier
  remainingUsage?: number
  resetDate?: Date
  restrictions?: any
}

export class SEOTierAccessControl {
  private static instance: SEOTierAccessControl
  private usageTracking: Map<string, UsageTracking> = new Map()
  private tierConfigurations: Map<UserTier, TierConfiguration> = new Map()
  private seoFeatures: Map<string, SEOFeature> = new Map()

  constructor() {
    this.initializeTierConfigurations()
    this.initializeSEOFeatures()
    
    // Reset usage tracking monthly
    setInterval(() => this.resetMonthlyUsage(), 24 * 60 * 60 * 1000) // Daily check
  }

  static getInstance(): SEOTierAccessControl {
    if (!SEOTierAccessControl.instance) {
      SEOTierAccessControl.instance = new SEOTierAccessControl()
    }
    return SEOTierAccessControl.instance
  }

  /**
   * Check if user can access a specific SEO feature
   */
  async checkFeatureAccess(
    userId: string,
    userTier: UserTier,
    featureId: string,
    requestParams?: {
      competitorCount?: number
      keywordCount?: number
      analysisDepth?: string
    }
  ): Promise<AccessCheckResult> {
    try {
      const feature = this.seoFeatures.get(featureId)
      if (!feature) {
        return {
          allowed: false,
          reason: 'Feature not found'
        }
      }

      // Check tier requirement
      if (!this.isTierSufficient(userTier, feature.requiredTier)) {
        return {
          allowed: false,
          reason: `${feature.name} requires ${feature.requiredTier} tier or higher`,
          upgradeRequired: true,
          recommendedTier: feature.requiredTier
        }
      }

      // Check usage limits
      const usageCheck = await this.checkUsageLimits(userId, userTier, featureId)
      if (!usageCheck.allowed) {
        return usageCheck
      }

      // Check feature-specific restrictions
      const restrictionCheck = this.checkFeatureRestrictions(userTier, featureId, requestParams)
      if (!restrictionCheck.allowed) {
        return restrictionCheck
      }

      // All checks passed
      return {
        allowed: true,
        remainingUsage: usageCheck.remainingUsage,
        resetDate: usageCheck.resetDate,
        restrictions: this.getTierRestrictions(userTier)
      }

    } catch (error) {
      logger.error('Error checking SEO feature access', { userId, userTier, featureId }, error)
      return {
        allowed: false,
        reason: 'Access check failed'
      }
    }
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(
    userId: string,
    userTier: UserTier,
    featureId: string
  ): Promise<boolean> {
    try {
      const currentPeriod = new Date().toISOString().slice(0, 7) // YYYY-MM
      let userUsage = this.usageTracking.get(`${userId}-${currentPeriod}`)

      if (!userUsage) {
        userUsage = {
          userId,
          userTier,
          period: currentPeriod,
          usage: {
            seoAnalysis: 0,
            competitorResearch: 0,
            contentOptimization: 0,
            keywordGapAnalysis: 0
          },
          lastReset: new Date()
        }
      }

      // Increment usage based on feature
      switch (featureId) {
        case 'seo-content-gap-analysis':
          userUsage.usage.seoAnalysis++
          break
        case 'competitor-seo-research':
          userUsage.usage.competitorResearch++
          break
        case 'content-optimization':
          userUsage.usage.contentOptimization++
          break
        case 'keyword-gap-analysis':
          userUsage.usage.keywordGapAnalysis++
          break
      }

      this.usageTracking.set(`${userId}-${currentPeriod}`, userUsage)
      
      logger.info('SEO feature usage tracked', {
        userId,
        userTier,
        featureId,
        currentUsage: userUsage.usage
      })

      return true
    } catch (error) {
      logger.error('Error tracking SEO feature usage', { userId, userTier, featureId }, error)
      return false
    }
  }

  /**
   * Get user's current usage statistics
   */
  getUserUsageStats(userId: string): {
    currentPeriod: string
    usage: UsageTracking['usage']
    limits: TierConfiguration['monthlyUsageLimits']
    resetDate: Date
  } | null {
    const currentPeriod = new Date().toISOString().slice(0, 7)
    const userUsage = this.usageTracking.get(`${userId}-${currentPeriod}`)

    if (!userUsage) {
      return null
    }

    const tierConfig = this.tierConfigurations.get(userUsage.userTier)
    if (!tierConfig) {
      return null
    }

    // Calculate next reset date (first day of next month)
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    nextMonth.setDate(1)
    nextMonth.setHours(0, 0, 0, 0)

    return {
      currentPeriod,
      usage: userUsage.usage,
      limits: tierConfig.monthlyUsageLimits,
      resetDate: nextMonth
    }
  }

  /**
   * Get available features for a tier
   */
  getTierFeatures(userTier: UserTier): SEOFeature[] {
    return Array.from(this.seoFeatures.values())
      .filter(feature => this.isTierSufficient(userTier, feature.requiredTier))
  }

  /**
   * Get upgrade recommendations
   */
  getUpgradeRecommendations(currentTier: UserTier): {
    recommendedTier: UserTier
    additionalFeatures: SEOFeature[]
    benefits: string[]
    pricing: { monthly: number; annual: number }
  } | null {
    const currentTierIndex = this.getTierIndex(currentTier)
    if (currentTierIndex >= 2) return null // Already at highest tier

    const targetTier = ['free', 'professional', 'enterprise'][currentTierIndex + 1] as UserTier
    const currentFeatures = this.getTierFeatures(currentTier)
    const targetFeatures = this.getTierFeatures(targetTier)
    
    const additionalFeatures = targetFeatures.filter(
      feature => !currentFeatures.some(cf => cf.id === feature.id)
    )

    const tierConfig = this.tierConfigurations.get(targetTier)!
    
    const benefits = [
      `Access to ${additionalFeatures.length} additional SEO features`,
      `${tierConfig.restrictions.maxCompetitorsPerAnalysis} competitors per analysis`,
      `${tierConfig.restrictions.maxKeywordsPerAnalysis} keywords per analysis`,
      `${tierConfig.restrictions.analysisDepth} analysis depth`,
      `${tierConfig.monthlyUsageLimits.seoAnalysis} SEO analyses per month`
    ]

    return {
      recommendedTier: targetTier,
      additionalFeatures,
      benefits,
      pricing: tierConfig.pricing
    }
  }

  /**
   * Private Methods
   */

  private initializeTierConfigurations(): void {
    this.tierConfigurations = new Map([
      ['free', {
        tier: 'free',
        features: ['basic-seo-analysis'],
        monthlyUsageLimits: {
          seoAnalysis: 2,
          competitorResearch: 0,
          contentOptimization: 1,
          keywordGapAnalysis: 0
        },
        restrictions: {
          maxCompetitorsPerAnalysis: 0,
          maxKeywordsPerAnalysis: 3,
          analysisDepth: 'basic',
          cacheExpiryHours: 72,
          concurrentAnalyses: 1
        },
        pricing: { monthly: 0, annual: 0 }
      }],
      ['professional', {
        tier: 'professional',
        features: [
          'seo-content-gap-analysis',
          'competitor-seo-research',
          'content-optimization',
          'keyword-gap-analysis'
        ],
        monthlyUsageLimits: {
          seoAnalysis: 25,
          competitorResearch: 15,
          contentOptimization: 30,
          keywordGapAnalysis: 10
        },
        restrictions: {
          maxCompetitorsPerAnalysis: 5,
          maxKeywordsPerAnalysis: 50,
          analysisDepth: 'detailed',
          cacheExpiryHours: 48,
          concurrentAnalyses: 3
        },
        pricing: { monthly: 149, annual: 1490 }
      }],
      ['enterprise', {
        tier: 'enterprise',
        features: [
          'seo-content-gap-analysis',
          'competitor-seo-research',
          'content-optimization',
          'keyword-gap-analysis',
          'advanced-reporting',
          'api-access',
          'custom-integrations'
        ],
        monthlyUsageLimits: {
          seoAnalysis: 100,
          competitorResearch: 50,
          contentOptimization: 100,
          keywordGapAnalysis: 30
        },
        restrictions: {
          maxCompetitorsPerAnalysis: 15,
          maxKeywordsPerAnalysis: 200,
          analysisDepth: 'comprehensive',
          cacheExpiryHours: 24,
          concurrentAnalyses: 10
        },
        pricing: { monthly: 499, annual: 4990 }
      }]
    ])
  }

  private initializeSEOFeatures(): void {
    this.seoFeatures = new Map([
      ['seo-content-gap-analysis', {
        id: 'seo-content-gap-analysis',
        name: 'SEO Content Gap Analysis',
        description: 'Comprehensive analysis of content gaps and opportunities',
        category: 'analysis',
        requiredTier: 'professional',
        usageLimit: { period: 'monthly', limit: 25 }
      }],
      ['competitor-seo-research', {
        id: 'competitor-seo-research',
        name: 'Competitor SEO Research',
        description: 'Deep dive into competitor SEO strategies and keyword rankings',
        category: 'research',
        requiredTier: 'professional',
        usageLimit: { period: 'monthly', limit: 15 }
      }],
      ['content-optimization', {
        id: 'content-optimization',
        name: 'AI Content Optimization',
        description: 'AI-powered content optimization recommendations',
        category: 'optimization',
        requiredTier: 'professional',
        usageLimit: { period: 'monthly', limit: 30 }
      }],
      ['keyword-gap-analysis', {
        id: 'keyword-gap-analysis',
        name: 'Keyword Gap Analysis',
        description: 'Advanced keyword opportunity identification and gap analysis',
        category: 'analysis',
        requiredTier: 'professional',
        usageLimit: { period: 'monthly', limit: 10 }
      }],
      ['basic-seo-analysis', {
        id: 'basic-seo-analysis',
        name: 'Basic SEO Analysis',
        description: 'Basic SEO recommendations and insights',
        category: 'analysis',
        requiredTier: 'free',
        usageLimit: { period: 'monthly', limit: 2 }
      }]
    ])
  }

  private async checkUsageLimits(
    userId: string,
    userTier: UserTier,
    featureId: string
  ): Promise<AccessCheckResult> {
    const currentPeriod = new Date().toISOString().slice(0, 7)
    const userUsage = this.usageTracking.get(`${userId}-${currentPeriod}`)
    const tierConfig = this.tierConfigurations.get(userTier)!

    if (!userUsage) {
      // First usage this period
      return { allowed: true }
    }

    let currentUsage = 0
    let limit = 0

    switch (featureId) {
      case 'seo-content-gap-analysis':
        currentUsage = userUsage.usage.seoAnalysis
        limit = tierConfig.monthlyUsageLimits.seoAnalysis
        break
      case 'competitor-seo-research':
        currentUsage = userUsage.usage.competitorResearch
        limit = tierConfig.monthlyUsageLimits.competitorResearch
        break
      case 'content-optimization':
        currentUsage = userUsage.usage.contentOptimization
        limit = tierConfig.monthlyUsageLimits.contentOptimization
        break
      case 'keyword-gap-analysis':
        currentUsage = userUsage.usage.keywordGapAnalysis
        limit = tierConfig.monthlyUsageLimits.keywordGapAnalysis
        break
    }

    if (currentUsage >= limit) {
      const nextTier = this.getNextTier(userTier)
      return {
        allowed: false,
        reason: `Monthly usage limit reached (${currentUsage}/${limit})`,
        upgradeRequired: !!nextTier,
        recommendedTier: nextTier || undefined
      }
    }

    // Calculate next reset date
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    nextMonth.setDate(1)
    nextMonth.setHours(0, 0, 0, 0)

    return {
      allowed: true,
      remainingUsage: limit - currentUsage,
      resetDate: nextMonth
    }
  }

  private checkFeatureRestrictions(
    userTier: UserTier,
    featureId: string,
    requestParams?: any
  ): AccessCheckResult {
    const tierConfig = this.tierConfigurations.get(userTier)!

    if (requestParams?.competitorCount && 
        requestParams.competitorCount > tierConfig.restrictions.maxCompetitorsPerAnalysis) {
      return {
        allowed: false,
        reason: `${userTier} tier allows up to ${tierConfig.restrictions.maxCompetitorsPerAnalysis} competitors per analysis`,
        upgradeRequired: true,
        recommendedTier: this.getNextTier(userTier) || undefined
      }
    }

    if (requestParams?.keywordCount && 
        requestParams.keywordCount > tierConfig.restrictions.maxKeywordsPerAnalysis) {
      return {
        allowed: false,
        reason: `${userTier} tier allows up to ${tierConfig.restrictions.maxKeywordsPerAnalysis} keywords per analysis`,
        upgradeRequired: true,
        recommendedTier: this.getNextTier(userTier) || undefined
      }
    }

    return { allowed: true }
  }

  private isTierSufficient(userTier: UserTier, requiredTier: UserTier): boolean {
    const tierHierarchy = ['free', 'professional', 'enterprise']
    return tierHierarchy.indexOf(userTier) >= tierHierarchy.indexOf(requiredTier)
  }

  private getTierIndex(tier: UserTier): number {
    return ['free', 'professional', 'enterprise'].indexOf(tier)
  }

  private getNextTier(currentTier: UserTier): UserTier | null {
    const tiers: UserTier[] = ['free', 'professional', 'enterprise']
    const currentIndex = tiers.indexOf(currentTier)
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null
  }

  private getTierRestrictions(userTier: UserTier): any {
    return this.tierConfigurations.get(userTier)?.restrictions || {}
  }

  private resetMonthlyUsage(): void {
    const currentPeriod = new Date().toISOString().slice(0, 7)
    const today = new Date()
    
    // Reset usage if it's the first day of the month
    if (today.getDate() === 1) {
      for (const [key, usage] of this.usageTracking.entries()) {
        if (!key.includes(currentPeriod)) {
          this.usageTracking.delete(key)
        }
      }
      logger.info('Monthly SEO usage tracking reset completed')
    }
  }
}

/**
 * Convenience function to get the singleton instance
 */
export function getSEOAccessControl(): SEOTierAccessControl {
  return SEOTierAccessControl.getInstance()
}

/**
 * Middleware function for API route access control
 */
export async function requireSEOAccess(
  userId: string,
  userTier: UserTier,
  featureId: string,
  requestParams?: any
): Promise<AccessCheckResult> {
  const accessControl = getSEOAccessControl()
  return accessControl.checkFeatureAccess(userId, userTier, featureId, requestParams)
}

/**
 * Track feature usage after successful API call
 */
export async function trackSEOUsage(
  userId: string,
  userTier: UserTier,
  featureId: string
): Promise<boolean> {
  const accessControl = getSEOAccessControl()
  return accessControl.trackFeatureUsage(userId, userTier, featureId)
}
