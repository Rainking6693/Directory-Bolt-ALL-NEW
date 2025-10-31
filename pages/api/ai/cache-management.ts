/**
 * Phase 3.2: AI Analysis Cache Management API
 * 
 * This endpoint provides cache management functionality for the AI analysis system,
 * including cache metrics, cleanup operations, and cache invalidation.
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { createAIAnalysisCacheService } from '../../../lib/services/ai-analysis-cache'

interface CacheMetricsResponse {
  success: boolean
  metrics?: {
    cacheHitRate: number
    totalAnalyses: number
    cachedAnalyses: number
    costSavings: number
    averageAnalysisAge: number
  }
  stats?: {
    totalCachedRecords: number
    averageAge: number
    oldestEntry: Date | null
    newestEntry: Date | null
    confidenceDistribution: { [key: string]: number }
  }
  error?: string
}

interface CacheCleanupResponse {
  success: boolean
  cleanedCount?: number
  error?: string
}

interface CacheInvalidationResponse {
  success: boolean
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { action, customerId, timeframeDays, olderThanDays } = req.query

  try {
    const cacheService = createAIAnalysisCacheService()

    switch (action) {
      case 'metrics':
        return await handleGetMetrics(req, res, cacheService, Number(timeframeDays) || 30)

      case 'stats':
        return await handleGetStats(req, res, cacheService)

      case 'cleanup':
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed. Use POST for cleanup.' })
        }
        return await handleCleanup(req, res, cacheService, Number(olderThanDays) || 60)

      case 'invalidate':
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed. Use POST for invalidation.' })
        }
        if (!customerId) {
          return res.status(400).json({ success: false, error: 'customerId is required for invalidation' })
        }
        return await handleInvalidateCustomer(req, res, cacheService, customerId as string)

      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid action. Supported actions: metrics, stats, cleanup, invalidate' 
        })
    }

  } catch (error) {
    console.error('❌ Cache management operation failed:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

/**
 * Get cache metrics for specified timeframe
 */
async function handleGetMetrics(
  req: NextApiRequest,
  res: NextApiResponse<CacheMetricsResponse>,
  cacheService: any,
  timeframeDays: number
) {
  console.log('📊 Getting cache metrics for', timeframeDays, 'days')

  const metrics = await cacheService.getCacheMetrics(timeframeDays)

  return res.status(200).json({
    success: true,
    metrics
  })
}

/**
 * Get detailed cache statistics
 */
async function handleGetStats(
  req: NextApiRequest,
  res: NextApiResponse<CacheMetricsResponse>,
  cacheService: any
) {
  console.log('📈 Getting detailed cache statistics')

  const stats = await cacheService.getCacheStats()

  return res.status(200).json({
    success: true,
    stats
  })
}

/**
 * Clean up stale cache entries
 */
async function handleCleanup(
  req: NextApiRequest,
  res: NextApiResponse<CacheCleanupResponse>,
  cacheService: any,
  olderThanDays: number
) {
  console.log('🧹 Cleaning up cache entries older than', olderThanDays, 'days')

  const cleanedCount = await cacheService.cleanupStaleCache(olderThanDays)

  return res.status(200).json({
    success: true,
    cleanedCount
  })
}

/**
 * Invalidate cache for specific customer
 */
async function handleInvalidateCustomer(
  req: NextApiRequest,
  res: NextApiResponse<CacheInvalidationResponse>,
  cacheService: any,
  customerId: string
) {
  const { reason } = req.body

  console.log('🗑️ Invalidating cache for customer:', customerId, 'Reason:', reason)

  const success = await cacheService.invalidateCustomerCache(customerId, reason)

  if (success) {
    return res.status(200).json({ success: true })
  } else {
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to invalidate customer cache' 
    })
  }
}