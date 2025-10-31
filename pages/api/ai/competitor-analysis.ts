import { NextApiRequest, NextApiResponse } from 'next'
import { rateLimit } from '../../../lib/utils/rate-limit'
import { logger } from '../../../lib/utils/logger'
import { AI, BusinessProfile, CompetitorAnalysis } from '../../../lib/services/ai-service'

// Rate limiting for competitor analysis (expensive AI operation)
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 50, // Limit to 50 unique users per minute
})

export interface CompetitorAnalysisRequest {
  businessProfile: BusinessProfile
  userTier: 'free' | 'pro' | 'enterprise'
  includePositioning?: boolean
  includeGaps?: boolean
}

export interface CompetitorAnalysisResponse {
  success: boolean
  data?: {
    competitors: CompetitorAnalysis['competitors']
    marketGaps: string[]
    positioningAdvice: string
    analysisDate: string
    businessName: string
    confidence: number
  }
  error?: string
  requestId?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CompetitorAnalysisResponse>
) {
  const requestId = `ai_comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        requestId
      })
    }

    // Check if AI is enabled
    if (!AI.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'AI competitor analysis is currently unavailable',
        requestId
      })
    }

    // Validate input
    const { businessProfile, userTier, includePositioning = true, includeGaps = true }: CompetitorAnalysisRequest = req.body

    if (!businessProfile || !businessProfile.name) {
      return res.status(400).json({
        success: false,
        error: 'Business profile is required',
        requestId
      })
    }

    // Feature gating - competitor analysis is Pro+ only
    if (userTier === 'free') {
      return res.status(403).json({
        success: false,
        error: 'Competitor analysis is a Pro feature. Upgrade to access AI-powered competitive insights.',
        requestId
      })
    }

    // Apply rate limiting (Pro users get more requests)
    try {
      const rateLimit = userTier === 'enterprise' ? 15 : 8 // Enterprise gets more requests
      await limiter.check(res, rateLimit, 'AI_COMPETITOR_CACHE_TOKEN')
    } catch {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again in a few minutes.',
        requestId
      })
    }

    // Log the request
    logger.info('AI competitor analysis requested', {
      requestId,
      userAgent: req.headers['user-agent'] as string,
      ipAddress: (req.headers['x-forwarded-for'] || req.connection.remoteAddress) as string,
      metadata: {
        businessName: businessProfile.name,
        category: businessProfile.category,
        industry: businessProfile.industry,
        userTier,
        includePositioning,
        includeGaps
      }
    })

    // Generate competitor analysis using AI
    const analysis = await AI.analyzeCompetitors(businessProfile)

    // Calculate confidence score based on business profile completeness
    let confidence = 60 // Base confidence
    if (businessProfile.description && businessProfile.description.length > 50) confidence += 10
    if (businessProfile.keywords.length > 3) confidence += 10
    if (businessProfile.targetAudience.length > 0) confidence += 10
    if (businessProfile.industry && businessProfile.category) confidence += 10

    // Filter and enhance results based on user tier
    let competitors = analysis.competitors || []
    let marketGaps = analysis.marketGaps || []
    const positioningAdvice = analysis.positioningAdvice || ''

    if (userTier === 'pro') {
      // Pro tier gets top 5 competitors
      competitors = competitors.slice(0, 5)
      marketGaps = marketGaps.slice(0, 8)
    } else if (userTier === 'enterprise') {
      // Enterprise gets full analysis
      competitors = competitors.slice(0, 10)
      marketGaps = marketGaps.slice(0, 15)
    }

    // Log successful analysis
    logger.info('AI competitor analysis completed', {
      requestId,
      metadata: {
        businessName: businessProfile.name,
        competitorCount: competitors.length,
        gapCount: marketGaps.length,
        confidence,
        userTier
      }
    })

    // Return successful response
    return res.status(200).json({
      success: true,
      data: {
        competitors,
        marketGaps: includeGaps ? marketGaps : [],
        positioningAdvice: includePositioning ? positioningAdvice : '',
        analysisDate: new Date().toISOString(),
        businessName: businessProfile.name,
        confidence
      },
      requestId
    })

  } catch (error) {
    // Handle and log errors appropriately
    logger.error('AI competitor analysis failed', { 
      requestId,
      httpMethod: req.method,
      httpUrl: '/api/ai/competitor-analysis',
      metadata: { 
        businessName: req.body?.businessProfile?.name,
        userTier: req.body?.userTier 
      }
    }, error instanceof Error ? error : new Error(String(error)))

    // Return appropriate error response
    if (error instanceof Error) {
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        return res.status(429).json({
          success: false,
          error: 'AI service quota exceeded. Please try again in a few minutes.',
          requestId
        })
      }
      
      if (error.message.includes('API') || error.message.includes('OpenAI')) {
        return res.status(503).json({
          success: false,
          error: 'AI competitor analysis temporarily unavailable.',
          requestId
        })
      }
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      error: 'Competitor analysis failed. Please try again or contact support if this persists.',
      requestId
    })
  }
}

// Export configuration for large payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
    responseLimit: '10mb',
  },
}