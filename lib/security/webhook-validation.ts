// 🔒 WEBHOOK SIGNATURE VALIDATION
// Secure validation of Stripe webhook signatures

import crypto from 'crypto'
import { NextApiRequest } from 'next'

export interface WebhookValidationResult {
  isValid: boolean
  error?: string
  event?: any
}

/**
 * Validates Stripe webhook signature to ensure authenticity
 * Prevents webhook spoofing and unauthorized access
 */
export function validateStripeWebhook(
  payload: string | Buffer,
  signature: string,
  secret: string
): WebhookValidationResult {
  try {
    // Ensure we have all required parameters
    if (!payload || !signature || !secret) {
      return {
        isValid: false,
        error: 'Missing required parameters for webhook validation'
      }
    }

    // Extract timestamp and signatures from header
    const elements = signature.split(',')
    let timestamp: string | null = null
    const signatures: string[] = []

    for (const element of elements) {
      const [key, value] = element.split('=')
      if (key === 't') {
        timestamp = value
      } else if (key === 'v1') {
        signatures.push(value)
      }
    }

    if (!timestamp || signatures.length === 0) {
      return {
        isValid: false,
        error: 'Invalid signature format'
      }
    }

    // Check timestamp to prevent replay attacks (5 minutes tolerance)
    const timestampNumber = parseInt(timestamp, 10)
    const currentTime = Math.floor(Date.now() / 1000)
    const tolerance = 300 // 5 minutes

    if (Math.abs(currentTime - timestampNumber) > tolerance) {
      return {
        isValid: false,
        error: 'Webhook timestamp too old - possible replay attack'
      }
    }

    // Create expected signature
    const payloadString = typeof payload === 'string' ? payload : payload.toString('utf8')
    const signedPayload = `${timestamp}.${payloadString}`
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex')

    // Verify signature using constant-time comparison
    let isSignatureValid = false
    for (const signature of signatures) {
      if (crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(signature, 'hex')
      )) {
        isSignatureValid = true
        break
      }
    }

    if (!isSignatureValid) {
      return {
        isValid: false,
        error: 'Invalid webhook signature'
      }
    }

    // Parse the event if validation successful
    let event
    try {
      event = JSON.parse(payloadString)
    } catch (parseError) {
      return {
        isValid: false,
        error: 'Invalid JSON payload'
      }
    }

    return {
      isValid: true,
      event
    }

  } catch (error) {
    return {
      isValid: false,
      error: `Webhook validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Middleware to validate webhook signatures in Next.js API routes
 */
export async function validateWebhookMiddleware(
  req: NextApiRequest,
  webhookSecret: string
): Promise<WebhookValidationResult> {
  // Get raw body for signature validation
  const signature = req.headers['stripe-signature'] as string
  
  if (!signature) {
    return {
      isValid: false,
      error: 'Missing Stripe signature header'
    }
  }

  // Get raw body (should be configured in API route)
  const rawBody = (req as any).rawBody || req.body
  
  if (!rawBody) {
    return {
      isValid: false,
      error: 'Missing request body for signature validation'
    }
  }

  return validateStripeWebhook(rawBody, signature, webhookSecret)
}

/**
 * Security logging for webhook events
 */
export function logWebhookEvent(
  event: any,
  isValid: boolean,
  ip?: string,
  userAgent?: string
) {
  const logData = {
    timestamp: new Date().toISOString(),
    eventType: event?.type || 'unknown',
    eventId: event?.id || 'unknown',
    isValid,
    ip: ip || 'unknown',
    userAgent: userAgent || 'unknown',
    severity: isValid ? 'info' : 'warning'
  }

  if (isValid) {
    console.log('✅ Valid webhook received:', logData)
  } else {
    console.warn('⚠️ Invalid webhook attempt:', logData)
  }

  // In production, send to security monitoring service
  if (process.env.NODE_ENV === 'production' && process.env.SECURITY_WEBHOOK_URL) {
    fetch(process.env.SECURITY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'webhook_validation',
        ...logData
      })
    }).catch(error => {
      console.error('Failed to send security log:', error)
    })
  }
}

/**
 * Rate limiting for webhook endpoints
 */
export class WebhookRateLimiter {
  private attempts: Map<string, number[]> = new Map()
  private readonly maxAttempts: number
  private readonly windowMs: number

  constructor(maxAttempts = 100, windowMs = 60000) { // 100 requests per minute
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
  }

  isAllowed(ip: string): boolean {
    const now = Date.now()
    const attempts = this.attempts.get(ip) || []
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < this.windowMs)
    
    if (validAttempts.length >= this.maxAttempts) {
      return false
    }

    // Add current attempt
    validAttempts.push(now)
    this.attempts.set(ip, validAttempts)
    
    return true
  }

  reset(ip: string): void {
    this.attempts.delete(ip)
  }
}

// Global rate limiter instance
export const webhookRateLimiter = new WebhookRateLimiter()

/**
 * Complete webhook security validation
 */
export async function secureWebhookHandler(
  req: NextApiRequest,
  webhookSecret: string,
  allowedEventTypes: string[] = []
): Promise<{
  isValid: boolean
  event?: any
  error?: string
  shouldBlock?: boolean
}> {
  const ip = req.headers['x-forwarded-for'] as string || 
            req.headers['x-real-ip'] as string || 
            'unknown'
  
  const userAgent = req.headers['user-agent'] || 'unknown'

  // Rate limiting check
  if (!webhookRateLimiter.isAllowed(ip)) {
    logWebhookEvent(null, false, ip, userAgent)
    return {
      isValid: false,
      error: 'Rate limit exceeded',
      shouldBlock: true
    }
  }

  // Validate webhook signature
  const validation = await validateWebhookMiddleware(req, webhookSecret)
  
  if (!validation.isValid) {
    logWebhookEvent(null, false, ip, userAgent)
    return validation
  }

  // Check allowed event types if specified
  if (allowedEventTypes.length > 0 && validation.event) {
    if (!allowedEventTypes.includes(validation.event.type)) {
      logWebhookEvent(validation.event, false, ip, userAgent)
      return {
        isValid: false,
        error: `Event type '${validation.event.type}' not allowed`
      }
    }
  }

  // Log successful validation
  logWebhookEvent(validation.event, true, ip, userAgent)

  return {
    isValid: true,
    event: validation.event
  }
}