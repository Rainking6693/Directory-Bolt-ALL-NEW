/**
 * AutoBolt Queue Processing API
 * 
 * POST /api/autobolt/process-queue
 * Starts processing the entire queue
 * 
 * POST /api/autobolt/process-queue?customerId=xxx
 * Processes a specific customer
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { queueManager } from '../../../lib/services/queue-manager'
import { rateLimit } from '../../../lib/utils/rate-limit'

// Rate limiting for queue processing API
const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 10, // Very limited - processing is resource intensive
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    })
  }

  try {
    // Apply rate limiting
    await limiter.check(res, 5, 'process-queue') // 5 requests per minute per IP
  } catch {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Queue processing is resource intensive. Please wait.'
    })
  }

  const { customerId } = req.query

  try {
    // Check if queue is already processing
    if (queueManager().isQueueProcessing()) {
      return res.status(409).json({
        success: false,
        error: 'Queue processing already in progress',
        message: 'Only one queue processing operation can run at a time'
      })
    }

    if (customerId && typeof customerId === 'string') {
      // Process specific customer
      console.log(`🎯 Processing specific customer: ${customerId}`)
      
      const result = await queueManager().processSpecificCustomer(customerId)
      
      return res.status(200).json({
        success: true,
        message: `Customer ${customerId} processed successfully`,
        data: {
          customerId: result.customerId,
          directoriesProcessed: result.directoriesProcessed,
          directoriesFailed: result.directoriesFailed,
          completedAt: result.completedAt,
          errors: result.errors
        }
      })

    } else {
      // Process entire queue
      console.log('🚀 Starting full queue processing')
      
      // Start processing asynchronously (don't wait for completion)
      queueManager().processQueue().catch((error: any) => {
        console.error('❌ Queue processing failed:', error)
      })

      return res.status(202).json({
        success: true,
        message: 'Queue processing started',
        data: {
          status: 'processing',
          startedAt: new Date().toISOString(),
          message: 'Check /api/autobolt/queue-status for progress updates'
        }
      })
    }

  } catch (error) {
    console.error('Queue processing API error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Failed to start queue processing',
      message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : 'Internal server error'
    })
  }
}