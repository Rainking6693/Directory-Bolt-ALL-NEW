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
      directories_to_process: number
      created_at: string
      updated_at: string
    }>
    submissions: Array<{
      id: string
      directory_url: string
      status: string
      created_at: string
      result_message?: string
    }>
    completed_logs: Array<{
      id: string
      directory_name: string
      screenshot_url: string | null
      success: boolean | null
      timestamp: string | null
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

    // Get customer's jobs (Queue Status)
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, status, created_at, updated_at, directory_limit')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (jobsError) console.error('Error fetching jobs:', jobsError)

    // Get customer's submissions (Queue Details)
    // NOTE: 'directory_submissions' contains the QUEUE state
    const { data: submissions, error: submissionsError } = await supabase
      .from('directory_submissions')
      .select('id, directory_url, status, created_at, result_message')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (submissionsError) console.error('Error fetching submissions:', submissionsError)

    // Get actual completed logs with screenshots
    // NOTE: 'autobolt_submission_logs' contains the RESULT state
    const { data: completedLogs, error: logsError } = await supabase
      .from('autobolt_submission_logs')
      .select('id, directory_name, screenshot_url, success, timestamp')
      .eq('customer_id', customerId)
      .order('timestamp', { ascending: false })

    if (logsError) console.error('Error fetching logs:', logsError)

    // Calculate stats
    const totalSubmissions = submissions?.length || 0
    const completedSubmissions = completedLogs?.filter(l => l.success).length || 0
    const failedSubmissions = completedLogs?.filter(l => !l.success).length || 0
    // Pending is roughly total queued minus processed, or just count 'pending' status in queue
    const pendingSubmissions = submissions?.filter(s => s.status === 'pending' || s.status === 'queued' || s.status === 'processing').length || 0

    // Success rate based on completed logs
    const totalProcessed = completedSubmissions + failedSubmissions
    const successRate = totalProcessed > 0 ? Math.round((completedSubmissions / totalProcessed) * 100) : 0

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
        directories_to_process: job.directory_limit || 0,
        created_at: job.created_at,
        updated_at: job.updated_at
      })),
      submissions: (submissions || []).map(submission => ({
        id: submission.id,
        directory_url: submission.directory_url,
        status: submission.status || 'unknown',
        created_at: submission.created_at || new Date().toISOString(),
        result_message: submission.result_message || ''
      })),
      completed_logs: (completedLogs || []).map(log => ({
        id: log.id,
        directory_name: log.directory_name,
        screenshot_url: log.screenshot_url,
        success: log.success,
        timestamp: log.timestamp
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