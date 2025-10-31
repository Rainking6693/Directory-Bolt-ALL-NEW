// AutoBolt Extension API - Get Processing Queue
// Provides the processing queue to the Chrome extension

import { NextApiRequest, NextApiResponse } from 'next'
import { AutoBoltIntegrationService } from '../../../lib/services/autobolt-integration-service'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('📋 AutoBolt requesting processing queue')

    // Get processing queue
    const queue = await AutoBoltIntegrationService.getProcessingQueue()

    console.log(`✅ AutoBolt processing queue retrieved: ${queue.length} customers`)

    res.status(200).json({
      success: true,
      data: {
        queue,
        total_customers: queue.length,
        retrieved_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ AutoBolt processing queue error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve processing queue'
    })
  }
}
