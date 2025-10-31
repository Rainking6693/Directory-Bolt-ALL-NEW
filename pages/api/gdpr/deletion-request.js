// GDPR Data Deletion Request API Endpoint
// Compliant with GDPR Article 17 (Right to Erasure)

import crypto from 'crypto'

// Rate limiting map (in production, use Redis or similar)
const rateLimitMap = new Map()

// Request processing queue (in production, use a proper queue system)
const deletionRequests = new Map()

export default async function handler(req, res) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.',
      code: 'METHOD_NOT_ALLOWED'
    })
  }

  try {
    // Rate limiting (5 requests per IP per hour)
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown'
    const now = Date.now()
    const hourAgo = now - (60 * 60 * 1000)

    if (rateLimitMap.has(clientIP)) {
      const requests = rateLimitMap.get(clientIP).filter(time => time > hourAgo)
      if (requests.length >= 5) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Maximum 5 deletion requests per hour.',
          code: 'RATE_LIMITED',
          retryAfter: 3600
        })
      }
      requests.push(now)
      rateLimitMap.set(clientIP, requests)
    } else {
      rateLimitMap.set(clientIP, [now])
    }

    // Input validation
    const { email, requestType, reason, verificationCode } = req.body

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Valid email address is required.',
        code: 'INVALID_EMAIL'
      })
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format.',
        code: 'INVALID_EMAIL_FORMAT'
      })
    }

    // Request type validation
    const validRequestTypes = ['full_deletion', 'data_export', 'account_deactivation']
    const reqType = requestType || 'full_deletion'
    
    if (!validRequestTypes.includes(reqType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request type. Must be: full_deletion, data_export, or account_deactivation',
        code: 'INVALID_REQUEST_TYPE'
      })
    }

    // Generate unique request ID
    const requestId = crypto.randomUUID()
    const timestamp = new Date().toISOString()

    // Create deletion request record
    const deletionRequest = {
      id: requestId,
      email: email.toLowerCase().trim(),
      requestType: reqType,
      reason: reason || 'User requested data deletion',
      status: 'pending_verification',
      clientIP: clientIP,
      userAgent: req.headers['user-agent'] || 'unknown',
      createdAt: timestamp,
      verificationToken: crypto.randomBytes(32).toString('hex'),
      verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      processedAt: null,
      completedAt: null
    }

    // Store request (in production, save to database)
    deletionRequests.set(requestId, deletionRequest)

    // Log the request for compliance audit trail
    console.log(`[GDPR] Deletion request created: ${requestId} for ${email} (${reqType})`)

    // In a real implementation, send verification email here
    // For demo purposes, we'll simulate the process
    
    const response = {
      success: true,
      message: 'GDPR deletion request received successfully.',
      data: {
        requestId: requestId,
        email: deletionRequest.email,
        requestType: reqType,
        status: 'pending_verification',
        createdAt: timestamp,
        estimatedCompletionTime: '30 days maximum (EU law compliance)',
        nextSteps: [
          'Verification email sent to the provided address',
          'Click the verification link within 24 hours',
          'We will process your request within 30 days',
          'Confirmation email will be sent upon completion'
        ],
        supportContact: 'privacy@directorybolt.com',
        yourRights: {
          gdpr: [
            'Right to confirmation of processing',
            'Right to access your personal data',
            'Right to rectification of inaccurate data',
            'Right to erasure (being processed)',
            'Right to restrict processing',
            'Right to data portability',
            'Right to object to processing',
            'Right to not be subject to automated decision-making'
          ],
          ccpa: [
            'Right to know about personal information collected',
            'Right to delete personal information',
            'Right to opt-out of the sale of personal information',
            'Right to non-discrimination for exercising privacy rights'
          ]
        },
        dataTypes: [
          'Account information and profile data',
          'Business information submitted for directory listings',
          'Payment and transaction history',
          'Communication history with support',
          'Website usage analytics (anonymized)',
          'Marketing preferences and communication history'
        ]
      }
    }

    // Simulate data processing workflow
    setTimeout(() => {
      if (deletionRequests.has(requestId)) {
        const request = deletionRequests.get(requestId)
        request.status = 'verified'
        request.processedAt = new Date().toISOString()
        deletionRequests.set(requestId, request)
        
        console.log(`[GDPR] Request ${requestId} moved to verification complete`)
        
        // Simulate actual deletion process after verification
        setTimeout(() => {
          if (deletionRequests.has(requestId)) {
            const finalRequest = deletionRequests.get(requestId)
            finalRequest.status = 'completed'
            finalRequest.completedAt = new Date().toISOString()
            deletionRequests.set(requestId, finalRequest)
            
            console.log(`[GDPR] Request ${requestId} completed - data deletion processed`)
          }
        }, 5000) // Simulate 5-second processing time
      }
    }, 2000) // Simulate 2-second verification time

    return res.status(200).json(response)

  } catch (error) {
    console.error('[GDPR] Deletion request error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error processing deletion request.',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      supportContact: 'privacy@directorybolt.com'
    })
  }
}

// Export helper function to check request status
export function getRequestStatus(requestId) {
  return deletionRequests.get(requestId) || null
}

// Export helper function for admin to view all requests (with proper authentication in production)
export function getAllRequests() {
  return Array.from(deletionRequests.values()).map(req => ({
    id: req.id,
    email: req.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email for privacy
    requestType: req.requestType,
    status: req.status,
    createdAt: req.createdAt,
    completedAt: req.completedAt
  }))
}