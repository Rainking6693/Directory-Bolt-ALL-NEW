// 🔒 JORDAN'S API KEY MANAGEMENT API - AutoBolt extension API key generation
// GET/POST/DELETE /api/auth/api-keys - Manage API keys for automation

import type { NextApiRequest, NextApiResponse } from 'next'
import { apiKeyManager, type ApiKeyCreationRequest, type ApiKeyResponse } from '../../../lib/auth/api-keys'
import { authMiddleware, type AuthenticatedRequest } from '../../../lib/auth/middleware'
import { getUserRole } from '../../../lib/auth/rbac'
import { handleApiError, AuthorizationError, ValidationError } from '../../../lib/utils/errors'
import { logger } from '../../../lib/utils/logger'

interface ApiKeysListResponse {
  success: true
  data: {
    apiKeys: ApiKeyResponse[]
    total: number
  }
  requestId: string
}

interface ApiKeyCreateResponse {
  success: true
  data: {
    apiKey: ApiKeyResponse
    plainKey: string
    warning: string
  }
  requestId: string
}

interface ApiKeyDeleteResponse {
  success: true
  data: {
    message: string
  }
  requestId: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = `apikeys_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // Apply authentication middleware
    await authMiddleware({ 
      requireAuth: true, 
      requireVerified: true,
      requiredPermission: 'apikeys:read'
    })(
      req as AuthenticatedRequest,
      res,
      async () => {
        // Set security headers
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')

        if (req.method === 'GET') {
          await handleListApiKeys(req as AuthenticatedRequest, res, requestId)
        } else if (req.method === 'POST') {
          await handleCreateApiKey(req as AuthenticatedRequest, res, requestId)
        } else if (req.method === 'DELETE') {
          await handleDeleteApiKey(req as AuthenticatedRequest, res, requestId)
        } else {
          res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
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

async function handleListApiKeys(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiKeysListResponse | any>,
  requestId: string
) {
  if (!req.user) {
    throw new AuthorizationError('User not authenticated', 'AUTH_REQUIRED')
  }

  const apiKeys = await apiKeyManager.getUserApiKeys(req.user.id)

  logger.info('API keys listed', {
    requestId,
    metadata: {
      userId: req.user.id,
      keyCount: apiKeys.length
    }
  })

  const response: ApiKeysListResponse = {
    success: true,
    data: {
      apiKeys,
      total: apiKeys.length
    },
    requestId
  }

  res.status(200).json(response)
}

async function handleCreateApiKey(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiKeyCreateResponse | any>,
  requestId: string
) {
  if (!req.user) {
    throw new AuthorizationError('User not authenticated', 'AUTH_REQUIRED')
  }

  const clientIp = req.headers['x-forwarded-for'] as string || 
                   req.headers['x-real-ip'] as string || 
                   req.socket.remoteAddress || 'unknown'

  // Validate request body
  const createRequest: ApiKeyCreationRequest = req.body
  
  if (!createRequest.name) {
    throw new ValidationError('API key name is required', 'name', 'REQUIRED')
  }

  if (!createRequest.permissions || createRequest.permissions.length === 0) {
    throw new ValidationError('At least one permission is required', 'permissions', 'REQUIRED')
  }

  // Set default permissions if not specified
  if (!createRequest.permissions.includes('read_directories')) {
    createRequest.permissions.push('read_directories')
  }
  
  if (!createRequest.permissions.includes('create_submissions')) {
    createRequest.permissions.push('create_submissions')
  }

  // Create the API key
  const result = await apiKeyManager.createApiKey(req.user, createRequest, clientIp)

  logger.info('API key created', {
    requestId,
    metadata: {
      userId: req.user.id,
      keyId: result.apiKey.id,
      keyName: result.apiKey.name,
      permissions: result.apiKey.permissions
    }
  })

  const response: ApiKeyCreateResponse = {
    success: true,
    data: {
      apiKey: result.apiKey,
      plainKey: result.plainKey,
      warning: 'Store this API key securely. It will not be shown again.'
    },
    requestId
  }

  res.status(201).json(response)
}

async function handleDeleteApiKey(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiKeyDeleteResponse | any>,
  requestId: string
) {
  if (!req.user) {
    throw new AuthorizationError('User not authenticated', 'AUTH_REQUIRED')
  }

  const { keyId } = req.body

  if (!keyId) {
    throw new ValidationError('API key ID is required', 'keyId', 'REQUIRED')
  }

  const userRole = getUserRole(req.user)
  await apiKeyManager.revokeApiKey(req.user.id, keyId, userRole)

  logger.info('API key revoked', {
    requestId,
    metadata: {
      userId: req.user.id,
      keyId
    }
  })

  const response: ApiKeyDeleteResponse = {
    success: true,
    data: {
      message: 'API key successfully revoked'
    },
    requestId
  }

  res.status(200).json(response)
}