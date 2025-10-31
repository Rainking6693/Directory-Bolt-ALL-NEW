// 🚀 AI SERVICES HEALTH CHECK API
// Monitor health and availability of AI Business Intelligence services

import { NextApiRequest, NextApiResponse } from 'next'
import { getBusinessIntelligenceEngine } from '../../lib/services/ai-business-intelligence-engine'
import { logger } from '../../lib/utils/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed. Use GET.',
      code: 'METHOD_NOT_ALLOWED'
    })
  }

  const startTime = Date.now()

  try {
    // Get AI Business Intelligence Engine instance
    const engine = getBusinessIntelligenceEngine()

    // Perform health check
    const healthResult = await engine.healthCheck()
    const responseTime = Date.now() - startTime

    // Determine overall health status
    const isHealthy = healthResult.status === 'healthy'
    const statusCode = isHealthy ? 200 : healthResult.status === 'degraded' ? 503 : 503

    const response = {
      status: healthResult.status,
      timestamp: new Date().toISOString(),
      responseTime,
      services: {
        aiService: {
          status: healthResult.components.aiService ? 'healthy' : 'unhealthy',
          description: healthResult.components.aiService 
            ? 'OpenAI API connection successful'
            : 'OpenAI API connection failed'
        },
        database: {
          status: healthResult.components.database ? 'healthy' : 'unhealthy',
          description: healthResult.components.database
            ? 'Database connection successful'
            : 'Database connection failed'
        },
        puppeteer: {
          status: healthResult.components.puppeteer ? 'healthy' : 'unhealthy',
          description: healthResult.components.puppeteer
            ? 'Puppeteer browser engine available'
            : 'Puppeteer browser engine unavailable'
        }
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        uptime: Math.round(process.uptime())
      },
      configuration: {
        openaiConfigured: !!process.env.OPENAI_API_KEY,
        screenshotsEnabled: true,
        aiModel: process.env.AI_MODEL || 'gpt-4o',
        maxDirectories: 50
      }
    }

    logger.info('AI health check completed', {
      metadata: {
        status: healthResult.status,
        responseTime,
        components: Object.keys(healthResult.components).length
      }
    })

    return res.status(statusCode).json(response)

  } catch (error) {
    const responseTime = Date.now() - startTime

    logger.error('AI health check failed', {
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime
      }
    })

    return res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime,
      error: error instanceof Error ? error.message : 'Health check failed',
      services: {
        aiService: { status: 'unknown', description: 'Unable to check AI service' },
        database: { status: 'unknown', description: 'Unable to check database' },
        puppeteer: { status: 'unknown', description: 'Unable to check browser engine' }
      }
    })
  }
}

export const config = {
  api: {
    bodyParser: false, // No body parsing needed for GET request
  },
}