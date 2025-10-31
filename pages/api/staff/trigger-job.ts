import type { NextApiRequest, NextApiResponse } from 'next'
import { withStaffAuth } from '../../../lib/middleware/staff-auth'

function getBaseUrl(req: NextApiRequest) {
  // Prefer Netlify URL when available, else derive from request
  const envUrl = process.env.URL || process.env.SITE_URL || ''
  if (envUrl) return envUrl.replace(/\/$/, '')
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
  const host = req.headers.host
  return `${proto}://${host}`
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { jobId, customerId } = req.body || {}
    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId required' })
    }

    const base = getBaseUrl(req)
    const staffKey = process.env.STAFF_API_KEY
    if (!staffKey) {
      return res.status(500).json({ success: false, error: 'STAFF_API_KEY not configured' })
    }

    const resp = await fetch(`${base}/.netlify/functions/trigger-job-processing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffKey}`,
      },
      body: JSON.stringify({ jobId, customerId }),
    })

    const data = await resp.json().catch(() => ({}))
    if (resp.status === 202 && data?.success) {
      return res.status(202).json({ success: true, message: 'Job queued' })
    }

    return res.status(resp.status || 500).json({ success: false, error: data?.error || 'Failed to queue job' })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Internal error' })
  }
}

export default withStaffAuth(handler)