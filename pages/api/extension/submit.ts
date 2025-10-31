// @ts-nocheck
/**
 * Extension Submission API Endpoint
 * POST /api/extension/submit - Submit from Chrome extension
 * Phase 2.2 Implementation
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { ExtensionQueueSubmission, ExtensionSubmissionResponse } from '../../../lib/types/queue.types'
import { v4 as uuidv4 } from 'uuid'

// Rate limiting for extension submissions
import rateLimit from 'express-rate-limit'

const extensionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each API key to 10 submissions per hour
  keyGenerator: (req) => (req.headers['x-api-key'] as string) || req.ip || 'default',
  message: {
    success: false,
    error: 'Extension submission rate limit exceeded',
    code: 'RATE_LIMIT_EXCEEDED'
  }
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply rate limiting
  await new Promise((resolve, reject) => {
    extensionLimiter(req as any, res as any, (result: any) => {
      if (result instanceof Error) {
        return reject(result)
      }
      return resolve(result)
    })
  })

  try {
    switch (req.method) {
      case 'POST':
        return await handleExtensionSubmission(req, res)
      default:
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED'
        })
    }
  } catch (error) {
    console.error('Extension submission API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleExtensionSubmission(req: NextApiRequest, res: NextApiResponse<ExtensionSubmissionResponse>) {
  try {
    const submission: ExtensionQueueSubmission = {
      businessData: req.body.businessData,
      packageType: req.body.packageType,
      apiKey: req.headers['x-api-key'] as string || req.body.apiKey,
      customerEmail: req.body.customerEmail,
      priority: req.body.priority || 3
    }

    // Validate API key
    if (!submission.apiKey) {
      return res.status(401).json({
        success: false,
        data: {} as any,
        message: 'API key is required. Provide it in X-API-Key header or request body.'
      })
    }

    // Validate API key format (simplified validation)
    if (!submission.apiKey.startsWith('ak_') || submission.apiKey.length < 20) {
      return res.status(401).json({
        success: false,
        data: {} as any,
        message: 'Invalid API key format'
      })
    }

    // Validate required business data
    if (!submission.businessData) {
      return res.status(400).json({
        success: false,
        data: {} as any,
        message: 'Business data is required'
      })
    }

    const requiredFields = ['businessName', 'businessUrl', 'businessEmail', 'businessCategory']
    const missingFields = requiredFields.filter(field => !submission.businessData[field as keyof typeof submission.businessData])

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        data: {} as any,
        message: `Missing required business fields: ${missingFields.join(', ')}`
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(submission.customerEmail)) {
      return res.status(400).json({
        success: false,
        data: {} as any,
        message: 'Invalid customer email format'
      })
    }

    if (!emailRegex.test(submission.businessData.businessEmail)) {
      return res.status(400).json({
        success: false,
        data: {} as any,
        message: 'Invalid business email format'
      })
    }

    // Validate package type
    const validPackageTypes = ['starter', 'growth', 'pro', 'subscription']
    if (!validPackageTypes.includes(submission.packageType.toLowerCase())) {
      return res.status(400).json({
        success: false,
        data: {} as any,
        message: `Invalid package type. Must be one of: ${validPackageTypes.join(', ')}`
      })
    }

    // Validate URL format
    try {
      new URL(submission.businessData.businessUrl)
    } catch {
      return res.status(400).json({
        success: false,
        data: {} as any,
        message: 'Invalid business URL format'
      })
    }

    // Generate customer ID and tracking ID
    const customerId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const trackingId = uuidv4()

    // Create business submission record for queue manager
    const businessSubmissionRecord = {
      recordId: `rec_${customerId}`,
      customerId,
      businessName: submission.businessData.businessName,
      businessDescription: submission.businessData.businessDescription || '',
      businessUrl: submission.businessData.businessUrl,
      businessEmail: submission.businessData.businessEmail,
      businessPhone: submission.businessData.businessPhone,
      businessAddress: submission.businessData.businessAddress,
      businessCategory: submission.businessData.businessCategory,
      packageType: submission.packageType.toLowerCase() as 'starter' | 'growth' | 'pro' | 'subscription',
      submissionStatus: 'pending' as const,
      purchaseDate: new Date().toISOString(),
      processingNotes: `Submitted via Chrome Extension with API key ${submission.apiKey.slice(0, 8)}...`
    }

    // Add to queue manager
    try {
      const { queueManager } = await import('../../../lib/services/queue-manager')
      const manager = queueManager()

      const { createOrUpdateCustomer } = await import('../../../lib/services/customer-service')

      await createOrUpdateCustomer({
        customerId,
        firstName: submission.businessData.firstName,
        lastName: submission.businessData.lastName,
        businessName: submission.businessData.businessName,
        email: submission.businessData.email,
        phone: submission.businessData.phone,
        city: submission.businessData.city,
        state: submission.businessData.state,
        packageType: submission.packageType.toLowerCase(),
        submissionStatus: 'pending',
        website: submission.businessData.businessWebsite,
        description: submission.businessData.businessDescription,
        status: 'pending',
        directoriesSubmitted: 0,
        failedDirectories: 0,
        metadata: {
          source: 'extension-submit',
          categories: submission.categories,
          paymentData: submission.paymentData,
          businessCategory: submission.businessData.businessCategory
        }
      })

      // Get current queue position
      const pendingQueue = await manager.getPendingQueue()
      const queuePosition = pendingQueue.length + 1

      // Calculate estimated wait time based on current processing
      const stats = await manager.getQueueStats()
      const estimatedWaitTime = queuePosition * stats.averageProcessingTime * 60 // Convert to seconds

      // Store tracking information (in production, this would be in Redis or database)
      const trackingInfo = {
        customerId,
        trackingId,
        apiKey: submission.apiKey,
        queuePosition,
        estimatedWaitTime,
        submittedAt: new Date().toISOString(),
        status: 'pending'
      }

      // Simple in-memory storage for demo (use Redis in production)
      if (!(global as any).extensionTracking) {
        (global as any).extensionTracking = new Map()
      }
      ;(global as any).extensionTracking.set(trackingId, trackingInfo)

      const response: ExtensionSubmissionResponse = {
        success: true,
        data: {
          customerId,
          queuePosition,
          estimatedWaitTime,
          trackingId
        },
        message: `Submission successful. Your business has been added to the processing queue at position ${queuePosition}.`
      }

      return res.status(201).json(response)

    } catch (error) {
      console.error('Failed to add submission to queue:', error)
      return res.status(500).json({
        success: false,
        data: {} as any,
        message: 'Failed to add submission to processing queue'
      })
    }

  } catch (error) {
    console.error('Extension submission processing error:', error)
    return res.status(500).json({
      success: false,
      data: {} as any,
      message: 'Failed to process extension submission'
    })
  }
}