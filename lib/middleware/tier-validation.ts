// 🔒 TIER VALIDATION MIDDLEWARE
// Validate user permissions before analysis and enforce tier-based feature access

import type { NextApiRequest, NextApiResponse } from 'next'
import type { SubscriptionTier, AnalysisType } from '../database/tier-schema'
import { tierManager } from '../services/tier-management'
import { analysisCostTracker } from '../services/analysis-cost-tracker'
import { handleApiError, Errors, AuthorizationError } from '../utils/errors'
import { logger } from '../utils/logger'

interface TierValidationRequest extends NextApiRequest {
  user?: {
    id: string
    tier: SubscriptionTier
    email: string
  }
  analysisContext?: {
    type: AnalysisType
    inputData: Record<string, any>
    estimatedCost?: number
  }
}

interface TierValidationResult {
  canProceed: boolean
  user: NonNullable<TierValidationRequest['user']>
  costEstimate?: {
    estimatedCost: number
    breakdown: any
    recommendations: string[]
  }
  upgradePrompt?: {
    shouldPrompt: boolean
    message: string
    currentTier: SubscriptionTier
    recommendedTier: SubscriptionTier
    upgradeUrl: string
  }
  usage?: any
}

/**
 * Comprehensive tier validation middleware
 * Validates user authentication, tier permissions, and usage limits
 */
export function withTierValidation(
  handler: (
    req: TierValidationRequest,
    res: NextApiResponse,
    validationResult: TierValidationResult
  ) => Promise<void>
) {
  return async (req: TierValidationRequest, res: NextApiResponse) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      // Step 1: Authenticate user
      const user = await authenticateUser(req, requestId)
      if (!user) {
        return res.status(401).json(
          handleApiError(new AuthorizationError('Authentication required', 'UNAUTHORIZED'), requestId)
        )
      }

      req.user = user

      // Step 2: Validate analysis access if analysis context provided
      let validationResult: TierValidationResult = {
        canProceed: true,
        user
      }

      if (req.analysisContext) {
        const accessValidation = await tierManager.validateAnalysisAccess(
          user.id,
          req.analysisContext.type
        )

        if (!accessValidation.canAccess) {
          // Check if upgrade prompt should be shown
          const upgradePrompt = await tierManager.checkUpgradePrompts(user.id)
          
          validationResult = {
            canProceed: false,
            user,
            upgradePrompt: upgradePrompt ? {
              shouldPrompt: true,
              message: accessValidation.reason || 'Upgrade required',
              currentTier: user.tier,
              recommendedTier: accessValidation.upgradeRequired || 'starter',
              upgradeUrl: `/upgrade?from=${user.tier}&to=${accessValidation.upgradeRequired}&source=analysis_limit`
            } : undefined,
            usage: accessValidation.usage
          }

          // Return upgrade prompt instead of hard error for better UX
          return res.status(402).json({
            success: false,
            error: {
              code: 'TIER_UPGRADE_REQUIRED',
              message: accessValidation.reason || 'Upgrade required',
              details: {
                currentTier: user.tier,
                requiredTier: accessValidation.upgradeRequired,
                limitType: accessValidation.limitType,
                upgradeUrl: validationResult.upgradePrompt?.upgradeUrl
              }
            },
            upgradePrompt: validationResult.upgradePrompt,
            usage: validationResult.usage,
            requestId
          })
        }

        // Step 3: Get cost estimate for the analysis
        const costEstimate = analysisCostTracker.estimateAnalysisCost(
          req.analysisContext.inputData,
          req.analysisContext.type,
          user.tier
        )

        validationResult.costEstimate = costEstimate
        req.analysisContext.estimatedCost = costEstimate.estimatedCost

        // Step 4: Check if cost estimate exceeds tier limits
        const tierLimits = await getTierCostLimits(user.tier)
        if (costEstimate.estimatedCost > tierLimits.perAnalysisLimit) {
          return res.status(402).json({
            success: false,
            error: {
              code: 'ANALYSIS_COST_LIMIT_EXCEEDED',
              message: `Estimated cost of $${(costEstimate.estimatedCost / 100).toFixed(2)} exceeds your tier limit of $${(tierLimits.perAnalysisLimit / 100).toFixed(2)}`,
              details: {
                estimatedCost: costEstimate.estimatedCost,
                costLimit: tierLimits.perAnalysisLimit,
                currentTier: user.tier
              }
            },
            costEstimate,
            upgradePrompt: {
              shouldPrompt: true,
              message: 'Upgrade to increase your per-analysis cost limit',
              currentTier: user.tier,
              recommendedTier: getNextTierForCostLimit(costEstimate.estimatedCost),
              upgradeUrl: `/upgrade?from=${user.tier}&source=cost_limit`
            },
            requestId
          })
        }

        // Step 5: Check for upgrade prompts even when access is allowed
        const upgradePrompt = await tierManager.checkUpgradePrompts(user.id)
        if (upgradePrompt) {
          validationResult.upgradePrompt = {
            shouldPrompt: upgradePrompt.shouldPrompt,
            message: upgradePrompt.message,
            currentTier: upgradePrompt.currentTier,
            recommendedTier: upgradePrompt.recommendedTier,
            upgradeUrl: `/upgrade?from=${upgradePrompt.currentTier}&to=${upgradePrompt.recommendedTier}&source=usage_approaching`
          }
        }

        validationResult.usage = accessValidation.usage
      }

      // Step 6: Log tier validation event
      await logTierValidation(user, req.analysisContext, validationResult, requestId)

      // Step 7: Call the actual handler
      await handler(req, res, validationResult)

    } catch (error) {
      logger.error('Tier validation middleware error', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          path: req.url
        }
      })

      const errorResponse = handleApiError(error as Error, requestId)
      return res.status(errorResponse.error.statusCode).json(errorResponse)
    }
  }
}

/**
 * Analysis-specific middleware that requires analysis context
 */
export function withAnalysisValidation(analysisType: AnalysisType) {
  return function(
    handler: (
      req: TierValidationRequest,
      res: NextApiResponse,
      validationResult: TierValidationResult
    ) => Promise<void>
  ) {
    return withTierValidation(async (req, res, validationResult) => {
      // Extract analysis context from request
      req.analysisContext = {
        type: analysisType,
        inputData: req.body?.inputData || req.body || {},
        estimatedCost: validationResult.costEstimate?.estimatedCost
      }

      // Re-validate with analysis context
      if (!validationResult.canProceed) {
        return // Already handled by parent middleware
      }

      await handler(req, res, validationResult)
    })
  }
}

/**
 * Feature-specific access control
 */
export function requiresFeature(feature: string) {
  return function(
    handler: (
      req: TierValidationRequest,
      res: NextApiResponse,
      validationResult: TierValidationResult
    ) => Promise<void>
  ) {
    return withTierValidation(async (req, res, validationResult) => {
      if (!validationResult.user) {
        return res.status(401).json(
          handleApiError(new AuthorizationError('Authentication required'), 'unknown')
        )
      }

      const hasFeature = await checkFeatureAccess(validationResult.user.tier, feature)
      if (!hasFeature) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_ACCESS_DENIED',
            message: `Feature '${feature}' requires a higher subscription tier`,
            details: {
              currentTier: validationResult.user.tier,
              requiredFeature: feature
            }
          },
          upgradePrompt: {
            shouldPrompt: true,
            message: `Upgrade to access ${feature}`,
            currentTier: validationResult.user.tier,
            recommendedTier: getRequiredTierForFeature(feature),
            upgradeUrl: `/upgrade?from=${validationResult.user.tier}&feature=${feature}`
          }
        })
      }

      await handler(req, res, validationResult)
    })
  }
}

/**
 * Usage tracking decorator
 */
export function trackUsage(analysisType: AnalysisType) {
  return function(originalMethod: any, context: ClassMethodDecoratorContext) {
    return async function(this: any, ...args: any[]) {
      const result = await originalMethod.apply(this, args)
      
      // Extract user ID and cost from result or context
      const userId = this.userId || args[0]?.user?.id
      const actualCost = result?.costBreakdown?.totalCost || 0
      
      if (userId && actualCost > 0) {
        await tierManager.consumeAnalysisUsage(
          userId,
          analysisType,
          actualCost,
          result?.costBreakdown?.openaiCost || 0,
          result?.costBreakdown?.anthropicCost || 0
        )
      }

      return result
    }
  }
}

// Helper functions

async function authenticateUser(req: TierValidationRequest, requestId: string): Promise<{
  id: string
  tier: SubscriptionTier
  email: string
} | null> {
  try {
    // TODO: Implement proper JWT token validation
    // const token = req.headers.authorization?.replace('Bearer ', '') || 
    //               req.cookies?.access_token

    // if (!token) return null

    // const decoded = jwt.verify(token, process.env.JWT_SECRET)
    // const user = await db.users.findFirst({ where: { id: decoded.sub } })
    
    // if (!user || !user.is_verified) return null

    // Mock authentication for development
    const mockUser = {
      id: 'usr_test_123',
      tier: 'free' as SubscriptionTier,
      email: 'test@directorybolt.com'
    }

    logger.info('User authenticated', {
      requestId,
      userId: mockUser.id,
      tier: mockUser.tier
    })

    return mockUser

  } catch (error) {
    logger.error('Authentication error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

async function getTierCostLimits(tier: SubscriptionTier): Promise<{
  monthlyAiCostLimit: number
  perAnalysisLimit: number
}> {
  const tierConfig = {
    free: { monthlyAiCostLimit: 500, perAnalysisLimit: 200 },
    starter: { monthlyAiCostLimit: 5000, perAnalysisLimit: 500 },
    growth: { monthlyAiCostLimit: 15000, perAnalysisLimit: 1000 },
    professional: { monthlyAiCostLimit: 30000, perAnalysisLimit: 2000 },
    enterprise: { monthlyAiCostLimit: 100000, perAnalysisLimit: 5000 }
  }

  return tierConfig[tier]
}

function getNextTierForCostLimit(requiredCost: number): SubscriptionTier {
  if (requiredCost <= 500) return 'starter'
  if (requiredCost <= 1000) return 'growth'  
  if (requiredCost <= 2000) return 'professional'
  return 'enterprise'
}

async function checkFeatureAccess(tier: SubscriptionTier, feature: string): Promise<boolean> {
  const tierFeatures = {
    free: ['basic_extraction'],
    starter: ['basic_extraction', 'ai_competitor_analysis', 'csv_export'],
    growth: ['basic_extraction', 'ai_competitor_analysis', 'advanced_insights', 'pdf_export'],
    professional: ['basic_extraction', 'ai_competitor_analysis', 'advanced_insights', 'priority_processing', 'xlsx_export'],
    enterprise: ['basic_extraction', 'ai_competitor_analysis', 'advanced_insights', 'priority_processing', 'dedicated_support', 'xml_export']
  }

  return tierFeatures[tier].includes(feature)
}

function getRequiredTierForFeature(feature: string): SubscriptionTier {
  const featureRequirements = {
    'ai_competitor_analysis': 'starter',
    'advanced_insights': 'growth',
    'priority_processing': 'professional',
    'dedicated_support': 'enterprise'
  }

  return (featureRequirements[feature as keyof typeof featureRequirements] || 'starter') as SubscriptionTier
}

async function logTierValidation(
  user: any,
  analysisContext: any,
  validationResult: TierValidationResult,
  requestId: string
): Promise<void> {
  const logData = {
    timestamp: new Date().toISOString(),
    requestId,
    userId: user.id,
    userTier: user.tier,
    analysisType: analysisContext?.type,
    canProceed: validationResult.canProceed,
    estimatedCost: validationResult.costEstimate?.estimatedCost,
    upgradePrompted: !!validationResult.upgradePrompt
  }

  logger.info('Tier validation completed', logData)

  // TODO: Save to audit log database
  // await db.auditLogs.create({
  //   data: {
  //     user_id: user.id,
  //     action: 'tier_validation',
  //     entity_type: 'analysis',
  //     entity_id: requestId,
  //     new_values: logData
  //   }
  // })
}

// Export additional utilities
export type { TierValidationRequest, TierValidationResult }