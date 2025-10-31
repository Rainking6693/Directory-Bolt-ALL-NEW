import { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../lib/utils/logger'
import { AI } from '../../../lib/services/ai-service'

export interface AIStatusResponse {
  success: boolean
  data?: {
    aiEnabled: boolean
    modelStatus: 'healthy' | 'degraded' | 'unavailable'
    features: {
      websiteAnalysis: boolean
      descriptionGeneration: boolean
      competitorAnalysis: boolean
    }
    lastHealthCheck: string
    responseTime?: number
  }
  error?: string
  requestId?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AIStatusResponse>
) {
  const requestId = `ai_status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  
  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        requestId
      })
    }

    // Check if AI is configured
    const aiEnabled = AI.isEnabled()
    
    if (!aiEnabled) {
      return res.status(200).json({
        success: true,
        data: {
          aiEnabled: false,
          modelStatus: 'unavailable',
          features: {
            websiteAnalysis: false,
            descriptionGeneration: false,
            competitorAnalysis: false
          },
          lastHealthCheck: new Date().toISOString()
        },
        requestId
      })
    }

    // Perform AI health check
    const healthCheckStart = Date.now()
    const isHealthy = await AI.healthCheck()
    const healthCheckTime = Date.now() - healthCheckStart

    const modelStatus = isHealthy ? 'healthy' : 
                       healthCheckTime > 10000 ? 'degraded' : 'unavailable'

    // Log health check
    logger.info('AI status check completed', {
      requestId,
      metadata: {
        aiEnabled,
        modelStatus,
        healthCheckTime,
        isHealthy
      }
    })

    const responseTime = Date.now() - startTime

    return res.status(200).json({
      success: true,
      data: {
        aiEnabled,
        modelStatus,
        features: {
          websiteAnalysis: isHealthy,
          descriptionGeneration: isHealthy,
          competitorAnalysis: isHealthy
        },
        lastHealthCheck: new Date().toISOString(),
        responseTime
      },
      requestId
    })

  } catch (error) {
    logger.error('AI status check failed', { 
      requestId,
      httpMethod: req.method,
      httpUrl: '/api/ai/status'
    }, error instanceof Error ? error : new Error(String(error)))

    return res.status(500).json({
      success: false,
      error: 'AI status check failed',
      requestId
    })
  }
}

// Export configuration
export const config = {
  api: {
    responseLimit: '1mb',
  },
}