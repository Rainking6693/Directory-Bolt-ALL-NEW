import { NextApiRequest, NextApiResponse } from 'next'
import { rateLimit } from '../../../lib/utils/rate-limit'
import { logger } from '../../../lib/utils/logger'
import { AI, BusinessProfile } from '../../../lib/services/ai-service'

// Rate limiting for premium AI features
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100, // Limit to 100 unique users per minute
})

export interface GenerateDescriptionsRequest {
  businessProfile: BusinessProfile
  directory: {
    id: string
    name: string
    category: string
    features?: string[]
  }
  count?: number
  userTier: 'free' | 'pro' | 'enterprise'
}

export interface GenerateDescriptionsResponse {
  success: boolean
  data?: {
    descriptions: string[]
    directory: string
    businessName: string
    generatedAt: string
    variations: number
  }
  error?: string
  requestId?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateDescriptionsResponse>
) {
  const requestId = `ai_desc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        requestId
      })
    }

    // Check if AI is enabled
    if (!AI.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'AI features are currently unavailable',
        requestId
      })
    }

    // Apply rate limiting (more generous for Pro users)
    try {
      const rateLimit = req.body.userTier === 'pro' ? 20 : 5 // Pro users get 4x more requests
      await limiter.check(res, rateLimit, 'AI_DESCRIPTIONS_CACHE_TOKEN')
    } catch {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Upgrade to Pro for higher limits.',
        requestId
      })
    }

    // Validate input
    const { businessProfile, directory, count = 3, userTier }: GenerateDescriptionsRequest = req.body

    if (!businessProfile || !businessProfile.name) {
      return res.status(400).json({
        success: false,
        error: 'Business profile is required',
        requestId
      })
    }

    if (!directory || !directory.name) {
      return res.status(400).json({
        success: false,
        error: 'Directory information is required',
        requestId
      })
    }

    // Limit count based on user tier
    const maxCount = userTier === 'pro' ? 10 : userTier === 'enterprise' ? 15 : 3
    const finalCount = Math.min(count, maxCount)

    if (userTier === 'free' && finalCount > 3) {
      return res.status(403).json({
        success: false,
        error: 'Free tier limited to 3 descriptions. Upgrade to Pro for up to 10 variations.',
        requestId
      })
    }

    // Log the request
    logger.info('AI description generation requested', {
      requestId,
      userAgent: req.headers['user-agent'] as string,
      ipAddress: (req.headers['x-forwarded-for'] || req.connection.remoteAddress) as string,
      metadata: {
        businessName: businessProfile.name,
        directory: directory.name,
        count: finalCount,
        userTier
      }
    })

    // Generate descriptions using AI
    const descriptions = await AI.generateDescriptions(businessProfile, directory, finalCount)

    // Filter out any empty or invalid descriptions
    const validDescriptions = descriptions.filter(desc => 
      desc && desc.length > 20 && desc.length < 500
    )

    if (validDescriptions.length === 0) {
      throw new Error('Failed to generate valid descriptions')
    }

    // Log successful generation
    logger.info('AI descriptions generated successfully', {
      requestId,
      metadata: {
        businessName: businessProfile.name,
        directory: directory.name,
        generatedCount: validDescriptions.length,
        userTier
      }
    })

    // Return successful response
    return res.status(200).json({
      success: true,
      data: {
        descriptions: validDescriptions,
        directory: directory.name,
        businessName: businessProfile.name,
        generatedAt: new Date().toISOString(),
        variations: validDescriptions.length
      },
      requestId
    })

  } catch (error) {
    // Handle and log errors appropriately
    logger.error('AI description generation failed', { 
      requestId,
      httpMethod: req.method,
      httpUrl: '/api/ai/generate-descriptions',
      metadata: { 
        businessName: req.body?.businessProfile?.name,
        directory: req.body?.directory?.name 
      }
    }, error instanceof Error ? error : new Error(String(error)))

    // Return appropriate error response
    if (error instanceof Error) {
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        return res.status(429).json({
          success: false,
          error: 'AI service temporarily overloaded. Please try again in a few minutes.',
          requestId
        })
      }
      
      if (error.message.includes('API') || error.message.includes('OpenAI')) {
        return res.status(503).json({
          success: false,
          error: 'AI service temporarily unavailable. Please try again later.',
          requestId
        })
      }
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      error: 'Description generation failed. Please try again or contact support.',
      requestId
    })
  }
}

// Export configuration for large payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
    responseLimit: '5mb',
  },
}