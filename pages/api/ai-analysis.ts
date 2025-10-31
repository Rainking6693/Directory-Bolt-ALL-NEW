// @ts-nocheck
// 🚀 AI BUSINESS INTELLIGENCE API ENDPOINT
// Next.js API route for comprehensive $299+ business analysis

import { NextApiRequest, NextApiResponse } from 'next'
import rateLimit from 'express-rate-limit'
import { 
  BusinessIntelligence, 
  createBusinessIntelligenceEngine,
  AnalysisRequest,
  BusinessIntelligenceResponse,
  AnalysisProgress 
} from '../../lib/services/ai-business-intelligence-engine'
import { logger } from '../../lib/utils/logger'

// Rate limiting for AI analysis (expensive operation)
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per hour
  message: {
    error: 'Too many analysis requests. Please try again in an hour.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Middleware to apply rate limiting
function runMiddleware(req: NextApiRequest, res: NextApiResponse, fn: Function) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result)
      }
      return resolve(result)
    })
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply rate limiting
  try {
    await runMiddleware(req, res, limiter)
  } catch (error) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.',
      code: 'METHOD_NOT_ALLOWED'
    })
  }

  const startTime = Date.now()

  try {
    // Validate request body
    const validationResult = validateRequest(req.body)
    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        error: validationResult.error,
        code: 'VALIDATION_ERROR'
      })
    }

    const analysisRequest: AnalysisRequest = req.body

    logger.info('AI analysis request received', {
      metadata: {
        url: analysisRequest.url,
        userAgent: req.headers['user-agent'],
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      }
    })

    // Initialize AI Business Intelligence Engine
    const engine = createBusinessIntelligenceEngine(analysisRequest.config)

    // Set up progress tracking for real-time updates (if supported)
    let progressData: AnalysisProgress | null = null
    engine.onProgress((progress) => {
      progressData = progress
      // In a real implementation, you might send this via WebSocket or Server-Sent Events
      logger.debug('Analysis progress update', { metadata: progress })
    })

    // Perform comprehensive business analysis
    const result: BusinessIntelligenceResponse = await engine.analyzeBusinessIntelligence(analysisRequest)

    const processingTime = Date.now() - startTime

    if (result.success && result.data) {
      // Log successful analysis
      logger.info('AI analysis completed successfully', {
        metadata: {
          url: analysisRequest.url,
          processingTime,
          confidence: result.data.confidence,
          directoryCount: result.data.directoryOpportunities.totalDirectories,
          estimatedCost: result.usage.cost
        }
      })

      // Return comprehensive analysis results
      return res.status(200).json({
        success: true,
        data: {
          ...result.data,
          metadata: {
            processingTime,
            analysisVersion: '2.0',
            apiVersion: '1.0',
            generatedAt: new Date().toISOString()
          }
        },
        processingTime,
        usage: result.usage
      })

    } else {
      // Handle analysis failure
      logger.error('AI analysis failed', {
        metadata: {
          url: analysisRequest.url,
          error: result.error,
          processingTime
        }
      })

      return res.status(500).json({
        success: false,
        error: result.error || 'Analysis failed due to internal error',
        code: 'ANALYSIS_FAILED',
        processingTime
      })
    }

  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('AI analysis endpoint error', {
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime
      }
    })

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('OpenAI')) {
        return res.status(503).json({
          success: false,
          error: 'AI service temporarily unavailable. Please try again later.',
          code: 'AI_SERVICE_UNAVAILABLE',
          processingTime
        })
      }

      if (error.message.includes('timeout')) {
        return res.status(408).json({
          success: false,
          error: 'Analysis timed out. The website may be too complex to analyze.',
          code: 'ANALYSIS_TIMEOUT',
          processingTime
        })
      }

      if (error.message.includes('rate limit')) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded for AI service. Please try again later.',
          code: 'AI_RATE_LIMIT_EXCEEDED',
          processingTime
        })
      }
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error occurred during analysis',
      code: 'INTERNAL_ERROR',
      processingTime
    })
  }
}

// Request validation
interface ValidationResult {
  valid: boolean
  error?: string
}

function validateRequest(body: any): ValidationResult {
  if (!body) {
    return { valid: false, error: 'Request body is required' }
  }

  if (!body.url) {
    return { valid: false, error: 'URL is required' }
  }

  if (typeof body.url !== 'string') {
    return { valid: false, error: 'URL must be a string' }
  }

  // Validate URL format
  try {
    new URL(body.url)
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }

  // Validate URL protocol
  const url = new URL(body.url)
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, error: 'URL must use HTTP or HTTPS protocol' }
  }

  // Validate domain (basic security check)
  const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0', 'internal', '.local']
  if (blockedDomains.some(blocked => url.hostname.includes(blocked))) {
    return { valid: false, error: 'Internal or local URLs are not allowed' }
  }

  // Validate optional user input
  if (body.userInput) {
    if (typeof body.userInput !== 'object') {
      return { valid: false, error: 'User input must be an object' }
    }

    if (body.userInput.budget && typeof body.userInput.budget !== 'number') {
      return { valid: false, error: 'Budget must be a number' }
    }

    if (body.userInput.budget && (body.userInput.budget < 0 || body.userInput.budget > 50000)) {
      return { valid: false, error: 'Budget must be between 0 and 50000' }
    }

    if (body.userInput.businessGoals && !Array.isArray(body.userInput.businessGoals)) {
      return { valid: false, error: 'Business goals must be an array' }
    }
  }

  // Validate optional config
  if (body.config) {
    if (typeof body.config !== 'object') {
      return { valid: false, error: 'Config must be an object' }
    }

    if (body.config.aiAnalysis?.model && !['gpt-4', 'gpt-4-turbo', 'gpt-4o'].includes(body.config.aiAnalysis.model)) {
      return { valid: false, error: 'Invalid AI model specified' }
    }

    if (body.config.directoryMatching?.maxDirectories && 
        (body.config.directoryMatching.maxDirectories < 1 || body.config.directoryMatching.maxDirectories > 100)) {
      return { valid: false, error: 'Max directories must be between 1 and 100' }
    }
  }

  return { valid: true }
}

// Export configuration for Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: '8mb', // Large response due to comprehensive analysis
  },
}