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
    // First check if directories table exists
    const { error: tableCheckError } = await supabase
      .from('directories')
      .select('id')
      .limit(1)

    if (tableCheckError && tableCheckError.message?.includes('relation "directories" does not exist')) {
      console.log('[staff:directory-settings] Directories table does not exist, returning empty data')
      return res.status(200).json({ success: true, data: [] })
    }

    // Fetch directory settings, tolerating missing optional pacing columns
    let directories: any[] | null = null
    let error: any = null
    {
      const r = await supabase
        .from('directories')
        .select('id, name, category, active, pacing_min_ms, pacing_max_ms, max_retries')
        .order('name')
      directories = r.data
      error = r.error
    }

    if (error && String(error.message || '').toLowerCase().includes('column') && String(error.message || '').includes('does not exist')) {
      console.warn('[staff:directory-settings] Optional columns missing, retrying with minimal selection')
      const r2 = await supabase
        .from('directories')
        .select('id, name, category, active')
        .order('name')
      directories = r2.data
      error = r2.error
    }

    if (error) {
      console.error('[staff:directory-settings] directories query error', error)
      return res.status(500).json({ success: false, error: 'Failed to load directory settings' })
    }

    // Format the data for the frontend
    const formattedData = (directories || []).map((dir: any) => ({
      id: dir.id,
      name: dir.name || 'Unknown Directory',
      category: dir.category || 'General',
      enabled: dir.active !== false, // Default to enabled if not specified
      pacing_min_ms: (typeof dir.pacing_min_ms === 'number' ? dir.pacing_min_ms : null) ?? 1000,
      pacing_max_ms: (typeof dir.pacing_max_ms === 'number' ? dir.pacing_max_ms : null) ?? 5000,
      max_retries: (typeof dir.max_retries === 'number' ? dir.max_retries : null) ?? 3,
    }))

    return res.status(200).json({ success: true, data: formattedData })
  } catch (e: any) {
    console.error('[staff:directory-settings] error', e?.message || e)
    return res.status(500).json({ success: false, error: 'Internal error' })
  }
}

export default withStaffAuth(handler)