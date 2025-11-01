import { NextApiRequest, NextApiResponse } from 'next'
import { ContentGapAnalyzer } from '../../../lib/services/content-gap-analyzer'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'
import { logger } from '../../../lib/utils/logger'

interface ContentGapResponse {
  success: boolean
  data?: any
  error?: string
  processingTime: number
}

async function handler(req: NextApiRequest, res: NextApiResponse<ContentGapResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      processingTime: 0
    })
  }

  const startTime = Date.now()

  try {
    const { targetWebsite, options = {} } = req.body

    // Validate required fields
    if (!targetWebsite || typeof targetWebsite !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Target website URL is required',
        processingTime: Date.now() - startTime
      })
    }

    logger.info('Starting content gap analysis', {
      metadata: {
        targetWebsite
      }
    })

    const analyzer = new ContentGapAnalyzer()
    const result = await analyzer.analyzeContentGaps(targetWebsite, options)

    const processingTime = Date.now() - startTime

    logger.info('Content gap analysis completed successfully', {
      metadata: {
        targetWebsite,
        processingTime,
        missingKeywords: result.missingKeywords?.length || 0
      }
    })

    return res.status(200).json({
      success: true,
      data: result,
      processingTime
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('Content gap analysis failed', {
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
