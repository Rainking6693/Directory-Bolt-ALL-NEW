import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      hasStripe: !!process.env.STRIPE_SECRET_KEY,
      hasSupabase: !!process.env.SUPABASE_URL
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed'
    })
  }
}