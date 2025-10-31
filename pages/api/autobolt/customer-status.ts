// @ts-nocheck
/**
 * AutoBolt Customer Status API
 * 
 * GET /api/autobolt/customer-status?customerId=xxx
 * Returns detailed status for a specific customer
 * 
 * POST /api/autobolt/customer-status
 * Updates customer status (for internal use)
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { findByCustomerId, updateSubmissionStatus } from '../../../lib/services/customer-service'
import { rateLimit } from '../../../lib/utils/rate-limit'

// Rate limiting for customer status API
const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 200, // Limit each IP to 200 requests per interval
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!['GET', 'POST'].includes(req.method || '')) {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET or POST.'
    })
  }

  try {
    // Apply rate limiting
    await limiter.check(res, 30, 'customer-status') // 30 requests per minute per IP
  } catch {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please try again later.'
    })
  }

  if (req.method === 'GET') {
    const { customerId } = req.query

    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'customerId query parameter is required'
      })
    }

    try {
      const customer = await findByCustomerId(customerId)
      
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found',
          message: `No customer found with ID: ${customerId}`
        })
      }

      // Calculate processing progress
      const directoryLimit = getDirectoryLimit(customer.packageType || '')
      const progressPercentage = customer.submissionStatus === 'completed' 
        ? 100 
        : customer.submissionStatus === 'in-progress' 
        ? Math.floor(((customer.directoriesSubmitted ?? 0) / directoryLimit) * 100)
        : 0

      return res.status(200).json({
        success: true,
        data: {
          customerId: customer.customerId,
          businessName: customer.businessName,
          email: customer.email,
          packageType: customer.packageType,
          submissionStatus: customer.submissionStatus,
          directoryLimit,
          directoriesSubmitted: customer.directoriesSubmitted ?? 0,
          failedDirectories: customer.failedDirectories ?? 0,
          progressPercentage,
          purchaseDate: customer.purchaseDate,
          website: customer.website,
          recordId: customer.recordId,
          lastUpdated: new Date().toISOString()
        }
      })

    } catch (error) {
      console.error('Customer status lookup error:', error)
      
      return res.status(500).json({
        success: false,
        error: 'Failed to get customer status',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : 'Internal server error'
      })
    }
  }

  if (req.method === 'POST') {
    const { customerId, status, directoriesSubmitted, failedDirectories } = req.body

    if (!customerId || !status) {
      return res.status(400).json({
        success: false,
        error: 'customerId and status are required'
      })
    }

    if (!['pending', 'in-progress', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: pending, in-progress, completed, or failed'
      })
    }

    try {
      const updatedCustomer = await updateSubmissionStatus(
        customerId,
        status,
        directoriesSubmitted,
        failedDirectories
      )

      return res.status(200).json({
        success: true,
        message: `Customer ${customerId} status updated to ${status}`,
        data: {
          customerId: updatedCustomer.customerId,
          submissionStatus: updatedCustomer.submissionStatus,
          directoriesSubmitted: updatedCustomer.directoriesSubmitted,
          failedDirectories: updatedCustomer.failedDirectories,
          updatedAt: new Date().toISOString()
        }
      })

    } catch (error) {
      console.error('Customer status update error:', error)
      
      return res.status(500).json({
        success: false,
        error: 'Failed to update customer status',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : 'Internal server error'
      })
    }
  }
}

function getDirectoryLimit(packageType: string): number {
  const limits = {
    'starter': 50,
    'growth': 100,
    'pro': 200,
    'subscription': 0
  }
  return limits[packageType?.toLowerCase() as keyof typeof limits] || 50
}