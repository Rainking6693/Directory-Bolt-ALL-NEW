/**
 * AutoBolt Queue Status API
 * 
 * GET /api/autobolt/queue-status
 * Returns current queue statistics and status
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseQueueManager } from '../../../lib/services/supabase-queue-manager'
import { rateLimit } from '../../../lib/utils/rate-limit'

// Rate limiting for queue status API
const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 100, // Limit each IP to 100 requests per interval
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // FIXED: Simple response function for Next.js
  console.log('📋 Queue status API called:', {
    method: req.method
  })
  
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET.'
    })
  }

  try {
    // Apply rate limiting
    await limiter.check(res, 20, 'queue-status') // 20 requests per minute per IP
  } catch {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please try again later.'
    })
  }

  try {
    const stats = await supabaseQueueManager().getQueueStats()
    const isProcessing = supabaseQueueManager().isQueueProcessing()
    const nextCustomer = await supabaseQueueManager().getNextCustomer()

    return res.status(200).json({
      success: true,
      data: {
        stats,
        isProcessing,
        nextCustomer: nextCustomer ? {
          customerId: nextCustomer.customerId,
          businessName: nextCustomer.businessName,
          packageType: nextCustomer.packageType,
          directoryLimit: nextCustomer.directoryLimit,
          priority: nextCustomer.priority,
          createdAt: nextCustomer.createdAt
        } : null,
        lastUpdated: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Queue status API error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get queue status',
      message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : 'Internal server error'
    })
  }
}