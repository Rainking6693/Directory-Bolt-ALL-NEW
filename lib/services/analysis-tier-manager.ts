// 🚀 ANALYSIS TIER MANAGER - Freemium to $299+ Premium Conversion Engine
// Tier validation, feature gating, usage tracking, and upgrade funnel management

import { logger } from '../utils/logger'
import { BusinessIntelligence, AnalysisProgress } from '../types/business-intelligence'

export type AnalysisTier = 'free' | 'basic' | 'premium' | 'enterprise'

export interface TierLimits {
  directoryPreviews: number
  aiAnalysisDepth: 'basic' | 'standard' | 'comprehensive'
  screenshotsEnabled: boolean
  competitorAnalysisEnabled: boolean
  revenueProjectionsEnabled: boolean
  directoryOptimizationEnabled: boolean
  exportFormats: string[]
  monthlyAnalyses: number
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated'
  customBranding: boolean
  apiAccess: boolean
}

export interface UserUsage {
  userId: string
  email?: string
  currentTier: AnalysisTier
  analysesThisMonth: number
  directoriesViewed: number
  lastAnalysisDate: Date | null
  totalAnalyses: number
  upgradePrompts: number
  conversionEvents: ConversionEvent[]
}

export interface ConversionEvent {
  eventType: 'feature_locked' | 'upgrade_prompt' | 'value_demonstration' | 'conversion'
  timestamp: Date
  featureAttempted?: string
  valueShown?: string
  source?: string
  metadata?: Record<string, any>
}

export interface TierConfig {
  name: string
  price: number
  billingPeriod: 'monthly' | 'yearly'
  limits: TierLimits
  features: string[]
  valueProposition: string
  upgradeCallToAction: string
}

export interface UpgradePrompt {
  title: string
  message: string
  valueProposition: string
  features: string[]
  ctaText: string
  urgency?: string
  discount?: {
    percentage: number
    validUntil: Date
  }
}

export class AnalysisTierManager {
  private tiers: Record<AnalysisTier, TierConfig> = {
    free: {
      name: 'Free Preview',
      price: 0,
      billingPeriod: 'monthly',
      limits: {
        directoryPreviews: 5,
        aiAnalysisDepth: 'basic',
        screenshotsEnabled: false,
        competitorAnalysisEnabled: false,
        revenueProjectionsEnabled: false,
        directoryOptimizationEnabled: false,
        exportFormats: ['summary'],
        monthlyAnalyses: 2,
        supportLevel: 'community',
        customBranding: false,
        apiAccess: false
      },
      features: [
        'Basic business category detection',
        '5 directory previews',
        'Simple SEO analysis',
        'Basic recommendations'
      ],
      valueProposition: 'Get a taste of AI-powered business analysis',
      upgradeCallToAction: 'Unlock Full Analysis for $299/month'
    },
    basic: {
      name: 'Starter Plan',
      price: 99,
      billingPeriod: 'monthly',
      limits: {
        directoryPreviews: 25,
        aiAnalysisDepth: 'standard',
        screenshotsEnabled: true,
        competitorAnalysisEnabled: false,
        revenueProjectionsEnabled: false,
        directoryOptimizationEnabled: true,
        exportFormats: ['pdf', 'json'],
        monthlyAnalyses: 10,
        supportLevel: 'email',
        customBranding: false,
        apiAccess: false
      },
      features: [
        'Enhanced business intelligence',
        '25 directory opportunities',
        'Website screenshots',
        'Directory optimization',
        'Email support'
      ],
      valueProposition: 'Perfect for small businesses starting their growth journey',
      upgradeCallToAction: 'Get Full Intelligence Suite for $299/month'
    },
    premium: {
      name: 'Growth Plan',
      price: 299,
      billingPeriod: 'monthly',
      limits: {
        directoryPreviews: 100,
        aiAnalysisDepth: 'comprehensive',
        screenshotsEnabled: true,
        competitorAnalysisEnabled: true,
        revenueProjectionsEnabled: true,
        directoryOptimizationEnabled: true,
        exportFormats: ['pdf', 'json', 'csv', 'xlsx'],
        monthlyAnalyses: 50,
        supportLevel: 'priority',
        customBranding: true,
        apiAccess: true
      },
      features: [
        'Complete AI business intelligence',
        '100+ directory opportunities',
        'Competitor analysis & market positioning',
        'Revenue projections & ROI modeling',
        'Priority support & consultation',
        'API access & custom integrations'
      ],
      valueProposition: 'Complete business intelligence for serious growth',
      upgradeCallToAction: 'Scale with Enterprise Features'
    },
    enterprise: {
      name: 'Enterprise Plan',
      price: 999,
      billingPeriod: 'monthly',
      limits: {
        directoryPreviews: -1, // Unlimited
        aiAnalysisDepth: 'comprehensive',
        screenshotsEnabled: true,
        competitorAnalysisEnabled: true,
        revenueProjectionsEnabled: true,
        directoryOptimizationEnabled: true,
        exportFormats: ['pdf', 'json', 'csv', 'xlsx', 'custom'],
        monthlyAnalyses: -1, // Unlimited
        supportLevel: 'dedicated',
        customBranding: true,
        apiAccess: true
      },
      features: [
        'Unlimited AI business intelligence',
        'Unlimited directory opportunities',
        'Custom analysis workflows',
        'Dedicated account manager',
        'White-label solutions',
        'Custom integrations & API'
      ],
      valueProposition: 'Enterprise-grade business intelligence at scale',
      upgradeCallToAction: 'Contact Sales for Custom Solutions'
    }
  }

  private userUsageStore: Map<string, UserUsage> = new Map()

  constructor() {
    logger.info('Analysis Tier Manager initialized with freemium strategy')
  }

  // Tier Validation & Feature Gating

  async validateTierAccess(userId: string, tier: AnalysisTier): Promise<{
    allowed: boolean
    reason?: string
    upgradePrompt?: UpgradePrompt
  }> {
    const usage = await this.getUserUsage(userId)
    const tierLimits = this.tiers[tier].limits

    // Check monthly analysis limit
    if (tierLimits.monthlyAnalyses !== -1 && usage.analysesThisMonth >= tierLimits.monthlyAnalyses) {
      return {
        allowed: false,
        reason: 'Monthly analysis limit reached',
        upgradePrompt: this.generateUpgradePrompt(tier, 'monthly_limit')
      }
    }

    return { allowed: true }
  }

  async canAccessFeature(userId: string, tier: AnalysisTier, feature: string): Promise<{
    allowed: boolean
    reason?: string
    upgradePrompt?: UpgradePrompt
  }> {
    const tierLimits = this.tiers[tier].limits

    switch (feature) {
      case 'screenshots':
        if (!tierLimits.screenshotsEnabled) {
          await this.trackConversionEvent(userId, {
            eventType: 'feature_locked',
            timestamp: new Date(),
            featureAttempted: 'screenshots'
          })
          return {
            allowed: false,
            reason: 'Screenshots not available in current tier',
            upgradePrompt: this.generateUpgradePrompt(tier, 'screenshots')
          }
        }
        break

      case 'competitor_analysis':
        if (!tierLimits.competitorAnalysisEnabled) {
          await this.trackConversionEvent(userId, {
            eventType: 'feature_locked',
            timestamp: new Date(),
            featureAttempted: 'competitor_analysis'
          })
          return {
            allowed: false,
            reason: 'Competitor analysis requires premium plan',
            upgradePrompt: this.generateUpgradePrompt(tier, 'competitor_analysis')
          }
        }
        break

      case 'revenue_projections':
        if (!tierLimits.revenueProjectionsEnabled) {
          await this.trackConversionEvent(userId, {
            eventType: 'feature_locked',
            timestamp: new Date(),
            featureAttempted: 'revenue_projections'
          })
          return {
            allowed: false,
            reason: 'Revenue projections available in premium plans',
            upgradePrompt: this.generateUpgradePrompt(tier, 'revenue_projections')
          }
        }
        break

      case 'directory_optimization':
        if (!tierLimits.directoryOptimizationEnabled) {
          await this.trackConversionEvent(userId, {
            eventType: 'feature_locked',
            timestamp: new Date(),
            featureAttempted: 'directory_optimization'
          })
          return {
            allowed: false,
            reason: 'Directory optimization requires paid plan',
            upgradePrompt: this.generateUpgradePrompt(tier, 'directory_optimization')
          }
        }
        break
    }

    return { allowed: true }
  }

  async checkDirectoryPreviewLimit(userId: string, tier: AnalysisTier): Promise<{
    allowed: boolean
    remaining: number
    upgradePrompt?: UpgradePrompt
  }> {
    const usage = await this.getUserUsage(userId)
    const tierLimits = this.tiers[tier].limits

    if (tierLimits.directoryPreviews === -1) {
      return { allowed: true, remaining: -1 } // Unlimited
    }

    const remaining = Math.max(0, tierLimits.directoryPreviews - usage.directoriesViewed)

    if (remaining === 0) {
      await this.trackConversionEvent(userId, {
        eventType: 'feature_locked',
        timestamp: new Date(),
        featureAttempted: 'directory_preview'
      })

      return {
        allowed: false,
        remaining: 0,
        upgradePrompt: this.generateUpgradePrompt(tier, 'directory_limit')
      }
    }

    // Show upgrade prompt when getting close to limit
    if (remaining <= 2 && tier === 'free') {
      await this.trackConversionEvent(userId, {
        eventType: 'upgrade_prompt',
        timestamp: new Date(),
        source: 'directory_limit_warning'
      })
    }

    return { allowed: true, remaining }
  }

  // Analysis Configuration Based on Tier

  getAnalysisConfig(tier: AnalysisTier) {
    const tierLimits = this.tiers[tier].limits

    return {
      aiAnalysis: {
        model: 'gpt-4o' as const,
        temperature: 0.3,
        maxTokens: tierLimits.aiAnalysisDepth === 'comprehensive' ? 4000 : 
                   tierLimits.aiAnalysisDepth === 'standard' ? 2500 : 1500,
        enableRevenueProjections: tierLimits.revenueProjectionsEnabled,
        enableCompetitorAnalysis: tierLimits.competitorAnalysisEnabled,
        analysisDepth: tierLimits.aiAnalysisDepth
      },
      websiteAnalysis: {
        timeout: 30000,
        maxRetries: 3,
        userAgent: 'DirectoryBolt Enhanced Analyzer/2.0 (Business Intelligence Engine)',
        enableScreenshots: tierLimits.screenshotsEnabled,
        enableSocialAnalysis: true,
        enableTechStackAnalysis: true,
        screenshotOptions: {
          fullPage: true,
          width: 1920,
          height: 1080,
          quality: tierLimits.screenshotsEnabled ? 85 : 0,
          format: 'png' as const
        }
      },
      directoryMatching: {
        maxDirectories: tierLimits.directoryPreviews === -1 ? 500 : tierLimits.directoryPreviews,
        enableOptimization: tierLimits.directoryOptimizationEnabled,
        prioritizeHighAuthority: tier !== 'free',
        includeNicheDirectories: tier === 'premium' || tier === 'enterprise'
      }
    }
  }

  // Usage Tracking & Limits Enforcement

  async trackAnalysis(userId: string, analysisType: string): Promise<void> {
    const usage = await this.getUserUsage(userId)
    
    usage.analysesThisMonth += 1
    usage.totalAnalyses += 1
    usage.lastAnalysisDate = new Date()
    
    await this.updateUserUsage(userId, usage)
    
    logger.info('Analysis tracked for user', {
      metadata: {
        userId,
        analysisType,
        monthlyCount: usage.analysesThisMonth,
        totalCount: usage.totalAnalyses
      }
    })
  }

  async trackDirectoryView(userId: string): Promise<void> {
    const usage = await this.getUserUsage(userId)
    usage.directoriesViewed += 1
    
    await this.updateUserUsage(userId, usage)
  }

  async trackConversionEvent(userId: string, event: ConversionEvent): Promise<void> {
    const usage = await this.getUserUsage(userId)
    usage.conversionEvents.push(event)

    if (event.eventType === 'upgrade_prompt') {
      usage.upgradePrompts += 1
    }

    await this.updateUserUsage(userId, usage)
    
    logger.info('Conversion event tracked', {
      metadata: {
        userId,
        eventType: event.eventType,
        feature: event.featureAttempted
      }
    })
  }

  // Upgrade Prompt Generation

  generateUpgradePrompt(currentTier: AnalysisTier, trigger: string): UpgradePrompt {
    const nextTier = this.getNextTier(currentTier)
    const tierConfig = this.tiers[nextTier]
    
    const prompts: Record<string, UpgradePrompt> = {
      monthly_limit: {
        title: 'Monthly Analysis Limit Reached',
        message: 'You\'ve reached your monthly analysis limit. Upgrade to continue getting business intelligence insights.',
        valueProposition: `Unlock ${tierConfig.limits.monthlyAnalyses === -1 ? 'unlimited' : tierConfig.limits.monthlyAnalyses} monthly analyses`,
        features: tierConfig.features.slice(0, 3),
        ctaText: `Upgrade to ${tierConfig.name} - $${tierConfig.price}/month`
      },
      directory_limit: {
        title: 'Directory Preview Limit Reached',
        message: 'Discover more opportunities! Upgrade to see all available directories for your business.',
        valueProposition: `Access ${tierConfig.limits.directoryPreviews === -1 ? 'unlimited' : tierConfig.limits.directoryPreviews}+ directory opportunities`,
        features: ['Priority directory matching', 'Industry-specific directories', 'Local directory optimization'],
        ctaText: `See All Directories - $${tierConfig.price}/month`
      },
      screenshots: {
        title: 'Visual Website Analysis',
        message: 'Get detailed visual analysis with desktop and mobile screenshots of your website.',
        valueProposition: 'Professional website screenshots and visual analysis',
        features: ['Desktop & mobile screenshots', 'Visual design analysis', 'Mobile optimization insights'],
        ctaText: `Enable Screenshots - $${tierConfig.price}/month`
      },
      competitor_analysis: {
        title: 'Competitor Intelligence',
        message: 'Understand your competitive landscape with AI-powered competitor analysis.',
        valueProposition: 'Complete competitor analysis and market positioning',
        features: ['Direct competitor identification', 'Market gap analysis', 'Competitive advantage insights'],
        ctaText: `Unlock Competitor Analysis - $${tierConfig.price}/month`
      },
      revenue_projections: {
        title: 'Revenue Growth Projections',
        message: 'See how directory submissions could impact your revenue with AI-powered projections.',
        valueProposition: 'Detailed revenue projections and ROI modeling',
        features: ['12-month revenue projections', 'ROI calculations', 'Growth scenario modeling'],
        ctaText: `See Revenue Impact - $${tierConfig.price}/month`
      },
      directory_optimization: {
        title: 'Directory Optimization',
        message: 'Get optimized directory descriptions and submission strategies tailored for your business.',
        valueProposition: 'AI-optimized directory submissions for maximum impact',
        features: ['Optimized business descriptions', 'Submission timing strategies', 'Category recommendations'],
        ctaText: `Optimize Submissions - $${tierConfig.price}/month`
      }
    }

    const basePrompt = prompts[trigger] || prompts.directory_limit
    
    // Add urgency for free users
    if (currentTier === 'free') {
      basePrompt.urgency = 'Start your 7-day free trial today!'
    }

    return basePrompt
  }

  private getNextTier(currentTier: AnalysisTier): AnalysisTier {
    switch (currentTier) {
      case 'free': return 'basic'
      case 'basic': return 'premium' 
      case 'premium': return 'enterprise'
      default: return 'premium'
    }
  }

  // Value Demonstration

  async demonstrateValue(userId: string, tier: AnalysisTier, analysis: BusinessIntelligence): Promise<{
    value: string
    metrics: Record<string, number>
    projections: Record<string, number>
  }> {
    const tierLimits = this.tiers[tier].limits
    
    // Calculate potential value
    const potentialDirectories = Math.min(analysis.directoryOpportunities.totalDirectories, 100)
    const averageTrafficPerDirectory = 250
    const averageLeadsPerDirectory = 8
    const averageRevenuePerLead = 500
    
    const projectedTrafficIncrease = potentialDirectories * averageTrafficPerDirectory
    const projectedLeadIncrease = potentialDirectories * averageLeadsPerDirectory
    const projectedRevenueIncrease = projectedLeadIncrease * averageRevenuePerLead
    
    const value = `Based on ${potentialDirectories} directory opportunities, you could see ${projectedTrafficIncrease.toLocaleString()} additional monthly visitors, ${projectedLeadIncrease} new leads, and $${projectedRevenueIncrease.toLocaleString()} in additional revenue.`
    
    await this.trackConversionEvent(userId, {
      eventType: 'value_demonstration',
      timestamp: new Date(),
      valueShown: value,
      metadata: {
        potentialDirectories,
        projectedTrafficIncrease,
        projectedLeadIncrease,
        projectedRevenueIncrease
      }
    })
    
    return {
      value,
      metrics: {
        potentialDirectories,
        currentlyViewable: tierLimits.directoryPreviews === -1 ? potentialDirectories : Math.min(tierLimits.directoryPreviews, potentialDirectories),
        trafficIncrease: projectedTrafficIncrease,
        leadIncrease: projectedLeadIncrease
      },
      projections: {
        monthlyRevenue: projectedRevenueIncrease,
        yearlyRevenue: projectedRevenueIncrease * 12,
        roi: Math.round(((projectedRevenueIncrease * 12) / (this.tiers.premium.price * 12)) * 100)
      }
    }
  }

  // User Management

  async getUserUsage(userId: string): Promise<UserUsage> {
    let usage = this.userUsageStore.get(userId)
    
    if (!usage) {
      usage = {
        userId,
        currentTier: 'free',
        analysesThisMonth: 0,
        directoriesViewed: 0,
        lastAnalysisDate: null,
        totalAnalyses: 0,
        upgradePrompts: 0,
        conversionEvents: []
      }
      this.userUsageStore.set(userId, usage)
    }
    
    // Reset monthly counters if new month
    const now = new Date()
    const lastReset = usage.lastAnalysisDate
    if (lastReset && now.getMonth() !== lastReset.getMonth()) {
      usage.analysesThisMonth = 0
      usage.directoriesViewed = 0
    }
    
    return usage
  }

  async updateUserUsage(userId: string, usage: UserUsage): Promise<void> {
    this.userUsageStore.set(userId, usage)
    // In production, persist to database
  }

  async upgradeUser(userId: string, newTier: AnalysisTier): Promise<void> {
    const usage = await this.getUserUsage(userId)
    usage.currentTier = newTier
    
    await this.trackConversionEvent(userId, {
      eventType: 'conversion',
      timestamp: new Date(),
      metadata: { newTier }
    })
    
    await this.updateUserUsage(userId, usage)
    
    logger.info('User upgraded successfully', {
      metadata: { userId, newTier }
    })
  }

  // Analytics & Reporting

  getConversionMetrics(userId?: string): {
    totalUsers: number
    conversionRate: number
    averageUpgradePrompts: number
    topFeatureLocks: Array<{ feature: string; count: number }>
    revenueProjection: number
  } {
    const allUsage = Array.from(this.userUsageStore.values())
    const filteredUsage = userId ? allUsage.filter(u => u.userId === userId) : allUsage
    
    const totalUsers = filteredUsage.length
    const paidUsers = filteredUsage.filter(u => u.currentTier !== 'free').length
    const conversionRate = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0
    
    const totalUpgradePrompts = filteredUsage.reduce((sum, u) => sum + u.upgradePrompts, 0)
    const averageUpgradePrompts = totalUsers > 0 ? totalUpgradePrompts / totalUsers : 0
    
    // Analyze feature locks
    const featureLocks = new Map<string, number>()
    filteredUsage.forEach(usage => {
      usage.conversionEvents
        .filter(e => e.eventType === 'feature_locked')
        .forEach(e => {
          const feature = e.featureAttempted || 'unknown'
          featureLocks.set(feature, (featureLocks.get(feature) || 0) + 1)
        })
    })
    
    const topFeatureLocks = Array.from(featureLocks.entries())
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    
    const monthlyRevenue = filteredUsage
      .filter(u => u.currentTier !== 'free')
      .reduce((sum, u) => sum + this.tiers[u.currentTier].price, 0)
    
    return {
      totalUsers,
      conversionRate,
      averageUpgradePrompts,
      topFeatureLocks,
      revenueProjection: monthlyRevenue * 12
    }
  }

  // Public API Methods

  getTierConfig(tier: AnalysisTier): TierConfig {
    return this.tiers[tier]
  }

  getAllTiers(): Record<AnalysisTier, TierConfig> {
    return { ...this.tiers }
  }

  async resetUsage(userId: string): Promise<void> {
    const usage = await this.getUserUsage(userId)
    usage.analysesThisMonth = 0
    usage.directoriesViewed = 0
    await this.updateUserUsage(userId, usage)
  }
}

// Singleton instance
let tierManagerInstance: AnalysisTierManager | null = null

export function getTierManager(): AnalysisTierManager {
  if (!tierManagerInstance) {
    tierManagerInstance = new AnalysisTierManager()
  }
  return tierManagerInstance
}

// Convenience exports
export const TierManager = {
  validateAccess: (userId: string, tier: AnalysisTier) => getTierManager().validateTierAccess(userId, tier),
  canAccessFeature: (userId: string, tier: AnalysisTier, feature: string) => getTierManager().canAccessFeature(userId, tier, feature),
  getConfig: (tier: AnalysisTier) => getTierManager().getAnalysisConfig(tier),
  generateUpgrade: (tier: AnalysisTier, trigger: string) => getTierManager().generateUpgradePrompt(tier, trigger),
  trackAnalysis: (userId: string, type: string) => getTierManager().trackAnalysis(userId, type),
  demonstrateValue: (userId: string, tier: AnalysisTier, analysis: BusinessIntelligence) => getTierManager().demonstrateValue(userId, tier, analysis)
}
