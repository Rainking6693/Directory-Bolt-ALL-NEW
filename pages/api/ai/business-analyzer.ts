import { NextApiRequest, NextApiResponse } from 'next'
import { AIBusinessAnalyzer } from '../../../lib/services/ai-business-analyzer'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'
import { logger } from '../../../lib/utils/logger'

interface BusinessAnalyzerResponse {
  success: boolean
  data?: any
  error?: string
  processingTime: number
}

async function handler(req: NextApiRequest, res: NextApiResponse<BusinessAnalyzerResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      processingTime: 0
    })
  }

  const startTime = Date.now()

  try {
    const { websiteData, analysisType = 'full' } = req.body

    // Validate required fields
    if (!websiteData || !websiteData.url) {
      return res.status(400).json({
        success: false,
        error: 'Website data with URL is required',
        processingTime: Date.now() - startTime
      })
    }

    logger.info('Starting AI business analysis', {
      metadata: {
        url: websiteData.url,
        analysisType
      }
    })

    const analyzer = AIBusinessAnalyzer.getInstance()

    // Perform analysis based on type
    let result: any = {}

    if (analysisType === 'full' || analysisType === 'profile') {
      result.businessProfile = await analyzer.analyzeBusinessProfile(websiteData)
    }

    if (analysisType === 'full' || analysisType === 'competitive') {
      if (!result.businessProfile) {
        result.businessProfile = await analyzer.analyzeBusinessProfile(websiteData)
      }
      result.competitiveAnalysis = await analyzer.performCompetitiveAnalysis(result.businessProfile)
    }

    if (analysisType === 'full' || analysisType === 'seo') {
      if (!result.businessProfile) {
        result.businessProfile = await analyzer.analyzeBusinessProfile(websiteData)
      }
      result.seoAnalysis = await analyzer.analyzeSEOOpportunities(websiteData, result.businessProfile)
    }

    if (analysisType === 'full' || analysisType === 'market') {
      if (!result.businessProfile) {
        result.businessProfile = await analyzer.analyzeBusinessProfile(websiteData)
      }
      if (!result.competitiveAnalysis) {
        result.competitiveAnalysis = await analyzer.performCompetitiveAnalysis(result.businessProfile)
      }
      result.marketInsights = await analyzer.generateMarketInsights(
        result.businessProfile,
        result.competitiveAnalysis
      )
    }

    // Generate comprehensive business intelligence if full analysis
    if (analysisType === 'full') {
      result.businessIntelligence = await analyzer.generateBusinessIntelligence(websiteData)
    }

    const processingTime = Date.now() - startTime

    logger.info('AI business analysis completed successfully', {
      metadata: {
        url: websiteData.url,
        analysisType,
        processingTime
      }
    })

    return res.status(200).json({
      success: true,
      data: result,
      processingTime
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('AI business analysis failed', {
      metadata: {
        url: req.body?.websiteData?.url,
        analysisType: req.body?.analysisType,
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

