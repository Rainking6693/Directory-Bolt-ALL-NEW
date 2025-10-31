import type { SupabaseClient } from '@supabase/supabase-js'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Status type definitions for compatibility
export type JobStatus = 'pending' | 'in_progress' | 'complete' | 'failed'
export type JobResultStatus = 'pending' | 'submitted' | 'failed' | 'retry'

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      autobolt_processing_queue: {
        Row: {
          completed_at: string | null
          created_at: string | null
          customer_id: string
          directory_limit: number
          error_message: string | null
          id: number
          priority_level: number | null
          processed_by: string | null
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          customer_id: string
          directory_limit?: number
          error_message?: string | null
          id?: number
          priority_level?: number | null
          processed_by?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string
          directory_limit?: number
          error_message?: string | null
          id?: number
          priority_level?: number | null
          processed_by?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      autobolt_submission_logs: {
        Row: {
          action: string | null
          created_at: string | null
          customer_id: string | null
          details: Json | null
          directory_name: string
          error_message: string | null
          id: string
          job_id: string | null
          processing_time_ms: number | null
          screenshot_url: string | null
          success: boolean | null
          timestamp: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          customer_id?: string | null
          details?: Json | null
          directory_name: string
          error_message?: string | null
          id?: string
          job_id?: string | null
          processing_time_ms?: number | null
          screenshot_url?: string | null
          success?: boolean | null
          timestamp?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          customer_id?: string | null
          details?: Json | null
          directory_name?: string
          error_message?: string | null
          id?: string
          job_id?: string | null
          processing_time_ms?: number | null
          screenshot_url?: string | null
          success?: boolean | null
          timestamp?: string | null
        }
        Relationships: []
      }
      autobolt_test_logs: {
        Row: {
          created_at: string | null
          directory_count: number
          id: number
          status: string
          test_customer_id: string
          test_job_id: number | null
          test_name: string
          test_type: string | null
        }
        Insert: {
          created_at?: string | null
          directory_count: number
          id?: number
          status?: string
          test_customer_id: string
          test_job_id?: number | null
          test_name: string
          test_type?: string | null
        }
        Update: {
          created_at?: string | null
          directory_count?: number
          id?: number
          status?: string
          test_customer_id?: string
          test_job_id?: number | null
          test_name?: string
          test_type?: string | null
        }
        Relationships: []
      }
      batch_operations: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          customer_ids: Json
          error_message: string | null
          failed_operations: number | null
          id: string
          operation_type: string
          processed_customers: number | null
          started_at: string | null
          status: string | null
          successful_operations: number | null
          total_customers: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_ids: Json
          error_message?: string | null
          failed_operations?: number | null
          id?: string
          operation_type: string
          processed_customers?: number | null
          started_at?: string | null
          status?: string | null
          successful_operations?: number | null
          total_customers: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_ids?: Json
          error_message?: string | null
          failed_operations?: number | null
          id?: string
          operation_type?: string
          processed_customers?: number | null
          started_at?: string | null
          status?: string | null
          successful_operations?: number | null
          total_customers?: number
        }
        Relationships: []
      }
      customer_notifications: {
        Row: {
          action_text: string | null
          action_url: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          message: string
          notification_type: string
          read: boolean | null
          title: string
        }
        Insert: {
          action_text?: string | null
          action_url?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          message: string
          notification_type: string
          read?: boolean | null
          title: string
        }
        Update: {
          action_text?: string | null
          action_url?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          message?: string
          notification_type?: string
          read?: boolean | null
          title?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          business_data: Json | null
          business_name: string
          category: string | null
          city: string | null
          country: string | null
          created_at: string | null
          customer_id: string
          description: string | null
          directory_limit: number | null
          email: string
          package_type: string | null
          phone: string | null
          state: string | null
          status: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          business_data?: Json | null
          business_name: string
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          customer_id: string
          description?: string | null
          directory_limit?: number | null
          email: string
          package_type?: string | null
          phone?: string | null
          state?: string | null
          status?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          business_data?: Json | null
          business_name?: string
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          customer_id?: string
          description?: string | null
          directory_limit?: number | null
          email?: string
          package_type?: string | null
          phone?: string | null
          state?: string | null
          status?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      directories: {
        Row: {
          active: boolean
          category: string
          country_code: string | null
          created_at: string | null
          description: string | null
          difficulty: string | null
          domain_authority: number | null
          estimated_traffic: number | null
          failure_rate: number | null
          features: Json | null
          field_selectors: Json | null
          has_captcha: boolean | null
          id: string
          impact_level: string | null
          language: string | null
          name: string
          requires_approval: boolean | null
          requires_login: boolean | null
          selector_discovery_log: Json | null
          selectors_updated_at: string | null
          submission_url: string | null
          tier_required: number | null
          time_to_approval: string | null
          updated_at: string | null
          website: string
        }
        Insert: {
          active?: boolean
          category: string
          country_code?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          domain_authority?: number | null
          estimated_traffic?: number | null
          failure_rate?: number | null
          features?: Json | null
          field_selectors?: Json | null
          has_captcha?: boolean | null
          id?: string
          impact_level?: string | null
          language?: string | null
          name: string
          requires_approval?: boolean | null
          requires_login?: boolean | null
          selector_discovery_log?: Json | null
          selectors_updated_at?: string | null
          submission_url?: string | null
          tier_required?: number | null
          time_to_approval?: string | null
          updated_at?: string | null
          website: string
        }
        Update: {
          active?: boolean
          category?: string
          country_code?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          domain_authority?: number | null
          estimated_traffic?: number | null
          failure_rate?: number | null
          features?: Json | null
          field_selectors?: Json | null
          has_captcha?: boolean | null
          id?: string
          impact_level?: string | null
          language?: string | null
          name?: string
          requires_approval?: boolean | null
          requires_login?: boolean | null
          selector_discovery_log?: Json | null
          selectors_updated_at?: string | null
          submission_url?: string | null
          tier_required?: number | null
          time_to_approval?: string | null
          updated_at?: string | null
          website?: string
        }
        Relationships: []
      }
      directory_form_mappings: {
        Row: {
          created_at: string | null
          directory_url: string
          field_mappings: Json
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          directory_url: string
          field_mappings: Json
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          directory_url?: string
          field_mappings?: Json
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      directory_overrides: {
        Row: {
          created_at: string | null
          directory_id: string
          enabled: boolean | null
          id: string
          max_retries: number | null
          pacing_max_ms: number | null
          pacing_min_ms: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          directory_id: string
          enabled?: boolean | null
          id?: string
          max_retries?: number | null
          pacing_max_ms?: number | null
          pacing_min_ms?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          directory_id?: string
          enabled?: boolean | null
          id?: string
          max_retries?: number | null
          pacing_max_ms?: number | null
          pacing_min_ms?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      directory_submissions: {
        Row: {
          created_at: string | null
          customer_id: string | null
          customer_job_id: string | null
          directory_category: string | null
          directory_tier: string | null
          directory_url: string
          error_message: string | null
          id: string
          listing_data: Json | null
          processing_time_seconds: number | null
          result_message: string | null
          status: string | null
          submission_queue_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          customer_job_id?: string | null
          directory_category?: string | null
          directory_tier?: string | null
          directory_url: string
          error_message?: string | null
          id?: string
          listing_data?: Json | null
          processing_time_seconds?: number | null
          result_message?: string | null
          status?: string | null
          submission_queue_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          customer_job_id?: string | null
          directory_category?: string | null
          directory_tier?: string | null
          directory_url?: string
          error_message?: string | null
          id?: string
          listing_data?: Json | null
          processing_time_seconds?: number | null
          result_message?: string | null
          status?: string | null
          submission_queue_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_directory_submissions_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "fk_directory_submissions_job_queue"
            columns: ["submission_queue_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_dirsubs_job"
            columns: ["submission_queue_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_results: {
        Row: {
          created_at: string | null
          directory_name: string | null
          directory_url: string | null
          error_message: string | null
          id: number
          job_id: number
          processing_time_seconds: number | null
          status: string
          submission_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          directory_name?: string | null
          directory_url?: string | null
          error_message?: string | null
          id?: number
          job_id: number
          processing_time_seconds?: number | null
          status?: string
          submission_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          directory_name?: string | null
          directory_url?: string | null
          error_message?: string | null
          id?: number
          job_id?: number
          processing_time_seconds?: number | null
          status?: string
          submission_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      job_results_count: {
        Row: {
          count: number | null
        }
        Insert: {
          count?: number | null
        }
        Update: {
          count?: number | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          address: string | null
          business_address: string | null
          business_category: string | null
          business_city: string | null
          business_data: Json | null
          business_description: string | null
          business_email: string | null
          business_name: string | null
          business_phone: string | null
          business_state: string | null
          business_website: string | null
          business_zip: string | null
          category: string | null
          city: string | null
          completed_at: string | null
          created_at: string
          customer_email: string | null
          customer_id: string
          customer_name: string | null
          customer_uuid: string | null
          description: string | null
          directory_limit: number
          email: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          package_size: number
          package_type: string
          phone: string | null
          priority_level: number | null
          started_at: string | null
          state: string | null
          status: string
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          business_address?: string | null
          business_category?: string | null
          business_city?: string | null
          business_data?: Json | null
          business_description?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_state?: string | null
          business_website?: string | null
          business_zip?: string | null
          category?: string | null
          city?: string | null
          completed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id: string
          customer_name?: string | null
          customer_uuid?: string | null
          description?: string | null
          directory_limit?: number
          email?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          package_size: number
          package_type?: string
          phone?: string | null
          priority_level?: number | null
          started_at?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          business_address?: string | null
          business_category?: string | null
          business_city?: string | null
          business_data?: Json | null
          business_description?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_state?: string | null
          business_website?: string | null
          business_zip?: string | null
          category?: string | null
          city?: string | null
          completed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string
          customer_name?: string | null
          customer_uuid?: string | null
          description?: string | null
          directory_limit?: number
          email?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          package_size?: number
          package_type?: string
          phone?: string | null
          priority_level?: number | null
          started_at?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      legacy_submissions_count: {
        Row: {
          count: number | null
        }
        Insert: {
          count?: number | null
        }
        Update: {
          count?: number | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          id: string
          package_type: string | null
          status: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          id?: string
          package_type?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          id?: string
          package_type?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: []
      }
      queue_history: {
        Row: {
          created_at: string | null
          customer_id: string | null
          directories_failed: number | null
          directories_processed: number | null
          error_message: string | null
          id: string
          metadata: Json | null
          processing_time_seconds: number | null
          status_from: string | null
          status_to: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          directories_failed?: number | null
          directories_processed?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processing_time_seconds?: number | null
          status_from?: string | null
          status_to: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          directories_failed?: number | null
          directories_processed?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processing_time_seconds?: number | null
          status_from?: string | null
          status_to?: string
        }
        Relationships: []
      }
      system_flags: {
        Row: {
          created_at: string | null
          description: string | null
          flag_key: string
          flag_value: Json | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          flag_key: string
          flag_value?: Json | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          flag_key?: string
          flag_value?: Json | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      two_factor_requests: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          customer_id: string | null
          details: Json | null
          directory_name: string | null
          id: string
          job_id: string | null
          request_type: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          customer_id?: string | null
          details?: Json | null
          directory_name?: string | null
          id?: string
          job_id?: string | null
          request_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          customer_id?: string | null
          details?: Json | null
          directory_name?: string | null
          id?: string
          job_id?: string | null
          request_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "two_factor_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string | null
          id: string
          payload: Json | null
          processed: boolean | null
          provider: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          provider?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          provider?: string | null
        }
        Relationships: []
      }
      worker_heartbeats: {
        Row: {
          ai_services_enabled: boolean | null
          created_at: string | null
          jobs_processed: number | null
          last_seen: string
          metadata: Json | null
          status: string
          updated_at: string | null
          worker_id: string
        }
        Insert: {
          ai_services_enabled?: boolean | null
          created_at?: string | null
          jobs_processed?: number | null
          last_seen: string
          metadata?: Json | null
          status: string
          updated_at?: string | null
          worker_id: string
        }
        Update: {
          ai_services_enabled?: boolean | null
          created_at?: string | null
          jobs_processed?: number | null
          last_seen?: string
          metadata?: Json | null
          status?: string
          updated_at?: string | null
          worker_id?: string
        }
        Relationships: []
      }
      worker_status: {
        Row: {
          desired_state: string | null
          last_heartbeat: string
          status: string | null
          worker_id: string
        }
        Insert: {
          desired_state?: string | null
          last_heartbeat: string
          status?: string | null
          worker_id: string
        }
        Update: {
          desired_state?: string | null
          last_heartbeat?: string
          status?: string | null
          worker_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_autobolt_job:
        | {
            Args: {
              error_message_param?: string
              final_status_param?: string
              job_id_param: string
            }
            Returns: boolean
          }
        | {
            Args: {
              error_message_param?: string
              final_status_param?: string
              job_id_param: string
            }
            Returns: boolean
          }
      generate_customer_id: { Args: never; Returns: string }
      get_job_progress_for_staff: {
        Args: never
        Returns: {
          business_name: string
          completed_directories: number
          created_at: string
          customer_id: string
          estimated_completion: string
          failed_directories: number
          job_id: string
          priority_level: number
          progress_percentage: number
          status: string
          total_directories: number
          updated_at: string
        }[]
      }
      get_job_queue_stats: {
        Args: never
        Returns: {
          total_complete: number
          total_failed: number
          total_in_progress: number
          total_pending: number
        }[]
      }
      get_next_job_in_queue: {
        Args: never
        Returns: {
          created_at: string
          customer_id: string
          id: string
          metadata: Json
          package_size: number
          priority_level: number
          status: string
        }[]
      }
      get_queue_status_counts: {
        Args: never
        Returns: {
          count: number
          status: string
        }[]
      }
      get_stale_selector_directories: {
        Args: { days_old?: number }
        Returns: {
          days_since_update: number
          id: string
          name: string
          submission_url: string
        }[]
      }
      mark_job_in_progress:
        | {
            Args: { extension_id: string; job_id_param: string }
            Returns: boolean
          }
        | { Args: { job_id_param: string }; Returns: boolean }
      select_pending_jobs: {
        Args: { _limit?: number }
        Returns: {
          created_at: string
          customer_id: string
          id: string
          package_size: number
          status: string
        }[]
      }
      update_directory_selectors: {
        Args: { dir_id: string; discovery_log: Json; new_selectors: Json }
        Returns: undefined
      }
      update_job_progress:
        | {
            Args: {
              directory_name_param: string
              error_message_param?: string
              job_id_param: string
              listing_url_param?: string
              submission_status_param: string
            }
            Returns: boolean
          }
        | {
            Args: {
              directory_name_param: string
              job_id_param: string
              response_log_param?: Json
              submission_status_param: string
              submitted_at_param?: string
            }
            Returns: boolean
          }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

// Compatibility aliases for existing codebase
export type DirectoryBoltDatabase = Database

export type JobsRow = Database['public']['Tables']['jobs']['Row']
export type JobsInsert = Database['public']['Tables']['jobs']['Insert']
export type JobsUpdate = Database['public']['Tables']['jobs']['Update']

export type JobResultsRow = Database['public']['Tables']['job_results']['Row']
export type JobResultsInsert = Database['public']['Tables']['job_results']['Insert']
export type JobResultsUpdate = Database['public']['Tables']['job_results']['Update']

export type DirectoriesRow = Database['public']['Tables']['directories']['Row']
export type DirectoriesInsert = Database['public']['Tables']['directories']['Insert']
export type DirectoriesUpdate = Database['public']['Tables']['directories']['Update']
