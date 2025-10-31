// @ts-nocheck
/**
 * AutoBolt Pending Customers API
 * 
 * GET /api/autobolt/pending-customers
 * Returns list of customers waiting to be processed
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseQueueManager } from '../../../lib/services/supabase-queue-manager'
import { rateLimit } from '../../../lib/utils/rate-limit'

// Rate limiting for pending customers API
const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 100, // Limit each IP to 100 requests per interval
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET.'
    })
  }

  try {
    // Apply rate limiting
    await limiter.check(res, 10, 'pending-customers') // 10 requests per minute per IP
  } catch {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please try again later.'
    })
  }

  const { limit, offset } = req.query

  try {
    const pendingQueue = await supabaseQueueManager().getPendingQueue()
    
    // Apply pagination if requested
    const limitNum = limit ? parseInt(limit as string, 10) : undefined
    const offsetNum = offset ? parseInt(offset as string, 10) : 0
    
    let paginatedQueue = pendingQueue
    if (limitNum) {
      paginatedQueue = pendingQueue.slice(offsetNum, offsetNum + limitNum)
    }

    // Format response data (exclude sensitive info)
    const customers = paginatedQueue.map(item => ({
      customerId: item.customerId,
      businessName: item.businessData.businessName,
      email: item.businessData.email,
      packageType: item.packageType,
      directoryLimit: item.directoryLimit,
      priority: item.priority,
      submissionStatus: item.submissionStatus,
      createdAt: item.createdAt,
      purchaseDate: item.businessData.purchaseDate,
      website: item.businessData.website
    }))

    return res.status(200).json({
      success: true,
      data: {
        customers,
        pagination: {
          total: pendingQueue.length,
          offset: offsetNum,
          limit: limitNum || pendingQueue.length,
          hasMore: limitNum ? (offsetNum + limitNum) < pendingQueue.length : false
        },
        metadata: {
          totalPending: pendingQueue.length,
          lastUpdated: new Date().toISOString(),
          queueDepth: pendingQueue.reduce((sum: number, item: any) => sum + item.directoryLimit, 0)
        }
      }
    })

  } catch (error) {
    console.error('Pending customers API error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get pending customers',
      message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : 'Internal server error'
    })
  }
}