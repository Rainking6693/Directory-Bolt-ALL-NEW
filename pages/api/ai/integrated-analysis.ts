import { NextApiRequest, NextApiResponse } from 'next'
import { performIntegratedAnalysis, IntegratedAnalysisRequest } from '../../../lib/services/integrated-seo-ai-service'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'
import { logger } from '../../../lib/utils/logger'

interface IntegratedAnalysisResponse {
  success: boolean
  data?: any
  error?: string
  processingTime: number
}

async function handler(req: NextApiRequest, res: NextApiResponse<IntegratedAnalysisResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      processingTime: 0
    })
  }

  const startTime = Date.now()

  try {
    const {
      businessProfile,
      customerId,
      userTier = 'free',
      analysisScope,
      competitorUrls,
      targetKeywords,
      currentContent,
      forceRefresh
    } = req.body

    // Validate required fields
    if (!businessProfile || !businessProfile.name) {
      return res.status(400).json({
        success: false,
        error: 'Business profile with name is required',
        processingTime: Date.now() - startTime
      })
    }

    if (!analysisScope || typeof analysisScope !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Analysis scope is required',
        processingTime: Date.now() - startTime
      })
    }

    // Validate user tier
    const validTiers = ['free', 'professional', 'enterprise']
    if (!validTiers.includes(userTier)) {
      return res.status(400).json({
        success: false,
        error: `Invalid user tier. Must be one of: ${validTiers.join(', ')}`,
        processingTime: Date.now() - startTime
      })
    }

    logger.info('Starting integrated SEO + AI analysis', {
      metadata: {
        businessName: businessProfile.name,
        userTier,
        customerId,
        analysisScope
      }
    })

    // Build request
    const analysisRequest: IntegratedAnalysisRequest = {
      businessProfile: {
        name: businessProfile.name,
        description: businessProfile.description || '',
        category: businessProfile.category || 'General',
        subcategory: businessProfile.subcategory,
        industry: businessProfile.industry || 'General',
        location: businessProfile.location,
        targetAudience: businessProfile.targetAudience || [],
        keywords: businessProfile.keywords || [],
        businessModel: businessProfile.businessModel || 'Service Provider',
        size: businessProfile.size || 'small',
        stage: businessProfile.stage || 'early'
      },
      customerId,
      userTier: userTier as 'free' | 'professional' | 'enterprise',
      analysisScope: {
        includeDirectoryAnalysis: analysisScope.includeDirectoryAnalysis ?? true,
        includeSEOAnalysis: analysisScope.includeSEOAnalysis ?? false,
        includeCompetitorResearch: analysisScope.includeCompetitorResearch ?? false,
        includeContentOptimization: analysisScope.includeContentOptimization ?? false,
        includeKeywordAnalysis: analysisScope.includeKeywordAnalysis ?? false
      },
      competitorUrls: competitorUrls || [],
      targetKeywords: targetKeywords || [],
      currentContent,
      forceRefresh: forceRefresh ?? false
    }

    // Perform integrated analysis
    const result = await performIntegratedAnalysis(analysisRequest)

    const processingTime = Date.now() - startTime

    logger.info('Integrated analysis completed successfully', {
      metadata: {
        businessName: businessProfile.name,
        userTier,
        processingTime,
        confidence: result.analysisMetrics?.confidence,
        completeness: result.analysisMetrics?.completeness
      }
    })

    return res.status(200).json({
      success: true,
      data: result,
      processingTime
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('Integrated analysis failed', {
      metadata: {
        url: req.body?.businessProfile?.name,
        userTier: req.body?.userTier,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error as Error)

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
      processingTime
    })
  }
}

export default withRateLimit(handler, rateLimiters.analyze)

