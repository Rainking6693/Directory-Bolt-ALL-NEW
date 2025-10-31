/**
 * Helper function to create directory_submissions records for a new job
 * This populates the job with directories to submit to based on package size
 */

import { SupabaseClient } from '@supabase/supabase-js'

interface CreateDirectorySubmissionsParams {
  supabase: SupabaseClient
  jobId: string
  customerId: string
  packageSize: number
}

export async function createDirectorySubmissions({
  supabase,
  jobId,
  customerId,
  packageSize
}: CreateDirectorySubmissionsParams): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    console.log(`📋 Creating directory submissions for job ${jobId}, package size: ${packageSize}`)

    // Fetch active directories from the directories table
    const { data: directories, error: dirError } = await supabase
      .from('directories')
      .select('id, name, website, submission_url, category')
      .eq('active', true)
      .order('domain_authority', { ascending: false })
      .limit(packageSize)

    if (dirError) {
      console.error('❌ Failed to fetch directories:', dirError)
      return { success: false, count: 0, error: dirError.message }
    }

    if (!directories || directories.length === 0) {
      console.warn('⚠️ No active directories found in database')
      return { success: false, count: 0, error: 'No active directories available' }
    }

    console.log(`✅ Found ${directories.length} directories to submit to`)

    // Create directory_submissions records
    const submissions = directories.map(dir => ({
      submission_queue_id: jobId, // FK to jobs.id (UUID)
      customer_id: customerId, // FK to customers.customer_id (DIR-YYYYMMDD-XXXXXX)
      customer_job_id: customerId, // Also store customer_id for legacy compatibility
      directory_url: dir.submission_url || dir.website,
      status: 'pending',
      listing_data: {
        directory_name: dir.name,
        directory_id: dir.id,
        category: dir.category
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { data: created, error: insertError } = await supabase
      .from('directory_submissions')
      .insert(submissions)
      .select('id')

    if (insertError) {
      console.error('❌ Failed to create directory submissions:', insertError)
      return { success: false, count: 0, error: insertError.message }
    }

    console.log(`✅ Created ${created?.length || 0} directory submissions for job ${jobId}`)

    return { success: true, count: created?.length || 0 }
  } catch (error) {
    console.error('❌ Unexpected error creating directory submissions:', error)
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
