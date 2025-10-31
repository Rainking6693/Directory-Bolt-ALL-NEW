/**
 * Batch Operations API Endpoint
 * POST /api/queue/batch - Create batch operation
 * GET /api/queue/batch - Get all batches
 * Phase 2.2 Implementation
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { CreateBatchRequest, BatchOperation, BatchOperationResponse } from '../../../lib/types/queue.types'

// Simple in-memory storage for batch operations
// In production, this would be stored in Redis or a database
const batchStorage = new Map<string, BatchOperation>()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'POST':
        return await handleCreateBatch(req, res)
      case 'GET':
        return await handleGetBatches(req, res)
      default:
        res.setHeader('Allow', ['POST', 'GET'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED'
        })
    }
  } catch (error) {
    console.error('Batch operations API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleCreateBatch(req: NextApiRequest, res: NextApiResponse<BatchOperationResponse>) {
  try {
    const request: CreateBatchRequest = {
      customerIds: req.body.customerIds,
      operation: req.body.operation,
      priority: req.body.priority || 3,
      scheduledFor: req.body.scheduledFor
    }

    // Validate required fields
    if (!request.customerIds || !Array.isArray(request.customerIds) || request.customerIds.length === 0) {
      return res.status(400).json({
        success: false,
        data: {} as any,
        message: 'Customer IDs array is required and cannot be empty'
      })
    }

    if (!request.operation || !['process', 'retry', 'cancel'].includes(request.operation)) {
      return res.status(400).json({
        success: false,
        data: {} as any,
        message: 'Operation must be one of: process, retry, cancel'
      })
    }

    // Validate customer IDs
    if (request.customerIds.length > 100) {
      return res.status(400).json({
        success: false,
        data: {} as any,
        message: 'Maximum 100 customers per batch operation'
      })
    }

    // Generate batch ID
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create batch operation
    const batch: BatchOperation = {
      id: batchId,
      type: request.operation,
      status: request.scheduledFor && new Date(request.scheduledFor) > new Date() ? 'queued' : 'running',
      customerIds: [...request.customerIds], // Create copy
      createdAt: new Date().toISOString(),
      startedAt: !request.scheduledFor || new Date(request.scheduledFor) <= new Date() 
        ? new Date().toISOString() 
        : undefined,
      progress: {
        total: request.customerIds.length,
        completed: 0,
        failed: 0,
        percentage: 0
      }
    }

    // Store batch
    batchStorage.set(batchId, batch)

    // If not scheduled for later, start processing immediately
    if (!request.scheduledFor || new Date(request.scheduledFor) <= new Date()) {
      processBatchAsync(batch).catch(error => {
        console.error(`Batch ${batchId} processing error:`, error)
        // Update batch status to failed
        const failedBatch = batchStorage.get(batchId)
        if (failedBatch) {
          failedBatch.status = 'failed'
          failedBatch.completedAt = new Date().toISOString()
          batchStorage.set(batchId, failedBatch)
        }
      })
    }

    const response: BatchOperationResponse = {
      success: true,
      data: batch,
      message: `Batch operation created with ID: ${batchId}`
    }

    return res.status(201).json(response)

  } catch (error) {
    console.error('Failed to create batch operation:', error)
    return res.status(500).json({
      success: false,
      data: {} as any,
      message: 'Failed to create batch operation'
    })
  }
}

async function handleGetBatches(req: NextApiRequest, res: NextApiResponse) {
  try {
    const status = req.query.status as string
    let batches = Array.from(batchStorage.values())

    // Filter by status if provided
    if (status) {
      batches = batches.filter(batch => batch.status === status)
    }

    // Sort by creation date (newest first)
    batches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Limit to last 100 batches
    batches = batches.slice(0, 100)

    return res.status(200).json({
      success: true,
      data: batches,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to fetch batches:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch batches',
      code: 'FETCH_ERROR'
    })
  }
}

// Async function to process batch operations
async function processBatchAsync(batch: BatchOperation): Promise<void> {
  console.log(`Starting batch processing for batch ${batch.id} with ${batch.customerIds.length} customers`)

  try {
    // Import queue manager dynamically to avoid circular dependencies
    const { queueManager } = await import('../../../lib/services/queue-manager')
    const manager = queueManager()

    const results = []
    let completed = 0
    let failed = 0

    // Process each customer in the batch
    for (const customerId of batch.customerIds) {
      try {
        let result
        
        switch (batch.type) {
          case 'process':
            result = await manager.processSpecificCustomer(customerId)
            break
          case 'retry':
            // First update status to pending, then process
            await manager.updateSubmissionStatus(customerId, 'pending')
            result = await manager.processSpecificCustomer(customerId)
            break
          case 'cancel':
            await manager.updateSubmissionStatus(customerId, 'failed', 0, 0)
            result = { 
              success: true, 
              customerId, 
              directoriesProcessed: 0, 
              directoriesFailed: 0, 
              completedAt: new Date(),
              processingTimeSeconds: 0 
            }
            break
          default:
            throw new Error(`Unknown batch operation: ${batch.type}`)
        }

        if (result.success) {
          completed++
        } else {
          failed++
        }

        results.push(result)

        // Update progress
        const updatedBatch = batchStorage.get(batch.id)
        if (updatedBatch) {
          updatedBatch.progress.completed = completed
          updatedBatch.progress.failed = failed
          updatedBatch.progress.percentage = ((completed + failed) / batch.customerIds.length) * 100
          batchStorage.set(batch.id, updatedBatch)
        }

        // Small delay between customers to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`Failed to process customer ${customerId} in batch ${batch.id}:`, error)
        failed++
        
        results.push({
          success: false,
          customerId,
          directoriesProcessed: 0,
          directoriesFailed: 0,
          completedAt: new Date(),
          processingTimeSeconds: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        })
      }
    }

    // Mark batch as completed
    const completedBatch = batchStorage.get(batch.id)
    if (completedBatch) {
      completedBatch.status = 'completed'
      completedBatch.completedAt = new Date().toISOString()
      completedBatch.results = results
      completedBatch.progress.completed = completed
      completedBatch.progress.failed = failed
      completedBatch.progress.percentage = 100
      batchStorage.set(batch.id, completedBatch)
    }

    console.log(`Batch ${batch.id} completed: ${completed} successful, ${failed} failed`)

  } catch (error) {
    console.error(`Batch ${batch.id} processing failed:`, error)
    
    // Mark batch as failed
    const failedBatch = batchStorage.get(batch.id)
    if (failedBatch) {
      failedBatch.status = 'failed'
      failedBatch.completedAt = new Date().toISOString()
      batchStorage.set(batch.id, failedBatch)
    }
  }
}

// Cleanup old batches periodically (in production, this would be a separate job)
setInterval(() => {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 7) // Keep batches for 7 days

  for (const [batchId, batch] of batchStorage.entries()) {
    const batchDate = new Date(batch.createdAt)
    if (batchDate < cutoffDate) {
      batchStorage.delete(batchId)
    }
  }
}, 60 * 60 * 1000) // Run cleanup every hour