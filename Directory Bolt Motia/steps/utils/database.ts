import type { SupabaseLike } from './supabaseClient'
import { getSupabaseClient } from './supabaseClient'

// Database utility for DirectoryBolt
export class DirectoryBoltDB {
  private supabase: SupabaseLike

  constructor(supabaseUrl: string, supabaseKey: string) {
    // Prefer real Supabase when credentials are available, otherwise use a safe mock
    this.supabase = supabaseUrl && supabaseKey ? getSupabaseClient() : getSupabaseClient()
  }

  // Customer-specific database operations
  async getCustomerById(customerId: string) {
    const { data, error } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (error) throw new Error(`Failed to fetch customer: ${error.message}`)
    return data
  }

  async getCustomerJobs(customerId: string) {
    const { data, error } = await this.supabase
      .from('jobs')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch customer jobs: ${error.message}`)
    return data
  }

  async getJobResults(jobId: string) {
    const { data, error } = await this.supabase
      .from('job_results')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch job results: ${error.message}`)
    return data
  }

  async getCustomerDirectories(customerId: string) {
    const { data: jobs, error: jobsError } = await this.supabase
      .from('jobs')
      .select('id')
      .eq('customer_id', customerId)

    if (jobsError) throw new Error(`Failed to fetch customer jobs: ${jobsError.message}`)

    if (!jobs || jobs.length === 0) return []

    const jobIds = jobs.map((job: any) => job.id)

    const { data: results, error: resultsError } = await this.supabase
      .from('job_results')
      .select('directory_name, status, created_at')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false })

    if (resultsError) throw new Error(`Failed to fetch job results: ${resultsError.message}`)

    return results
  }

  async getCustomerStats(customerId: string) {
    const { data: jobs, error } = await this.supabase
      .from('jobs')
      .select('status')
      .eq('customer_id', customerId)

    if (error) throw new Error(`Failed to fetch customer stats: ${error.message}`)

    const stats = {
      total: jobs?.length ?? 0,
      pending: (jobs ?? []).filter((j: any) => j.status === 'pending').length,
      in_progress: (jobs ?? []).filter((j: any) => j.status === 'in_progress').length,
      completed: (jobs ?? []).filter((j: any) => j.status === 'completed').length,
      failed: (jobs ?? []).filter((j: any) => j.status === 'failed').length,
    }

    return stats
  }
}
