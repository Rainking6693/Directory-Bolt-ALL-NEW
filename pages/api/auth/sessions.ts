// 🔒 JORDAN'S SESSION MANAGEMENT API - Multi-device session control
// GET/DELETE /api/auth/sessions - Manage user sessions across devices

import type { NextApiRequest, NextApiResponse } from 'next'
import { sessionManager } from '../../../lib/auth/session-manager'
import { jwtManager } from '../../../lib/auth/jwt'
import { authMiddleware, type AuthenticatedRequest } from '../../../lib/auth/middleware'
import { handleApiError, AuthorizationError } from '../../../lib/utils/errors'
import { logger } from '../../../lib/utils/logger'

interface SessionsResponse {
  success: true
  data: {
    sessions: Array<{
      id: string
      deviceInfo: string
      location: string
      lastActivity: string
      isCurrentSession: boolean
      status: string
    }>
    total: number
  }
  requestId: string
}

interface RevokeSessionResponse {
  success: true
  data: {
    message: string
    revokedCount: number
  }
  requestId: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = `sessions_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // Apply authentication middleware
    await authMiddleware({ requireAuth: true, requireVerified: true })(
      req as AuthenticatedRequest,
      res,
      async () => {
        // Set security headers
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')

        if (req.method === 'GET') {
          await handleGetSessions(req as AuthenticatedRequest, res, requestId)
        } else if (req.method === 'DELETE') {
          await handleRevokeSessions(req as AuthenticatedRequest, res, requestId)
        } else {
          res.setHeader('Allow', ['GET', 'DELETE'])
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

async function handleGetSessions(
  req: AuthenticatedRequest,
  res: NextApiResponse<SessionsResponse | any>,
  requestId: string
) {
  if (!req.user) {
    throw new AuthorizationError('User not authenticated', 'AUTH_REQUIRED')
  }

  const currentSessionId = req.sessionId
  const userSessions = await sessionManager.getUserSessions(req.user.id)

  // Mark current session
  const sessions = userSessions.map(session => ({
    ...session,
    lastActivity: session.lastActivity.toISOString(),
    isCurrentSession: session.id === currentSessionId
  }))

  logger.info('User sessions retrieved', {
    requestId,
    metadata: {
      userId: req.user.id,
      sessionCount: sessions.length,
      currentSessionId
    }
  })

  const response: SessionsResponse = {
    success: true,
    data: {
      sessions,
      total: sessions.length
    },
    requestId
  }

  res.status(200).json(response)
}

async function handleRevokeSessions(
  req: AuthenticatedRequest,
  res: NextApiResponse<RevokeSessionResponse | any>,
  requestId: string
) {
  if (!req.user) {
    throw new AuthorizationError('User not authenticated', 'AUTH_REQUIRED')
  }

  const { sessionId, revokeAll } = req.body || {}

  let revokedCount = 0
  let message = ''

  if (revokeAll) {
    // Revoke all sessions except current
    revokedCount = await sessionManager.revokeAllUserSessions(req.user.id, req.sessionId)
    
    // Also invalidate all refresh tokens
    await jwtManager.invalidateUserTokens(req.user.id)
    
    message = `Successfully revoked ${revokedCount} sessions`
    
    logger.info('All user sessions revoked', {
      requestId,
      metadata: {
        userId: req.user.id,
        revokedCount,
        currentSessionId: req.sessionId
      }
    })
    
  } else if (sessionId) {
    // Revoke specific session
    if (sessionId === req.sessionId) {
      return res.status(400).json(handleApiError(
        new Error('Cannot revoke current session'),
        requestId
      ))
    }
    
    const revoked = await sessionManager.revokeSession(sessionId, 'user_request')
    revokedCount = revoked ? 1 : 0
    message = revoked ? 'Session successfully revoked' : 'Session not found or already revoked'
    
    logger.info('Specific session revoked', {
      requestId,
      metadata: {
        userId: req.user.id,
        targetSessionId: sessionId,
        revoked
      }
    })
    
  } else {
    return res.status(400).json(handleApiError(
      new Error('Either sessionId or revokeAll must be specified'),
      requestId
    ))
  }

  const response: RevokeSessionResponse = {
    success: true,
    data: {
      message,
      revokedCount
    },
    requestId
  }

  res.status(200).json(response)
}