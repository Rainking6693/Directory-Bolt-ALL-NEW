/**
 * Individual Customer Queue API Endpoint
 * GET /api/queue/[customerId] - Get specific customer queue item
 * POST /api/queue/[customerId] - Process specific customer
 * Phase 2.2 Implementation
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { queueManager } from '../../../lib/services/queue-manager'
import { QueueProcessingResult } from '../../../lib/types/queue.types'
import { rateLimit, rateLimitPresets } from '../../../lib/middleware/rate-limit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(rateLimitPresets.public)(req, res)
  if (!rateLimitResult || !rateLimitResult.allowed) {
    return // Response already sent by rate limiter
  }
  try {
    const { customerId } = req.query

    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required',
        code: 'MISSING_CUSTOMER_ID'
      })
    }

    switch (req.method) {
      case 'GET':
        return await handleGetCustomer(customerId, res)
      case 'POST':
        return await handleProcessCustomer(customerId, res)
      default:
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED'
        })
    }
  } catch (error) {
    console.error('Customer queue API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleGetCustomer(customerId: string, res: NextApiResponse) {
  try {
    const manager = queueManager()
    const pendingQueue = await manager.getPendingQueue()
    
    // Find the customer in the queue
    const customerItem = pendingQueue.find(item => item.customerId === customerId)
    
    if (!customerItem) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found in queue',
        code: 'CUSTOMER_NOT_FOUND'
      })
    }

    return res.status(200).json({
      success: true,
      data: customerItem,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to fetch customer:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch customer data',
      code: 'FETCH_ERROR'
    })
  }
}

async function handleProcessCustomer(customerId: string, res: NextApiResponse) {
  try {
    const manager = queueManager()
    
    // Check if the customer exists and is in a processable state
    const pendingQueue = await manager.getPendingQueue()
    const customerItem = pendingQueue.find(item => item.customerId === customerId)
    
    if (!customerItem) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found in queue',
        code: 'CUSTOMER_NOT_FOUND'
      })
    }

    if (customerItem.submissionStatus !== 'pending' && customerItem.submissionStatus !== 'failed') {
      return res.status(409).json({
        success: false,
        error: `Customer is in ${customerItem.submissionStatus} state and cannot be processed`,
        code: 'INVALID_STATUS'
      })
    }

    // Process the specific customer
    const result: QueueProcessingResult = await manager.processSpecificCustomer(customerId)
    
    return res.status(200).json({
      success: true,
      data: result,
      message: `Customer ${customerId} processing ${result.success ? 'completed successfully' : 'failed'}`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to process customer:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to process customer',
      code: 'PROCESSING_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}