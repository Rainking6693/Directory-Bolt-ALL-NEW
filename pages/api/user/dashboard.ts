// 🔒 USER DASHBOARD API
// GET /api/user/dashboard - Comprehensive user dashboard with tier usage and upgrade prompts

import type { NextApiRequest, NextApiResponse } from 'next'
import { withTierValidation } from '../../../lib/middleware/tier-validation'
import type { TierValidationRequest, TierValidationResult } from '../../../lib/middleware/tier-validation'
import { tierManager } from '../../../lib/services/tier-management'
import { analysisCostTracker } from '../../../lib/services/analysis-cost-tracker'
import { ANALYSIS_TIERS, getTierConfig } from '../../../lib/database/tier-schema'
import type { SubscriptionTier } from '../../../lib/database/tier-schema'
import { handleApiError } from '../../../lib/utils/errors'
import { logger } from '../../../lib/utils/logger'

interface DashboardResponse {
  success: true
  data: {
    user: {
      id: string
      email: string
      fullName: string
      tier: SubscriptionTier
      tierName: string
      joinedAt: string
    }
    usage: {
      currentMonth: {
        totalAnalyses: number
        analysisLimit: number
        usagePercentage: number
        totalCost: number
        costLimit: number
        costPercentage: number
        breakdownByType: {
          basicExtractions: number
          competitorAnalyses: number
          advancedInsights: number
        }
      }
      lastMonth: {
        totalAnalyses: number
        totalCost: number
        averageCostPerAnalysis: number
      }
      yearToDate: {
        totalAnalyses: number
        totalCost: number
        monthlyAverage: number
      }
    }
    tierInfo: {
      current: {
        name: string
        monthlyPrice: number
        analysisLimit: number
        features: string[]
        costLimits: {
          monthly: number
          perAnalysis: number
        }
      }
      next?: {
        name: string
        monthlyPrice: number
        analysisLimit: number
        features: string[]
        costLimits: {
          monthly: number
          perAnalysis: number
        }
        upgradeBenefits: string[]
        estimatedSavings?: number
      }
    }
    upgradePrompt?: {
      shouldPrompt: boolean
      urgency: 'low' | 'medium' | 'high'
      message: string
      reason: string
      recommendedTier: SubscriptionTier
      potentialBenefits: string[]
      upgradeUrl: string
    }
    recentAnalyses: Array<{
      id: string
      type: string
      websiteUrl: string
      completedAt: string
      cost: number
      processingTime: number
      status: string
    }>
    costOptimization: {
      currentMonthSpend: number
      projectedMonthSpend: number
      recommendations: Array<{
        type: string
        title: string
        description: string
        potentialSavings: number
        implementationEffort: string
      }>
    }
    billing: {
      nextBillingDate?: string
      currentPeriodEnd?: string
      subscriptionStatus?: string
      paymentMethod?: string
    }
  }
  requestId: string
}

export default withTierValidation(
  async function handler(
    req: TierValidationRequest,
    res: NextApiResponse<DashboardResponse | any>,
    validationResult: TierValidationResult
  ) {
    const requestId = `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET'])
        return res.status(405).json(handleApiError(
          new Error('Method not allowed'),
          requestId
        ))
      }

      await generateDashboard(req, res, validationResult, requestId)

    } catch (error) {
      const errorResponse = handleApiError(error as Error, requestId)
      return res.status(errorResponse.error.statusCode).json(errorResponse)
    }
  }
)

async function generateDashboard(
  req: TierValidationRequest,
  res: NextApiResponse,
  validationResult: TierValidationResult,
  requestId: string
) {
  const user = validationResult.user!
  
  // Get comprehensive usage data
  const [
    currentMonthUsage,
    lastMonthUsage,
    yearToDateUsage,
    recentAnalyses,
    upgradePrompt,
    costOptimization,
    billingInfo
  ] = await Promise.all([
    getCurrentMonthUsage(user.id),
    getLastMonthUsage(user.id),
    getYearToDateUsage(user.id),
    getRecentAnalyses(user.id, 10),
    tierManager.checkUpgradePrompts(user.id),
    analysisCostTracker.getCostOptimizationRecommendations(user.id),
    getBillingInfo(user.id)
  ])

  // Get tier configuration
  const currentTierConfig = getTierConfig(user.tier)
  const nextTier = getNextTier(user.tier)
  const nextTierConfig = nextTier ? getTierConfig(nextTier) : null

  // Calculate tier comparison benefits
  const upgradeBenefits = nextTierConfig ? calculateUpgradeBenefits(
    currentTierConfig,
    nextTierConfig,
    currentMonthUsage
  ) : []

  // Determine upgrade prompt urgency
  const upgradeUrgency = determineUpgradeUrgency(currentMonthUsage, currentTierConfig)

  const response: DashboardResponse = {
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        fullName: 'Test User', // TODO: Get from user record
        tier: user.tier,
        tierName: currentTierConfig.name,
        joinedAt: '2024-01-01T00:00:00.000Z' // TODO: Get from user record
      },
      usage: {
        currentMonth: {
          totalAnalyses: currentMonthUsage.total_analyses,
          analysisLimit: currentTierConfig.monthlyAnalysisLimit,
          usagePercentage: currentTierConfig.monthlyAnalysisLimit > 0 
            ? Math.round((currentMonthUsage.total_analyses / currentTierConfig.monthlyAnalysisLimit) * 100)
            : 0,
          totalCost: currentMonthUsage.total_ai_cost,
          costLimit: currentTierConfig.costLimits.monthlyAiCostLimit,
          costPercentage: Math.round((currentMonthUsage.total_ai_cost / currentTierConfig.costLimits.monthlyAiCostLimit) * 100),
          breakdownByType: {
            basicExtractions: currentMonthUsage.basic_extractions,
            competitorAnalyses: currentMonthUsage.ai_competitor_analyses,
            advancedInsights: currentMonthUsage.advanced_insights
          }
        },
        lastMonth: {
          totalAnalyses: lastMonthUsage.total_analyses,
          totalCost: lastMonthUsage.total_ai_cost,
          averageCostPerAnalysis: lastMonthUsage.total_analyses > 0 
            ? Math.round(lastMonthUsage.total_ai_cost / lastMonthUsage.total_analyses)
            : 0
        },
        yearToDate: {
          totalAnalyses: yearToDateUsage.total_analyses,
          totalCost: yearToDateUsage.total_ai_cost,
          monthlyAverage: Math.round(yearToDateUsage.total_analyses / Math.max(1, new Date().getMonth() + 1))
        }
      },
      tierInfo: {
        current: {
          name: currentTierConfig.name,
          monthlyPrice: getTierPrice(user.tier),
          analysisLimit: currentTierConfig.monthlyAnalysisLimit,
          features: formatTierFeatures(currentTierConfig.features),
          costLimits: {
            monthly: currentTierConfig.costLimits.monthlyAiCostLimit,
            perAnalysis: currentTierConfig.costLimits.perAnalysisLimit
          }
        },
        next: nextTierConfig ? {
          name: nextTierConfig.name,
          monthlyPrice: getTierPrice(nextTier!),
          analysisLimit: nextTierConfig.monthlyAnalysisLimit,
          features: formatTierFeatures(nextTierConfig.features),
          costLimits: {
            monthly: nextTierConfig.costLimits.monthlyAiCostLimit,
            perAnalysis: nextTierConfig.costLimits.perAnalysisLimit
          },
          upgradeBenefits,
          estimatedSavings: calculateEstimatedSavings(currentMonthUsage, nextTierConfig)
        } : undefined
      },
      upgradePrompt: upgradePrompt ? {
        shouldPrompt: upgradePrompt.shouldPrompt,
        urgency: upgradeUrgency,
        message: upgradePrompt.message,
        reason: determineUpgradeReason(currentMonthUsage, currentTierConfig),
        recommendedTier: upgradePrompt.recommendedTier,
        potentialBenefits: upgradeBenefits,
        upgradeUrl: `/upgrade?from=${user.tier}&to=${upgradePrompt.recommendedTier}&source=dashboard`
      } : undefined,
      recentAnalyses: recentAnalyses.map(analysis => ({
        id: analysis.id,
        type: formatAnalysisType(analysis.type),
        websiteUrl: analysis.websiteUrl,
        completedAt: analysis.completedAt,
        cost: analysis.cost,
        processingTime: analysis.processingTime,
        status: analysis.status
      })),
      costOptimization: {
        currentMonthSpend: costOptimization.currentMonthSpend,
        projectedMonthSpend: costOptimization.projectedMonthSpend,
        recommendations: costOptimization.recommendations
      },
      billing: billingInfo
    },
    requestId
  }

  // Set caching headers
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')
  res.setHeader('X-User-Tier', user.tier)
  
  res.status(200).json(response)

  logger.info('Dashboard generated', {
    requestId,
    userId: user.id,
    metadata: {
      tier: user.tier,
      totalAnalyses: currentMonthUsage.total_analyses,
      totalCost: currentMonthUsage.total_ai_cost,
      upgradePrompted: !!upgradePrompt
    }
  })
}

// Helper functions for data aggregation

async function getCurrentMonthUsage(userId: string): Promise<any> {
  // Mock current month usage
  return {
    total_analyses: Math.floor(Math.random() * 20) + 5,
    basic_extractions: Math.floor(Math.random() * 10),
    ai_competitor_analyses: Math.floor(Math.random() * 8),
    advanced_insights: Math.floor(Math.random() * 3),
    total_ai_cost: Math.floor(Math.random() * 2000) + 500, // $5-25 in cents
    openai_cost: Math.floor(Math.random() * 1200),
    anthropic_cost: Math.floor(Math.random() * 800)
  }
}

async function getLastMonthUsage(userId: string): Promise<any> {
  // Mock last month usage
  return {
    total_analyses: Math.floor(Math.random() * 15) + 3,
    total_ai_cost: Math.floor(Math.random() * 1800) + 300
  }
}

async function getYearToDateUsage(userId: string): Promise<any> {
  // Mock year to date usage
  const monthsElapsed = new Date().getMonth() + 1
  return {
    total_analyses: Math.floor(Math.random() * 100) + (monthsElapsed * 10),
    total_ai_cost: Math.floor(Math.random() * 15000) + (monthsElapsed * 500)
  }
}

async function getRecentAnalyses(userId: string, limit: number): Promise<any[]> {
  // Mock recent analyses
  const analyses = []
  for (let i = 0; i < Math.min(limit, 8); i++) {
    analyses.push({
      id: `analysis_${Date.now() - (i * 86400000)}_${i}`,
      type: ['basic_extraction', 'ai_competitor_analysis', 'advanced_insights'][Math.floor(Math.random() * 3)],
      websiteUrl: `https://example${i}.com`,
      completedAt: new Date(Date.now() - (i * 86400000)).toISOString(),
      cost: Math.floor(Math.random() * 500) + 100,
      processingTime: Math.floor(Math.random() * 30000) + 5000,
      status: 'completed'
    })
  }
  return analyses
}

async function getBillingInfo(userId: string): Promise<any> {
  // Mock billing information
  return {
    nextBillingDate: '2024-02-01T00:00:00.000Z',
    currentPeriodEnd: '2024-02-01T00:00:00.000Z',
    subscriptionStatus: 'active',
    paymentMethod: '**** 4242'
  }
}

// Helper functions for calculations

function getNextTier(currentTier: SubscriptionTier): SubscriptionTier | null {
  const tiers: SubscriptionTier[] = ['free', 'starter', 'growth', 'professional', 'enterprise']
  const currentIndex = tiers.indexOf(currentTier)
  
  if (currentIndex === -1 || currentIndex === tiers.length - 1) {
    return null
  }
  
  return tiers[currentIndex + 1]
}

function getTierPrice(tier: SubscriptionTier): number {
  const prices = {
    free: 0,
    starter: 14900, // $149.00 in cents
    growth: 29900,  // $299.00 in cents
    professional: 49900, // $499.00 in cents
    enterprise: 79900 // $799.00 in cents
  }
  
  return prices[tier]
}

function formatTierFeatures(features: any): string[] {
  const featureNames: Record<string, string> = {
    basicExtraction: 'Basic Website Extraction',
    aiCompetitorAnalysis: 'AI Competitor Analysis',
    advancedInsights: 'Advanced Market Insights',
    priorityProcessing: 'Priority Processing',
    exportFormats: 'Multiple Export Formats',
    supportLevel: 'Enhanced Support'
  }

  return Object.entries(features)
    .filter(([_, value]) => value)
    .map(([key, value]) => {
      if (key === 'exportFormats' && Array.isArray(value)) {
        return `Export: ${value.join(', ').toUpperCase()}`
      }
      if (key === 'supportLevel') {
        return `${value} Support`
      }
      return featureNames[key] || key
    })
}

function calculateUpgradeBenefits(
  currentTier: any,
  nextTier: any,
  usage: any
): string[] {
  const benefits: string[] = []

  // Analysis limit improvements
  if (nextTier.monthlyAnalysisLimit === -1) {
    benefits.push('Unlimited analyses per month')
  } else if (nextTier.monthlyAnalysisLimit > currentTier.monthlyAnalysisLimit) {
    const additional = nextTier.monthlyAnalysisLimit - currentTier.monthlyAnalysisLimit
    benefits.push(`${additional} more analyses per month`)
  }

  // Cost limit improvements
  const costIncrease = nextTier.costLimits.monthlyAiCostLimit - currentTier.costLimits.monthlyAiCostLimit
  if (costIncrease > 0) {
    benefits.push(`$${(costIncrease / 100).toFixed(0)} higher monthly AI budget`)
  }

  // New features
  const newFeatures = Object.entries(nextTier.features)
    .filter(([key, value]) => value && !currentTier.features[key])
    .map(([key]) => {
      switch (key) {
        case 'aiCompetitorAnalysis': return 'AI Competitor Analysis'
        case 'advancedInsights': return 'Advanced Market Insights'
        case 'priorityProcessing': return 'Priority Processing'
        default: return key
      }
    })

  benefits.push(...newFeatures)

  return benefits
}

function calculateEstimatedSavings(usage: any, nextTierConfig: any): number {
  // Calculate potential savings from higher cost efficiency in higher tiers
  if (usage.total_ai_cost > nextTierConfig.costLimits.monthlyAiCostLimit * 0.5) {
    return Math.round(usage.total_ai_cost * 0.15) // 15% savings estimate
  }
  return 0
}

function determineUpgradeUrgency(usage: any, tierConfig: any): 'low' | 'medium' | 'high' {
  const analysisPercentage = tierConfig.monthlyAnalysisLimit > 0 
    ? usage.total_analyses / tierConfig.monthlyAnalysisLimit 
    : 0
  const costPercentage = usage.total_ai_cost / tierConfig.costLimits.monthlyAiCostLimit

  if (analysisPercentage >= 0.9 || costPercentage >= 0.9) return 'high'
  if (analysisPercentage >= 0.7 || costPercentage >= 0.7) return 'medium'
  return 'low'
}

function determineUpgradeReason(usage: any, tierConfig: any): string {
  if (usage.total_analyses >= tierConfig.monthlyAnalysisLimit * 0.9) {
    return 'Approaching monthly analysis limit'
  }
  if (usage.total_ai_cost >= tierConfig.costLimits.monthlyAiCostLimit * 0.9) {
    return 'Approaching monthly cost limit'
  }
  if (usage.total_analyses >= tierConfig.monthlyAnalysisLimit * 0.7) {
    return 'High usage suggests higher tier would be more cost-effective'
  }
  return 'Unlock additional features and higher limits'
}

function formatAnalysisType(type: string): string {
  const typeNames = {
    'basic_extraction': 'Basic Extraction',
    'ai_competitor_analysis': 'Competitor Analysis', 
    'advanced_insights': 'Advanced Insights',
    'full_analysis': 'Full Analysis'
  }
  
  return typeNames[type as keyof typeof typeNames] || type
}