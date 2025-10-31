import type { NextApiRequest, NextApiResponse } from 'next'
import { withStaffAuth } from '../../../../lib/middleware/staff-auth'
import { createClient } from '@supabase/supabase-js'

interface ResetJobBody {
  job_id: string
  customer_id: string
}

interface ResetJobResponse {
  success: boolean
  data?: {
    job_id: string
    customer_id: string
    status: string
  }
  error?: string
}

async function handler(req: NextApiRequest, res: NextApiResponse<ResetJobResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ success: false, error: 'Supabase not configured' })
  }

  try {
    const body = (req.body || {}) as ResetJobBody
    if (!body.job_id || !body.customer_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'job_id and customer_id are required' 
      })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const now = new Date().toISOString()

    // Reset job status to pending and clear completion data
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .update({
        status: 'pending',
        completed_at: null,
        error_message: null,
        updated_at: now,
        metadata: {
          reset_at: now,
          reset_reason: 'manual_reset_by_staff'
        }
      })
      .eq('id', body.job_id)
      .eq('customer_id', body.customer_id)
      .select('id, customer_id, status')
      .single()

    if (jobError) {
      console.error('❌ Failed to reset job:', jobError)
      return res.status(500).json({ 
        success: false, 
        error: `Failed to reset job: ${jobError.message}` 
      })
    }

    if (!job) {
      return res.status(404).json({ 
        success: false, 
        error: 'Job not found' 
      })
    }

    // Also reset any job results for this job
    const { error: resultsError } = await supabase
      .from('job_results')
      .delete()
      .eq('job_id', body.job_id)

    if (resultsError) {
      console.warn('⚠️ Failed to clear job results:', resultsError)
      // Don't fail the request, just log the warning
    }

    console.log('✅ Job reset successfully:', body.job_id, 'for customer:', body.customer_id)

    return res.status(200).json({
      success: true,
      data: {
        job_id: job.id,
        customer_id: job.customer_id,
        status: job.status
      }
    })
  } catch (e) {
    console.error('[staff.jobs.reset] error', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export default withStaffAuth(handler)
