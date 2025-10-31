import type { SupabaseClient } from '@supabase/supabase-js'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export type JobStatus = 'pending' | 'in_progress' | 'complete' | 'failed'
export type JobResultStatus = 'pending' | 'submitted' | 'failed' | 'retry'

export interface JobsRow {
  id: string
  customer_id: string
  package_size: number
  priority_level: number
  status: JobStatus
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  metadata: Json | null
  business_name: string | null
  business_address: string | null
  business_city: string | null
  business_state: string | null
  business_zip: string | null
  business_phone: string | null
  business_email: string | null
  business_website: string | null
  business_description: string | null
}

export type JobsInsert = {
  id?: string
  customer_id: string
  package_size: number
  priority_level?: number
  status?: JobStatus
  created_at?: string
  updated_at?: string
  started_at?: string | null
  completed_at?: string | null
  error_message?: string | null
  metadata?: Json | null
  business_name?: string | null
  business_address?: string | null
  business_city?: string | null
  business_state?: string | null
  business_zip?: string | null
  business_phone?: string | null
  business_email?: string | null
  business_website?: string | null
  business_description?: string | null
}

export type JobsUpdate = {
  id?: string
  customer_id?: string
  package_size?: number
  priority_level?: number
  status?: JobStatus
  created_at?: string
  updated_at?: string
  started_at?: string | null
  completed_at?: string | null
  error_message?: string | null
  metadata?: Json | null
  business_name?: string | null
  business_address?: string | null
  business_city?: string | null
  business_state?: string | null
  business_zip?: string | null
  business_phone?: string | null
  business_email?: string | null
  business_website?: string | null
  business_description?: string | null
}

export interface JobResultsRow {
  id: string
  job_id: string
  directory_name: string
  status: JobResultStatus
  response_log: Json | null
  submitted_at: string | null
  retry_count: number
  updated_at: string
}

export type JobResultsInsert = {
  id?: string
  job_id: string
  directory_name: string
  status: JobResultStatus
  response_log?: Json | null
  submitted_at?: string | null
  retry_count?: number
  updated_at?: string
}

export type JobResultsUpdate = {
  id?: string
  job_id?: string
  directory_name?: string
  status?: JobResultStatus
  response_log?: Json | null
  submitted_at?: string | null
  retry_count?: number
  updated_at?: string
}

// Directory types with selector discovery fields
export interface DirectoriesRow {
  id: string
  name: string
  correct_submission_url?: string
  submission_url?: string
  category?: string | null
  domain_authority?: number | null
  impact_level?: string | null
  tier_level?: string | null
  difficulty?: number | null
  traffic_estimate?: number | null
  time_to_approval?: number | null
  has_captcha?: boolean | null
  active?: boolean | null
  pacing_min_ms?: number | null
  pacing_max_ms?: number | null
  max_retries?: number | null
  // Selector discovery fields (from migration 016)
  field_selectors?: Json | null
  selectors_updated_at?: string | null
  selector_discovery_log?: Json | null
  requires_login?: boolean | null
  failure_rate?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export type DirectoriesInsert = {
  id?: string
  name: string
  correct_submission_url?: string
  submission_url?: string
  category?: string | null
  domain_authority?: number | null
  impact_level?: string | null
  tier_level?: string | null
  difficulty?: number | null
  traffic_estimate?: number | null
  time_to_approval?: number | null
  has_captcha?: boolean | null
  active?: boolean | null
  pacing_min_ms?: number | null
  pacing_max_ms?: number | null
  max_retries?: number | null
  field_selectors?: Json | null
  selectors_updated_at?: string | null
  selector_discovery_log?: Json | null
  requires_login?: boolean | null
  failure_rate?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export type DirectoriesUpdate = {
  id?: string
  name?: string
  correct_submission_url?: string
  submission_url?: string
  category?: string | null
  domain_authority?: number | null
  impact_level?: string | null
  tier_level?: string | null
  difficulty?: number | null
  traffic_estimate?: number | null
  time_to_approval?: number | null
  has_captcha?: boolean | null
  active?: boolean | null
  pacing_min_ms?: number | null
  pacing_max_ms?: number | null
  max_retries?: number | null
  field_selectors?: Json | null
  selectors_updated_at?: string | null
  selector_discovery_log?: Json | null
  requires_login?: boolean | null
  failure_rate?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export type DirectoryBoltDatabase = {
  public: {
    Tables: {
      jobs: {
        Row: JobsRow
        Insert: JobsInsert
        Update: JobsUpdate
        Relationships: [
          {
            foreignKeyName: 'jobs_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          }
        ]
      }
      job_results: {
        Row: JobResultsRow
        Insert: JobResultsInsert
        Update: JobResultsUpdate
        Relationships: [
          {
            foreignKeyName: 'job_results_job_id_fkey'
            columns: ['job_id']
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          }
        ]
      }
      directories: {
        Row: DirectoriesRow
        Insert: DirectoriesInsert
        Update: DirectoriesUpdate
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      update_directory_selectors: {
        Args: {
          dir_id: string
          new_selectors: Json
          discovery_log: Json
        }
        Returns: void
      }
      get_stale_selector_directories: {
        Args: {
          days_old?: number
        }
        Returns: {
          id: string
          name: string
          submission_url: string
          days_since_update: number
        }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type DirectoryBoltSupabaseClient = SupabaseClient<DirectoryBoltDatabase, 'public', any, any, any>



