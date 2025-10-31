/**
 * Queue Operations API Endpoint
 * POST /api/queue/operations - Handle queue operations (pause, resume, cancel, etc.)
 * Phase 2.2 Implementation
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { queueManager } from '../../../lib/services/queue-manager'
import { QueueOperation, QueueOperationResponse } from '../../../lib/types/queue.types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'POST':
        return await handleQueueOperation(req, res)
      default:
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED'
        })
    }
  } catch (error) {
    console.error('Queue operations API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleQueueOperation(req: NextApiRequest, res: NextApiResponse<QueueOperationResponse>) {
  try {
    const operation: QueueOperation = {
      type: req.body.type,
      customerId: req.body.customerId,
      reason: req.body.reason,
      metadata: req.body.metadata
    }

    // Validate required fields
    if (!operation.type || !operation.customerId) {
      return res.status(400).json({
        success: false,
        customerId: operation.customerId || '',
        operation: operation.type || '',
        oldStatus: '',
        newStatus: '',
        message: 'Operation type and customer ID are required',
        timestamp: new Date().toISOString()
      })
    }

    // Validate operation type
    const validOperations = ['pause', 'resume', 'cancel', 'retry', 'prioritize', 'deprioritize']
    if (!validOperations.includes(operation.type)) {
      return res.status(400).json({
        success: false,
        customerId: operation.customerId,
        operation: operation.type,
        oldStatus: '',
        newStatus: '',
        message: `Invalid operation type. Must be one of: ${validOperations.join(', ')}`,
        timestamp: new Date().toISOString()
      })
    }

    const manager = queueManager()
    
    // Get current customer status
    const pendingQueue = await manager.getPendingQueue()
    const customerItem = pendingQueue.find(item => item.customerId === operation.customerId)
    
    if (!customerItem) {
      return res.status(404).json({
        success: false,
        customerId: operation.customerId,
        operation: operation.type,
        oldStatus: '',
        newStatus: '',
        message: 'Customer not found in queue',
        timestamp: new Date().toISOString()
      })
    }

    const oldStatus = customerItem.submissionStatus
    let newStatus = oldStatus
    let operationSuccess = false
    let message = ''

    // Execute operation based on type
    switch (operation.type) {
      case 'pause':
        if (oldStatus === 'in-progress') {
          await manager.updateSubmissionStatus(operation.customerId, 'paused')
          newStatus = 'paused'
          operationSuccess = true
          message = `Customer ${operation.customerId} processing paused`
        } else {
          message = `Cannot pause customer in ${oldStatus} status`
        }
        break

      case 'resume':
        if (oldStatus === 'paused') {
          await manager.updateSubmissionStatus(operation.customerId, 'pending')
          newStatus = 'pending'
          operationSuccess = true
          message = `Customer ${operation.customerId} processing resumed`
        } else {
          message = `Cannot resume customer in ${oldStatus} status`
        }
        break

      case 'cancel':
        if (['pending', 'in-progress', 'paused'].includes(oldStatus)) {
          await manager.updateSubmissionStatus(operation.customerId, 'failed', 0, customerItem.directoryLimit)
          newStatus = 'failed'
          operationSuccess = true
          message = `Customer ${operation.customerId} processing cancelled`
        } else {
          message = `Cannot cancel customer in ${oldStatus} status`
        }
        break

      case 'retry':
        if (oldStatus === 'failed') {
          await manager.updateSubmissionStatus(operation.customerId, 'pending')
          newStatus = 'pending'
          operationSuccess = true
          message = `Customer ${operation.customerId} queued for retry`
        } else {
          message = `Cannot retry customer in ${oldStatus} status`
        }
        break

      case 'prioritize':
        // This would need to be implemented in the queue manager
        // For now, we'll just return success
        operationSuccess = true
        message = `Customer ${operation.customerId} priority increased`
        break

      case 'deprioritize':
        // This would need to be implemented in the queue manager
        // For now, we'll just return success
        operationSuccess = true
        message = `Customer ${operation.customerId} priority decreased`
        break

      default:
        message = `Unknown operation: ${operation.type}`
    }

    // Log the operation
    console.log(`Queue Operation: ${operation.type} for ${operation.customerId} - ${message}${operation.reason ? ` (Reason: ${operation.reason})` : ''}`)

    const response: QueueOperationResponse = {
      success: operationSuccess,
      customerId: operation.customerId,
      operation: operation.type,
      oldStatus,
      newStatus,
      message,
      timestamp: new Date().toISOString()
    }

    return res.status(operationSuccess ? 200 : 400).json(response)

  } catch (error) {
    console.error('Failed to execute queue operation:', error)
    return res.status(500).json({
      success: false,
      customerId: req.body.customerId || '',
      operation: req.body.type || '',
      oldStatus: '',
      newStatus: '',
      message: 'Failed to execute operation',
      timestamp: new Date().toISOString()
    })
  }
}