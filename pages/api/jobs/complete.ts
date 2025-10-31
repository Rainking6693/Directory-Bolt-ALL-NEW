// Legacy endpoint for Railway worker compatibility
// This endpoint redirects to the correct autobolt endpoint

import type { NextApiRequest, NextApiResponse } from 'next'
import { completeJob } from '../../../lib/server/autoboltJobs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { jobId, finalStatus, summary } = req.body

    if (!jobId) {
      return res.status(400).json({ 
        success: false, 
        error: 'jobId is required' 
      })
    }

    // Use the existing completeJob function
    const result = await completeJob({
      jobId,
      finalStatus: finalStatus || 'completed',
      summary
    })

    return res.status(200).json({
      success: true,
      data: result,
      message: `Job ${jobId} completed successfully.`
    })
  } catch (error) {
    console.error('[jobs/complete] Error:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to complete job' 
    })
  }
}