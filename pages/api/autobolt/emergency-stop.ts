// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const emergencyStopTimestamp = new Date().toISOString()

      // 1. Set emergency stop flag in system config
      await supabase.from('autobolt_system_config').upsert([{
        key: 'emergency_stop',
        value: JSON.stringify({
          enabled: true,
          timestamp: emergencyStopTimestamp,
          initiated_by: 'admin'
        }),
        updated_at: emergencyStopTimestamp
      }])

      // 2. Send stop command to all active extensions
      await supabase.from('autobolt_commands').insert([{
        command: 'emergency_stop',
        parameters: { 
          reason: 'Emergency stop initiated by admin',
          timestamp: emergencyStopTimestamp
        },
        status: 'pending',
        priority: 'critical',
        created_at: emergencyStopTimestamp
      }])

      // 3. Update all processing customers to 'paused' status
      const { data: processingCustomers } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('status', 'processing')

      if (processingCustomers && processingCustomers.length > 0) {
        await supabase
          .from('customers')
          .update({ 
            status: 'paused',
            pause_reason: 'Emergency stop',
            paused_at: emergencyStopTimestamp
          })
          .eq('status', 'processing')
      }

      // 4. Log all active queue items as paused
      await supabase.from('queue_history').insert(
        (processingCustomers || []).map(customer => ({
          id: crypto.randomUUID(),
          customer_id: customer.customer_id,
          status_from: 'processing',
          status_to: 'paused',
          directories_processed: 0,
          directories_failed: 0,
          processing_time_seconds: 0,
          metadata: {
            emergency_stop: true,
            stop_reason: 'Emergency stop initiated by admin',
            stopped_at: emergencyStopTimestamp
          },
          created_at: emergencyStopTimestamp
        }))
      )

      // 5. Create emergency activity log entry
      await supabase.from('autobolt_activity_log').insert([{
        action: 'Emergency Stop Initiated',
        directory: null,
        customer_id: null,
        status: 'critical',
        details: `Emergency stop activated. ${processingCustomers?.length || 0} customers paused.`,
        metadata: {
          customers_affected: processingCustomers?.length || 0,
          emergency_stop: true,
          initiated_by: 'admin'
        }
      }])

      // 6. Create system alert
      await supabase.from('system_alerts').insert([{
        alert_type: 'emergency_stop',
        severity: 'critical',
        title: 'Emergency Stop Activated',
        message: `All AutoBolt processing has been halted. ${processingCustomers?.length || 0} customers were processing and have been paused.`,
        metadata: {
          customers_affected: processingCustomers?.length || 0,
          stop_timestamp: emergencyStopTimestamp
        },
        resolved: false,
        created_at: emergencyStopTimestamp
      }])

      res.status(200).json({
        success: true,
        message: 'Emergency stop initiated successfully',
        details: {
          timestamp: emergencyStopTimestamp,
          customersAffected: processingCustomers?.length || 0,
          actions: [
            'Emergency stop flag enabled',
            'Stop commands sent to extensions',
            'Processing customers paused',
            'System alerts created'
          ]
        }
      })

    } catch (error) {
      console.error('Error executing emergency stop:', error)
      
      // Log the emergency stop failure
      await supabase.from('autobolt_error_log').insert([{
        error_message: `Emergency stop failed: ${error.message}`,
        stack_trace: error.stack,
        context: {
          action: 'emergency_stop',
          critical: true
        }
      }]).catch(console.error)

      res.status(500).json({
        success: false,
        error: 'Failed to execute emergency stop',
        details: error.message
      })
    }
  } else if (req.method === 'DELETE') {
    try {
      // Clear emergency stop - resume operations
      await supabase.from('autobolt_system_config').upsert([{
        key: 'emergency_stop',
        value: JSON.stringify({
          enabled: false,
          cleared_at: new Date().toISOString(),
          cleared_by: 'admin'
        }),
        updated_at: new Date().toISOString()
      }])

      // Resume paused customers
      const { data: pausedCustomers } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('status', 'paused')
        .eq('pause_reason', 'Emergency stop')

      if (pausedCustomers && pausedCustomers.length > 0) {
        await supabase
          .from('customers')
          .update({ 
            status: 'pending',
            pause_reason: null,
            paused_at: null,
            resumed_at: new Date().toISOString()
          })
          .eq('status', 'paused')
          .eq('pause_reason', 'Emergency stop')
      }

      // Log the resumption
      await supabase.from('autobolt_activity_log').insert([{
        action: 'Emergency Stop Cleared',
        directory: null,
        customer_id: null,
        status: 'success',
        details: `Emergency stop cleared. ${pausedCustomers?.length || 0} customers resumed.`,
        metadata: {
          customers_resumed: pausedCustomers?.length || 0,
          cleared_by: 'admin'
        }
      }])

      res.status(200).json({
        success: true,
        message: 'Emergency stop cleared successfully',
        details: {
          customersResumed: pausedCustomers?.length || 0
        }
      })

    } catch (error) {
      console.error('Error clearing emergency stop:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to clear emergency stop'
      })
    }
  } else if (req.method === 'GET') {
    try {
      // Check emergency stop status
      const { data } = await supabase
        .from('autobolt_system_config')
        .select('value')
        .eq('key', 'emergency_stop')
        .single()

      const emergencyStopData = data?.value ? JSON.parse(data.value) : { enabled: false }

      res.status(200).json({
        success: true,
        emergencyStop: emergencyStopData
      })

    } catch (error) {
      console.error('Error checking emergency stop status:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to check emergency stop status'
      })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}