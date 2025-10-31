/**
 * AutoBolt Directories API
 * 
 * Provides access to the master directory list and statistics
 * Phase 3.2 Implementation: Directory management endpoints
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { AutoBoltExtensionService } from '../../../lib/services/autobolt-extension'
import { enhancedRateLimit, getClientIP, determineUserTier } from '../../../lib/utils/enhanced-rate-limit'

// Initialize AutoBolt Extension Service
const autoBoltExtensionService = new AutoBoltExtensionService()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Apply rate limiting
    const ipAddress = getClientIP(req)
    const userTier = determineUserTier(null, null) // No user/API key for this endpoint
    
    const rateLimitResult = await enhancedRateLimit.checkRateLimit({
      ipAddress,
      userAgent: req.headers['user-agent'] || 'unknown',
      endpoint: '/api/autobolt/directories',
      tier: userTier,
      timestamp: Date.now()
    })

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter
      })
    }

    if (req.method === 'GET') {
      // Initialize service if needed
      await autoBoltExtensionService.initialize()

      const { stats, list, limit } = req.query

      // Get directory statistics
      if (stats === 'true') {
        const directoryStats = autoBoltExtensionService.getDirectoryStats()
        
        return res.status(200).json({
          success: true,
          data: directoryStats,
          timestamp: new Date().toISOString()
        })
      }

      // Get processable directories for a specific limit
      if (limit && typeof limit === 'string') {
        const directoryLimit = parseInt(limit, 10)
        
        if (isNaN(directoryLimit) || directoryLimit <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid directory limit. Must be a positive number.'
          })
        }

        const processableDirectories = autoBoltExtensionService.getProcessableDirectoriesForLimit(directoryLimit)
        
        return res.status(200).json({
          success: true,
          data: {
            directoryLimit,
            processableDirectories: processableDirectories.length,
            directories: processableDirectories
          },
          timestamp: new Date().toISOString()
        })
      }

      // Get full directory list
      if (list === 'true') {
        const directoryList = autoBoltExtensionService.getDirectoryList()
        
        return res.status(200).json({
          success: true,
          data: {
            total: directoryList.length,
            directories: directoryList
          },
          timestamp: new Date().toISOString()
        })
      }

      // Default response - stats only
      const directoryStats = autoBoltExtensionService.getDirectoryStats()
      
      return res.status(200).json({
        success: true,
        data: directoryStats,
        message: 'Use ?stats=true, ?list=true, or ?limit=N for specific data',
        timestamp: new Date().toISOString()
      })

    } else {
      res.setHeader('Allow', ['GET'])
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Only GET requests are supported.'
      })
    }

  } catch (error) {
    console.error('❌ AutoBolt Directories API error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error processing directory request',
      timestamp: new Date().toISOString()
    })
  }
}