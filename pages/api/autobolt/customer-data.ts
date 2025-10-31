// AutoBolt Extension API - Get Customer Data
// Provides customer data to the Chrome extension for directory submission

import { NextApiRequest, NextApiResponse } from 'next'
import { AutoBoltIntegrationService } from '../../../lib/services/autobolt-integration-service'
import { corsMiddleware } from '../../../lib/utils/cors'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply CORS headers for Chrome extension support
  if (!corsMiddleware(req, res, { allowCredentials: true })) {
    return; // OPTIONS request handled
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { customer_id } = req.query

    if (!customer_id || typeof customer_id !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Customer ID is required'
      })
    }

    console.log('🔍 AutoBolt requesting customer data:', customer_id)

    // Get customer data
    const customerData = await AutoBoltIntegrationService.getCustomerData(customer_id)

    if (!customerData) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Customer not found or inactive'
      })
    }

    // Get pending directory submissions
    const pendingSubmissions = await AutoBoltIntegrationService.getPendingSubmissions(customer_id)

    console.log(`✅ AutoBolt customer data retrieved: ${customer_id}`)

    res.status(200).json({
      success: true,
      data: {
        customer: customerData,
        pending_submissions: pendingSubmissions,
        total_pending: pendingSubmissions.length
      }
    })

  } catch (error) {
    console.error('❌ AutoBolt customer data error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve customer data'
    })
  }
}
