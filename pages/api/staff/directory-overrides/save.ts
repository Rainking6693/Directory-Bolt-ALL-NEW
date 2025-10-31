import type { NextApiRequest, NextApiResponse } from 'next'
import { withStaffAuth } from '../../../../lib/middleware/staff-auth'
import { createClient } from '@supabase/supabase-js'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ success: false, error: 'Supabase not configured' })
  }
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const { directory_id, enabled, pacing_min_ms, pacing_max_ms, max_retries } = req.body || {}
    if (!directory_id) return res.status(400).json({ success: false, error: 'directory_id required' })

    const payload: any = { directory_id }
    if (typeof enabled === 'boolean') payload.enabled = enabled
    if (typeof pacing_min_ms === 'number') payload.pacing_min_ms = pacing_min_ms
    if (typeof pacing_max_ms === 'number') payload.pacing_max_ms = pacing_max_ms
    if (typeof max_retries === 'number') payload.max_retries = max_retries
    payload.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('directory_overrides')
      .upsert(payload, { onConflict: 'directory_id' })
      .select('*')

    if (error) {
      console.error('[staff:directory-overrides:save] upsert error', error)
      return res.status(500).json({ success: false, error: 'Failed to save override' })
    }

    return res.status(200).json({ success: true, data: data?.[0] || null })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Internal error' })
  }
}

export default withStaffAuth(handler)
