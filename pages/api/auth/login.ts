// 🔒 JORDAN'S LOGIN API - Secure authentication with brute force protection
// POST /api/auth/login - Authenticate users with comprehensive security controls

import type { NextApiRequest, NextApiResponse } from 'next'
import { handleApiError, Errors, AuthenticationError } from '../../../lib/utils/errors'
import { validateEmail } from '../../../lib/utils/validation'
import { logger } from '../../../lib/utils/logger'
import type { User } from '../../../lib/database/schema'

// Login attempt tracking (use Redis in production)
const loginAttempts = new Map<string, { count: number; resetTime: number }>()
const accountLocks = new Map<string, number>() // userId -> lockUntil timestamp

const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_WINDOW: 60 * 60 * 1000, // 1 hour
  MAX_ATTEMPTS_PER_IP: 10,
  JWT_EXPIRES_IN: '24h',
  REFRESH_TOKEN_EXPIRES_IN: '7d'
}

interface LoginRequest {
  email: string
  password: string
  remember_me?: boolean
}

interface LoginResponse {
  success: true
  data: {
    user: Omit<User, 'password_hash' | 'verification_token'>
    tokens: {
      access_token: string
      refresh_token: string
      expires_in: number
    }
    session: {
      created_at: string
      expires_at: string
      ip_address: string
    }
  }
  requestId: string
}

// 🔒 SECURITY: Secure CORS configuration for authentication endpoints
function getAuthCorsHeaders(req: NextApiRequest) {
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['https://directorybolt.netlify.app', 'https://directorybolt.com']
    : ['http://localhost:3000', 'http://localhost:3001'];
    
  const origin = req.headers.origin;
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true', // Important for auth cookies
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  
  if (origin && allowedOrigins.includes(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  }
  
  return corsHeaders;
}

// 🔒 SECURITY: Apply CORS headers to response
function applyCorsHeaders(res: NextApiResponse, corsHeaders: Record<string, string>) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse | any>
) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // 🔒 SECURITY FIX: Apply secure CORS headers (CORS-010)
  const corsHeaders = getAuthCorsHeaders(req);
  applyCorsHeaders(res, corsHeaders);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      return res.status(405).json(handleApiError(
        new Error('Method not allowed'),
        requestId
      ))
    }
    
    await handleLogin(req, res, requestId)
    
  } catch (error) {
    const errorResponse = handleApiError(error as Error, requestId)
    return res.status(errorResponse.error.statusCode).json(errorResponse)
  }
}

async function handleLogin(
  req: NextApiRequest,
  res: NextApiResponse,
  requestId: string
) {
  const data: LoginRequest = req.body
  const clientIp = req.headers['x-forwarded-for'] as string || 
                   req.headers['x-real-ip'] as string || 
                   req.socket.remoteAddress || 'unknown'
  const userAgent = req.headers['user-agent'] || 'unknown'
  
  // Rate limiting check by IP
  const ipRateLimitKey = `login_ip:${clientIp}`
  if (!checkIpRateLimit(ipRateLimitKey)) {
    await logLoginAttempt(null, clientIp, userAgent, false, 'IP_RATE_LIMITED')
    throw Errors.rateLimitExceeded(Date.now() + SECURITY_CONFIG.RATE_LIMIT_WINDOW)
  }
  
  // Validate input
  if (!data.email || !data.password) {
    throw new AuthenticationError('Email and password are required', 'MISSING_CREDENTIALS')
  }
  
  // Email validation
  const emailValidation = validateEmail(data.email)
  if (!emailValidation.isValid) {
    await logLoginAttempt(data.email, clientIp, userAgent, false, 'INVALID_EMAIL')
    throw new AuthenticationError('Invalid email format', 'INVALID_EMAIL')
  }
  
  // Find user
  const user = await findUserByEmail(emailValidation.sanitizedData!)
  if (!user) {
    // Add artificial delay to prevent timing attacks
    await sleep(Math.random() * 1000 + 500)
    await logLoginAttempt(data.email, clientIp, userAgent, false, 'USER_NOT_FOUND')
    throw Errors.invalidCredentials()
  }
  
  // Check if account is locked
  const lockUntil = accountLocks.get(user.id)
  if (lockUntil && Date.now() < lockUntil) {
    const lockExpiry = new Date(lockUntil)
    await logLoginAttempt(user.email, clientIp, userAgent, false, 'ACCOUNT_LOCKED')
    throw Errors.accountLocked(lockExpiry)
  }
  
  // Check if account is verified
  if (!user.is_verified) {
    await logLoginAttempt(user.email, clientIp, userAgent, false, 'ACCOUNT_NOT_VERIFIED')
    throw new AuthenticationError('Please verify your email address before logging in', 'ACCOUNT_NOT_VERIFIED')
  }
  
  // Verify password
  const passwordValid = await verifyPassword(data.password, user.password_hash)
  if (!passwordValid) {
    // Increment failed login attempts
    await incrementFailedLoginAttempts(user.id, user.email, requestId)
    await logLoginAttempt(user.email, clientIp, userAgent, false, 'INVALID_PASSWORD')
    throw Errors.invalidCredentials()
  }
  
  // Reset failed login attempts on successful authentication
  await resetFailedLoginAttempts(user.id, requestId)
  
  // Generate tokens
  const accessToken = generateAccessToken(user)
  const refreshToken = generateRefreshToken(user)
  
  // Update user login timestamp
  await updateLastLogin(user.id, clientIp, requestId)
  
  // Create session record
  const session = {
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    ip_address: clientIp
  }
  
  await saveSession(user.id)
  
  // Log successful login
  await logLoginAttempt(user.email, clientIp, userAgent, true, 'SUCCESS')
  
  // Remove sensitive data from response
  const { password_hash: _password_hash, verification_token: _verification_token, ...userResponse } = user
  
  const response: LoginResponse = {
    success: true,
    data: {
      user: userResponse,
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 24 * 60 * 60 // 24 hours in seconds
      },
      session
    },
    requestId
  }
  
  // Set security headers and secure cookies
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  
  // Set HTTP-only cookies for tokens (more secure than localStorage)
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: data.remember_me ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 7 days or 24 hours
  }
  
  res.setHeader('Set-Cookie', [
    `access_token=${accessToken}; ${Object.entries(cookieOptions).map(([k, v]) => `${k}=${v}`).join('; ')}`,
    `refresh_token=${refreshToken}; ${Object.entries(cookieOptions).map(([k, v]) => `${k}=${v}`).join('; ')}`
  ])
  
  res.status(200).json(response)
}

// Rate limiting functions
function checkIpRateLimit(key: string): boolean {
  const now = Date.now()
  const attempts = loginAttempts.get(key)
  
  if (!attempts || now > attempts.resetTime) {
    loginAttempts.set(key, { count: 1, resetTime: now + SECURITY_CONFIG.RATE_LIMIT_WINDOW })
    return true
  }
  
  if (attempts.count >= SECURITY_CONFIG.MAX_ATTEMPTS_PER_IP) {
    return false
  }
  
  attempts.count++
  return true
}

async function incrementFailedLoginAttempts(userId: string, email: string, requestId: string): Promise<void> {
  // TODO: Implement database update
  // const user = await db.users.update({
  //   where: { id: userId },
  //   data: { 
  //     failed_login_attempts: { increment: 1 },
  //     updated_at: new Date()
  //   }
  // })
  
  // Mock: simulate getting updated failed attempts count
  const failedAttempts = Math.floor(Math.random() * 3) + 1 // Mock 1-3 attempts
  
  if (failedAttempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
    const lockUntil = Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION
    accountLocks.set(userId, lockUntil)
    
    logger.warn(`Account locked: ${email}`, {
      requestId,
      metadata: { failedAttempts, email }
    })
    
    // TODO: Send account lockout notification email
    await sendAccountLockoutEmail(email, new Date(lockUntil))
  }
  
  logger.warn(`Failed login attempt for ${email}`, {
    requestId,
    metadata: { failedAttempts, maxAttempts: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS, email }
  })
}

async function resetFailedLoginAttempts(userId: string, requestId: string): Promise<void> {
  // TODO: Implement database update
  // await db.users.update({
  //   where: { id: userId },
  //   data: { 
  //     failed_login_attempts: 0,
  //     locked_until: null,
  //     updated_at: new Date()
  //   }
  // })
  
  accountLocks.delete(userId)
  logger.info(`Reset failed login attempts`, {
    requestId,
    metadata: { userId }
  })
}

// Database functions (mock implementations)
async function findUserByEmail(email: string): Promise<User | null> {
  // TODO: Implement actual database query
  // return await db.users.findFirst({ where: { email } })
  
  // Mock user for development
  if (email === 'test@directorybolt.com') {
    return {
      id: 'usr_test_123',
      email: 'test@directorybolt.com',
      password_hash: 'hashed_password_123',
      full_name: 'Test User',
      company_name: 'Test Company',
      subscription_tier: 'professional',
      credits_remaining: 50,
      is_verified: true,
      failed_login_attempts: 0,
      created_at: new Date('2024-01-01'),
      updated_at: new Date(),
      // New subscription-related fields
      directories_used_this_period: 15,
      directory_limit: 100
    } as User
  }
  
  return null
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // TODO: Implement bcrypt verification
  // const bcrypt = require('bcryptjs')
  // return await bcrypt.compare(password, hash)
  
  // Mock verification for development
  return password === 'test123' && hash === 'hashed_password_123'
}

async function updateLastLogin(userId: string, ipAddress: string, requestId: string): Promise<void> {
  // TODO: Implement database update
  // await db.users.update({
  //   where: { id: userId },
  //   data: { 
  //     last_login_at: new Date(),
  //     updated_at: new Date()
  //   }
  // })
  
  logger.info(`Updated last login`, {
    requestId,
    metadata: { userId, ipAddress }
  })
}

// Token generation (simplified - use proper JWT library in production)
function generateAccessToken(user: User): string {
  // TODO: Implement proper JWT token generation
  // const jwt = require('jsonwebtoken')
  // return jwt.sign(
  //   { 
  //     sub: user.id, 
  //     email: user.email, 
  //     tier: user.subscription_tier 
  //   },
  //   process.env.JWT_SECRET,
  //   { expiresIn: SECURITY_CONFIG.JWT_EXPIRES_IN }
  // )
  
  // Mock token for development
  return `access_${user.id}_${Date.now()}`
}

function generateRefreshToken(user: User): string {
  // TODO: Implement proper refresh token generation
  // Mock token for development
  return `refresh_${user.id}_${Date.now()}`
}

async function saveSession(
  userId: string
): Promise<void> {
  // TODO: Implement session storage (database or Redis)
  logger.info(`Saved session`, {
    metadata: { userId }
  })
}

// Notification functions
async function sendAccountLockoutEmail(email: string, lockUntil: Date): Promise<void> {
  // TODO: Implement email notification
  logger.info(`Account lockout email sent`, {
    metadata: { email, lockUntil: lockUntil.toISOString() }
  })
}

// Audit logging
async function logLoginAttempt(
  email: string | null,
  ipAddress: string,
  userAgent: string,
  success: boolean,
  reason: string
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: 'login_attempt',
    email,
    ip_address: ipAddress,
    user_agent: userAgent,
    success,
    reason
  }
  
  logger.info(`Login attempt logged`, {
    metadata: { email: logEntry.email, success: logEntry.success }
  })
  
  // TODO: Save to audit log database
  // await db.audit_logs.create({ data: logEntry })
}

// Utility functions
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}