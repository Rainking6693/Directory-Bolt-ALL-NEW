/**
 * AutoBolt Test Submissions API - FIXED VERSION
 * 
 * POST /api/autobolt/test-submissions - Create a test job to verify directory submissions
 * GET /api/autobolt/test-submissions - Get status of test submissions
 * 
 * Allows staff to test that AutoBolt extension is working properly
 * Creates test customers and monitors actual directory submission attempts
 * 
 * Security: Requires AUTOBOLT_API_KEY authentication
 * 
 * Phase 1 - Task 1.7 Implementation
 * Agent: Alex (Full-Stack Engineer)
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'

// Initialize Supabase client with service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface TestSubmissionRequest {
  test_type?: 'basic' | 'comprehensive' | 'stress'
  directory_count?: number
  test_name?: string
}

interface TestSubmissionResponse {
  success: boolean
  data?: {
    test_job_id: string
    test_customer_id: string
    test_name: string
    directory_count: number
    test_status: string
    created_at: string
    monitor_url: string
    expected_completion_minutes: number
  } | {
    active_tests: Array<{
      test_job_id: string
      test_customer_id: string
      test_name: string
      status: string
      progress_percentage: number
      directories_completed: number
      directories_failed: number
      created_at: string
      elapsed_minutes: number
    }>
    completed_tests_today: number
  }
  error?: string
  message?: string
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestSubmissionResponse>
) {
  try {
    // Authenticate using API key
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '')
    
    if (!apiKey || apiKey !== process.env.AUTOBOLT_API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Valid AUTOBOLT_API_KEY required.'
      })
    }

    if (req.method === 'POST') {
      return await handleCreateTestSubmission(req, res)
    } else if (req.method === 'GET') {
      return await handleGetTestStatus(req, res)
    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Use POST to create test or GET to check status.'
      })
    }

  } catch (error) {
    console.error('AutoBolt Test Submissions API Error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    })
  }
}

async function handleCreateTestSubmission(
  req: NextApiRequest,
  res: NextApiResponse<TestSubmissionResponse>
) {
  const { test_type = 'basic', directory_count, test_name }: TestSubmissionRequest = req.body

  // Determine directory count based on test type
  let dirCount = directory_count
  if (!dirCount) {
    switch (test_type) {
      case 'basic':
        dirCount = 3
        break
      case 'comprehensive':
        dirCount = 10
        break
      case 'stress':
        dirCount = 25
        break
      default:
        dirCount = 3
    }
  }

  // Generate test customer ID
  const timestamp = Date.now()
  const testCustomerId = `TEST-${timestamp.toString().slice(-8)}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
  const testJobName = test_name || `AutoBolt Test ${test_type} - ${new Date().toLocaleString()}`

  try {
    // Create test customer record - using actual customers table schema
    const testCustomerData = {
      customer_id: testCustomerId,
      first_name: 'Test',
      last_name: 'Business',
      business_name: `Test Business ${testCustomerId}`,
      email: `test-${timestamp}@directorybolt-testing.com`,
      phone: '555-0123',
      address: '123 Test Street',
      city: 'Test City',
      state: 'CA',
      zip: '90210',
      website: 'https://test-business.example.com',
      package_type: 'starter',
      status: 'active',
      directories_submitted: 0,
      failed_directories: 0,
      metadata: {
        description: `Test business created for AutoBolt submission testing - ${testJobName}`,
        facebook: 'https://facebook.com/testbusiness',
        instagram: 'https://instagram.com/testbusiness',
        linkedin: 'https://linkedin.com/company/testbusiness',
        test_type: test_type,
        created_for_testing: true
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert(testCustomerData)
      .select()
      .single()

    if (customerError) {
      console.error('❌ Failed to create test customer:', customerError)
      return res.status(500).json({
        success: false,
        error: 'Failed to create test customer'
      })
    }

    // Create test job in AutoBolt processing queue
    const testJobData = {
      customer_id: testCustomerId,
      business_name: `Test Business ${testCustomerId}`,
      email: `test-${timestamp}@directorybolt-testing.com`,
      package_type: 'starter',
      directory_limit: dirCount,
      status: 'queued',
      priority_level: 1, // High priority for tests
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: job, error: jobError } = await supabase
      .from('autobolt_processing_queue')
      .insert(testJobData)
      .select()
      .single()

    if (jobError) {
      console.error('❌ Failed to create test job:', jobError)
      
      // Clean up customer record
      await supabase
        .from('customers')
        .delete()
        .eq('customer_id', testCustomerId)

      return res.status(500).json({
        success: false,
        error: 'Failed to create test job'
      })
    }

    // Create test submission log entry for tracking
    const testLogData = {
      test_job_id: job.id,
      test_customer_id: testCustomerId,
      test_name: testJobName,
      test_type: test_type,
      directory_count: dirCount,
      status: 'queued',
      created_at: new Date().toISOString()
    }

    try {
      await supabase
        .from('autobolt_test_logs')
        .insert(testLogData)
    } catch (error) {
      console.warn('⚠️ Failed to create test log entry:', error)
      // Don't fail the entire request for logging issues
    }

    // Calculate expected completion time (estimate 30 seconds per directory + 2 minutes overhead)
    const expectedCompletionMinutes = Math.ceil((dirCount * 0.5) + 2)

    const monitorUrl = `${req.headers.origin || 'https://directorybolt.com'}/staff/autobolt-monitor?jobId=${job.id}`

    console.log(`✅ Created test submission: Job ${job.id} for customer ${testCustomerId}`)
    console.log(`📋 Test will attempt ${dirCount} directory submissions`)

    return res.status(201).json({
      success: true,
      data: {
        test_job_id: job.id,
        test_customer_id: testCustomerId,
        test_name: testJobName,
        directory_count: dirCount,
        test_status: 'queued',
        created_at: job.created_at,
        monitor_url: monitorUrl,
        expected_completion_minutes: expectedCompletionMinutes
      },
      message: `Test submission created successfully. Job ${job.id} will attempt ${dirCount} directory submissions.`
    })

  } catch (error) {
    console.error('❌ Error creating test submission:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create test submission'
    })
  }
}

async function handleGetTestStatus(
  req: NextApiRequest,
  res: NextApiResponse<TestSubmissionResponse>
) {
  try {
    // Get active test jobs - remove the problematic inner join
    const { data: activeTests, error: activeError } = await supabase
      .from('autobolt_processing_queue')
      .select(`
        id,
        customer_id,
        directory_limit,
        status,
        created_at,
        started_at
      `)
      .like('customer_id', 'TEST-%')
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: false })

    if (activeError) {
      console.error('❌ Failed to fetch active tests:', activeError)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch test status'
      })
    }

    // Get completed tests today
    const { data: completedToday, error: completedError } = await supabase
      .from('autobolt_processing_queue')
      .select('id')
      .like('customer_id', 'TEST-%')
      .in('status', ['completed', 'failed'])
      .gte('created_at', new Date().toISOString().split('T')[0] + 'T00:00:00.000Z')

    if (completedError) {
      console.warn('⚠️ Failed to fetch completed tests:', completedError)
    }

    // Calculate progress for active tests
    const testsWithProgress = []

    for (const test of activeTests || []) {
      // Get job results to calculate progress
      const { data: jobResults } = await supabase
        .from('job_results')
        .select('status')
        .eq('job_id', test.id)

      const directoriesCompleted = jobResults?.filter(r => 
        ['submitted', 'approved'].includes(r.status)
      ).length || 0
      
      const directoriesFailed = jobResults?.filter(r => 
        ['failed', 'rejected'].includes(r.status)
      ).length || 0
      
      const progressPercentage = test.directory_limit > 0 ? 
        Math.round(((directoriesCompleted + directoriesFailed) / test.directory_limit) * 100) : 0

      const elapsedMinutes = Math.round((Date.now() - new Date(test.created_at).getTime()) / (1000 * 60))

      testsWithProgress.push({
        test_job_id: test.id,
        test_customer_id: test.customer_id,
        test_name: `Test Business ${test.customer_id}`,
        status: test.status,
        progress_percentage: progressPercentage,
        directories_completed: directoriesCompleted,
        directories_failed: directoriesFailed,
        created_at: test.created_at,
        elapsed_minutes: elapsedMinutes
      })
    }

    console.log(`✅ Test status: ${testsWithProgress.length} active tests`)

    return res.status(200).json({
      success: true,
      data: {
        active_tests: testsWithProgress,
        completed_tests_today: completedToday?.length || 0
      },
      message: `Found ${testsWithProgress.length} active test submissions`
    })

  } catch (error) {
    console.error('❌ Error getting test status:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get test status'
    })
  }
}

export default withRateLimit(handler, rateLimiters.general)