// Legacy endpoint for Railway worker compatibility
// This endpoint redirects to the correct autobolt endpoint

import type { NextApiRequest, NextApiResponse } from 'next'
import { getNextPendingJob } from '../../../lib/server/autoboltJobs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    // Use the existing getNextPendingJob function
    const result = await getNextPendingJob()
    
    if (!result) {
      return res.status(200).json({ 
        success: true, 
        data: null, 
        message: 'No jobs currently in queue' 
      })
    }

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Job retrieved successfully'
    })
  } catch (error) {
    console.error('[jobs/next] Error:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to get next job' 
    })
  }
}