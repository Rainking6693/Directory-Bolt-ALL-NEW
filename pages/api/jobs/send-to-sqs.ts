import type { NextApiRequest, NextApiResponse } from 'next'

interface DeprecatedResponse {
  success: boolean
  error: string
  redirect: string
}

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<DeprecatedResponse>
) {
  return res.status(410).json({
    success: false,
    error: 'Deprecated endpoint: use the Render backend /api/jobs/enqueue service.',
    redirect: 'https://render.com'
  })
}

