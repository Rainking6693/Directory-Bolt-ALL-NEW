import { NextApiRequest, NextApiResponse } from 'next'
import { createBusinessIntelligenceEngine, DEFAULT_BUSINESS_INTELLIGENCE_CONFIG } from '../../../lib/services/ai-business-intelligence-engine'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'
import { logger } from '../../../lib/utils/logger'

interface BusinessIntelligenceResponse {
  success: boolean
  data?: any
  error?: string
  processingTime: number
  progress?: any
}

async function handler(req: NextApiRequest, res: NextApiResponse<BusinessIntelligenceResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      processingTime: 0
    })
  }

  const startTime = Date.now()

  try {
    const { url, userInput, config } = req.body

    // Validate required fields
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Website URL is required',
        processingTime: Date.now() - startTime
      })
    }

    logger.info('Starting AI Business Intelligence analysis', {
      metadata: {
        url,
        hasUserInput: !!userInput,
        hasCustomConfig: !!config
      }
    })

    // Create engine with custom config if provided
    const engineConfig = config 
      ? { ...DEFAULT_BUSINESS_INTELLIGENCE_CONFIG, ...config }
      : DEFAULT_BUSINESS_INTELLIGENCE_CONFIG

    const engine = createBusinessIntelligenceEngine(engineConfig)

    // Set up progress tracking if enabled
    let progressUpdates: any[] = []
    if (engineConfig.enableProgressTracking) {
      engine.onProgress((progress) => {
        progressUpdates.push(progress)
      })
    }

    // Perform comprehensive analysis
    const result = await engine.performComprehensiveAnalysis({
      url,
      userInput: userInput || {},
      config: engineConfig
    })

    const processingTime = Date.now() - startTime

    logger.info('AI Business Intelligence analysis completed successfully', {
      metadata: {
        url,
        processingTime,
        confidence: result.confidence,
        qualityScore: result.qualityScore
      }
    })

    return res.status(200).json({
      success: true,
      data: result,
      processingTime,
      progress: progressUpdates.length > 0 ? progressUpdates : undefined
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('AI Business Intelligence analysis failed', {
      metadata: {
        url: req.body?.url,
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

