/**
 * Staff API: Create Test Customer and Seed Pending Job
 * POST /api/staff/create-test-customer
 * Body (optional): { name, website, address, city, state, zip, phone, email, package_size }
 * If body is omitted, defaults to the provided Ben Stone sample.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { withStaffAuth } from '../../../lib/middleware/staff-auth'
import { getSupabaseAdminClient } from '../../../lib/server/supabaseAdmin'
import { createDirectorySubmissions } from '../../../lib/server/createDirectorySubmissions'

interface CreateTestCustomerResponse {
  success: boolean
  data?: { customer_id: string; job_id: string }
  message?: string
  error?: string
}

async function handler(req: NextApiRequest, res: NextApiResponse<CreateTestCustomerResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase admin client not available' })
    }

    // Generate unique identifiers
    const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const customer_id = `DIR-${date}-${rand}`
    const timestamp = Date.now()
    
    const {
      name = 'Ben Stone',
      website = 'https://www.directorybolt.com',
      address = '4026 W Harper Lane',
      city = 'Lehi',
      state = 'UT',
      zip = '84043',
      phone = '385-225-1199',
      email = `test-${timestamp}@directorybolt.com`, // Generate unique email
      package_size = 50,
    } = (req.body || {}) as Record<string, any>

    // Insert customer (ensure customer_id satisfies NOT NULL constraint)
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .insert({
        customer_id, // required business identifier with custom format
        business_name: name,
        email,
        phone,
        website,
        address,
        city,
        state,
        zip,
        package_type: 'starter',
        directory_limit: package_size,
        description: 'Test customer created from staff dashboard',
        category: 'Business Services',
      })
      .select('customer_id')
      .single()

    if (custErr || !customer) {
      return res.status(500).json({ success: false, error: `Failed to create customer: ${custErr?.message || 'Unknown error'}` })
    }

    // Seed a pending job for that customer
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .insert({
        // Use customer_id (business ID) for FK relationship
        customer_id: customer.customer_id,
        business_name: name,
        email: email,
        package_size: package_size,
        priority_level: 3,
        status: 'pending',
        metadata: {
          businessName: name,
          email: email,
          phone: phone,
          website: website,
          address: address,
          city: city,
          state: state,
          zip: zip,
          package_size: package_size
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (jobErr || !job) {
      return res.status(500).json({ success: false, error: `Failed to create job: ${jobErr?.message || 'Unknown error'}` })
    }

    // Create directory submissions for the job
    const submissionsResult = await createDirectorySubmissions({
      supabase,
      jobId: job.id,
      customerId: customer.customer_id,
      packageSize: package_size
    })

    if (!submissionsResult.success) {
      console.warn('⚠️ Failed to create directory submissions:', submissionsResult.error)
      return res.status(200).json({ 
        success: true, 
        data: { customer_id: customer.customer_id, job_id: job.id }, 
        message: `Test customer and job created, but failed to create directory submissions: ${submissionsResult.error}` 
      })
    }

    return res.status(200).json({ 
      success: true, 
      data: { customer_id: customer.customer_id, job_id: job.id }, 
      message: `Test customer, job, and ${submissionsResult.count} directory submissions created successfully` 
    })
  } catch (error) {
    console.error('[staff.create-test-customer] error', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export default withStaffAuth(handler)