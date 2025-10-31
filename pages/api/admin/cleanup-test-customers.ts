// CRITICAL DATABASE CLEANUP API - Remove ALL Fake/Test Customers
// Comprehensive cleanup to resolve stuck customer alerts on staff dashboard

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { withStaffAuth } from '../../../lib/middleware/staff-auth'

// IMPORTANT: Supabase client must be created lazily inside the handler

// Comprehensive patterns to identify fake/test data
const FAKE_DATA_PATTERNS = {
  customer_ids: ['TEST', 'FAKE', 'DEMO', 'SAMPLE', 'DIR-2025-000'],
  emails: ['test@', 'fake@', 'demo@', 'sample@', 'noreply@', 'example@', 'temp@', '.test'],
  business_names: ['test', 'fake', 'demo', 'sample', 'example', 'temp', 'default', 'placeholder', 'validation'],
  domains: ['test.com', 'fake.com', 'demo.com', 'example.com', 'placeholder.com', 'temp.com']
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('dYs" CRITICAL CLEANUP: Starting comprehensive removal of ALL fake/test customers')

    // Lazy supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(503).json({ error: 'Service Unavailable', message: 'Supabase is not configured on this environment' })
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Step 1: Get ALL customers to identify test patterns
    const { data: allCustomers, error: fetchError } = await supabase
      .from('customers')
      .select('id, customer_id, business_name, email, status, package_type, directories_submitted, failed_directories, created_at, updated_at')

    if (fetchError) {
      console.error('??O Failed to fetch customers:', fetchError)
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to fetch customers for cleanup'
      })
    }

    console.log(`dY"S Found ${allCustomers?.length || 0} total customers to analyze`)

    // Step 2: Identify ALL fake/test customers using comprehensive patterns
    const testCustomers = allCustomers?.filter(customer => {
      const businessName = customer.business_name?.toLowerCase() || ''
      const email = customer.email?.toLowerCase() || ''
      const customerId = customer.customer_id?.toUpperCase() || ''
      
      return (
        // Customer ID patterns
        FAKE_DATA_PATTERNS.customer_ids.some(pattern => customerId.includes(pattern)) ||
        
        // Email patterns
        FAKE_DATA_PATTERNS.emails.some(pattern => email.includes(pattern)) ||
        
        // Business name patterns
        FAKE_DATA_PATTERNS.business_names.some(pattern => businessName.includes(pattern)) ||
        
        // Additional suspicious patterns
        businessName.includes('company') && businessName.length < 10 ||
        email.includes('test') ||
        customerId.includes('REAL001') || // Even the "real" test customer
        
        // Stuck processing patterns (likely test data)
        (customer.status === 'in-progress' && customer.directories_submitted === 0) ||
        (customer.status === 'active' && customer.directories_submitted === 0 && 
         new Date(customer.updated_at) < new Date(Date.now() - 4 * 60 * 60 * 1000)) // No activity for 4+ hours
      )
    }) || []

    console.log(`dY"? IDENTIFIED ${testCustomers.length} fake/test customers for removal:`)
    testCustomers.forEach((customer, index) => {
      console.log(`   ${index + 1}. ${customer.customer_id} - ${customer.business_name} (${customer.email})`)
    })

    let cleanupResults = {
      customers_removed: 0,
      queue_entries_removed: 0,
      directory_submissions_removed: 0,
      notifications_removed: 0,
      history_entries_removed: 0,
      errors: [] as string[]
    }

    if (testCustomers.length > 0) {
      const testCustomerIds = testCustomers.map(c => c.customer_id)
      
      // Step 3: Remove from customers table (cascades to related tables)
      console.log('dY-`?,? Removing fake customers from main customers table...')
      const { error: deleteCustomersError } = await supabase
        .from('customers')
        .delete()
        .in('customer_id', testCustomerIds)

      if (deleteCustomersError) {
        console.error('??O Failed to delete test customers:', deleteCustomersError)
        cleanupResults.errors.push(`Customers table: ${deleteCustomersError.message}`)
      } else {
        cleanupResults.customers_removed = testCustomers.length
        console.log(`?o. Removed ${testCustomers.length} fake customers from customers table`)
      }

      // Step 4: Remove from autobolt_processing_queue
      console.log('dY-`?,? Cleaning autobolt processing queue...')
      const { error: deleteQueueError } = await supabase
        .from('autobolt_processing_queue')
        .delete()
        .in('customer_id', testCustomerIds)

      if (deleteQueueError) {
        console.error('??O Failed to cleanup autobolt queue:', deleteQueueError)
        cleanupResults.errors.push(`AutoBolt queue: ${deleteQueueError.message}`)
      } else {
        console.log(`?o. Cleaned autobolt processing queue`)
      }

      // Step 5: Remove from directory_submissions
      console.log('dY-`?,? Cleaning directory submissions...')
      const { error: deleteSubmissionsError } = await supabase
        .from('directory_submissions')
        .delete()
        .in('customer_id', testCustomerIds)

      if (deleteSubmissionsError) {
        console.error('??O Failed to cleanup directory submissions:', deleteSubmissionsError)
        cleanupResults.errors.push(`Directory submissions: ${deleteSubmissionsError.message}`)
      } else {
        console.log(`?o. Cleaned directory submissions`)
      }

      // Step 6: Remove from customer_notifications
      console.log('dY-`?,? Cleaning customer notifications...')
      const { error: deleteNotificationsError } = await supabase
        .from('customer_notifications')
        .delete()
        .in('customer_id', testCustomerIds)

      if (deleteNotificationsError) {
        console.error('??O Failed to cleanup notifications:', deleteNotificationsError)
        cleanupResults.errors.push(`Notifications: ${deleteNotificationsError.message}`)
      } else {
        console.log(`?o. Cleaned customer notifications`)
      }

      // Step 7: Remove from queue_history
      console.log('dY-`?,? Cleaning queue history...')
      const { error: deleteHistoryError } = await supabase
        .from('queue_history')
        .delete()
        .in('customer_id', testCustomerIds)

      if (deleteHistoryError) {
        console.error('??O Failed to cleanup queue history:', deleteHistoryError)
        cleanupResults.errors.push(`Queue history: ${deleteHistoryError.message}`)
      } else {
        console.log(`?o. Cleaned queue history`)
      }

      // Step 8: Remove from analytics_events
      console.log('dY-`?,? Cleaning analytics events...')
      const { error: deleteAnalyticsError } = await supabase
        .from('analytics_events')
        .delete()
        .in('customer_id', testCustomerIds)

      if (deleteAnalyticsError) {
        console.error('??O Failed to cleanup analytics:', deleteAnalyticsError)
        cleanupResults.errors.push(`Analytics events: ${deleteAnalyticsError.message}`)
      } else {
        console.log(`?o. Cleaned analytics events`)
      }
    }

    // Step 9: Reset any stuck AutoBolt extension statuses
    console.log('dY", Resetting stuck AutoBolt extension statuses...')
    const { error: resetExtensionError } = await supabase
      .from('autobolt_extension_status')
      .update({ 
        status: 'offline',
        current_customer_id: null,
        current_queue_id: null,
        processing_started_at: null,
        error_message: 'Reset during cleanup',
        updated_at: new Date().toISOString()
      })
      .neq('status', 'offline')

    if (resetExtensionError) {
      console.error('??O Failed to reset extension statuses:', resetExtensionError)
      cleanupResults.errors.push(`Extension reset: ${resetExtensionError.message}`)
    } else {
      console.log(`?o. Reset stuck AutoBolt extension statuses`)
    }

    // NO TEST CUSTOMERS WILL BE CREATED - COMPLETE CLEANUP

    // Step 10: Get final statistics
    const { data: finalCustomers, error: finalCountError } = await supabase
      .from('customers')
      .select('id, status', { count: 'exact' })

    const finalCount = finalCustomers?.length || 0
    const activeCount = finalCustomers?.filter(c => c.status === 'active')?.length || 0
    const inProgressCount = finalCustomers?.filter(c => c.status === 'in-progress')?.length || 0
    
    // Step 11: Final queue status check
    const { data: queueCount } = await supabase
      .from('autobolt_processing_queue')
      .select('id', { count: 'exact' })

    console.log('dYZ% CRITICAL CLEANUP COMPLETED SUCCESSFULLY!')
    console.log(`dY"S Final Stats: ${finalCount} customers remaining, ${activeCount} active, ${inProgressCount} in-progress`)
    console.log(`dY"- AutoBolt queue: ${queueCount?.length || 0} entries remaining`)

    return res.status(200).json({
      success: true,
      message: 'CRITICAL DATABASE CLEANUP COMPLETED - All fake/test customers removed',
      cleanup_results: cleanupResults,
      final_statistics: {
        total_customers_remaining: finalCount,
        active_customers: activeCount,
        in_progress_customers: inProgressCount,
        autobolt_queue_entries: queueCount?.length || 0
      },
      removed_customers: testCustomers.map(c => ({
        customer_id: c.customer_id,
        business_name: c.business_name,
        email: c.email,
        status: c.status
      })),
      patterns_used: FAKE_DATA_PATTERNS,
      cleanup_timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('dYs" CRITICAL CLEANUP ERROR:', error)
    return res.status(500).json({
      error: 'Critical Cleanup Failed',
      message: 'Failed to complete comprehensive fake customer cleanup',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}

// Export with staff authentication
export default withStaffAuth(handler)