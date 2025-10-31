import type { NextApiRequest, NextApiResponse } from 'next'
import { withStaffAuth } from '../../../lib/middleware/staff-auth'
import { createClient } from '@supabase/supabase-js'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ success: false, error: 'Supabase not configured' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  try {
    // Find latest entries that indicate 2FA/manual required in the last 48h
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    // Primary source: autobolt_submission_logs (production table)
    let rows: any[] = []
    let primaryOk = false
    try {
      const primary = await supabase
        .from('autobolt_submission_logs')
        .select('job_id, customer_id, directory_name, timestamp, details, error_message')
        .gte('timestamp', since)
        .order('timestamp', { ascending: false })

      if (!primary.error && Array.isArray(primary.data)) {
        rows = primary.data
        primaryOk = true
      }
    } catch {}

    // Fallback: autobolt_test_logs if primary not available
    if (!primaryOk) {
      // First check if the table exists to avoid noisy errors
      const { error: tableCheckError } = await supabase
        .from('autobolt_test_logs')
        .select('id')
        .limit(1)

      if (tableCheckError && tableCheckError.message?.includes('relation "autobolt_test_logs" does not exist')) {
        console.log('[staff:2fa-queue] No submission logs tables exist, returning empty result')
        return res.status(200).json({ success: true, data: [] })
      }

      const fallback = await supabase
        .from('autobolt_test_logs')
        .select('*')
        .gte('timestamp', since)
        .order('timestamp', { ascending: false })

      if (fallback.error) {
        console.error('[staff:2fa-queue] fallback query error', fallback.error)
        return res.status(500).json({ success: false, error: 'Failed to fetch 2FA queue' })
      }
      rows = fallback.data || []
    }

    // Node-side filter: indicators of manual or 2FA
    const filtered = rows.filter((r) => {
      const detailsStr = typeof r?.details === 'string' ? r.details : JSON.stringify(r?.details || {})
      const errorStr = String(r?.error_message || '')
      const hay = `${detailsStr} ${errorStr}`.toLowerCase()
      return hay.includes('manual_required') || hay.includes('manual') || hay.includes('2fa') || hay.includes('verification')
    })

    // Deduplicate by job_id + directory_name, keep the latest timestamp
    const byKey = new Map<string, any>()
    for (const row of filtered) {
      const k = `${row.job_id}::${row.directory_name}`
      const prev = byKey.get(k)
      if (!prev || new Date(row.timestamp).getTime() > new Date(prev.timestamp).getTime()) {
        byKey.set(k, row)
      }
    }

    const data = Array.from(byKey.values()).map((row: any) => ({
      job_id: row.job_id ?? row.test_job_id ?? row.queue_id ?? 'unknown',
      customer_id: row.customer_id ?? row.test_customer_id ?? row.customer ?? 'unknown',
      directory_name: row.directory_name ?? row.test_name ?? row.directory ?? 'Unknown Directory',
      last_seen: row.timestamp ?? row.created_at ?? new Date().toISOString()
    }))

    return res.status(200).json({ success: true, data })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Internal error' })
  }
}

export default withStaffAuth(handler)