// 🔒 WEBSITE ANALYSIS API WITH TIER VALIDATION
// POST /api/analysis/website-analyze - AI-powered website analysis with tier enforcement

import type { NextApiRequest, NextApiResponse } from 'next'
import { withAnalysisValidation, trackUsage } from '../../../lib/middleware/tier-validation'
import type { TierValidationRequest, TierValidationResult } from '../../../lib/middleware/tier-validation'
import { analysisCostTracker } from '../../../lib/services/analysis-cost-tracker'
import { tierManager } from '../../../lib/services/tier-management'
import { handleApiError, Errors } from '../../../lib/utils/errors'
import { logger } from '../../../lib/utils/logger'
import type { AnalysisJob, AnalysisType, SubscriptionTier } from '../../../lib/database/tier-schema'

interface WebsiteAnalysisRequest {
  websiteUrl: string
  businessName?: string
  analysisType: AnalysisType
  includeCompetitors?: boolean
  exportFormat?: 'json' | 'csv' | 'pdf' | 'xlsx'
}

interface WebsiteAnalysisResponse {
  success: true
  data: {
    analysisId: string
    results: {
      basicExtraction?: {
        title: string
        description: string
        keywords: string[]
        contactInfo: Record<string, any>
        technologies: string[]
      }
      competitorAnalysis?: {
        competitors: Array<{
          name: string
          url: string
          strengths: string[]
          weaknesses: string[]
          marketPosition: string
        }>
        competitiveAdvantages: string[]
        marketGaps: string[]
      }
      advancedInsights?: {
        marketAnalysis: string
        recommendedStrategies: string[]
        riskAssessment: string[]
        growthOpportunities: string[]
      }
    }
    costBreakdown: {
      totalCost: number
      openaiCost: number
      anthropicCost: number
      tokensUsed: number
    }
    usage: {
      analysesRemainingThisMonth: number
      costRemainingThisMonth: number
    }
    processingTime: number
  }
  upgradePrompt?: {
    shouldPrompt: boolean
    message: string
    currentTier: SubscriptionTier
    recommendedTier: SubscriptionTier
    upgradeUrl: string
  }
  requestId: string
}

// Apply tier validation middleware for AI competitor analysis
export default withAnalysisValidation('ai_competitor_analysis')(
  async function handler(
    req: TierValidationRequest,
    res: NextApiResponse<WebsiteAnalysisResponse | any>,
    validationResult: TierValidationResult
  ) {
    const requestId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST'])
        return res.status(405).json(handleApiError(
          new Error('Method not allowed'),
          requestId
        ))
      }

      await performWebsiteAnalysis(req, res, validationResult, requestId)

    } catch (error) {
      const errorResponse = handleApiError(error as Error, requestId)
      return res.status(errorResponse.error.statusCode).json(errorResponse)
    }
  }
)

async function performWebsiteAnalysis(
  req: TierValidationRequest,
  res: NextApiResponse,
  validationResult: TierValidationResult,
  requestId: string
) {
  const data: WebsiteAnalysisRequest = req.body
  const user = validationResult.user!
  const startTime = Date.now()

  // Validate request data
  if (!data.websiteUrl || !data.analysisType) {
    throw new Error('Website URL and analysis type are required')
  }

  if (!isValidUrl(data.websiteUrl)) {
    throw new Error('Invalid website URL provided')
  }

  // Create analysis job record
  const analysisJob = await createAnalysisJob({
    userId: user.id,
    websiteUrl: data.websiteUrl,
    analysisType: data.analysisType,
    userTier: user.tier,
    estimatedCost: validationResult.costEstimate?.estimatedCost || 0,
    requestId
  })

  try {
    // Perform the actual analysis based on type and tier
    const analysisResults = await executeAnalysis(data, user.tier, analysisJob.id)
    
    // Track actual costs
    const costBreakdown = await analysisCostTracker.trackActualCosts(
      analysisJob.id,
      user.id,
      analysisResults.aiUsage
    )

    // Update usage counters
    await tierManager.consumeAnalysisUsage(
      user.id,
      data.analysisType,
      costBreakdown.totalCost,
      costBreakdown.openaiCost,
      costBreakdown.anthropicCost
    )

    // Complete analysis job
    await completeAnalysisJob(analysisJob.id, {
      results: analysisResults.results,
      costBreakdown,
      processingTime: Date.now() - startTime
    })

    // Get updated usage information
    const currentUsage = await tierManager.getCurrentMonthUsage(user.id)
    const tierConfig = getTierLimits(user.tier)

    const response: WebsiteAnalysisResponse = {
      success: true,
      data: {
        analysisId: analysisJob.id,
        results: analysisResults.results,
        costBreakdown: {
          totalCost: costBreakdown.totalCost,
          openaiCost: costBreakdown.openaiCost,
          anthropicCost: costBreakdown.anthropicCost,
          tokensUsed: analysisResults.totalTokensUsed
        },
        usage: {
          analysesRemainingThisMonth: Math.max(0, tierConfig.monthlyLimit - currentUsage.total_analyses),
          costRemainingThisMonth: Math.max(0, tierConfig.monthlyCostLimit - currentUsage.total_ai_cost)
        },
        processingTime: Date.now() - startTime
      },
      upgradePrompt: validationResult.upgradePrompt,
      requestId
    }

    // Set appropriate headers for caching and security
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    res.setHeader('X-Analysis-Cost', costBreakdown.totalCost.toString())
    res.setHeader('X-User-Tier', user.tier)

    res.status(200).json({
  success: true,
  data: response
})

    // Log successful analysis
    logger.info('Website analysis completed', {
      requestId,
      userId: user.id,
      metadata: {
        analysisType: data.analysisType,
        websiteUrl: data.websiteUrl,
        totalCost: costBreakdown.totalCost,
        processingTime: Date.now() - startTime
      }
    })

  } catch (error) {
    // Mark analysis job as failed
    await failAnalysisJob(analysisJob.id, error instanceof Error ? error.message : 'Unknown error')
    throw error
  }
}

async function executeAnalysis(
  data: WebsiteAnalysisRequest,
  userTier: SubscriptionTier,
  jobId: string
): Promise<{
  results: any
  aiUsage: any
  totalTokensUsed: number
}> {
  const results: any = {}
  let totalTokensUsed = 0
  const aiUsage: any = {}

  try {
    // Basic extraction - available to all tiers
    if (data.analysisType === 'basic_extraction' || data.analysisType === 'ai_competitor_analysis' || data.analysisType === 'full_analysis') {
      const extractionResult = await performBasicExtraction(data.websiteUrl, userTier)
      results.basicExtraction = extractionResult.data
      totalTokensUsed += extractionResult.tokensUsed
      
      if (extractionResult.aiUsage.openai) {
        aiUsage.openai = extractionResult.aiUsage.openai
      }
    }

    // AI Competitor Analysis - starter tier and above
    if ((data.analysisType === 'ai_competitor_analysis' || data.analysisType === 'full_analysis') && 
        ['starter', 'growth', 'professional', 'enterprise'].includes(userTier)) {
      const competitorResult = await performCompetitorAnalysis(data.websiteUrl, data.businessName, userTier)
      results.competitorAnalysis = competitorResult.data
      totalTokensUsed += competitorResult.tokensUsed

      if (competitorResult.aiUsage.openai) {
        if (aiUsage.openai) {
          aiUsage.openai.inputTokens += competitorResult.aiUsage.openai.inputTokens
          aiUsage.openai.outputTokens += competitorResult.aiUsage.openai.outputTokens
        } else {
          aiUsage.openai = competitorResult.aiUsage.openai
        }
      }

      if (competitorResult.aiUsage.anthropic) {
        aiUsage.anthropic = competitorResult.aiUsage.anthropic
      }
    }

    // Advanced Insights - growth tier and above
    if ((data.analysisType === 'advanced_insights' || data.analysisType === 'full_analysis') &&
        ['growth', 'professional', 'enterprise'].includes(userTier)) {
      const insightsResult = await performAdvancedInsights(data.websiteUrl, results, userTier)
      results.advancedInsights = insightsResult.data
      totalTokensUsed += insightsResult.tokensUsed

      if (insightsResult.aiUsage.anthropic) {
        if (aiUsage.anthropic) {
          aiUsage.anthropic.inputTokens += insightsResult.aiUsage.anthropic.inputTokens
          aiUsage.anthropic.outputTokens += insightsResult.aiUsage.anthropic.outputTokens
        } else {
          aiUsage.anthropic = insightsResult.aiUsage.anthropic
        }
      }
    }

    return { results, aiUsage, totalTokensUsed }

  } catch (error) {
    logger.error('Analysis execution error', {
      metadata: {
        jobId,
        analysisType: data.analysisType,
        userTier,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    throw error
  }
}

// Mock analysis functions (replace with actual AI service calls)

async function performBasicExtraction(websiteUrl: string, userTier: SubscriptionTier): Promise<{
  data: any
  tokensUsed: number
  aiUsage: any
}> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Mock extraction results
  const data = {
    title: "Example Business - Professional Services",
    description: "Leading provider of professional services with 10+ years of experience",
    keywords: ["professional services", "consulting", "business solutions"],
    contactInfo: {
      email: "contact@example.com",
      phone: "+1-555-0123",
      address: "123 Business St, City, State 12345"
    },
    technologies: ["WordPress", "Google Analytics", "Stripe"]
  }

  const tokensUsed = 2500 // Mock token usage
  const aiUsage = {
    openai: {
      model: 'gpt-4o-mini',
      inputTokens: 1500,
      outputTokens: 1000,
      responseTime: 800,
      requestId: `openai_${Date.now()}`
    }
  }

  return { data, tokensUsed, aiUsage }
}

async function performCompetitorAnalysis(websiteUrl: string, businessName?: string, userTier?: SubscriptionTier): Promise<{
  data: any
  tokensUsed: number
  aiUsage: any
}> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 2000))

  const data = {
    competitors: [
      {
        name: "Competitor A",
        url: "https://competitor-a.com",
        strengths: ["Strong brand presence", "Excellent customer service"],
        weaknesses: ["Higher pricing", "Limited service area"],
        marketPosition: "Premium market leader"
      },
      {
        name: "Competitor B", 
        url: "https://competitor-b.com",
        strengths: ["Competitive pricing", "Fast delivery"],
        weaknesses: ["Lower quality", "Poor customer support"],
        marketPosition: "Budget-friendly option"
      }
    ],
    competitiveAdvantages: [
      "Better technology stack",
      "More personalized service",
      "Stronger local presence"
    ],
    marketGaps: [
      "Underserved small business segment",
      "Lack of mobile-first solutions",
      "Limited industry-specific offerings"
    ]
  }

  const tokensUsed = 5200
  const aiUsage: any = {
    openai: {
      model: 'gpt-4o',
      inputTokens: 3000,
      outputTokens: 2200,
      responseTime: 1800,
      requestId: `openai_${Date.now()}`
    }
  }

  // Add Anthropic for professional+ tiers
  if (userTier === 'professional' || userTier === 'enterprise') {
    aiUsage.anthropic = {
      model: 'claude-3-haiku-20240307',
      inputTokens: 2800,
      outputTokens: 1800,
      responseTime: 1200,
      requestId: `anthropic_${Date.now()}`
    }
  }

  return { data, tokensUsed, aiUsage }
}

async function performAdvancedInsights(websiteUrl: string, previousResults: any, userTier: SubscriptionTier): Promise<{
  data: any
  tokensUsed: number
  aiUsage: any
}> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 3000))

  const data = {
    marketAnalysis: "The market shows strong growth potential with increasing demand for digital solutions. Key trends include...",
    recommendedStrategies: [
      "Focus on digital transformation services",
      "Develop industry-specific solutions",
      "Expand into adjacent markets",
      "Strengthen online presence"
    ],
    riskAssessment: [
      "Increased competition from tech companies",
      "Economic uncertainty affecting B2B spending",
      "Regulatory changes in data privacy"
    ],
    growthOpportunities: [
      "AI-powered service offerings", 
      "Subscription-based revenue model",
      "International market expansion",
      "Strategic partnerships with tech companies"
    ]
  }

  const tokensUsed = 7800
  const aiUsage = {
    anthropic: {
      model: 'claude-3-5-sonnet-20241022',
      inputTokens: 4500,
      outputTokens: 3300,
      responseTime: 2800,
      requestId: `anthropic_${Date.now()}`
    }
  }

  return { data, tokensUsed, aiUsage }
}

// Database helper functions (mock implementations)

async function createAnalysisJob(params: {
  userId: string
  websiteUrl: string
  analysisType: AnalysisType
  userTier: SubscriptionTier
  estimatedCost: number
  requestId: string
}): Promise<AnalysisJob> {
  const job: AnalysisJob = {
    id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    user_id: params.userId,
    type: params.analysisType,
    input_data: { websiteUrl: params.websiteUrl },
    status: 'processing',
    user_tier_at_creation: params.userTier,
    tier_validated: true,
    feature_access_validated: true,
    total_ai_cost: 0,
    estimated_cost_before_run: params.estimatedCost,
    retry_count: 0,
    max_retries: 3,
    created_at: new Date(),
    updated_at: new Date()
  }

  // TODO: Save to database
  // await db.analysisJobs.create({ data: job })

  logger.info('Analysis job created', {
    metadata: {
      jobId: job.id,
      userId: params.userId,
      analysisType: params.analysisType,
      estimatedCost: params.estimatedCost
    }
  })

  return job
}

async function completeAnalysisJob(jobId: string, results: {
  results: any
  costBreakdown: any
  processingTime: number
}): Promise<void> {
  // TODO: Update database
  // await db.analysisJobs.update({
  //   where: { id: jobId },
  //   data: {
  //     status: 'completed',
  //     completed_at: new Date(),
  //     processing_time_ms: results.processingTime,
  //     total_ai_cost: results.costBreakdown.totalCost,
  //     extraction_results: results.results.basicExtraction,
  //     competitor_analysis: results.results.competitorAnalysis,
  //     ai_insights: results.results.advancedInsights
  //   }
  // })

  logger.info('Analysis job completed', {
    metadata: {
      jobId,
      processingTime: results.processingTime,
      totalCost: results.costBreakdown.totalCost
    }
  })
}

async function failAnalysisJob(jobId: string, errorMessage: string): Promise<void> {
  // TODO: Update database
  // await db.analysisJobs.update({
  //   where: { id: jobId },
  //   data: {
  //     status: 'failed',
  //     failed_at: new Date(),
  //     error_message: errorMessage
  //   }
  // })

  logger.error('Analysis job failed', { metadata: { jobId, errorMessage } })
}

// Utility functions

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

function getTierLimits(tier: SubscriptionTier): { monthlyLimit: number; monthlyCostLimit: number } {
  const limits = {
    free: { monthlyLimit: 3, monthlyCostLimit: 500 },
    starter: { monthlyLimit: 25, monthlyCostLimit: 5000 },
    growth: { monthlyLimit: 100, monthlyCostLimit: 15000 },
    professional: { monthlyLimit: 300, monthlyCostLimit: 30000 },
    enterprise: { monthlyLimit: -1, monthlyCostLimit: 100000 }
  }
  
  return limits[tier]
}