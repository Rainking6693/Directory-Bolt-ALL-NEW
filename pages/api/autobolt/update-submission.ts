// AutoBolt Extension API - Update Directory Submission Status
// Handles submission status updates from the Chrome extension

import { NextApiRequest, NextApiResponse } from 'next'
import { AutoBoltIntegrationService } from '../../../lib/services/autobolt-integration-service'
import { corsMiddleware } from '../../../lib/utils/cors'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply CORS headers for Chrome extension support
  if (!corsMiddleware(req, res, { allowCredentials: true })) {
    return; // OPTIONS request handled
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { submission_id, status, metadata } = req.body

    if (!submission_id || !status) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Submission ID and status are required'
      })
    }

    const validStatuses = ['pending', 'submitted', 'approved', 'rejected', 'processing']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      })
    }

    console.log(`🔄 AutoBolt updating submission: ${submission_id} to ${status}`)

    // Update submission status
    const success = await AutoBoltIntegrationService.updateSubmissionStatus(
      submission_id,
      status,
      metadata || {}
    )

    if (!success) {
      return res.status(500).json({
        error: 'Update Failed',
        message: 'Failed to update submission status'
      })
    }

    // Log analytics event
    await AutoBoltIntegrationService.logEvent(
      metadata?.customer_id || 'unknown',
      'submission_update',
      'directory_submission_status_changed',
      {
        submission_id,
        status,
        metadata
      }
    )

    console.log(`✅ AutoBolt submission updated: ${submission_id} -> ${status}`)

    res.status(200).json({
      success: true,
      message: 'Submission status updated successfully',
      data: {
        submission_id,
        status,
        updated_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ AutoBolt submission update error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update submission status'
    })
  }
}
