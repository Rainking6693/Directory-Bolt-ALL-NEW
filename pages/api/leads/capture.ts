// @ts-nocheck
// 🔒 LEAD CAPTURE API - Handles "Get My Free Analysis" form submissions
// POST /api/leads/capture - Capture lead data from homepage forms

import type { NextApiRequest, NextApiResponse } from 'next'
import { handleApiError, Errors } from '../../../lib/utils/errors'
import { logger } from '../../../lib/utils/logger'
import { rateLimit } from '../../../lib/utils/rate-limit'
import { sanitizeInput, sanitizeEmail, sanitizeUrl } from '../../../lib/utils/sanitizer'

interface LeadCaptureRequest {
  firstName: string
  lastName: string
  email: string
  company: string
  website: string
  phone?: string
  businessType?: string
  currentChallenge?: string
  monthlyRevenue?: string
  source?: string
  context?: string
}

interface LeadCaptureResponse {
  success: true
  data: {
    leadId: string
    message: string
    nextSteps: string[]
  }
  requestId: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LeadCaptureResponse | any>
) {
  const requestId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      return res.status(405).json(handleApiError(
        new Error('Method not allowed'),
        requestId
      ))
    }

    // Apply rate limiting to prevent abuse
    const rateLimitResult = await rateLimit(req, res, {
      requests: 5,
      window: 15 * 60 * 1000, // 15 minutes
      keyGenerator: (req) => `lead_capture_${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`
    })
    
    if (!rateLimitResult.success) {
      return res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests. Please try again in 15 minutes.',
          statusCode: 429
        },
        requestId
      })
    }

    // Sanitize all input data to prevent XSS and injection attacks
    const leadData: LeadCaptureRequest = {
      firstName: sanitizeInput(req.body.firstName),
      lastName: sanitizeInput(req.body.lastName),
      email: sanitizeEmail(req.body.email),
      company: sanitizeInput(req.body.company),
      website: sanitizeUrl(req.body.website),
      phone: req.body.phone ? sanitizeInput(req.body.phone) : undefined,
      businessType: req.body.businessType ? sanitizeInput(req.body.businessType) : undefined,
      currentChallenge: req.body.currentChallenge ? sanitizeInput(req.body.currentChallenge) : undefined,
      monthlyRevenue: req.body.monthlyRevenue ? sanitizeInput(req.body.monthlyRevenue) : undefined,
      source: req.body.source ? sanitizeInput(req.body.source) : undefined,
      context: req.body.context ? sanitizeInput(req.body.context) : undefined
    }

    // Validate required fields
    const validationErrors = validateLeadData(leadData)
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: validationErrors,
          statusCode: 400
        },
        requestId
      })
    }

    // Generate unique lead ID
    const leadId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Save lead data (for now, just log it - TODO: integrate with CRM/database)
    await saveLead({
      ...leadData,
      leadId,
      submittedAt: new Date(),
      requestId
    })

    // Send confirmation email (TODO: integrate with email service)
    await sendConfirmationEmail(leadData)

    // Log successful lead capture (without PII for security)
    logger.info('Lead captured successfully', {
      requestId,
      metadata: {
        leadId,
        domain: leadData.email.split('@')[1], // Only log domain, not full email
        hasCompany: !!leadData.company,
        source: leadData.source,
        hasContext: !!leadData.context,
        timestamp: new Date().toISOString()
      }
    })

    const response: LeadCaptureResponse = {
      success: true,
      data: {
        leadId,
        message: 'Your analysis request has been submitted successfully!',
        nextSteps: [
          'Check your email for confirmation and next steps',
          'Our team will analyze your business within 24 hours',
          'You\'ll receive a personalized directory submission strategy',
          'Access our Directory Selection Tool in your inbox'
        ]
      },
      requestId
    }

    // Set response headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Content-Type', 'application/json')

    res.status(201).json(response)

  } catch (error) {
    logger.error('Lead capture error', {
      requestId,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        hasBody: !!req.body,
        method: req.method,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
        // NOTE: No req.body logged to prevent PII exposure
      }
    })

    const errorResponse = handleApiError(error as Error, requestId)
    return res.status(errorResponse.error.statusCode).json(errorResponse)
  }
}

function validateLeadData(data: LeadCaptureRequest): string[] {
  const errors: string[] = []

  if (!data.firstName || data.firstName.trim().length === 0) {
    errors.push('First name is required')
  }

  if (!data.lastName || data.lastName.trim().length === 0) {
    errors.push('Last name is required')
  }

  if (!data.email || data.email.trim().length === 0) {
    errors.push('Email is required')
  } else if (!isValidEmail(data.email)) {
    errors.push('Please enter a valid email address')
  }

  if (!data.company || data.company.trim().length === 0) {
    errors.push('Company name is required')
  }

  if (!data.website || data.website.trim().length === 0) {
    errors.push('Website is required')
  } else if (!isValidWebsite(data.website)) {
    errors.push('Please enter a valid website URL')
  }

  return errors
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

function isValidWebsite(website: string): boolean {
  if (!website) return false
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    new URL(url)
    return true
  } catch {
    return false
  }
}

async function saveLead(leadData: any): Promise<void> {
  // TODO: Integrate with actual database/CRM
  // For now, just log the lead data
  logger.info('Lead data saved', {
    metadata: {
      leadId: leadData.leadId,
      email: leadData.email,
      company: leadData.company,
      website: leadData.website,
      businessType: leadData.businessType,
      source: leadData.source,
      submittedAt: leadData.submittedAt.toISOString()
    }
  })

  // In production, this would be:
  // await db.leads.create({
  //   data: {
  //     id: leadData.leadId,
  //     first_name: leadData.firstName,
  //     last_name: leadData.lastName,
  //     email: leadData.email,
  //     company: leadData.company,
  //     website: leadData.website,
  //     phone: leadData.phone,
  //     business_type: leadData.businessType,
  //     current_challenge: leadData.currentChallenge,
  //     monthly_revenue: leadData.monthlyRevenue,
  //     source: leadData.source,
  //     context: leadData.context,
  //     submitted_at: leadData.submittedAt,
  //     request_id: leadData.requestId
  //   }
  // })
}

async function sendConfirmationEmail(leadData: LeadCaptureRequest): Promise<void> {
  // TODO: Integrate with email service (SendGrid, Mailgun, etc.)
  logger.info('Confirmation email sent', {
    metadata: {
      email: leadData.email,
      name: `${leadData.firstName} ${leadData.lastName}`,
      company: leadData.company
    }
  })

  // In production, this would send an actual email:
  // await emailService.send({
  //   to: leadData.email,
  //   from: 'noreply@directorybolt.com',
  //   subject: 'Your Free Directory Analysis Request - DirectoryBolt',
  //   template: 'lead-confirmation',
  //   data: {
  //     firstName: leadData.firstName,
  //     company: leadData.company,
  //     website: leadData.website
  //   }
  // })
}