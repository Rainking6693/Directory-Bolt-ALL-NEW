// AutoBolt Extension - Update Progress API
// Updates directory submission progress from the AutoBolt extension

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { corsMiddleware } from '../../../lib/utils/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply CORS headers for Chrome extension support
  if (!corsMiddleware(req, res, { allowCredentials: true })) {
    return; // OPTIONS request handled
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('📊 AutoBolt extension updating progress')

    const { 
      extension_id,
      queue_id,
      customer_id,
      directory_name,
      directory_url,
      submission_status,
      listing_url,
      rejection_reason,
      processing_time_seconds,
      error_message
    } = req.body

    if (!extension_id || !queue_id || !customer_id || !directory_name || !submission_status) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: extension_id, queue_id, customer_id, directory_name, submission_status'
      })
    }

    // Create or update AutoBolt submission record
    const submissionData = {
      customer_id: customer_id, // Use string customer_id directly
      directory_name: directory_name,
      directory_url: directory_url || null,
      submission_status: submission_status,
      submitted_at: submission_status === 'submitted' ? new Date().toISOString() : null,
      approved_at: submission_status === 'approved' ? new Date().toISOString() : null,
      listing_url: listing_url || null,
      rejection_reason: rejection_reason || null,
      processing_time_seconds: processing_time_seconds || null,
      error_message: error_message || null,
      updated_at: new Date().toISOString()
    }

    // First, try to find existing submission
    const { data: existingSubmission, error: findError } = await supabase
      .from('autobolt_submissions')
      .select('id')
      .eq('customer_id', customer_id)
      .eq('directory_name', directory_name)
      .single()

    let submission, submissionError

    if (existingSubmission) {
      // Update existing submission
      const { data: updatedSubmission, error: updateError } = await supabase
        .from('autobolt_submissions')
        .update(submissionData)
        .eq('id', existingSubmission.id)
        .select()
        .single()
      
      submission = updatedSubmission
      submissionError = updateError
    } else {
      // Insert new submission
      const { data: newSubmission, error: insertError } = await supabase
        .from('autobolt_submissions')
        .insert(submissionData)
        .select()
        .single()
      
      submission = newSubmission
      submissionError = insertError
    }

    if (submissionError) {
      console.error('❌ Failed to update directory submission:', submissionError)
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to update directory submission'
      })
    }

    // Update customer progress in customers table
    await updateCustomerProgress(customer_id)

    // Update processing history
    await updateProcessingHistory(queue_id, customer_id)

    // Update extension status
    await updateExtensionStatus(extension_id, customer_id, queue_id)

    console.log(`✅ Progress updated for ${customer_id}: ${directory_name} - ${submission_status}`)

    res.status(200).json({
      success: true,
      message: 'Progress updated successfully',
      data: {
        submission_id: submission.id,
        customer_id: customer_id,
        directory_name: directory_name,
        submission_status: submission_status,
        updated_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ AutoBolt update progress error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function updateCustomerProgress(customerIdString: string) {
  try {
    // Get submission counts for this customer
    const { data: submissions, error: submissionsError } = await supabase
      .from('autobolt_submissions')
      .select('submission_status')
      .eq('customer_id', customerIdString)

    if (submissionsError) {
      console.error('❌ Failed to get submission counts:', submissionsError)
      return
    }

    const submittedCount = submissions.filter(s => s.submission_status === 'approved').length
    const failedCount = submissions.filter(s => s.submission_status === 'failed').length

    // Update customer record
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        directories_submitted: submittedCount,
        failed_directories: failedCount,
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', customerIdString)

    if (updateError) {
      console.error('❌ Failed to update customer progress:', updateError)
    }
  } catch (error) {
    console.error('❌ Customer progress update error:', error)
  }
}

async function updateProcessingHistory(queueId: string, customerIdString: string) {
  try {
    // Get current submission counts
    const { data: submissions, error: submissionsError } = await supabase
      .from('autobolt_submissions')
      .select('submission_status')
      .eq('customer_id', customerIdString)

    if (submissionsError) {
      console.error('❌ Failed to get submissions for history:', submissionsError)
      return
    }

    const completedCount = submissions.filter(s => s.submission_status === 'approved').length
    const failedCount = submissions.filter(s => s.submission_status === 'failed').length
    const totalCount = submissions.length
    const successRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

    // Check if processing is complete
    const isComplete = completedCount + failedCount >= totalCount

    // Update processing history
    const { error: historyError } = await supabase
      .from('autobolt_processing_history')
      .update({
        directories_completed: completedCount,
        directories_failed: failedCount,
        success_rate: successRate,
        status: isComplete ? 'completed' : 'in_progress',
        session_completed_at: isComplete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('queue_id', queueId)

    if (historyError) {
      console.error('❌ Failed to update processing history:', historyError)
    }

    // If complete, update queue status
    if (isComplete) {
      const { error: queueError } = await supabase
        .from('autobolt_processing_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', queueId)

      if (queueError) {
        console.error('❌ Failed to update queue status:', queueError)
      }
    }
  } catch (error) {
    console.error('❌ Processing history update error:', error)
  }
}

async function updateExtensionStatus(extensionId: string, customerIdString: string, queueId: string) {
  try {
    // Get current submission counts
    const { data: submissions, error: submissionsError } = await supabase
      .from('autobolt_submissions')
      .select('submission_status')
      .eq('customer_id', customerIdString)

    if (submissionsError) {
      console.error('❌ Failed to get submissions for extension status:', submissionsError)
      return
    }

    const processedCount = submissions.filter(s => 
      ['approved', 'failed'].includes(s.submission_status)
    ).length
    const failedCount = submissions.filter(s => s.submission_status === 'failed').length

    const { error } = await supabase
      .from('autobolt_extension_status')
      .update({
        directories_processed: processedCount,
        directories_failed: failedCount,
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('extension_id', extensionId)

    if (error) {
      console.error('❌ Failed to update extension status:', error)
    }
  } catch (error) {
    console.error('❌ Extension status update error:', error)
  }
}
