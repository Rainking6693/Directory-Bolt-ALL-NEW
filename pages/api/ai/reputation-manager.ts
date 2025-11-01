import { NextApiRequest, NextApiResponse } from 'next'
import { aiReputationManager } from '../../../lib/competitive-features/ai-reputation-manager'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'
import { logger } from '../../../lib/utils/logger'

interface ReputationManagerResponse {
  success: boolean
  data?: any
  error?: string
  processingTime: number
}

async function handler(req: NextApiRequest, res: NextApiResponse<ReputationManagerResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      processingTime: 0
    })
  }

  const startTime = Date.now()

  try {
    const { action, businessId, directories, reviews, historicalData, currentPresence } = req.body

    if (!action || typeof action !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Action is required (monitor, respond, predict, optimize)',
        processingTime: Date.now() - startTime
      })
    }

    logger.info('Processing reputation management action', {
      metadata: { action, businessId }
    })

    let result: any = {}

    switch (action) {
      case 'monitor':
        if (!businessId || !directories) {
          return res.status(400).json({
            success: false,
            error: 'businessId and directories are required for monitoring',
            processingTime: Date.now() - startTime
          })
        }
        result = await aiReputationManager.monitorDirectoryReviews(businessId, directories)
        break

      case 'respond':
        if (!reviews || !Array.isArray(reviews)) {
          return res.status(400).json({
            success: false,
            error: 'reviews array is required for response generation',
            processingTime: Date.now() - startTime
          })
        }
        result = await aiReputationManager.generateAutoResponses(reviews)
        break

      case 'predict':
        if (!businessId) {
          return res.status(400).json({
            success: false,
            error: 'businessId is required for predictions',
            processingTime: Date.now() - startTime
          })
        }
        result = await aiReputationManager.predictReputationTrends(businessId, historicalData)
        break

      case 'optimize':
        if (!businessId) {
          return res.status(400).json({
            success: false,
            error: 'businessId is required for optimization',
            processingTime: Date.now() - startTime
          })
        }
        result = await aiReputationManager.optimizeDirectoryPresence(businessId, currentPresence)
        break

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown action: ${action}. Valid actions: monitor, respond, predict, optimize`,
          processingTime: Date.now() - startTime
        })
    }

    const processingTime = Date.now() - startTime

    logger.info('Reputation management action completed', {
      metadata: { action, businessId, processingTime }
    })

    return res.status(200).json({
      success: true,
      data: result,
      processingTime
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('Reputation management failed', {
      metadata: {
        action: req.body?.action,
        businessId: req.body?.businessId,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error as Error)

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Operation failed',
      processingTime
    })
  }
}

export default withRateLimit(handler, rateLimiters.analyze)

