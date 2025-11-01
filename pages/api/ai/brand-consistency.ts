import { NextApiRequest, NextApiResponse } from 'next'
import { brandConsistencyEngine } from '../../../lib/competitive-features/brand-consistency-engine'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'
import { logger } from '../../../lib/utils/logger'

interface BrandConsistencyResponse {
  success: boolean
  data?: any
  error?: string
  processingTime: number
}

async function handler(req: NextApiRequest, res: NextApiResponse<BrandConsistencyResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      processingTime: 0
    })
  }

  const startTime = Date.now()

  try {
    const { action, masterProfile, directoryListings, inconsistencies } = req.body

    if (!action || typeof action !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Action is required (sync, detect, correct, integrity)',
        processingTime: Date.now() - startTime
      })
    }

    logger.info('Processing brand consistency action', {
      metadata: { action }
    })

    let result: any = {}

    switch (action) {
      case 'sync':
        if (!masterProfile || !directoryListings) {
          return res.status(400).json({
            success: false,
            error: 'masterProfile and directoryListings are required for sync',
            processingTime: Date.now() - startTime
          })
        }
        result = await brandConsistencyEngine.syncBrandInformation(masterProfile, directoryListings)
        break

      case 'detect':
        if (!masterProfile || !directoryListings) {
          return res.status(400).json({
            success: false,
            error: 'masterProfile and directoryListings are required for detection',
            processingTime: Date.now() - startTime
          })
        }
        result = await brandConsistencyEngine.detectInconsistencies(masterProfile, directoryListings)
        break

      case 'correct':
        if (!inconsistencies || !masterProfile) {
          return res.status(400).json({
            success: false,
            error: 'inconsistencies and masterProfile are required for correction',
            processingTime: Date.now() - startTime
          })
        }
        result = await brandConsistencyEngine.autoCorrectListings(inconsistencies, masterProfile)
        break

      case 'integrity':
        if (!masterProfile || !directoryListings) {
          return res.status(400).json({
            success: false,
            error: 'masterProfile and directoryListings are required for integrity check',
            processingTime: Date.now() - startTime
          })
        }
        result = await brandConsistencyEngine.maintainBrandIntegrity(masterProfile, directoryListings)
        break

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown action: ${action}. Valid actions: sync, detect, correct, integrity`,
          processingTime: Date.now() - startTime
        })
    }

    const processingTime = Date.now() - startTime

    logger.info('Brand consistency action completed', {
      metadata: { action, processingTime }
    })

    return res.status(200).json({
      success: true,
      data: result,
      processingTime
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('Brand consistency operation failed', {
      metadata: {
        action: req.body?.action,
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

