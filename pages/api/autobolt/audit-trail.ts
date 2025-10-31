// @ts-nocheck
/**
 * AutoBolt Audit Trail API
 * 
 * GET /api/autobolt/audit-trail?jobId=<id> - Get audit trail for a specific job
 * GET /api/autobolt/audit-trail?customerId=<id> - Get audit trail for a customer
 * 
 * Provides detailed tracking of which directories each customer was submitted to
 * Includes submission status, timestamps, and results for monitoring
 * 
 * Security: Requires AUTOBOLT_API_KEY authentication
 * 
 * Phase 1 - Task 1.5 Implementation
 * Agent: Alex (Full-Stack Engineer)
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'

// Initialize Supabase client with service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface AuditTrailEntry {
  id: string
  job_id: string
  customer_id: string
  directory_name: string
  directory_url?: string
  directory_category?: string
  directory_tier?: string
  submission_status: string
  submission_timestamp: string
  completion_timestamp?: string
  response_log?: any
  error_message?: string
  retry_count: number
  processing_time_seconds?: number
  listing_url?: string
  submission_result?: string
}

interface AuditTrailResponse {
  success: boolean
  data?: {
    job_id?: string
    customer_id?: string
    total_directories: number
    successful_submissions: number
    failed_submissions: number
    pending_submissions: number
    audit_entries: AuditTrailEntry[]
    processing_summary?: {
      started_at?: string
      completed_at?: string
      total_processing_time_minutes?: number
      average_time_per_directory_seconds?: number
    }
  }
  error?: string
  message?: string
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuditTrailResponse>
) {
  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET.'
    })
  }

  try {
    // Authenticate using API key
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '')
    
    if (!apiKey || apiKey !== process.env.AUTOBOLT_API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Valid AUTOBOLT_API_KEY required.'
      })
    }

    const { jobId, customerId } = req.query

    if (!jobId && !customerId) {
      return res.status(400).json({
        success: false,
        error: 'Either jobId or customerId parameter is required'
      })
    }

    // Build query based on provided parameters
    let query = supabase
      .from('job_results')
      .select(`
        id,
        job_id,
        directory_name,
        status,
        response_log,
        submitted_at,
        retry_count,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: true })

    // Apply filters
    if (jobId) {
      query = query.eq('job_id', jobId)
    }

    const { data: auditEntries, error: auditError } = await query

    if (auditError) {
      console.error('❌ Failed to fetch audit trail:', auditError)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch audit trail'
      })
    }

    if (!auditEntries || auditEntries.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No audit entries found for the specified criteria'
      })
    }

    // Get job information for additional context
    let jobInfo = null
    let customerInfo = null

    if (jobId) {
      const { data: job } = await supabase
        .from('autobolt_processing_queue')
        .select(`
          id,
          customer_id,
          status,
          created_at,
          started_at,
          completed_at,
          customers!inner(
            customer_id,
            business_name,
            email
          )
        `)
        .eq('id', jobId)
        .single()

      jobInfo = job
      if (job) {
        customerInfo = job.customers
      }
    } else if (customerId) {
      // Get customer info and find associated jobs
      const { data: customer } = await supabase
        .from('customers')
        .select(`
          customer_id,
          business_name,
          email,
          status
        `)
        .eq('customer_id', customerId)
        .single()

      customerInfo = customer
    }

    // Calculate statistics
    const totalDirectories = auditEntries.length
    const successfulSubmissions = auditEntries.filter(entry => 
      ['submitted', 'approved'].includes(entry.status)
    ).length
    const failedSubmissions = auditEntries.filter(entry => 
      ['failed', 'rejected'].includes(entry.status)
    ).length
    const pendingSubmissions = auditEntries.filter(entry => 
      entry.status === 'pending'
    ).length

    // Transform audit entries for response
    const transformedEntries: AuditTrailEntry[] = auditEntries.map(entry => ({
      id: entry.id,
      job_id: entry.job_id,
      customer_id: jobInfo?.customer_id || customerId as string,
      directory_name: entry.directory_name,
      directory_url: entry.response_log?.directory_url,
      directory_category: entry.response_log?.category || 'business',
      directory_tier: entry.response_log?.tier || 'standard',
      submission_status: entry.status,
      submission_timestamp: entry.created_at,
      completion_timestamp: entry.submitted_at || entry.updated_at,
      response_log: entry.response_log,
      error_message: entry.response_log?.error_message,
      retry_count: entry.retry_count || 0,
      processing_time_seconds: entry.response_log?.processing_time_seconds,
      listing_url: entry.response_log?.listing_url,
      submission_result: entry.response_log?.submission_result
    }))

    // Calculate processing summary if job info is available
    let processingSummary = undefined
    if (jobInfo) {
      const startedAt = jobInfo.started_at
      const completedAt = jobInfo.completed_at
      
      if (startedAt) {
        processingSummary = {
          started_at: startedAt,
          completed_at: completedAt,
          total_processing_time_minutes: completedAt && startedAt ? 
            Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / (1000 * 60)) : 
            undefined,
          average_time_per_directory_seconds: totalDirectories > 0 ? 
            Math.round(transformedEntries.reduce((sum, entry) => 
              sum + (entry.processing_time_seconds || 0), 0) / totalDirectories) : 
            undefined
        }
      }
    }

    console.log(`✅ Retrieved audit trail: ${totalDirectories} entries, ${successfulSubmissions} successful`)

    return res.status(200).json({
      success: true,
      data: {
        job_id: jobId as string,
        customer_id: customerInfo?.customer_id || customerId as string,
        total_directories: totalDirectories,
        successful_submissions: successfulSubmissions,
        failed_submissions: failedSubmissions,
        pending_submissions: pendingSubmissions,
        audit_entries: transformedEntries,
        processing_summary: processingSummary
      },
      message: `Retrieved ${totalDirectories} audit entries with ${successfulSubmissions} successful submissions`
    })

  } catch (error) {
    console.error('AutoBolt Audit Trail API Error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    })
  }
}

export default withRateLimit(handler, rateLimiters.general)