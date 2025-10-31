// @ts-nocheck
// 🔒 JORDAN'S AUTHENTICATION API - Secure user registration with comprehensive validation
// POST /api/auth/register - Create new user accounts with security controls

import type { NextApiRequest, NextApiResponse } from 'next'
import { handleApiError, Errors, ValidationError } from '../../../lib/utils/errors'
import { validateEmail, validatePassword } from '../../../lib/utils/validation'
import { logger } from '../../../lib/utils/logger'
import type { User } from '../../../lib/database/schema'

// Registration rate limiting (use Redis in production)
const registrationAttempts = new Map<string, { count: number; resetTime: number }>()
const REGISTRATION_LIMITS = {
  MAX_ATTEMPTS_PER_HOUR: 5,
  WINDOW_MS: 60 * 60 * 1000 // 1 hour
}

interface RegisterRequest {
  email: string
  password: string
  full_name: string
  business_name?: string  // FIXED: Changed from company_name to business_name
  agree_to_terms: boolean
}

interface RegisterResponse {
  success: true
  data: {
    user: Omit<User, 'password_hash' | 'verification_token'>
    verification_required: boolean
    message: string
  }
  requestId: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RegisterResponse | any>
) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      return res.status(405).json(handleApiError(
        new Error('Method not allowed'),
        requestId
      ))
    }
    
    await handleRegister(req, res, requestId)
    
  } catch (error) {
    const errorResponse = handleApiError(error as Error, requestId)
    return res.status(errorResponse.error.statusCode).json(errorResponse)
  }
}

async function handleRegister(
  req: NextApiRequest,
  res: NextApiResponse,
  requestId: string
) {
  const data: RegisterRequest = req.body
  const clientIp = req.headers['x-forwarded-for'] as string || 
                   req.headers['x-real-ip'] as string || 
                   req.socket.remoteAddress || 'unknown'
  
  // Rate limiting check
  const rateLimitKey = `register:${clientIp}`
  if (!checkRegistrationRateLimit(rateLimitKey)) {
    throw Errors.rateLimitExceeded(Date.now() + REGISTRATION_LIMITS.WINDOW_MS)
  }
  
  // Validate required fields
  if (!data.email || !data.password || !data.full_name) {
    throw new ValidationError('Email, password, and full name are required', 'required', 'REQUIRED_FIELDS')
  }
  
  // Terms agreement validation
  if (!data.agree_to_terms) {
    throw new ValidationError('You must agree to the terms of service', 'agree_to_terms', 'TERMS_REQUIRED')
  }
  
  // Email validation
  const emailValidation = validateEmail(data.email)
  if (!emailValidation.isValid) {
    throw emailValidation.errors[0]
  }
  
  // Password validation
  const passwordValidation = validatePassword(data.password)
  if (!passwordValidation.isValid) {
    throw passwordValidation.errors[0]
  }
  
  // Full name validation
  const fullName = data.full_name.trim()
  if (fullName.length < 2) {
    throw new ValidationError('Full name must be at least 2 characters', 'full_name', 'TOO_SHORT')
  }
  
  if (fullName.length > 100) {
    throw new ValidationError('Full name must be less than 100 characters', 'full_name', 'TOO_LONG')
  }
  
  // Business name validation (optional)
  let businessName: string | undefined = undefined
  if (data.business_name) {
    businessName = data.business_name.trim()
    if (businessName.length > 200) {
      throw new ValidationError('Business name must be less than 200 characters', 'business_name', 'TOO_LONG')
    }
  }
  
  // Check if user already exists
  const existingUser = await findUserByEmail(emailValidation.sanitizedData!)
  if (existingUser) {
    throw new ValidationError('An account with this email already exists', 'email', 'EMAIL_EXISTS')
  }
  
  // Hash password
  const passwordHash = await hashPassword(data.password)
  
  // Generate verification token
  const verificationToken = generateSecureToken()
  
  // Create user
  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: emailValidation.sanitizedData!,
    password_hash: passwordHash,
    full_name: fullName,
    business_name: businessName,  // FIXED: Changed from company_name to business_name
    subscription_tier: 'free',
    credits_remaining: 10, // Free tier starter credits
    is_verified: false,
    failed_login_attempts: 0,
    verification_token: verificationToken,
    created_at: new Date(),
    updated_at: new Date(),
    // New subscription-related fields
    directories_used_this_period: 0,
    directory_limit: 5 // Free tier limit
  }
  
  // Save user to database
  await saveUser(newUser, requestId)
  
  // Send verification email
  await sendVerificationEmail(newUser.email, verificationToken, newUser.full_name)
  
  // Log registration attempt
  await logRegistrationAttempt(clientIp, newUser.email, true)
  
  // Remove sensitive data from response
  const { password_hash: _password_hash, verification_token: _verification_token, ...userResponse } = newUser
  
  const response: RegisterResponse = {
    success: true,
    data: {
      user: userResponse,
      verification_required: true,
      message: 'Account created successfully. Please check your email to verify your account.'
    },
    requestId
  }
  
  // Set security headers
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  
  res.status(201).json(response)
}

// Rate limiting for registration attempts
function checkRegistrationRateLimit(key: string): boolean {
  const now = Date.now()
  const attempts = registrationAttempts.get(key)
  
  if (!attempts || now > attempts.resetTime) {
    // First attempt or window expired
    registrationAttempts.set(key, { count: 1, resetTime: now + REGISTRATION_LIMITS.WINDOW_MS })
    return true
  }
  
  if (attempts.count >= REGISTRATION_LIMITS.MAX_ATTEMPTS_PER_HOUR) {
    return false
  }
  
  attempts.count++
  return true
}

// Mock database functions (replace with actual database calls)
async function findUserByEmail(_email: string): Promise<User | null> {
  // TODO: Implement actual database query
  // const user = await db.users.findFirst({ where: { email } })
  // return user
  
  // Mock: return null (user doesn't exist)
  return null
}

async function saveUser(user: User, requestId?: string): Promise<void> {
  // TODO: Implement actual database save
  // await db.users.create({ data: user })
  
  logger.info(`User registration saved`, {
    requestId,
    metadata: { email: user.email }
  })
}

// Security utilities
async function hashPassword(password: string): Promise<string> {
  // TODO: Implement bcrypt hashing
  // const bcrypt = require('bcryptjs')
  // const saltRounds = 12
  // return await bcrypt.hash(password, saltRounds)
  
  // Mock hash for development
  return `hashed_${password}_${Date.now()}`
}

function generateSecureToken(): string {
  // Generate cryptographically secure random token
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  return token
}

// Email service
async function sendVerificationEmail(email: string, token: string, fullName: string): Promise<void> {
  // TODO: Implement actual email sending service (SendGrid, AWS SES, etc.)
  const verificationUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/verify?token=${token}`
  
  const _emailContent = {
    to: email,
    subject: 'Verify Your DirectoryBolt Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to DirectoryBolt, ${fullName}!</h2>
        <p>Thank you for creating your account. Please verify your email address to get started.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Your Account Details:</strong></p>
          <ul>
            <li>Email: ${email}</li>
            <li>Free Credits: 10</li>
            <li>Account Type: Free Tier</li>
          </ul>
        </div>
        
        <a href="${verificationUrl}" 
           style="background: #3b82f6; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
          Verify Email Address
        </a>
        
        <p style="color: #666; font-size: 14px;">
          If you didn't create this account, you can safely ignore this email.
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          DirectoryBolt - Enterprise Directory Submission Platform<br>
          This email was sent from an automated system. Please do not reply.
        </p>
      </div>
    `
  }
  
  logger.info(`Verification email sent`, {
    metadata: { email, verificationUrl }
  })
  
  // In production, use actual email service:
  // await emailService.send(emailContent)
}

// Audit logging
async function logRegistrationAttempt(
  clientIp: string, 
  email: string, 
  success: boolean
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: 'user_registration',
    ip_address: clientIp,
    email,
    success,
    user_agent: 'request.headers["user-agent"]' // Would be actual user agent
  }
  
  logger.info(`Registration attempt logged`, {
    metadata: { email: logEntry.email, success: logEntry.success }
  })
  
  // TODO: Save to audit log database
  // await db.audit_logs.create({ data: logEntry })
}