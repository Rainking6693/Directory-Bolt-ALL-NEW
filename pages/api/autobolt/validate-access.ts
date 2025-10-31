/**
 * AutoBolt Access Validation API
 * 
 * GET /api/autobolt/validate-access - Validate monitoring dashboard access
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'

interface ValidationResponse {
  success: boolean
  permissions?: {
    monitoring: boolean
    demo_access: boolean
    health_monitor: boolean
    data_flow: boolean
    admin_actions: boolean
  }
  user_info?: {
    access_level: 'admin' | 'staff' | 'readonly'
    granted_at: string
    expires_at?: string
  }
  error?: string
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ValidationResponse>
) {
  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET.'
    })
  }

  try {
    // Get API key from headers
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '')
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key is required in X-API-Key header'
      })
    }

    // Validate the API key
    if (apiKey !== process.env.AUTOBOLT_API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      })
    }

    // Define permissions based on API key
    // In a production system, you might want to have different API keys with different permissions
    const permissions = {
      monitoring: true,
      demo_access: true,
      health_monitor: true,
      data_flow: true,
      admin_actions: true
    }

    const userInfo = {
      access_level: 'admin' as const,
      granted_at: new Date().toISOString(),
      expires_at: undefined // No expiration for admin access
    }

    console.log('✅ API key validated successfully for monitoring access')

    return res.status(200).json({
      success: true,
      permissions,
      user_info: userInfo
    })

  } catch (error) {
    console.error('AutoBolt Access Validation API Error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    })
  }
}

export default withRateLimit(handler, rateLimiters.general)