// Staff Dashboard - Manual Push to AutoBolt
// Allows staff to manually push customers to AutoBolt for directory submissions

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { withStaffAuth } from '../../../lib/middleware/staff-auth'
import { withRateLimit, rateLimitConfigs } from '../../../lib/middleware/rate-limit'
import { withCSRFProtection } from '../../../lib/middleware/csrf-protection'

// IMPORTANT: Do not create Supabase client at module scope in dev. Lazy-create inside the handler.

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('dYs? Staff requesting to push customer to AutoBolt')

    const { customer_id, action } = req.body

    if (!customer_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Customer ID is required'
      })
    }

    // Create Supabase client lazily
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(503).json({ error: 'Service Unavailable', message: 'Supabase is not configured on this environment' })
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Get customer data from Supabase
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        id,
        customer_id,
        business_name,
        email,
        package_type,
        status,
        directories_submitted,
        failed_directories,
        created_at,
        updated_at
      `)
      .eq('customer_id', customer_id)
      .single()

    if (customerError || !customer) {
      console.error('??O Customer not found:', customerError)
      return res.status(404).json({
        error: 'Not Found',
        message: 'Customer not found'
      })
    }

    // Check if customer is already being processed
    if (customer.status === 'in-progress') {
      return res.status(409).json({
        error: 'Already Processing',
        message: 'Customer is already being processed by AutoBolt'
      })
    }

    // Get directory limits based on package type
    const directoryLimits = getDirectoryLimits(customer.package_type)

    // Create AutoBolt processing record
    const processingData = {
      customer_id: customer.customer_id,
      business_name: customer.business_name,
      email: customer.email,
      package_type: customer.package_type,
      directory_limit: directoryLimits,
      priority_level: getPriorityLevel(customer.package_type),
      status: 'queued',
      action: action || 'start_processing',
      created_at: new Date().toISOString(),
      created_by: 'staff_dashboard'
    }

    // Insert into processing queue
    const { data: queueRecord, error: queueError } = await supabase
      .from('autobolt_processing_queue')
      .insert([processingData])
      .select()
      .single()

    if (queueError) {
      console.error('??O Failed to add to processing queue:', queueError)
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to add customer to AutoBolt processing queue',
        details: queueError.message
      })
    }

    // Update customer status to queued (will change to in-progress when processing starts)
    const { error: updateError } = await supabase
      .from('customers')
      .update({ 
        status: 'queued',
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', customer_id)

    if (updateError) {
      console.error('??O Failed to update customer status:', updateError)
      // Don't fail the request, just log the error
    }

    // Log the action
    console.log(`?o. Customer ${customer.customer_id} pushed to AutoBolt processing queue`)

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Customer successfully pushed to AutoBolt processing queue',
      data: {
        customer_id: customer.customer_id,
        business_name: customer.business_name,
        package_type: customer.package_type,
        directory_limit: directoryLimits,
        priority_level: getPriorityLevel(customer.package_type),
        status: 'queued',
        estimated_completion: calculateEstimatedCompletion(directoryLimits, customer.package_type)
      }
    })

  } catch (error) {
    console.error('??O Push to AutoBolt error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to push customer to AutoBolt',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

function getDirectoryLimits(packageType: string): number {
  const limits: Record<string, number> = {
    starter: 50,
    growth: 150,
    professional: 300,
    pro: 500,
    enterprise: 1000
  }
  return limits[packageType] || 50
}

function getPriorityLevel(packageType: string): number {
  const priorities: Record<string, number> = {
    starter: 4,
    growth: 3,
    professional: 2,
    pro: 1,
    enterprise: 1
  }
  return priorities[packageType] || 4
}

function calculateEstimatedCompletion(directoryLimits: number, packageType: string): string {
  const avgTimePerDirectory = getAverageTimePerDirectory(packageType)
  const estimatedMinutes = directoryLimits * avgTimePerDirectory
  const estimatedCompletion = new Date(Date.now() + estimatedMinutes * 60 * 1000)
  return estimatedCompletion.toISOString()
}

function getAverageTimePerDirectory(packageType: string): number {
  const timeMap: Record<string, number> = {
    starter: 3,      // 3 minutes per directory
    growth: 2,       // 2 minutes per directory
    professional: 1.5, // 1.5 minutes per directory
    pro: 1,          // 1 minute per directory
    enterprise: 0.5  // 30 seconds per directory
  }
  return timeMap[packageType] || 2
}

// Export with authentication, rate limiting, and CSRF protection middleware
export default withCSRFProtection()(withRateLimit(rateLimitConfigs.staff)(withStaffAuth(handler)))