// CSRF Token API
// Provides CSRF tokens for frontend requests

import { NextApiRequest, NextApiResponse } from 'next'
import { getCSRFToken } from '../../lib/middleware/csrf-protection'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const token = getCSRFToken()
    
    res.status(200).json({
      success: true,
      csrfToken: token,
      expiresIn: 3600 // 1 hour in seconds
    })
  } catch (error) {
    console.error('❌ CSRF token generation error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate CSRF token'
    })
  }
}