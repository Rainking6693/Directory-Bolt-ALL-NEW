import type { NextApiRequest, NextApiResponse } from 'next'
import { withStaffAuth } from '../../../../lib/middleware/staff-auth'
import { getSupabaseAdminClient } from '../../../../lib/server/supabaseAdmin'
import { createDirectorySubmissions } from '../../../../lib/server/createDirectorySubmissions'

interface CreateCustomerBody {
  business_name: string
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  package_size?: number
}

interface CreateCustomerResponse {
  success: boolean
  data?: {
    id: string
    customer_id: string
    job_id?: string
    business_name?: string
    job_error?: string | null
  }
  error?: string
}

type ErrorWithMessage = {
  message?: string
}

function getErrorMessage(error: unknown): string | undefined {
  if (!error) {
    return undefined
  }

  if (typeof error === 'string') {
    return error
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as ErrorWithMessage).message
    return typeof message === 'string' ? message : undefined
  }

  return undefined
}

async function handler(req: NextApiRequest, res: NextApiResponse<CreateCustomerResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase admin client not available' })
    }

    const body = (req.body || {}) as CreateCustomerBody
    if (!body.business_name) {
      return res.status(400).json({ success: false, error: 'business_name is required' })
    }

    const now = new Date().toISOString()

    // Generate custom customer ID
    const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const customerId = `DIR-${date}-${rand}`

    // Create customer record in the customers table
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        customer_id: customerId, // Use the customer_id format as the primary business identifier
        business_name: body.business_name,
        email: body.email || null,
        phone: body.phone || null,
        website: body.website || null,
        address: body.address || null,
        city: body.city || null,
        state: body.state || null,
        zip: body.zip || null,
        package_type: 'starter',
        directory_limit: body.package_size || 50,
        created_at: now,
        updated_at: now,
      })
      .select('customer_id')
      .single()

    if (customerError) {
      console.error('❌ Failed to create customer:', customerError)
      return res.status(500).json({ 
        success: false, 
        error: `Failed to create customer: ${customerError.message}` 
      })
    }

    console.log('✅ Customer created:', customerId)

    let job_id: string | undefined
    const pkg = Number(body.package_size) || 50

    console.log('Creating job with customer ID:', customerId)

    // Create job with customer ID (DIR-YYYYMMDD-XXXXXX format)
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .insert({
        customer_id: customerId, // Use customer_id (DIR-YYYYMMDD-XXXXXX format) for foreign key relationship
        business_name: body.business_name,
        email: body.email || '',
        package_size: pkg,
        priority_level: 3,
        status: 'pending',
        metadata: {
          businessName: body.business_name,
          email: body.email,
          phone: body.phone,
          website: body.website,
          address: body.address,
          city: body.city,
          state: body.state,
          zip: body.zip,
          package_size: pkg
        },
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single()

    if (!jobErr && job) {
      job_id = job.id
      console.log('✅ Job created:', job_id, 'for customer:', customerId)

      // Create directory submissions for the job
      const submissionsResult = await createDirectorySubmissions({
        supabase,
        jobId: job.id,
        customerId: customerId,
        packageSize: pkg
      })

      if (!submissionsResult.success) {
        console.warn('⚠️ Failed to create directory submissions:', submissionsResult.error)
      } else {
        console.log(`✅ Created ${submissionsResult.count} directory submissions`)
      }
    } else {
      console.error('❌ Failed to create job')
      console.error('Job Error:', JSON.stringify(jobErr, null, 2))
      console.error('Job Data:', JSON.stringify(job, null, 2))
    }

    return res.status(200).json({
      success: true,
      data: {
        id: customerId, // Return the customer_id (business identifier)
        customer_id: customerId,
        job_id: job_id || undefined,
        business_name: body.business_name,
        job_error: jobErr ? jobErr.message : null
      }
    })
  } catch (e) {
    console.error('[staff.customers.create] error', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export default withStaffAuth(handler)