// 🔒 SECURITY DASHBOARD API
// Real-time security monitoring dashboard

import { NextApiRequest, NextApiResponse } from 'next'
import { securityMonitor } from '../../../lib/security/security-monitoring'
import { withCSRFProtection } from '../../../lib/security/csrf-protection'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  // Basic authentication check (in production, use proper auth)
  const authHeader = req.headers.authorization
  if (!authHeader || authHeader !== `Bearer ${process.env.SECURITY_DASHBOARD_TOKEN}`) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized access to security dashboard'
    })
  }

  try {
    const timeWindow = parseInt(req.query.timeWindow as string) || 3600000 // 1 hour default
    const dashboardData = securityMonitor.getDashboardData(timeWindow)

    res.status(200).json({
      success: true,
      data: {
        ...dashboardData,
        timeWindow: timeWindow,
        timestamp: new Date().toISOString(),
        systemStatus: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version
        }
      }
    })

  } catch (error) {
    console.error('Security dashboard error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security dashboard data'
    })
  }
}

export default withCSRFProtection(handler)