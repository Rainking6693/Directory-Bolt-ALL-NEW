// Legacy endpoint for Railway worker compatibility
// This endpoint properly updates job progress with directory results

import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseAdminClient } from '../../../lib/server/supabaseAdmin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    console.log('[jobs/update] Request body:', JSON.stringify(req.body, null, 2))
    
    const { jobId, job_id, status, directoryResults, errorMessage } = req.body

    // Handle both jobId and job_id parameter names
    const actualJobId = jobId || job_id

    if (!actualJobId) {
      console.log('[jobs/update] Missing jobId')
      return res.status(400).json({ 
        success: false, 
        error: 'jobId is required' 
      })
    }
    
    console.log('[jobs/update] Processing job:', actualJobId, 'status:', status)

    const supabase = createSupabaseAdminClient()

    // 1) Insert directory results into job_results for accurate progress
    const toJobResultStatus = (s: string | undefined): 'submitted' | 'failed' | 'retry' | 'pending' => {
      const v = (s || '').toLowerCase()
      if (v === 'success' || v === 'submitted' || v === 'approved') return 'submitted'
      if (v === 'retry' || v === 'retrying') return 'retry'
      if (v === 'failed' || v === 'error' || v === 'rejected' || v === 'no_form') return 'failed'
      return 'pending'
    }

    if (Array.isArray(directoryResults) && directoryResults.length > 0) {
      const rows = directoryResults.map((r: any) => ({
        job_id: actualJobId,
        directory_name: r.directoryName || r.directory_name,
        status: toJobResultStatus(r.status),
        directory_url: r.directoryUrl || r.directory_url,
        listing_url: r.listingUrl || r.listing_url,
        response_log: r.responseLog || r.response_log || null,
        rejection_reason: r.rejectionReason || r.rejection_reason || null
      }))
      
      console.log('[jobs/update] Inserting directory results:', rows.length)
      const { error: insertErr } = await supabase.from('job_results').insert(rows)
      if (insertErr) {
        console.warn('[jobs/update] job_results insert warning', insertErr.message)
      }
    }

    // 2) Aggregate progress from job_results
    const { data: jrAgg, error: jrErr } = await supabase
      .from('job_results')
      .select('status')
      .eq('job_id', actualJobId)
    if (jrErr) {
      console.warn('[jobs/update] job_results aggregation warning', jrErr.message)
    }
    const total = (jrAgg || []).length
    const completed = (jrAgg || []).filter((r: any) => r.status === 'submitted').length
    const failed = (jrAgg || []).filter((r: any) => r.status === 'failed').length
    const progressPct = total > 0 ? Math.min(100, Math.round(((completed + failed) / total) * 100)) : undefined

    // 3) Update jobs row with status/metadata
    const updatedAt = new Date().toISOString()
    const metadata: Record<string, unknown> = {}
    if (typeof progressPct === 'number') metadata['progress_percentage'] = progressPct
    if (typeof completed === 'number') metadata['directories_completed'] = completed
    if (typeof total === 'number') metadata['directories_total'] = total
    if (Array.isArray(directoryResults) && directoryResults.length > 0) {
      metadata['last_directory'] = directoryResults[directoryResults.length - 1]?.directoryName
    }

    const updatePayload: any = {
      updated_at: updatedAt,
      metadata
    }
    if (status) updatePayload.status = status
    if (status === 'complete') updatePayload.completed_at = updatedAt
    if (typeof errorMessage === 'string' && errorMessage.trim().length > 0) {
      updatePayload.error_message = errorMessage.trim()
    }

    const { data, error: updErr } = await supabase
      .from('jobs')
      .update(updatePayload)
      .eq('id', actualJobId)
      .select('id, status, customer_id, metadata')
      .maybeSingle()

    if (updErr) {
      console.error('[jobs/update] jobs update failed', updErr)
      return res.status(500).json({ success: false, error: 'Failed to update job', details: updErr.message })
    }
    
    if (!data) {
      console.error('[jobs/update] No job found with ID:', actualJobId)
      return res.status(404).json({ success: false, error: 'Job not found', details: `No job found with ID: ${actualJobId}` })
    }

    console.log('[jobs/update] Success:', data)
    return res.status(200).json({
      success: true,
      data: data,
      message: `Job ${actualJobId} updated successfully.`
    })
  } catch (error) {
    console.error('[jobs/update] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[jobs/update] Error details:', errorMessage, errorStack)
    
    // Log the full error object for debugging
    console.error('[jobs/update] Full error object:', JSON.stringify(error, null, 2))
    
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to update job',
      details: errorMessage,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    })
  }
}