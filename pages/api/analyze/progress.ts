// 🚀 ANALYSIS PROGRESS API - Real-time progress tracking for website analysis
// GET /api/analyze/progress?requestId=xxx - Get analysis progress status

import type { NextApiRequest, NextApiResponse } from 'next'
import { ProgressTracker, AnalysisProgress } from '../../../lib/utils/progress-tracker'
import { logger } from '../../../lib/utils/logger'
import { handleApiError } from '../../../lib/utils/errors'

interface ProgressResponse {
  success: boolean
  data?: AnalysisProgress
  summary?: {
    total: number
    active: number
    completed: number
    failed: number
    averageDuration: number
  }
  error?: string
  requestId?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProgressResponse>
) {
  const apiRequestId = `progress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET'])
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        requestId: apiRequestId
      })
    }

    const { requestId, summary } = req.query

    // If requesting summary statistics
    if (summary === 'true') {
      const progressSummary = ProgressTracker.getProgressSummary()
      
      logger.info('Progress summary requested', {
        requestId: apiRequestId,
        metadata: progressSummary
      })

      return res.status(200).json({
        success: true,
        summary: progressSummary,
        requestId: apiRequestId
      })
    }

    // Validate requestId parameter
    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'requestId parameter is required',
        requestId: apiRequestId
      })
    }

    // Sanitize requestId
    const sanitizedRequestId = requestId.trim()
    if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedRequestId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid requestId format',
        requestId: apiRequestId
      })
    }

    // Get progress data
    const progress = ProgressTracker.getProgress(sanitizedRequestId)

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Analysis progress not found. The request may have expired or never existed.',
        requestId: apiRequestId
      })
    }

    // Log progress check
    logger.info('Progress check requested', {
      requestId: apiRequestId,
      metadata: {
        analysisRequestId: sanitizedRequestId,
        status: progress.status,
        overallProgress: progress.overallProgress,
        currentStep: progress.currentStep,
        url: progress.url
      }
    })

    // Set appropriate cache headers
    if (progress.status === 'completed' || progress.status === 'failed') {
      // Cache completed/failed analyses for 5 minutes
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    } else {
      // Don't cache in-progress analyses
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    }

    // Add performance headers
    const duration = Date.now() - startTime
    res.setHeader('X-Response-Time', `${duration}ms`)
    res.setHeader('X-Analysis-Status', progress.status)
    res.setHeader('X-Overall-Progress', progress.overallProgress.toString())

    return res.status(200).json({
      success: true,
      data: progress,
      requestId: apiRequestId
    })

  } catch (error) {
    const errorResponse = handleApiError(error as Error, apiRequestId)
    
    logger.error('Progress check failed', {
      requestId: apiRequestId,
      metadata: {
        requestId: req.query.requestId,
        userAgent: req.headers['user-agent'],
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : new Error(String(error)))

    return res.status(errorResponse.error.statusCode).json({
      success: false,
      error: errorResponse.error.message,
      requestId: apiRequestId
    })
  }
}

// Export configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: '2mb',
  },
}