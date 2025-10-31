/**
 * Queue Processing API Endpoint
 * POST /api/queue/process - Start queue processing
 * Phase 2.2 Implementation
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { queueManager } from '../../../lib/services/queue-manager'
import { ProcessQueueRequest, ProcessQueueResponse } from '../../../lib/types/queue.types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'POST':
        return await handleStartProcessing(req, res)
      default:
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED'
        })
    }
  } catch (error) {
    console.error('Queue processing API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleStartProcessing(req: NextApiRequest, res: NextApiResponse<ProcessQueueResponse>) {
  try {
    const params: ProcessQueueRequest = {
      customerId: req.body.customerId,
      batchSize: req.body.batchSize || 3,
      priorityOnly: req.body.priorityOnly || false,
      packageTypes: req.body.packageTypes
    }

    // Validate parameters
    if (params.batchSize && (params.batchSize < 1 || params.batchSize > 10)) {
      return res.status(400).json({
        success: false,
        data: {} as any,
        message: 'Batch size must be between 1 and 10',
        timestamp: new Date().toISOString()
      })
    }

    const manager = queueManager()

    // Check if processing is already running
    if (manager.isQueueProcessing()) {
      return res.status(409).json({
        success: false,
        data: {} as any,
        message: 'Queue processing is already in progress',
        timestamp: new Date().toISOString()
      })
    }

    let processedCustomers: string[] = []
    let failedCustomers: string[] = []
    let totalProcessed = 0

    if (params.customerId) {
      // Process specific customer
      try {
        const result = await manager.processSpecificCustomer(params.customerId)
        if (result.success) {
          processedCustomers.push(params.customerId)
        } else {
          failedCustomers.push(params.customerId)
        }
        totalProcessed = 1
      } catch (error) {
        failedCustomers.push(params.customerId)
        totalProcessed = 1
      }
    } else {
      // Start general queue processing
      // This runs asynchronously - we don't wait for completion
      manager.processQueue().catch(error => {
        console.error('Queue processing failed:', error)
      })

      // Get current queue stats to estimate processing time
      const pendingQueue = await manager.getPendingQueue()
      
      // Filter by package types if specified
      let filteredQueue = pendingQueue
      if (params.packageTypes && params.packageTypes.length > 0) {
        filteredQueue = pendingQueue.filter(item => 
          params.packageTypes!.includes(item.packageType)
        )
      }

      // Filter for priority only if specified
      if (params.priorityOnly) {
        filteredQueue = filteredQueue.filter(item => item.priority > 75)
      }

      totalProcessed = Math.min(filteredQueue.length, params.batchSize || 3)
      processedCustomers = filteredQueue
        .slice(0, totalProcessed)
        .map(item => item.customerId)
    }

    // Estimate time remaining based on average processing time
    const stats = await manager.getQueueStats()
    const estimatedTimeRemaining = totalProcessed * stats.averageProcessingTime * 60 // Convert to seconds

    const response: ProcessQueueResponse = {
      success: true,
      data: {
        processedCustomers,
        failedCustomers,
        totalProcessed,
        estimatedTimeRemaining,
        batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      message: params.customerId 
        ? `Processing customer ${params.customerId}`
        : `Started processing ${totalProcessed} customers`,
      timestamp: new Date().toISOString()
    }

    return res.status(200).json(response)

  } catch (error) {
    console.error('Failed to start queue processing:', error)
    return res.status(500).json({
      success: false,
      data: {} as any,
      message: 'Failed to start queue processing',
      timestamp: new Date().toISOString()
    })
  }
}