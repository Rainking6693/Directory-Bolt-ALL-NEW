import { NextApiRequest, NextApiResponse } from 'next'
import { verifyAdminAuth } from '../../../../../lib/auth/admin-auth'
import { withCSRFProtection } from '../../../../../lib/security/csrf-protection'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // SECURITY FIX: Require admin authentication for alert resolution
  if (!(await verifyAdminAuth(req, res))) {
    return // Response already sent by verifyAdminAuth
  }

  const { alertId } = req.query

  if (!alertId || typeof alertId !== 'string') {
    return res.status(400).json({ error: 'Alert ID is required' })
  }

  try {
    // Mock alert resolution
    console.log(`Resolving alert: ${alertId}`)
    
    // In a real implementation, you would:
    // 1. Update the alert status in your database
    // 2. Log the resolution action
    // 3. Notify relevant systems
    
    res.status(200).json({ 
      success: true, 
      message: `Alert ${alertId} resolved successfully`,
      resolvedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to resolve alert:', error)
    res.status(500).json({ error: 'Failed to resolve alert' })
  }
}

// Export with CSRF protection
export default withCSRFProtection(handler)