import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
const workerAuthToken = process.env.WORKER_AUTH_TOKEN;

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

if (!workerAuthToken) {
  throw new Error('Missing WORKER_AUTH_TOKEN environment variable');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ProgressUpdatePayload {
  job_id: string
  submission_id?: string
  status: string // e.g., 'in_progress', 'completed', 'failed', 'submitting', 'submitted'
  directories_completed?: number
  directories_failed?: number
  current_directory?: string
  error_message?: string
  metadata?: Record<string, any>
}

interface ProgressUpdateResponse {
  success: boolean
  message?: string
  error?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ProgressUpdateResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  // Authenticate worker
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== workerAuthToken) {
    console.warn('Unauthorized worker access attempt', { ip: req.socket.remoteAddress })
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const {
    job_id,
    submission_id,
    status,
    directories_completed,
    directories_failed,
    current_directory,
    error_message,
    metadata
  }: ProgressUpdatePayload = req.body

  if (!job_id || !status) {
    return res.status(400).json({ success: false, error: 'job_id and status are required' })
  }

  try {
    // Update master job record
    const jobUpdateData: Record<string, any> = {
      status: status,
      updated_at: new Date().toISOString(),
    }

    if (directories_completed !== undefined) jobUpdateData.directories_completed = directories_completed
    if (directories_failed !== undefined) jobUpdateData.directories_failed = directories_failed
    if (current_directory) jobUpdateData.metadata = { ...jobUpdateData.metadata, current_directory }
    if (error_message) jobUpdateData.error_message = error_message
    if (metadata) jobUpdateData.metadata = { ...jobUpdateData.metadata, ...metadata }

    const { error: jobError } = await supabase
      .from('jobs')
      .update(jobUpdateData)
      .eq('id', job_id)

    if (jobError) {
      console.error('Failed to update job status', { job_id, error: jobError.message })
      throw jobError
    }

    // If it's a submission-specific update, update the individual submission record
    if (submission_id) {
      const submissionUpdateData: Record<string, any> = {
        status: status,
        updated_at: new Date().toISOString(),
      }
      if (error_message) submissionUpdateData.error_message = error_message
      if (metadata) submissionUpdateData.metadata = { ...submissionUpdateData.metadata, ...metadata }

      // Set specific timestamps based on status
      if (status === 'submitting') submissionUpdateData.submitted_at = new Date().toISOString()
      if (status === 'submitted') submissionUpdateData.submitted_at = new Date().toISOString()
      if (status === 'approved') submissionUpdateData.approved_at = new Date().toISOString()
      if (status === 'failed') submissionUpdateData.failed_at = new Date().toISOString()

      const { error: submissionError } = await supabase
        .from('directory_submissions')
        .update(submissionUpdateData)
        .eq('id', submission_id)

      if (submissionError) {
        console.error('Failed to update submission status', { job_id, submission_id, error: submissionError.message })
        throw submissionError
      }
    }

    console.log('Progress updated successfully', { job_id, submission_id, status })
    return res.status(200).json({ success: true, message: 'Progress updated' })

  } catch (error) {
    console.error('Error processing progress update', {
      job_id,
      submission_id,
      status,
      error: error instanceof Error ? error.message : String(error)
    })
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

