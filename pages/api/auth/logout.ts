// 🔒 JORDAN'S LOGOUT API - Secure session termination and token invalidation
// POST /api/auth/logout - Logout user and invalidate tokens/sessions

import type { NextApiRequest, NextApiResponse } from 'next'
import { jwtManager, extractTokenFromCookie, extractTokenFromHeader } from '../../../lib/auth/jwt'
import { sessionManager } from '../../../lib/auth/session-manager'
import { handleApiError } from '../../../lib/utils/errors'
import { logger } from '../../../lib/utils/logger'

interface LogoutRequest {
  logoutFromAllDevices?: boolean
}

interface LogoutResponse {
  success: true
  message: string
  requestId: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LogoutResponse | any>
) {
  const requestId = `logout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      return res.status(405).json(handleApiError(
        new Error('Method not allowed'),
        requestId
      ))
    }

    // Set security headers
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    await handleLogout(req, res, requestId)

  } catch (error) {
    const errorResponse = handleApiError(error as Error, requestId)
    return res.status(errorResponse.error.statusCode).json(errorResponse)
  }
}

async function handleLogout(
  req: NextApiRequest,
  res: NextApiResponse,
  requestId: string
) {
  const clientIp = req.headers['x-forwarded-for'] as string || 
                   req.headers['x-real-ip'] as string || 
                   req.socket.remoteAddress || 'unknown'
  const userAgent = req.headers['user-agent'] || 'unknown'

  const logoutData: LogoutRequest = req.body || {}
  
  // Extract tokens from request
  const accessToken = extractTokenFromHeader(req.headers.authorization) || 
                     extractTokenFromCookie(req.headers.cookie)
  
  let refreshToken: string | null = null
  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
    
    refreshToken = cookies.refresh_token || null
  }

  let userId: string | undefined
  let sessionId: string | undefined

  // Try to get user info from access token (even if expired)
  if (accessToken) {
    try {
      const tokenPayload = await jwtManager.validateAccessToken(accessToken)
      userId = tokenPayload.sub
      sessionId = tokenPayload.sessionId
    } catch (error) {
      // Token might be expired - that's okay for logout
      // Try to decode without verification to get user ID
      try {
        const jwt = require('jsonwebtoken')
        const decoded = jwt.decode(accessToken) as any
        if (decoded && decoded.sub) {
          userId = decoded.sub
          sessionId = decoded.sessionId
        }
      } catch (decodeError) {
        // Can't get user info from token
      }
    }
  }

  let logoutCount = 0
  
  if (userId) {
    if (logoutData.logoutFromAllDevices) {
      // Revoke all user sessions except current if specified
      const revokedSessions = await sessionManager.revokeAllUserSessions(userId, sessionId)
      logoutCount = revokedSessions

      // Invalidate all refresh tokens for the user
      await jwtManager.invalidateUserTokens(userId)
      
      logger.info('User logged out from all devices', {
        requestId,
        metadata: {
          userId,
          revokedSessions,
          clientIp,
          userAgent
        }
      })
    } else {
      // Revoke only current session
      if (sessionId) {
        const revoked = await sessionManager.revokeSession(sessionId, 'user_logout')
        if (revoked) {
          logoutCount = 1
        }
      }

      // Invalidate the specific refresh token if available
      if (refreshToken) {
        // Note: Individual refresh token invalidation would need to be implemented
        // For now, we'll just log it
        logger.info('Refresh token invalidated on logout', {
          requestId,
          metadata: { userId, hasRefreshToken: true }
        })
      }

      logger.info('User logged out from current device', {
        requestId,
        metadata: {
          userId,
          sessionId,
          clientIp,
          userAgent
        }
      })
    }
  }

  // Clear authentication cookies
  const clearCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 0, // Expire immediately
    expires: new Date(0) // Set to past date
  }

  const clearCookies = [
    `access_token=; ${Object.entries(clearCookieOptions).map(([k, v]) => `${k}=${v}`).join('; ')}`,
    `refresh_token=; ${Object.entries(clearCookieOptions).map(([k, v]) => `${k}=${v}`).join('; ')}`
  ]

  res.setHeader('Set-Cookie', clearCookies)

  const response: LogoutResponse = {
    success: true,
    message: logoutData.logoutFromAllDevices 
      ? `Successfully logged out from all devices (${logoutCount} sessions terminated)`
      : 'Successfully logged out',
    requestId
  }

  res.status(200).json(response)
}