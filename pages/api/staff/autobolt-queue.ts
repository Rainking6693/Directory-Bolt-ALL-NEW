import { NextApiRequest, NextApiResponse } from 'next'
import { getQueueSnapshot } from '../../../lib/server/autoboltJobs'
import { withStaffAuth } from '../../../lib/middleware/staff-auth'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const snapshot = await getQueueSnapshot()

    return res.status(200).json({
      success: true,
      data: {
        queueItems: snapshot.jobs,
        stats: {
          total_queued: snapshot.stats.pendingJobs,
          total_processing: snapshot.stats.inProgressJobs,
          total_completed: snapshot.stats.completedJobs,
          total_failed: snapshot.stats.failedJobs,
          total_jobs: snapshot.stats.totalJobs,
          completed_directories: snapshot.stats.completedDirectories,
          failed_directories: snapshot.stats.failedDirectories,
          success_rate: snapshot.stats.successRate
        }
      },
      retrieved_at: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('AutoBolt queue snapshot error:', error)

    // If database tables don't exist, return empty snapshot instead of error
    if (error instanceof Error && (error.message?.includes('relation "autobolt_processing_queue"') ||
                                   error.message?.includes('relation "legacy_submissions_count"') ||
                                   error.message?.includes('relation "job_results_count"'))) {
      console.log('Database tables do not exist, returning empty snapshot')
      return res.status(200).json({
        success: true,
        data: {
          queueItems: [],
          stats: {
            total_queued: 0,
            total_processing: 0,
            total_completed: 0,
            total_failed: 0,
            total_jobs: 0,
            completed_directories: 0,
            failed_directories: 0,
            success_rate: 0
          }
        },
        retrieved_at: new Date().toISOString(),
        note: 'Database tables not initialized - run database_schema.sql'
      })
    }

    return res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve AutoBolt queue data',
      details: error.message || 'Unknown error'
    })
  }
}

export default withStaffAuth(handler)