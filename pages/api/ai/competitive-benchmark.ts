import { NextApiRequest, NextApiResponse } from 'next'
import { CompetitiveBenchmarkingService } from '../../../lib/services/competitive-benchmarking'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'
import { logger } from '../../../lib/utils/logger'

interface CompetitiveBenchmarkResponse {
  success: boolean
  data?: any
  error?: string
  processingTime: number
}

async function handler(req: NextApiRequest, res: NextApiResponse<CompetitiveBenchmarkResponse>) {
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
      targetWebsite,
      industry,
      competitors,
      includeTrafficEstimates = false,
      includeContentStrategy = true,
      includeTechnicalSEO = true,
      includeBacklinkAnalysis = false
    } = req.body

    // Validate required fields
    if (!targetWebsite || typeof targetWebsite !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Target website URL is required',
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

    logger.info('Starting competitive benchmark analysis', {
      metadata: {
        targetWebsite,
        industry,
        competitorCount: competitors?.length || 0
      }
    })

    const benchmarkingService = new CompetitiveBenchmarkingService()
    const result = await benchmarkingService.performBenchmarkAnalysis({
      targetWebsite,
      industry,
      competitors,
      benchmarkingDepth: 'basic',
      includeTrafficEstimates,
      includeContentStrategy,
      includeTechnicalSEO,
      includeBacklinkAnalysis
    })

    const processingTime = Date.now() - startTime

    logger.info('Competitive benchmark analysis completed successfully', {
      metadata: {
        targetWebsite,
        industry,
        processingTime,
        totalCompetitorsAnalyzed: result.totalCompetitorsAnalyzed
      }
    })

    return res.status(200).json({
      success: true,
      data: result,
      processingTime
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('Competitive benchmark analysis failed', {
      metadata: {
        targetWebsite: req.body?.targetWebsite,
        industry: req.body?.industry,
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

