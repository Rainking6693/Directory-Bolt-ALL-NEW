import { NextApiRequest, NextApiResponse } from 'next'
import { getBusinessIntelligenceEngine } from '../../../lib/services/ai-business-intelligence-engine'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, businessUrl } = req.body

    if (!userId || !businessUrl) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // Get the AI Business Intelligence Engine
    const engine = getBusinessIntelligenceEngine()

    // Start the analysis
    const result = await engine.analyzeBusinessIntelligence({
      url: businessUrl,
      config: {
        enableProgressTracking: true,
        cacheResults: true
      }
    })

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        processingTime: result.processingTime,
        usage: result.usage
      })
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        processingTime: result.processingTime
      })
    }

  } catch (error) {
    console.error('AI Portal refresh error:', error)
    res.status(500).json({ 
      success: false,
      error: 'Internal server error during analysis refresh' 
    })
  }
}

// Configuration for longer processing times
export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
  // Allow up to 5 minutes for AI processing
  maxDuration: 300
}