import type { NextApiRequest, NextApiResponse } from 'next'
import { withStaffAuth } from '../../../lib/middleware/staff-auth'
import { getSupabaseAdminClient } from '../../../lib/server/supabaseAdmin'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const supabase = getSupabaseAdminClient()
    
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' })
    }

    const { customer_id, job_id, limit = '100' } = req.query
    const lim = Math.min(parseInt(String(limit)) || 100, 500)

    // Try the correct table name first, fallback to test table if needed
    let query = supabase
      .from('autobolt_submission_logs')
      .select('id, customer_id, job_id, directory_name, action, timestamp, details, screenshot_url, success, processing_time_ms, error_message, created_at')
      .order('timestamp', { ascending: false })
      .limit(lim)

    if (customer_id) query = query.eq('customer_id', customer_id)
    if (job_id) query = query.eq('job_id', job_id)

    let { data, error } = await query

    // If the main table doesn't exist, try the test table
    if (error && error.message?.includes('relation "autobolt_submission_logs" does not exist')) {
      console.log('[staff:submission-logs] Main table not found, trying test table')
      query = supabase
        .from('autobolt_test_logs')
        .select('id, customer_id, job_id, directory_name, action, timestamp, details, screenshot_url, success, processing_time_ms, error_message, created_at')
        .order('timestamp', { ascending: false })
        .limit(lim)

      if (customer_id) query = query.eq('customer_id', customer_id)
      if (job_id) query = query.eq('job_id', job_id)

      const testResult = await query
      data = testResult.data
      error = testResult.error
    }

    if (error) {
      console.error('[staff:submission-logs] query error', error)
      // If neither table exists, return empty array instead of error
      if (error.message?.includes('does not exist')) {
        console.log('[staff:submission-logs] Tables do not exist, returning empty result')
        return res.status(200).json({ success: true, data: [] })
      }
      return res.status(500).json({ success: false, error: 'Failed to fetch logs' })
    }

    return res.status(200).json({ success: true, data })
  } catch (e: any) {
    console.error('[staff:submission-logs] unexpected error', e)
    return res.status(500).json({ success: false, error: e?.message || 'Internal error' })
  }
}

export default withStaffAuth(handler)