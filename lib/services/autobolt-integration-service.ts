// AutoBolt Extension Integration Service
// Handles communication between DirectoryBolt and the Chrome extension

import { createClient } from '@supabase/supabase-js'

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

export interface CustomerData {
  customer_id: string
  business_name: string
  business_website: string
  business_phone: string
  business_address: string
  business_city: string
  business_state: string
  business_zip: string
  business_description: string
  business_category: string
  package_type: string
  directory_limit: number
  priority_level: number
}

export interface DirectorySubmission {
  id: string
  customer_id: string
  directory_name: string
  directory_url: string
  submission_status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'processing'
  submitted_at?: string
  approved_at?: string
  listing_url?: string
  rejection_reason?: string
  domain_authority?: number
  estimated_traffic?: number
  category: string
  tier: 'standard' | 'premium' | 'enterprise'
  metadata: Record<string, any>
}

export class AutoBoltIntegrationService {
  /**
   * Get customer data for AutoBolt extension
   */
  static async getCustomerData(customerId: string): Promise<CustomerData | null> {
    try {
      const { data, error } = await (supabase as any)
        .from('customers')
        .select(`
          customer_id,
          business_name,
          business_website,
          business_phone,
          business_address,
          business_city,
          business_state,
          business_zip,
          business_description,
          business_category,
          package_type,
          total_directories_allocated,
          priority_level
        `)
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .single()

      if (error || !data) {
        console.error('❌ Failed to get customer data:', error)
        return null
      }

      return {
        customer_id: data.customer_id,
        business_name: data.business_name,
        business_website: data.business_website,
        business_phone: data.business_phone,
        business_address: data.business_address,
        business_city: data.business_city,
        business_state: data.business_state,
        business_zip: data.business_zip,
        business_description: data.business_description,
        business_category: data.business_category,
        package_type: data.package_type,
        directory_limit: data.total_directories_allocated,
        priority_level: data.priority_level
      }
    } catch (error) {
      console.error('❌ Error getting customer data:', error)
      return null
    }
  }

  /**
   * Get pending directory submissions for a customer
   */
  static async getPendingSubmissions(customerId: string): Promise<DirectorySubmission[]> {
    try {
      const { data, error } = await (supabase as any)
        .from('directory_submissions')
        .select('*')
        .eq('customer_id', customerId)
        .eq('submission_status', 'pending')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ Failed to get pending submissions:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('❌ Error getting pending submissions:', error)
      return []
    }
  }

  /**
   * Update directory submission status
   */
  static async updateSubmissionStatus(
    submissionId: string,
    status: DirectorySubmission['submission_status'],
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      const updateData: any = {
        submission_status: status,
        updated_at: new Date().toISOString(),
        metadata: metadata
      }

      if (status === 'submitted') {
        updateData.submitted_at = new Date().toISOString()
      } else if (status === 'approved') {
        updateData.approved_at = new Date().toISOString()
      }

      const { error } = await (supabase as any)
        .from('directory_submissions')
        .update(updateData)
        .eq('id', submissionId)

      if (error) {
        console.error('❌ Failed to update submission status:', error)
        return false
      }

      console.log(`✅ Updated submission ${submissionId} to status: ${status}`)
      return true
    } catch (error) {
      console.error('❌ Error updating submission status:', error)
      return false
    }
  }

  /**
   * Create directory submissions for a customer
   */
  static async createDirectorySubmissions(
    customerId: string,
    directories: Array<{
      name: string
      url: string
      category: string
      tier: 'standard' | 'premium' | 'enterprise'
      domain_authority?: number
      estimated_traffic?: number
    }>
  ): Promise<boolean> {
    try {
      const submissions = directories.map(dir => ({
        id: crypto.randomUUID(),
        customer_id: customerId,
        directory_name: dir.name,
        directory_url: dir.url,
        submission_status: 'pending' as const,
        category: dir.category,
        tier: dir.tier,
        domain_authority: dir.domain_authority || 0,
        estimated_traffic: dir.estimated_traffic || 0,
        metadata: {
          created_by: 'autobolt_system',
          created_at: new Date().toISOString()
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      const { error } = await (supabase as any)
        .from('directory_submissions')
        .insert(submissions)

      if (error) {
        console.error('❌ Failed to create directory submissions:', error)
        return false
      }

      console.log(`✅ Created ${submissions.length} directory submissions for customer ${customerId}`)
      return true
    } catch (error) {
      console.error('❌ Error creating directory submissions:', error)
      return false
    }
  }

  /**
   * Update customer progress
   */
  static async updateCustomerProgress(
    customerId: string,
    directoriesCompleted: number,
    directoriesFailed: number
  ): Promise<boolean> {
    try {
      const { error } = await (supabase as any)
        .from('customers')
        .update({
          directories_submitted: directoriesCompleted,
          failed_directories: directoriesFailed,
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', customerId)

      if (error) {
        console.error('❌ Failed to update customer progress:', error)
        return false
      }

      // Update queue history
      await (supabase as any)
        .from('queue_history')
        .insert([{
          id: crypto.randomUUID(),
          customer_id: customerId,
          status_from: 'processing',
          status_to: directoriesCompleted > 0 ? 'completed' : 'processing',
          directories_processed: directoriesCompleted,
          directories_failed: directoriesFailed,
          processing_time_seconds: 0, // Will be calculated by AutoBolt
          metadata: {
            updated_by: 'autobolt_extension',
            update_type: 'progress_update'
          },
          created_at: new Date().toISOString()
        }])

      console.log(`✅ Updated progress for customer ${customerId}: ${directoriesCompleted} completed, ${directoriesFailed} failed`)
      return true
    } catch (error) {
      console.error('❌ Error updating customer progress:', error)
      return false
    }
  }

  /**
   * Get processing queue for AutoBolt extension
   */
  static async getProcessingQueue(): Promise<Array<{
    customer_id: string
    business_name: string
    package_type: string
    priority_level: number
    directories_remaining: number
    created_at: string
  }>> {
    try {
      const { data, error } = await (supabase as any)
        .from('customers')
        .select(`
          customer_id,
          business_name,
          package_type,
          priority_level,
          total_directories_allocated,
          directories_submitted,
          created_at
        `)
        .eq('status', 'active')
        .order('priority_level', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ Failed to get processing queue:', error)
        return []
      }

      const customers = (data || []).filter((customer) => {
        const total = customer.total_directories_allocated ?? 0
        const submitted = customer.directories_submitted ?? 0
        return submitted < total
      })

      return customers.map(customer => ({
        customer_id: customer.customer_id,
        business_name: customer.business_name,
        package_type: customer.package_type,
        priority_level: customer.priority_level,
        directories_remaining: customer.total_directories_allocated - customer.directories_submitted,
        created_at: customer.created_at
      }))
    } catch (error) {
      console.error('❌ Error getting processing queue:', error)
      return []
    }
  }

  /**
   * Create customer notification
   */
  static async createNotification(
    customerId: string,
    type: 'success' | 'warning' | 'info' | 'error',
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string
  ): Promise<boolean> {
    try {
      const { error } = await (supabase as any)
        .from('customer_notifications')
        .insert([{
          id: crypto.randomUUID(),
          customer_id: customerId,
          notification_type: type,
          title,
          message,
          action_url: actionUrl,
          action_text: actionText,
          read: false,
          created_at: new Date().toISOString()
        }])

      if (error) {
        console.error('❌ Failed to create notification:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Error creating notification:', error)
      return false
    }
  }

  /**
   * Log analytics event
   */
  static async logEvent(
    customerId: string,
    eventType: string,
    eventName: string,
    eventData: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      const { error } = await (supabase as any)
        .from('analytics_events')
        .insert([{
          id: crypto.randomUUID(),
          customer_id: customerId,
          event_type: eventType,
          event_name: eventName,
          event_data: eventData,
          created_at: new Date().toISOString()
        }])

      if (error) {
        console.error('❌ Failed to log analytics event:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Error logging analytics event:', error)
      return false
    }
  }
}
