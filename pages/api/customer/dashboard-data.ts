import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase credentials not configured')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface DashboardDataResponse {
  success: boolean
  data?: {
    customer: {
      id: string
      business_name: string
      email: string
      package_type: string
    }
    jobs: Array<{
      id: string
      status: string
      progress_percentage: number
      directories_completed: number
      directories_failed: number
      directories_to_process: number
      created_at: string
      updated_at: string
    }>
    submissions: Array<{
      id: string
      directory_name: string
      status: string
      submitted_at?: string
      approved_at?: string
      failed_at?: string
      error_message?: string
    }>
    stats: {
      total_submissions: number
      completed_submissions: number
      failed_submissions: number
      pending_submissions: number
      success_rate: number
    }
  }
  error?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<DashboardDataResponse>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { customerId } = req.query

    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ success: false, error: 'Customer ID is required' })
    }

    // Get customer info
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('customer_id, business_name, email, package_type')
      .eq('customer_id', customerId)
      .single()

    if (customerError || !customer) {
      return res.status(404).json({
        success: false, 
        error: 'Customer not found' 
      })
    }

    // Get customer's jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
    }

    // Get customer's submissions
    const { data: submissions, error: submissionsError } = await supabase
      .from('directory_submissions')
      .select(`
        *,
        directories:directory_id (
          name,
          website
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError)
    }

    // Calculate stats
    const totalSubmissions = submissions?.length || 0
    const completedSubmissions = submissions?.filter(s => s.status === 'submitted' || s.status === 'approved').length || 0
    const failedSubmissions = submissions?.filter(s => s.status === 'failed').length || 0
    const pendingSubmissions = submissions?.filter(s => s.status === 'pending' || s.status === 'submitting').length || 0
    const successRate = totalSubmissions > 0 ? Math.round((completedSubmissions / totalSubmissions) * 100) : 0

    // Format response
    const dashboardData = {
      customer: {
        id: customer.customer_id,
        business_name: customer.business_name,
        email: customer.email,
        package_type: customer.package_type || 'starter'
      },
      jobs: (jobs || []).map(job => ({
        id: job.id,
        status: job.status,
        progress_percentage: job.progress_percentage || 0,
        directories_completed: job.directories_completed || 0,
        directories_failed: job.directories_failed || 0,
        directories_to_process: job.directories_to_process || 0,
        created_at: job.created_at,
        updated_at: job.updated_at
      })),
      submissions: (submissions || []).map(submission => ({
        id: submission.id,
        directory_name: submission.directories?.name || 'Unknown Directory',
        status: submission.status,
        submitted_at: submission.submitted_at,
        approved_at: submission.approved_at,
        failed_at: submission.failed_at,
        error_message: submission.error_message
      })),
      stats: {
        total_submissions: totalSubmissions,
        completed_submissions: completedSubmissions,
        failed_submissions: failedSubmissions,
        pending_submissions: pendingSubmissions,
        success_rate: successRate
      }
    }

    return res.status(200).json({
      success: true,
      data: dashboardData
    })

  } catch (error) {
    console.error('[customer.dashboard-data] error', error)
    return res.status(500).json({
      success: false, 
      error: 'Internal server error' 
    })
  }
}