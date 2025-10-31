import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdminClient } from '../../../lib/server/supabaseAdmin'
import { enqueueCustomerForAutoBolt } from '../../../lib/server/autoboltQueueSync'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' })
    }

    const { type, table, record } = req.body || {}

    if (type !== 'INSERT' || !record) {
      return res.status(200).json({ success: true, message: 'Ignored event' })
    }

    if (table !== 'customers') {
      return res.status(200).json({ success: true, message: 'Non-customer event ignored' })
    }

    const result = await enqueueCustomerForAutoBolt(supabase, record)
    const status = result.success ? 200 : 500
    return res.status(status).json({ success: result.success, message: result.message })
  } catch (err: any) {
    console.error('[autobolt.sync-webhook] error:', err)
    return res.status(500).json({ error: err?.message || 'Unknown error' })
  }
}
