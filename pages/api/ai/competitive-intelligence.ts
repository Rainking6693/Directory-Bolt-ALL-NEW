import { NextApiRequest, NextApiResponse } from 'next'
import { competitiveIntelligenceEngine } from '../../../lib/competitive-features/competitive-intelligence-engine'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'
import { logger } from '../../../lib/utils/logger'

interface CompetitiveIntelligenceResponse {
  success: boolean
  data?: any
  error?: string
  processingTime: number
}

async function handler(req: NextApiRequest, res: NextApiResponse<CompetitiveIntelligenceResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      processingTime: 0
    })
  }

  const startTime = Date.now()

  try {
    const { targetWebsite, industry, competitors, focusAreas, analysisType = 'full' } = req.body

    if (!targetWebsite || typeof targetWebsite !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Target website is required',
        processingTime: Date.now() - startTime
      })
    }

    if (!industry || typeof industry !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Industry is required',
        processingTime: Date.now() - startTime
      })
    }

    logger.info('Starting competitive intelligence analysis', {
      metadata: { targetWebsite, industry, analysisType }
    })

    const request = { targetWebsite, industry, competitors, focusAreas }
    let result: any = {}

    if (analysisType === 'full' || analysisType === 'competitors') {
      result.competitors = await competitiveIntelligenceEngine.trackCompetitors(request)
    }

    if (analysisType === 'full' || analysisType === 'opportunities') {
      result.opportunities = await competitiveIntelligenceEngine.analyzeMarketOpportunities(request)
    }

    if (analysisType === 'full' || analysisType === 'predictions') {
      result.predictions = await competitiveIntelligenceEngine.predictRankingChanges(request)
    }

    if (analysisType === 'full' || analysisType === 'insights') {
      result.insights = await competitiveIntelligenceEngine.generateStrategicInsights(request)
    }

    const processingTime = Date.now() - startTime

    logger.info('Competitive intelligence analysis completed', {
      metadata: { targetWebsite, processingTime }
    })

    return res.status(200).json({
      success: true,
      data: result,
      processingTime
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('Competitive intelligence analysis failed', {
      metadata: {
        targetWebsite: req.body?.targetWebsite,
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

