/**
 * Staff Push Job to AutoBolt API
 * 
 * POST /api/staff/jobs/push-to-autobolt
 * Manually pushes a pending job to AutoBolt processing queue
 * 
 * Security: Requires staff authentication + CSRF token
 * Usage: Staff dashboard JobProgressMonitor "Push to AutoBolt" button
 * 
 * Phase 2 - Task 2.2 Implementation
 * Agent: Riley (Frontend Engineer)
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { withRateLimit, rateLimiters } from '../../../../lib/middleware/production-rate-limit'
import { validateStaffAuth } from '../../../../lib/middleware/staff-auth'

interface PushJobResponse {
  success: boolean
  data?: {
    jobId: string
    business_name?: string
    package_type?: string
    directory_limit?: number
    priority_level?: number
    status?: string
    message: string
  }
  message?: string
  error?: string
}

// Staff authentication function - uses the same middleware as other staff endpoints
const authenticateStaff = (req: NextApiRequest) => {
  const authResult = validateStaffAuth(req)
  return authResult.isAuthenticated
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PushJobResponse>
) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    })
  }

  try {
    // Authenticate staff user
    if (!authenticateStaff(req)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Staff authentication required.',
        message: 'Use API key (x-staff-key), session cookie (staff-session), or basic auth'
      })
    }

    // Validate CSRF token (following existing pattern)
    const csrfToken = req.headers['x-csrf-token']
    if (!csrfToken) {
      return res.status(403).json({
        success: false,
        error: 'CSRF token required',
        message: 'Include X-CSRF-Token header'
      })
    }

    // Validate request body
    const { job_id } = req.body
    
    if (!job_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: job_id'
      })
    }

    console.log(`dYs? Staff pushing job ${job_id} to AutoBolt from IP:`, req.headers['x-forwarded-for'] || (req.socket as any)?.remoteAddress)

    // Create Supabase client lazily
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(503).json({ success: false, error: 'Supabase is not configured on this environment' })
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the pending job and mark it in_progress (doc model)
    const { data: jobRow, error: jobErr } = await supabase
      .from('jobs')
      .select('id, customer_id, package_size, status')
      .eq('id', job_id)
      .eq('status', 'pending')
      .single()
    if (jobErr || !jobRow) {
      return res.status(404).json({
        success: false,
        error: 'Job not found or not in pending status',
        message: 'Job may already be processing or completed'
      })
    }

    await supabase
      .from('jobs')
      .update({ status: 'in_progress', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', job_id)

    // Fetch customer for message context (optional)
    const { data: customer } = await supabase
      .from('customers')
      .select('business_name, email')
      .eq('id', jobRow.customer_id)
      .single()

    // Get directory limits and priority based on package
    const getDirectoryLimits = (packageType: string): number => {
      const limits: Record<string, number> = {
        starter: 50,
        growth: 150,
        professional: 300,
        pro: 500,
        enterprise: 1000
      }
      return limits[packageType] || 50
    }

    const getPriorityLevel = (packageType: string): number => {
      const priorities: Record<string, number> = {
        starter: 4,
        growth: 3,
        professional: 2,
        pro: 1,
        enterprise: 1
      }
      return priorities[packageType] || 4
    }

    const directoryLimit = getDirectoryLimits(jobRow.package_size)
    const priorityLevel = getPriorityLevel(jobRow.package_size)

    // Log the staff action for audit trail
    try {
      await supabase
        .from('staff_actions')
        .insert({
          action_type: 'push_to_autobolt',
          job_id: job_id,
          customer_id: jobRow.customer_id,
          staff_user: 'staff-dashboard',
          details: {
            job_id: job_id,
            customer_name: customer?.business_name,
            package_type: jobRow.package_size,
            pushed_at: new Date().toISOString()
          },
          created_at: new Date().toISOString()
        })
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.warn('Failed to log staff action:', auditError)
    }

    // Return success response with detailed information
    return res.status(200).json({
      success: true,
      data: {
        jobId: job_id,
        business_name: customer?.business_name,
        package_type: jobRow.package_size,
        directory_limit: directoryLimit,
        priority_level: priorityLevel,
        status: 'in_progress',
        message: `Job ${job_id} set to in_progress and ready for AutoBolt`
      },
      message: `Customer ${customer?.business_name || ''} (${customer?.email || ''}) has been queued for processing`
    })

  } catch (error) {
    console.error('Staff Push Job to AutoBolt API Error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    })
  }
}

export default withRateLimit(handler, rateLimiters.admin)