/**
 * Dynamic Form Mapping API Endpoints
 * 
 * Provides API access to Phase 3.3 Dynamic Form Mapping Engine:
 * - Test mapping for directories
 * - Get mapping statistics
 * - Manual mapping session management
 * - Site mapping health checks
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { dynamicFormMapper } from '../../../lib/services/dynamic-form-mapper'
import { chromeExtensionBridge } from '../../../lib/services/chrome-extension-bridge'
import { enhancedAutoBoltService } from '../../../lib/services/enhanced-autobolt-service'

// Rate limiting
const requestCounts = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT = 10 // requests per minute
const RATE_LIMIT_WINDOW = 60000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const userRequests = requestCounts.get(ip)

  if (!userRequests || now - userRequests.lastReset > RATE_LIMIT_WINDOW) {
    requestCounts.set(ip, { count: 1, lastReset: now })
    return true
  }

  if (userRequests.count >= RATE_LIMIT) {
    return false
  }

  userRequests.count++
  return true
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientIP = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown'

  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' })
  }

  try {
    const { method, query } = req

    switch (method) {
      case 'GET':
        return await handleGetRequest(req, res)
      case 'POST':
        return await handlePostRequest(req, res)
      case 'PUT':
        return await handlePutRequest(req, res)
      case 'DELETE':
        return await handleDeleteRequest(req, res)
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Dynamic mapping API error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error) 
    })
  }
}

/**
 * Handle GET requests
 */
async function handleGetRequest(req: NextApiRequest, res: NextApiResponse) {
  const { action, siteId, sessionId } = req.query

  switch (action) {
    case 'stats':
      return await getMappingStats(req, res)
    
    case 'health':
      return await getMappingHealth(req, res)
    
    case 'site-mappings':
      return await getSiteMappings(req, res)
    
    case 'session':
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' })
      }
      return await getMappingSession(req, res, sessionId as string)
    
    case 'test-directory':
      return await testDirectoryMapping(req, res)
    
    default:
      return res.status(400).json({ error: 'Invalid action parameter' })
  }
}

/**
 * Handle POST requests
 */
async function handlePostRequest(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query

  switch (action) {
    case 'map-fields':
      return await mapFormFields(req, res)
    
    case 'start-manual-mapping':
      return await startManualMapping(req, res)
    
    case 'save-mapping':
      return await saveSiteMapping(req, res)
    
    case 'test-submission':
      return await testFormSubmission(req, res)
    
    default:
      return res.status(400).json({ error: 'Invalid action parameter' })
  }
}

/**
 * Handle PUT requests
 */
async function handlePutRequest(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query

  switch (action) {
    case 'complete-session':
      return await completeMappingSession(req, res)
    
    case 'mark-broken':
      return await markSiteAsBroken(req, res)
    
    default:
      return res.status(400).json({ error: 'Invalid action parameter' })
  }
}

/**
 * Handle DELETE requests
 */
async function handleDeleteRequest(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query

  switch (action) {
    case 'cancel-session':
      return await cancelMappingSession(req, res)
    
    default:
      return res.status(400).json({ error: 'Invalid action parameter' })
  }
}

/**
 * Get mapping statistics
 */
async function getMappingStats(req: NextApiRequest, res: NextApiResponse) {
  await dynamicFormMapper.initialize()
  
  const stats = dynamicFormMapper.getMappingStats()
  const healthStats = enhancedAutoBoltService.getMappingHealthStats()

  return res.status(200).json({
    success: true,
    data: {
      ...stats,
      ...healthStats,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * Get mapping health status
 */
async function getMappingHealth(req: NextApiRequest, res: NextApiResponse) {
  const healthStats = enhancedAutoBoltService.getMappingHealthStats()
  
  const overallHealth = healthStats.healthyMappings / Math.max(healthStats.totalSites, 1)
  
  return res.status(200).json({
    success: true,
    data: {
      overallHealth: Math.round(overallHealth * 100),
      status: overallHealth > 0.8 ? 'healthy' : overallHealth > 0.6 ? 'warning' : 'critical',
      ...healthStats,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * Get site mappings
 */
async function getSiteMappings(req: NextApiRequest, res: NextApiResponse) {
  await dynamicFormMapper.initialize()
  
  const { limit = 50, offset = 0, status } = req.query
  
  let siteMappings = dynamicFormMapper.getAllSiteMappings()
  
  // Filter by status if provided
  if (status) {
    siteMappings = siteMappings.filter(mapping => mapping.verificationStatus === status)
  }

  // Pagination
  const total = siteMappings.length
  const paginatedMappings = siteMappings.slice(
    parseInt(offset as string),
    parseInt(offset as string) + parseInt(limit as string)
  )

  return res.status(200).json({
    success: true,
    data: {
      mappings: paginatedMappings,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + parseInt(limit as string)
      }
    }
  })
}

/**
 * Get mapping session details
 */
async function getMappingSession(req: NextApiRequest, res: NextApiResponse, sessionId: string) {
  const session = chromeExtensionBridge.getSession(sessionId)
  
  if (!session) {
    return res.status(404).json({ error: 'Mapping session not found' })
  }

  return res.status(200).json({
    success: true,
    data: session
  })
}

/**
 * Test directory mapping
 */
async function testDirectoryMapping(req: NextApiRequest, res: NextApiResponse) {
  const { siteUrl, businessData } = req.query

  if (!siteUrl || !businessData) {
    return res.status(400).json({ error: 'siteUrl and businessData are required' })
  }

  try {
    const businessObj = JSON.parse(businessData as string)
    
    await dynamicFormMapper.initialize()
    const mappingResult = await dynamicFormMapper.mapFormFields(siteUrl as string, businessObj)

    return res.status(200).json({
      success: true,
      data: mappingResult
    })
  } catch (error) {
    return res.status(400).json({ 
      error: 'Invalid request data',
      message: error instanceof Error ? error.message : String(error) 
    })
  }
}

/**
 * Map form fields for a site
 */
async function mapFormFields(req: NextApiRequest, res: NextApiResponse) {
  const { siteUrl, businessData, domContent } = req.body

  if (!siteUrl || !businessData) {
    return res.status(400).json({ error: 'siteUrl and businessData are required' })
  }

  await dynamicFormMapper.initialize()
  const mappingResult = await dynamicFormMapper.mapFormFields(siteUrl, businessData, domContent)

  return res.status(200).json({
    success: true,
    data: mappingResult
  })
}

/**
 * Start manual mapping session
 */
async function startManualMapping(req: NextApiRequest, res: NextApiResponse) {
  const { siteUrl, businessData, failedFields } = req.body

  if (!siteUrl || !businessData) {
    return res.status(400).json({ error: 'siteUrl and businessData are required' })
  }

  try {
    const sessionId = await chromeExtensionBridge.startManualMappingSession(
      siteUrl,
      businessData,
      failedFields || []
    )

    return res.status(200).json({
      success: true,
      data: { sessionId }
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to start manual mapping session',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Complete mapping session
 */
async function completeMappingSession(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId } = req.body

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' })
  }

  try {
    const finalMappings = await chromeExtensionBridge.completeMappingSession(sessionId)

    return res.status(200).json({
      success: true,
      data: { 
        sessionId,
        mappings: finalMappings,
        totalMapped: Object.keys(finalMappings).length
      }
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to complete mapping session',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Cancel mapping session
 */
async function cancelMappingSession(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId } = req.body

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' })
  }

  try {
    await chromeExtensionBridge.cancelMappingSession(sessionId)

    return res.status(200).json({
      success: true,
      data: { sessionId }
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to cancel mapping session',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Save site mapping
 */
async function saveSiteMapping(req: NextApiRequest, res: NextApiResponse) {
  const { siteUrl, mappings } = req.body

  if (!siteUrl || !mappings) {
    return res.status(400).json({ error: 'siteUrl and mappings are required' })
  }

  try {
    await dynamicFormMapper.initialize()
    await dynamicFormMapper.saveMappingForSite(siteUrl, mappings)

    return res.status(200).json({
      success: true,
      data: { 
        siteUrl,
        savedFields: Object.keys(mappings).length
      }
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to save site mapping',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Mark site as broken
 */
async function markSiteAsBroken(req: NextApiRequest, res: NextApiResponse) {
  const { siteId, reason } = req.body

  if (!siteId || !reason) {
    return res.status(400).json({ error: 'siteId and reason are required' })
  }

  try {
    await dynamicFormMapper.initialize()
    await dynamicFormMapper.markSiteAsBroken(siteId, reason)

    return res.status(200).json({
      success: true,
      data: { siteId, reason }
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to mark site as broken',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Test form submission
 */
async function testFormSubmission(req: NextApiRequest, res: NextApiResponse) {
  const { siteUrl, mappings, businessData } = req.body

  if (!siteUrl || !mappings || !businessData) {
    return res.status(400).json({ error: 'siteUrl, mappings, and businessData are required' })
  }

  try {
    const testResult = await chromeExtensionBridge.testFormSubmission(siteUrl, mappings, businessData)

    return res.status(200).json({
      success: true,
      data: testResult
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to test form submission',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}