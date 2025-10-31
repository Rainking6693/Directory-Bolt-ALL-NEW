/**
 * Extension Status API Endpoint
 * GET /api/extension/status/[trackingId] - Get submission status for Chrome extension
 * Phase 2.2 Implementation
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { ProgressIndicator, ETACalculation } from '../../../../lib/types/queue.types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { trackingId } = req.query
    const apiKey = req.headers['x-api-key'] as string

    if (!trackingId || typeof trackingId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Tracking ID is required',
        code: 'MISSING_TRACKING_ID'
      })
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key is required in X-API-Key header',
        code: 'MISSING_API_KEY'
      })
    }

    switch (req.method) {
      case 'GET':
        return await handleGetStatus(trackingId, apiKey, res)
      default:
        res.setHeader('Allow', ['GET'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED'
        })
    }
  } catch (error) {
    console.error('Extension status API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleGetStatus(trackingId: string, apiKey: string, res: NextApiResponse) {
  try {
    // Get tracking info from storage
    const extensionTracking = (global as any).extensionTracking
    if (!extensionTracking || !extensionTracking.has(trackingId)) {
      return res.status(404).json({
        success: false,
        error: 'Tracking ID not found',
        code: 'TRACKING_NOT_FOUND'
      })
    }

    const trackingInfo = extensionTracking.get(trackingId)

    // Verify API key matches
    if (trackingInfo.apiKey !== apiKey) {
      return res.status(403).json({
        success: false,
        error: 'API key does not match tracking record',
        code: 'API_KEY_MISMATCH'
      })
    }

    // Get current queue status
    const { queueManager } = await import('../../../../lib/services/queue-manager')
    const manager = queueManager()

    try {
      // Try to find the customer in the queue
      const pendingQueue = await manager.getPendingQueue()
      const customerItem = pendingQueue.find(item => item.customerId === trackingInfo.customerId)

      if (!customerItem) {
        // Customer may have been processed or removed
        return res.status(200).json({
          success: true,
          data: {
            customerId: trackingInfo.customerId,
            status: 'not_found',
            progress: {
              customerId: trackingInfo.customerId,
              currentStep: 'Submission not found in queue',
              totalSteps: 1,
              completedSteps: 0,
              percentage: 0,
              estimatedTimeRemaining: 0,
              lastUpdateTime: new Date().toISOString(),
              stepDetails: [{
                stepName: 'Submission may have been processed or removed',
                status: 'failed' as const,
                startTime: trackingInfo.submittedAt,
                endTime: new Date().toISOString(),
                duration: Math.floor((Date.now() - new Date(trackingInfo.submittedAt).getTime()) / 1000)
              }]
            },
            eta: {
              customerId: trackingInfo.customerId,
              estimatedStartTime: new Date().toISOString(),
              estimatedCompletionTime: new Date().toISOString(),
              estimatedProcessingDuration: 0,
              confidence: 0,
              factors: {
                queuePosition: 0,
                packageType: 'unknown',
                historicalProcessingTime: 0,
                currentLoad: 0,
                timeOfDay: 'unknown'
              }
            }
          }
        })
      }

      // Get current queue position
      const currentPosition = pendingQueue.findIndex(item => item.customerId === trackingInfo.customerId) + 1

      // Calculate progress based on queue status
      const progress: ProgressIndicator = {
        customerId: trackingInfo.customerId,
        currentStep: getStatusDescription(customerItem.submissionStatus),
        totalSteps: 4,
        completedSteps: getCompletedSteps(customerItem.submissionStatus),
        percentage: (getCompletedSteps(customerItem.submissionStatus) / 4) * 100,
        estimatedTimeRemaining: calculateEstimatedTime(currentPosition, customerItem.submissionStatus),
        lastUpdateTime: customerItem.updatedAt,
        stepDetails: [
          {
            stepName: 'Submission received',
            status: 'completed' as const,
            startTime: trackingInfo.submittedAt,
            endTime: trackingInfo.submittedAt,
            duration: 0
          },
          {
            stepName: 'Queued for processing',
            status: customerItem.submissionStatus === 'pending' ? 'completed' : 
                   ['in-progress', 'completed'].includes(customerItem.submissionStatus) ? 'completed' : 'pending',
            startTime: trackingInfo.submittedAt,
            endTime: customerItem.submissionStatus !== 'pending' ? customerItem.updatedAt : undefined
          },
          {
            stepName: 'Processing directories',
            status: customerItem.submissionStatus === 'in-progress' ? 'in-progress' :
                   customerItem.submissionStatus === 'completed' ? 'completed' :
                   customerItem.submissionStatus === 'failed' ? 'failed' : 'pending',
            startTime: customerItem.submissionStatus === 'in-progress' ? customerItem.updatedAt : undefined,
            endTime: ['completed', 'failed'].includes(customerItem.submissionStatus) ? customerItem.updatedAt : undefined
          },
          {
            stepName: 'Submission complete',
            status: customerItem.submissionStatus === 'completed' ? 'completed' :
                   customerItem.submissionStatus === 'failed' ? 'failed' : 'pending',
            endTime: ['completed', 'failed'].includes(customerItem.submissionStatus) ? customerItem.updatedAt : undefined
          }
        ]
      }

      // Calculate ETA
      const stats = await manager.getQueueStats()
      const eta: ETACalculation = {
        customerId: trackingInfo.customerId,
        estimatedStartTime: new Date(Date.now() + (currentPosition - 1) * stats.averageProcessingTime * 60 * 1000).toISOString(),
        estimatedCompletionTime: new Date(Date.now() + currentPosition * stats.averageProcessingTime * 60 * 1000).toISOString(),
        estimatedProcessingDuration: stats.averageProcessingTime * 60,
        confidence: currentPosition <= 5 ? 0.9 : currentPosition <= 20 ? 0.7 : 0.5,
        factors: {
          queuePosition: currentPosition,
          packageType: customerItem.packageType,
          historicalProcessingTime: stats.averageProcessingTime,
          currentLoad: stats.queueDepth,
          timeOfDay: new Date().getHours() >= 9 && new Date().getHours() <= 17 ? 'business_hours' : 'off_hours'
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          customerId: trackingInfo.customerId,
          status: customerItem.submissionStatus,
          progress,
          eta
        }
      })

    } catch (error) {
      console.error('Failed to get queue status:', error)
      
      // Return basic tracking info if queue lookup fails
      return res.status(200).json({
        success: true,
        data: {
          customerId: trackingInfo.customerId,
          status: 'unknown',
          progress: {
            customerId: trackingInfo.customerId,
            currentStep: 'Unable to retrieve current status',
            totalSteps: 1,
            completedSteps: 0,
            percentage: 0,
            estimatedTimeRemaining: trackingInfo.estimatedWaitTime,
            lastUpdateTime: trackingInfo.submittedAt,
            stepDetails: [{
              stepName: 'Submission received',
              status: 'completed' as const,
              startTime: trackingInfo.submittedAt,
              endTime: trackingInfo.submittedAt,
              duration: 0
            }]
          },
          eta: {
            customerId: trackingInfo.customerId,
            estimatedStartTime: new Date(Date.now() + trackingInfo.estimatedWaitTime * 1000).toISOString(),
            estimatedCompletionTime: new Date(Date.now() + (trackingInfo.estimatedWaitTime + 600) * 1000).toISOString(),
            estimatedProcessingDuration: 600,
            confidence: 0.5,
            factors: {
              queuePosition: trackingInfo.queuePosition,
              packageType: 'unknown',
              historicalProcessingTime: 10,
              currentLoad: 0,
              timeOfDay: 'unknown'
            }
          }
        }
      })
    }

  } catch (error) {
    console.error('Failed to get extension status:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve status',
      code: 'STATUS_RETRIEVAL_ERROR'
    })
  }
}

function getStatusDescription(status: string): string {
  switch (status) {
    case 'pending':
      return 'Waiting in queue for processing'
    case 'in-progress':
      return 'Processing directory submissions'
    case 'completed':
      return 'All directories processed successfully'
    case 'failed':
      return 'Processing failed'
    case 'paused':
      return 'Processing temporarily paused'
    default:
      return 'Unknown status'
  }
}

function getCompletedSteps(status: string): number {
  switch (status) {
    case 'pending':
      return 2
    case 'in-progress':
      return 3
    case 'completed':
      return 4
    case 'failed':
      return 3
    case 'paused':
      return 3
    default:
      return 1
  }
}

function calculateEstimatedTime(queuePosition: number, status: string): number {
  if (status === 'completed') return 0
  if (status === 'in-progress') return 300 // 5 minutes average
  if (status === 'failed') return 0
  
  // Estimate based on queue position (10 minutes per position)
  return queuePosition * 600
}