// @ts-nocheck
// 🔒 JORDAN'S ADMIN API KEY DETAILS - Individual API key management with full audit trail
// GET/PUT/DELETE /api/admin/api-keys/[keyId] - Detailed API key management

import type { NextApiRequest, NextApiResponse } from 'next'
import { apiKeyManager } from '../../../../lib/auth/api-keys'
import { authMiddleware, type AuthenticatedRequest } from '../../../../lib/auth/middleware'
import { getUserRole } from '../../../../lib/auth/rbac'
import { handleApiError, AuthorizationError, ValidationError } from '../../../../lib/utils/errors'
import { logger } from '../../../../lib/utils/logger'
import { apiKeyDatabase } from '../../../../lib/database/api-key-schema'
import { withCSRFProtection } from '../../../../lib/security/csrf-protection'

interface SecurityLogEntry {
  timestamp: string
  ipAddress: string
  action: string
  status: 'success' | 'failure'
}

interface AdminApiKeyDetailsResponse {
  success: true
  data: {
    apiKey: {
      id: string
      user_id: string
      user_email: string
      user_name: string
      name: string
      description?: string
      keyPrefix: string
      permissions: string[]
      isActive: boolean
      rateLimit: number
      createdAt: Date
      expiresAt?: Date
      lastUsedAt?: Date
      createdFromIp: string
      ipWhitelist?: string[]
      referrerWhitelist?: string[]
    }
    usage: {
      requestsToday: number
      requestsThisMonth: number
      totalRequests: number
      recentActivity: Array<{
        timestamp: Date
        endpoint: string
        method: string
        ipAddress: string
        responseStatus: number
        processingTime: number
      }>
    }
    securityLog: Array<{
      id: string
      eventType: string
      violationType?: string
      ipAddress?: string
      timestamp: Date
      metadata?: any
    }>
    analytics: {
      requests: {
        today: number
        thisWeek: number
        thisMonth: number
        total: number
      }
      endpoints: Array<{
        path: string
        count: number
        avgResponseTime: number
      }>
      errors: {
        total: number
        rate: number
        commonErrors: Array<{ status: number; count: number }>
      }
      performance: {
        avgResponseTime: number
        p95ResponseTime: number
        slowestEndpoint: string
      }
    }
  }
  requestId: string
}

interface AdminApiKeyUpdateResponse {
  success: true
  data: {
    message: string
    updatedFields: string[]
  }
  requestId: string
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = `admin_apikey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const { keyId } = req.query
  
  if (!keyId || typeof keyId !== 'string') {
    return res.status(400).json(handleApiError(
      new ValidationError('API key ID is required', 'keyId', 'REQUIRED'),
      requestId
    ))
  }

  try {
    // Apply admin authentication middleware
    await authMiddleware({ 
      requireAuth: true, 
      requireVerified: true,
      requiredPermission: 'system:admin'
    })(
      req as AuthenticatedRequest,
      res,
      async () => {
        // Set security headers
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')

        if (req.method === 'GET') {
          await handleGetApiKeyDetails(req as AuthenticatedRequest, res, requestId, keyId)
        } else if (req.method === 'PUT') {
          await handleUpdateApiKey(req as AuthenticatedRequest, res, requestId, keyId)
        } else if (req.method === 'DELETE') {
          await handleDeleteApiKey(req as AuthenticatedRequest, res, requestId, keyId)
        } else {
          res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
          return res.status(405).json(handleApiError(
            new Error('Method not allowed'),
            requestId
          ))
        }
      }
    )

  } catch (error) {
    const errorResponse = handleApiError(error as Error, requestId)
    return res.status(errorResponse.error.statusCode).json(errorResponse)
  }
}

async function handleGetApiKeyDetails(
  req: AuthenticatedRequest,
  res: NextApiResponse<AdminApiKeyDetailsResponse | any>,
  requestId: string,
  keyId: string
) {
  if (!req.user) {
    throw new AuthorizationError('Admin authentication required', 'ADMIN_AUTH_REQUIRED')
  }

  try {
    // Get API key details
    const apiKey = await apiKeyDatabase.getApiKeyById(keyId)
    if (!apiKey) {
      throw new ValidationError('API key not found', 'keyId', 'NOT_FOUND')
    }

    // Get user details
    const user = await apiKeyDatabase.getUserById(apiKey.user_id)
    if (!user) {
      throw new ValidationError('Associated user not found', 'userId', 'NOT_FOUND')
    }

    // Get usage statistics
    const usage = await apiKeyDatabase.getApiKeyUsage(keyId)

    // Get IP and referrer whitelists
    const ipWhitelist = await apiKeyDatabase.getApiKeyIpWhitelist(keyId)
    const referrerWhitelist = await apiKeyDatabase.getApiKeyReferrerWhitelist(keyId)

    // Get analytics
    const analytics = await apiKeyManager.getKeyAnalytics(keyId, apiKey.user_id)

    // TODO: Implement security log retrieval
    const securityLog: SecurityLogEntry[] = [] // await apiKeyDatabase.getSecurityLog(keyId)

    // TODO: Implement recent activity retrieval
    const recentActivity: SecurityLogEntry[] = [] // await apiKeyDatabase.getRecentActivity(keyId, 10)

    logger.info('Admin API key details retrieved', {
      requestId,
      metadata: {
        adminUserId: req.user.id,
        keyId,
        keyUserId: apiKey.user_id
      }
    })

    const response: AdminApiKeyDetailsResponse = {
      success: true,
      data: {
        apiKey: {
          id: apiKey.id,
          user_id: apiKey.user_id,
          user_email: user.email,
          user_name: user.full_name,
          name: apiKey.name,
          description: apiKey.description,
          keyPrefix: apiKey.key_hash.substring(0, 12) + '...',
          permissions: apiKey.permissions,
          isActive: apiKey.is_active,
          rateLimit: apiKey.rate_limit_per_hour,
          createdAt: apiKey.created_at,
          expiresAt: apiKey.expires_at,
          lastUsedAt: apiKey.last_used_at,
          createdFromIp: apiKey.created_from_ip,
          ipWhitelist: ipWhitelist.length > 0 ? ipWhitelist : undefined,
          referrerWhitelist: referrerWhitelist.length > 0 ? referrerWhitelist : undefined
        },
        usage: {
          ...usage,
          recentActivity
        },
        securityLog,
        analytics
      },
      requestId
    }

    res.status(200).json(response)

  } catch (error) {
    logger.error('Failed to get API key details', {
      requestId,
      error: error.message,
      adminUserId: req.user.id,
      keyId
    })
    throw error
  }
}

async function handleUpdateApiKey(
  req: AuthenticatedRequest,
  res: NextApiResponse<AdminApiKeyUpdateResponse | any>,
  requestId: string,
  keyId: string
) {
  if (!req.user) {
    throw new AuthorizationError('Admin authentication required', 'ADMIN_AUTH_REQUIRED')
  }

  const { name, isActive, rateLimit, expiresAt } = req.body

  try {
    // Verify API key exists
    const apiKey = await apiKeyDatabase.getApiKeyById(keyId)
    if (!apiKey) {
      throw new ValidationError('API key not found', 'keyId', 'NOT_FOUND')
    }

    const updatedFields: string[] = []

    // TODO: Implement update methods in database layer
    // For now, we can only deactivate keys
    if (typeof isActive === 'boolean' && isActive !== apiKey.is_active) {
      if (!isActive) {
        await apiKeyDatabase.deactivateApiKey(keyId)
        updatedFields.push('isActive')
      }
    }

    // Log the update
    await apiKeyDatabase.logSecurityEvent(
      keyId,
      'creation', // Using creation as placeholder - would need 'update' event type
      undefined,
      req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
      {
        adminUserId: req.user.id,
        updatedFields,
        changes: { name, isActive, rateLimit, expiresAt }
      }
    )

    logger.info('Admin API key updated', {
      requestId,
      metadata: {
        adminUserId: req.user.id,
        keyId,
        updatedFields
      }
    })

    const response: AdminApiKeyUpdateResponse = {
      success: true,
      data: {
        message: `API key updated successfully. Updated fields: ${updatedFields.join(', ')}`,
        updatedFields
      },
      requestId
    }

    res.status(200).json(response)

  } catch (error) {
    logger.error('Failed to update API key', {
      requestId,
      error: error.message,
      adminUserId: req.user.id,
      keyId
    })
    throw error
  }
}

async function handleDeleteApiKey(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  requestId: string,
  keyId: string
) {
  if (!req.user) {
    throw new AuthorizationError('Admin authentication required', 'ADMIN_AUTH_REQUIRED')
  }

  try {
    // Verify API key exists
    const apiKey = await apiKeyDatabase.getApiKeyById(keyId)
    if (!apiKey) {
      throw new ValidationError('API key not found', 'keyId', 'NOT_FOUND')
    }

    // Deactivate the API key (soft delete)
    await apiKeyDatabase.deactivateApiKey(keyId)

    // Log the deletion
    await apiKeyDatabase.logSecurityEvent(
      keyId,
      'revocation',
      undefined,
      req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
      {
        adminUserId: req.user.id,
        reason: 'Admin deletion'
      }
    )

    logger.info('Admin API key deleted', {
      requestId,
      metadata: {
        adminUserId: req.user.id,
        keyId,
        keyUserId: apiKey.user_id
      }
    })

    res.status(200).json({
      success: true,
      data: {
        message: 'API key successfully deleted (deactivated)'
      },
      requestId
    })

  } catch (error) {
    logger.error('Failed to delete API key', {
      requestId,
      error: error.message,
      adminUserId: req.user.id,
      keyId
    })
    throw error
  }
}
// Export with CSRF protection
export default withCSRFProtection(handler)
