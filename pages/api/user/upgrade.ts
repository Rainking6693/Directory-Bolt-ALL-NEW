// 🔒 TIER UPGRADE API
// POST /api/user/upgrade - Handle tier upgrades and Stripe integration

import type { NextApiRequest, NextApiResponse } from 'next'
import { withTierValidation } from '../../../lib/middleware/tier-validation'
import type { TierValidationRequest, TierValidationResult } from '../../../lib/middleware/tier-validation'
import { tierManager } from '../../../lib/services/tier-management'
import type { SubscriptionTier } from '../../../lib/database/tier-schema'
import { handleApiError } from '../../../lib/utils/errors'
import { getStripeClient } from '../../../lib/utils/stripe-client'
import { logger } from '../../../lib/utils/logger'

interface UpgradeRequest {
  targetTier: SubscriptionTier
  billingCycle?: 'monthly' | 'annual'
  source?: 'analysis_limit' | 'cost_limit' | 'feature_required' | 'manual' | 'dashboard'
  successUrl?: string
  cancelUrl?: string
}

interface UpgradeResponse {
  success: true
  data: {
    upgrade: {
      from: SubscriptionTier
      to: SubscriptionTier
      monthlyPrice: number
      annualPrice: number
      billingCycle: 'monthly' | 'annual'
      effectiveDate: string
    }
    checkout: {
      sessionId: string
      url: string
      expiresAt: string
    }
    benefits: {
      analysisLimitIncrease: number | string
      costLimitIncrease: number
      newFeatures: string[]
      estimatedSavings?: number
    }
    proration?: {
      amount: number
      description: string
    }
  }
  requestId: string
}

import { createClient } from '@supabase/supabase-js'
import { PRICING_TIERS, getTier } from '../../../lib/config/pricing'

// Use centralized pricing
const TIER_PRICING = {
  starter: { monthly: PRICING_TIERS.starter.price * 100, annual: PRICING_TIERS.starter.price * 100 },
  growth: { monthly: PRICING_TIERS.growth.price * 100, annual: PRICING_TIERS.growth.price * 100 },
  professional: { monthly: PRICING_TIERS.professional.price * 100, annual: PRICING_TIERS.professional.price * 100 },
  enterprise: { monthly: PRICING_TIERS.enterprise.price * 100, annual: PRICING_TIERS.enterprise.price * 100 }
} as const

const STRIPE_PRICE_IDS = {
  starter_monthly: 'price_starter_monthly_prod',
  starter_annual: 'price_starter_annual_prod',
  growth_monthly: 'price_growth_monthly_prod',
  growth_annual: 'price_growth_annual_prod',
  professional_monthly: 'price_professional_monthly_prod',
  professional_annual: 'price_professional_annual_prod',
  enterprise_monthly: 'price_enterprise_monthly_prod',
  enterprise_annual: 'price_enterprise_annual_prod'
} as const

export default withTierValidation(
  async function handler(
    req: TierValidationRequest,
    res: NextApiResponse<UpgradeResponse | any>,
    validationResult: TierValidationResult
  ) {
    const requestId = `upgrade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST'])
        return res.status(405).json(handleApiError(
          new Error('Method not allowed'),
          requestId
        ))
      }

      await handleUpgrade(req, res, validationResult, requestId)

    } catch (error) {
      const errorResponse = handleApiError(error as Error, requestId)
      return res.status(errorResponse.error.statusCode).json(errorResponse)
    }
  }
)

async function handleUpgrade(
  req: TierValidationRequest,
  res: NextApiResponse,
  validationResult: TierValidationResult,
  requestId: string
) {
  const user = validationResult.user!
  const data: UpgradeRequest = req.body

  // Validate upgrade request
  if (!data.targetTier) {
    throw new Error('Target tier is required')
  }

  if (data.targetTier === 'free') {
    throw new Error('Cannot upgrade to free tier')
  }

  if (!isValidUpgrade(user.tier, data.targetTier)) {
    throw new Error(`Invalid upgrade path from ${user.tier} to ${data.targetTier}`)
  }

  const billingCycle = data.billingCycle || 'monthly'

  try {
    // Get current usage for proration calculations
    const currentUsage = await tierManager.getCurrentMonthUsage(user.id)
    
    // Calculate upgrade benefits and pricing
    const upgradeBenefits = calculateUpgradeBenefits(user.tier, data.targetTier, currentUsage)
    const pricingInfo = getTierPricing(data.targetTier, billingCycle)
    
    // Create Stripe checkout session
    const checkoutSession = await createUpgradeCheckoutSession({
      userId: user.id,
      fromTier: user.tier,
      toTier: data.targetTier,
      billingCycle,
      source: data.source || 'manual',
      successUrl: data.successUrl || `${process.env.NEXTAUTH_URL}/dashboard?upgrade=success`,
      cancelUrl: data.cancelUrl || `${process.env.NEXTAUTH_URL}/upgrade?cancelled=true`,
      requestId
    })

    // Calculate proration if user has existing subscription
    const proration = await calculateProration(user.id, user.tier, data.targetTier, billingCycle)

    // Record upgrade attempt
    await tierManager.recordTierUpgrade(
      user.id,
      user.tier,
      data.targetTier,
      data.source || 'manual',
      undefined, // No limit type for manual upgrades
      pricingInfo.price
    )

    const response: UpgradeResponse = {
      success: true,
      data: {
        upgrade: {
          from: user.tier,
          to: data.targetTier,
          monthlyPrice: TIER_PRICING[data.targetTier].monthly,
          annualPrice: TIER_PRICING[data.targetTier].annual,
          billingCycle,
          effectiveDate: new Date().toISOString()
        },
        checkout: {
          sessionId: checkoutSession.id,
          url: checkoutSession.url,
          expiresAt: checkoutSession.expiresAt
        },
        benefits: upgradeBenefits,
        proration
      },
      requestId
    }

    res.status(200).json(response)

    logger.info('Upgrade initiated', {
      requestId,
      userId: user.id,
      fromTier: user.tier,
      toTier: data.targetTier,
      billingCycle,
      source: data.source,
      checkoutSessionId: checkoutSession.id
    })

  } catch (error) {
    logger.error('Upgrade creation failed', {
      requestId,
      userId: user.id,
      targetTier: data.targetTier,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

async function createUpgradeCheckoutSession(params: {
  userId: string
  fromTier: SubscriptionTier
  toTier: SubscriptionTier
  billingCycle: 'monthly' | 'annual'
  source: string
  successUrl: string
  cancelUrl: string
  requestId: string
}): Promise<{
  id: string
  url: string
  expiresAt: string
}> {
  try {
    // TODO: Implement actual Stripe checkout session creation
    // const stripe = getStripeClient()
    // const priceId = STRIPE_PRICE_IDS[`${params.toTier}_${params.billingCycle}` as keyof typeof STRIPE_PRICE_IDS]
    
    // const session = await stripe.checkout.sessions.create({
    //   customer: user.stripe_customer_id,
    //   mode: 'subscription',
    //   payment_method_types: ['card'],
    //   line_items: [{
    //     price: priceId,
    //     quantity: 1,
    //   }],
    //   success_url: `${params.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    //   cancel_url: params.cancelUrl,
    //   metadata: {
    //     user_id: params.userId,
    //     from_tier: params.fromTier,
    //     to_tier: params.toTier,
    //     billing_cycle: params.billingCycle,
    //     upgrade_source: params.source,
    //     request_id: params.requestId
    //   },
    //   allow_promotion_codes: true,
    //   billing_address_collection: 'required',
    //   subscription_data: {
    //     metadata: {
    //       user_id: params.userId,
    //       tier: params.toTier,
    //       upgraded_from: params.fromTier
    //     }
    //   }
    // })

    // Mock Stripe session for development
    const sessionId = `cs_upgrade_${Date.now()}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    logger.info('Stripe checkout session created', {
      sessionId,
      userId: params.userId,
      fromTier: params.fromTier,
      toTier: params.toTier
    })

    return {
      id: sessionId,
      url: `https://checkout.stripe.com/pay/${sessionId}`,
      expiresAt: expiresAt.toISOString()
    }

  } catch (error) {
    logger.error('Stripe checkout session creation failed', {
      userId: params.userId,
      toTier: params.toTier,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw new Error('Failed to create upgrade checkout session')
  }
}

function calculateUpgradeBenefits(
  fromTier: SubscriptionTier,
  toTier: SubscriptionTier,
  currentUsage: any
): {
  analysisLimitIncrease: number | string
  costLimitIncrease: number
  newFeatures: string[]
  estimatedSavings?: number
} {
  const fromConfig = getTierConfig(fromTier)
  const toConfig = getTierConfig(toTier)

  // Analysis limit increase
  let analysisLimitIncrease: number | string = 0
  if (toConfig.monthlyAnalysisLimit === -1) {
    analysisLimitIncrease = 'Unlimited'
  } else {
    analysisLimitIncrease = toConfig.monthlyAnalysisLimit - fromConfig.monthlyAnalysisLimit
  }

  // Cost limit increase
  const costLimitIncrease = toConfig.costLimits.monthlyAiCostLimit - fromConfig.costLimits.monthlyAiCostLimit

  // New features
  const newFeatures: string[] = []
  if (toConfig.features.aiCompetitorAnalysis && !fromConfig.features.aiCompetitorAnalysis) {
    newFeatures.push('AI Competitor Analysis')
  }
  if (toConfig.features.advancedInsights && !fromConfig.features.advancedInsights) {
    newFeatures.push('Advanced Market Insights')
  }
  if (toConfig.features.priorityProcessing && !fromConfig.features.priorityProcessing) {
    newFeatures.push('Priority Processing')
  }

  // Export format improvements
  const newFormats = toConfig.features.exportFormats.filter(
    (format: string) => !fromConfig.features.exportFormats.includes(format)
  )
  if (newFormats.length > 0) {
    newFeatures.push(`Export: ${newFormats.join(', ').toUpperCase()}`)
  }

  // Support level improvement
  if (toConfig.features.supportLevel !== fromConfig.features.supportLevel) {
    newFeatures.push(`${toConfig.features.supportLevel} Support`)
  }

  // Estimated savings calculation
  let estimatedSavings: number | undefined
  if (currentUsage.total_ai_cost > fromConfig.costLimits.monthlyAiCostLimit * 0.8) {
    // Higher tiers have better cost efficiency
    estimatedSavings = Math.round(currentUsage.total_ai_cost * 0.1) // 10% savings estimate
  }

  return {
    analysisLimitIncrease,
    costLimitIncrease,
    newFeatures,
    estimatedSavings
  }
}

function getTierConfig(tier: SubscriptionTier): any {
  // Import from tier-schema.ts
  const configs = {
    free: {
      monthlyAnalysisLimit: 3,
      costLimits: { monthlyAiCostLimit: 500, perAnalysisLimit: 200 },
      features: {
        basicExtraction: true,
        aiCompetitorAnalysis: false,
        advancedInsights: false,
        priorityProcessing: false,
        exportFormats: ['json'],
        supportLevel: 'community'
      }
    },
    starter: {
      monthlyAnalysisLimit: 25,
      costLimits: { monthlyAiCostLimit: 5000, perAnalysisLimit: 500 },
      features: {
        basicExtraction: true,
        aiCompetitorAnalysis: true,
        advancedInsights: false,
        priorityProcessing: false,
        exportFormats: ['json', 'csv'],
        supportLevel: 'email'
      }
    },
    growth: {
      monthlyAnalysisLimit: 100,
      costLimits: { monthlyAiCostLimit: 15000, perAnalysisLimit: 1000 },
      features: {
        basicExtraction: true,
        aiCompetitorAnalysis: true,
        advancedInsights: true,
        priorityProcessing: false,
        exportFormats: ['json', 'csv', 'pdf'],
        supportLevel: 'priority'
      }
    },
    professional: {
      monthlyAnalysisLimit: 300,
      costLimits: { monthlyAiCostLimit: 30000, perAnalysisLimit: 2000 },
      features: {
        basicExtraction: true,
        aiCompetitorAnalysis: true,
        advancedInsights: true,
        priorityProcessing: true,
        exportFormats: ['json', 'csv', 'pdf', 'xlsx'],
        supportLevel: 'priority'
      }
    },
    enterprise: {
      monthlyAnalysisLimit: -1,
      costLimits: { monthlyAiCostLimit: 100000, perAnalysisLimit: 5000 },
      features: {
        basicExtraction: true,
        aiCompetitorAnalysis: true,
        advancedInsights: true,
        priorityProcessing: true,
        exportFormats: ['json', 'csv', 'pdf', 'xlsx', 'xml'],
        supportLevel: 'dedicated'
      }
    }
  }

  return configs[tier]
}

function getTierPricing(tier: SubscriptionTier, billingCycle: 'monthly' | 'annual'): {
  price: number
  priceId: string
} {
  if (tier === 'free') {
    return { price: 0, priceId: '' }
  }

  const pricing = TIER_PRICING[tier as keyof typeof TIER_PRICING]
  const priceId = STRIPE_PRICE_IDS[`${tier}_${billingCycle}` as keyof typeof STRIPE_PRICE_IDS]

  return {
    price: pricing[billingCycle],
    priceId
  }
}

async function calculateProration(
  userId: string,
  fromTier: SubscriptionTier,
  toTier: SubscriptionTier,
  billingCycle: 'monthly' | 'annual'
): Promise<{
  amount: number
  description: string
} | undefined> {
  if (fromTier === 'free') {
    return undefined // No proration for free tier upgrades
  }

  // TODO: Get actual subscription info from Stripe
  // const currentSubscription = await getUserSubscription(userId)
  // if (!currentSubscription) return undefined

  // Calculate proration amount
  const daysRemainingInCycle = 15 // Mock: 15 days remaining
  const daysInCycle = billingCycle === 'monthly' ? 30 : 365
  
  const fromPrice = TIER_PRICING[fromTier as keyof typeof TIER_PRICING][billingCycle]
  const toPrice = TIER_PRICING[toTier as keyof typeof TIER_PRICING][billingCycle]
  
  const dailyDifference = (toPrice - fromPrice) / daysInCycle
  const prorationAmount = Math.round(dailyDifference * daysRemainingInCycle)

  return {
    amount: prorationAmount,
    description: `Prorated upgrade for ${daysRemainingInCycle} days remaining in billing cycle`
  }
}

function isValidUpgrade(fromTier: SubscriptionTier, toTier: SubscriptionTier): boolean {
  const tierOrder = ['free', 'starter', 'growth', 'professional', 'enterprise']
  const fromIndex = tierOrder.indexOf(fromTier)
  const toIndex = tierOrder.indexOf(toTier)
  
  return toIndex > fromIndex // Can only upgrade to higher tiers
}

// API endpoint for getting upgrade options
export async function getUpgradeOptions(req: TierValidationRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = req.user!
  const currentTier = user.tier
  const availableTiers = ['starter', 'growth', 'professional', 'enterprise']
    .filter(tier => isValidUpgrade(currentTier, tier as SubscriptionTier))

  const options = availableTiers.map(tier => {
    const config = getTierConfig(tier as SubscriptionTier)
    const pricing = TIER_PRICING[tier as keyof typeof TIER_PRICING]
    
    return {
      tier,
      name: config.name || `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`,
      monthlyPrice: pricing.monthly,
      annualPrice: pricing.annual,
      analysisLimit: config.monthlyAnalysisLimit,
      features: Object.entries(config.features)
        .filter(([_, value]) => value)
        .map(([key]) => key),
      recommended: tier === getRecommendedTier(currentTier)
    }
  })

  res.json({ success: true, data: { options } })
}

function getRecommendedTier(currentTier: SubscriptionTier): SubscriptionTier {
  const recommendations: { [key in SubscriptionTier]: SubscriptionTier } = {
    free: 'starter',
    starter: 'growth',
    growth: 'professional',
    professional: 'enterprise',
    enterprise: 'enterprise'
  }
  
  return recommendations[currentTier]
}
