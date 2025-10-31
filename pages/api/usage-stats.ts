// 📊 USAGE STATISTICS API
// Monitor system usage and costs

import { NextApiRequest, NextApiResponse } from 'next'
import UsageTracker from '../../lib/services/usage-tracker'
import { logger } from '../../lib/utils/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, sessionId, adminKey } = req.query

    // Admin access for system-wide stats
    if (adminKey === process.env.ADMIN_API_KEY) {
      const usageTracker = UsageTracker.getInstance()
      const summary = await usageTracker.getUsageSummary()
      
      return res.status(200).json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      })
    }

    // User-specific stats
    if (userId || sessionId) {
      const usageTracker = UsageTracker.getInstance()
      const userKey = (userId as string) || (sessionId as string)
      const stats = await usageTracker.getUserStats(userKey)
      
      return res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      })
    }

    return res.status(400).json({
      error: 'Missing required parameters',
      message: 'Provide userId, sessionId, or adminKey'
    })

  } catch (error) {
    logger.error('Usage stats request failed', {}, error as Error)
    
    return res.status(500).json({
      error: 'Failed to retrieve usage stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}