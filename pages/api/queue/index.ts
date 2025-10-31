/**
 * Queue API Endpoints - Main Queue Management
 * GET /api/queue - Fetch queue items with filtering and pagination
 * Now using REAL Supabase data instead of mock data
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseQueueManager } from '../../../lib/services/supabase-queue-manager'
import type { QueueItem } from '../../../lib/types/queue.types'

// Import the real QueueItem type from the queue manager
type ApiQueueItem = QueueItem

// Import types from the queue manager
import type { QueueStats } from '../../../lib/services/supabase-queue-manager'

interface GetQueueResponse {
  success: boolean
  data: {
    items: ApiQueueItem[]
    pagination: {
      total: number
      offset: number
      limit: number
      hasMore: boolean
    }
    stats: QueueStats
  }
  timestamp: string
  error?: string
}

// Simple logger
const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  error: (msg: string, error?: any) => console.error(`[ERROR] ${msg}`, error || '')
}

// Use the real Supabase queue manager instead of mock data
const queueManager = supabaseQueueManager()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Add timeout to prevent hanging
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), 10000) // 10 second timeout
  })

  try {
    const result = await Promise.race([
      handleRequest(req, res),
      timeoutPromise
    ])
    return result
  } catch (error) {
    logger.error('Queue API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleRequest(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return await handleGetQueue(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      })
  }
}

async function handleGetQueue(req: NextApiRequest, res: NextApiResponse<GetQueueResponse>) {
  try {
    logger.info('Fetching queue data')

    // Parse query parameters with defaults
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100)
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0)
    const status = req.query.status as string
    const sortBy = (req.query.sortBy as string) || 'priority'
    const sortOrder = (req.query.sortOrder as string) || 'desc'

    // Get REAL queue data from Supabase with timeout protection
    const [queueItems, stats] = await Promise.all([
      Promise.race([
        queueManager.getPendingQueue(),
        new Promise<ApiQueueItem[]>((_, reject) => 
          setTimeout(() => reject(new Error('Queue fetch timeout')), 5000)
        )
      ]),
      Promise.race([
        queueManager.getQueueStats(),
        new Promise<QueueStats>((_, reject) => 
          setTimeout(() => reject(new Error('Stats fetch timeout')), 5000)
        )
      ])
    ])

    logger.info(`Successfully fetched ${queueItems.length} real queue items from Supabase`)

    // Apply filtering
    let filteredItems = queueItems

    // Status filter
    if (status && status !== 'all') {
      filteredItems = filteredItems.filter(item => item.submissionStatus === status)
    }

    // Apply sorting
    filteredItems.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'priority':
          comparison = a.priority - b.priority
          break
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'packageType':
          comparison = a.packageType.localeCompare(b.packageType)
          break
        default:
          comparison = 0
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    // Apply pagination
    const totalItems = filteredItems.length
    const paginatedItems = filteredItems.slice(offset, offset + limit)

    // Build response
    const response: GetQueueResponse = {
      success: true,
      data: {
        items: paginatedItems,
        pagination: {
          total: totalItems,
          offset,
          limit,
          hasMore: offset + limit < totalItems
        },
        stats
      },
      timestamp: new Date().toISOString()
    }

    // Set appropriate headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Content-Type', 'application/json')
    
    logger.info(`Queue data fetched: ${paginatedItems.length} items`)
    return res.status(200).json(response)

  } catch (error) {
    logger.error('Failed to fetch queue:', error)
    return res.status(500).json({
      success: false,
      data: {
        items: [],
        pagination: { total: 0, offset: 0, limit: 50, hasMore: false },
        stats: {
          totalPending: 0, totalInProgress: 0, totalCompleted: 0, totalFailed: 0, totalPaused: 0,
          averageProcessingTime: 0, averageWaitTime: 0, queueDepth: 0, todaysProcessed: 0,
          todaysGoal: 50, successRate: 0, currentThroughput: 0, peakHours: []
        }
      },
      timestamp: new Date().toISOString(),
      error: 'Failed to fetch queue data: ' + (error instanceof Error ? error.message : 'Unknown error')
    })
  }
}