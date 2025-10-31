// API endpoint for serving sample analysis data
import { NextApiRequest, NextApiResponse } from 'next'
import { sampleAnalyses } from '../../../lib/data/sample-analysis-data'
import { apiResponse } from '../../../lib/utils/api-response'
import { rateLimit } from '../../../lib/utils/rate-limit'

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // limit to 500 requests per minute
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apply rate limiting
  try {
    await limiter.check(res, 10, 'CACHE_TOKEN') // 10 requests per minute per IP
  } catch {
    return apiResponse(res, 429, 'error', 'Too many requests')
  }

  if (req.method !== 'GET') {
    return apiResponse(res, 405, 'error', 'Method not allowed')
  }

  try {
    const { businessType } = req.query
    
    // Validate business type
    const validTypes = ['localRestaurant', 'saasCompany', 'ecommerce', 'professionalServices']
    
    if (businessType && !validTypes.includes(businessType as string)) {
      return apiResponse(res, 400, 'error', 'Invalid business type')
    }

    // Return specific analysis or all analyses
    if (businessType) {
      const analysis = sampleAnalyses[businessType as keyof typeof sampleAnalyses]
      if (!analysis) {
        return apiResponse(res, 404, 'error', 'Analysis not found')
      }
      
      return apiResponse(res, 200, 'success', 'Sample analysis retrieved', analysis)
    }

    // Return all sample analyses with metadata
    const response = {
      analyses: sampleAnalyses,
      businessTypes: validTypes,
      metadata: {
        totalAnalyses: validTypes.length,
        averageConfidence: Math.round(
          Object.values(sampleAnalyses).reduce((sum, analysis) => sum + analysis.confidence, 0) / 
          Object.values(sampleAnalyses).length
        ),
        averageROI: Math.round(
          Object.values(sampleAnalyses).reduce((sum, analysis) => sum + analysis.projectedResults.roi, 0) / 
          Object.values(sampleAnalyses).length
        ),
        totalDirectoryRecommendations: Object.values(sampleAnalyses).reduce((sum, analysis) => sum + analysis.recommendations.length, 0)
      }
    }

    return apiResponse(res, 200, 'success', 'Sample analyses retrieved', response)

  } catch (error) {
    console.error('Sample analysis API error:', error)
    return apiResponse(res, 500, 'error', 'Internal server error')
  }
}