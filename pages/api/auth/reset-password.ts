// 🔒 JORDAN'S PASSWORD RESET API - Secure password reset flow
// POST /api/auth/reset-password - Initiate or complete password reset

import type { NextApiRequest, NextApiResponse } from 'next'
import { passwordResetManager } from '../../../lib/auth/password-reset'
import { handleApiError } from '../../../lib/utils/errors'
import { logger } from '../../../lib/utils/logger'

interface ResetRequestBody {
  action: 'initiate' | 'complete' | 'validate'
  email?: string
  token?: string
  newPassword?: string
}

interface ResetResponse {
  success: true
  data: {
    message: string
    action: string
    isValid?: boolean
    expiresAt?: string
  }
  requestId: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResetResponse | any>
) {
  const requestId = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
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

    await handlePasswordReset(req, res, requestId)

  } catch (error) {
    const errorResponse = handleApiError(error as Error, requestId)
    return res.status(errorResponse.error.statusCode).json(errorResponse)
  }
}

async function handlePasswordReset(
  req: NextApiRequest,
  res: NextApiResponse,
  requestId: string
) {
  const clientIp = req.headers['x-forwarded-for'] as string || 
                   req.headers['x-real-ip'] as string || 
                   req.socket.remoteAddress || 'unknown'
  const userAgent = req.headers['user-agent'] || 'unknown'
  
  const requestBody: ResetRequestBody = req.body

  if (!requestBody.action) {
    return res.status(400).json(handleApiError(
      new Error('Action is required'),
      requestId
    ))
  }

  switch (requestBody.action) {
    case 'initiate':
      await handleInitiateReset(requestBody, clientIp, userAgent, res, requestId)
      break
      
    case 'validate':
      await handleValidateToken(requestBody, res, requestId)
      break
      
    case 'complete':
      await handleCompleteReset(requestBody, clientIp, userAgent, res, requestId)
      break
      
    default:
      return res.status(400).json(handleApiError(
        new Error('Invalid action'),
        requestId
      ))
  }
}

async function handleInitiateReset(
  requestBody: ResetRequestBody,
  clientIp: string,
  userAgent: string,
  res: NextApiResponse,
  requestId: string
) {
  if (!requestBody.email) {
    return res.status(400).json(handleApiError(
      new Error('Email is required'),
      requestId
    ))
  }

  const result = await passwordResetManager.requestPasswordReset(
    requestBody.email,
    clientIp,
    userAgent
  )

  const response: ResetResponse = {
    success: true,
    data: {
      message: result.message,
      action: 'initiate'
    },
    requestId: result.requestId
  }

  res.status(200).json(response)
}

async function handleValidateToken(
  requestBody: ResetRequestBody,
  res: NextApiResponse,
  requestId: string
) {
  if (!requestBody.token) {
    return res.status(400).json(handleApiError(
      new Error('Token is required'),
      requestId
    ))
  }

  const validation = await passwordResetManager.validateResetToken(requestBody.token)

  const response: ResetResponse = {
    success: true,
    data: {
      message: validation.isValid ? 'Token is valid' : 'Token is invalid or expired',
      action: 'validate',
      isValid: validation.isValid,
      ...(validation.expiresAt && { expiresAt: validation.expiresAt.toISOString() })
    },
    requestId
  }

  res.status(200).json(response)
}

async function handleCompleteReset(
  requestBody: ResetRequestBody,
  clientIp: string,
  userAgent: string,
  res: NextApiResponse,
  requestId: string
) {
  if (!requestBody.token || !requestBody.newPassword) {
    return res.status(400).json(handleApiError(
      new Error('Token and new password are required'),
      requestId
    ))
  }

  const result = await passwordResetManager.resetPassword(
    requestBody.token,
    requestBody.newPassword,
    clientIp,
    userAgent
  )

  const response: ResetResponse = {
    success: true,
    data: {
      message: result.message,
      action: 'complete'
    },
    requestId: result.requestId
  }

  res.status(200).json(response)
}