// WebSocket Dashboard Updates API
// Provides real-time updates for staff dashboard using Server-Sent Events (SSE)

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { withStaffAuth } from '../../../lib/middleware/staff-auth'

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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🔄 Starting real-time dashboard updates stream')

    // Set up Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ 
      type: 'connection', 
      message: 'Dashboard updates connected',
      timestamp: new Date().toISOString()
    })}\n\n`)

    // Function to send real-time analytics data
    const sendAnalyticsUpdate = async () => {
      try {
        // Get current customer statistics
        const { data: customers, error: customerError } = await supabase
          .from('customers')
          .select(`
            id,
            customer_id,
            business_name,
            package_type,
            directories_submitted,
            failed_directories,
            created_at,
            updated_at
          `)

        if (customerError) {
          console.error('❌ Failed to get customers for real-time update:', customerError)
          return
        }

        // Get queue statistics
        const { data: queueData, error: queueError } = await supabase
          .from('autobolt_processing_queue')
          .select('status, priority_level, created_at')
          .order('created_at', { ascending: false })

        if (queueError) {
          console.error('❌ Failed to get queue data for real-time update:', queueError)
          return
        }

        // Calculate real-time analytics
        const analytics = calculateRealTimeAnalytics(customers || [], queueData || [])

        // Send update via SSE
        res.write(`data: ${JSON.stringify({
          type: 'analytics_update',
          data: analytics,
          timestamp: new Date().toISOString()
        })}\n\n`)

        console.log('📊 Sent real-time analytics update')

      } catch (error) {
        console.error('❌ Error sending analytics update:', error)
      }
    }

    // Send initial analytics data
    await sendAnalyticsUpdate()

    // Set up interval for regular updates (every 10 seconds)
    const updateInterval = setInterval(sendAnalyticsUpdate, 10000)

    // Set up Supabase real-time subscription for instant updates
    const customerSubscription = supabase
      .channel('customers_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'customers' 
        }, 
        async (payload) => {
          console.log('🔄 Customer data changed, sending update')
          await sendAnalyticsUpdate()
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'autobolt_processing_queue' 
        }, 
        async (payload) => {
          console.log('🔄 Queue data changed, sending update')
          await sendAnalyticsUpdate()
        }
      )
      .subscribe()

    // Handle client disconnect
    req.on('close', () => {
      console.log('🔌 Dashboard updates client disconnected')
      clearInterval(updateInterval)
      customerSubscription.unsubscribe()
    })

    req.on('error', (error) => {
      console.error('❌ Dashboard updates connection error:', error)
      clearInterval(updateInterval)
      customerSubscription.unsubscribe()
    })

  } catch (error) {
    console.error('❌ Dashboard updates error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to establish real-time connection'
    })
  }
}

function calculateRealTimeAnalytics(customers: any[], queueData: any[]) {
  const now = new Date()
  
  // Basic customer statistics
  const totalCustomers = customers.length
  const activeCustomers = totalCustomers
  const completedCustomers = 0
  const pendingCustomers = 0

  // Queue statistics
  const queuedJobs = queueData.filter(q => q.status === 'queued').length
  const processingJobs = queueData.filter(q => q.status === 'processing').length
  const completedJobs = queueData.filter(q => q.status === 'completed').length

  // Package type breakdown
  const packageBreakdown = customers.reduce((acc, customer) => {
    const packageType = customer.package_type || 'unknown'
    acc[packageType] = (acc[packageType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Recent activity (customers updated in last hour)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const recentActivity = customers.filter(customer => {
    const updatedAt = new Date(customer.updated_at)
    return updatedAt > oneHourAgo
  }).length

  // Directory statistics
  const totalDirectoriesSubmitted = customers.reduce((sum, c) => sum + (c.directories_submitted || 0), 0)
  const totalDirectoriesFailed = customers.reduce((sum, c) => sum + (c.failed_directories || 0), 0)

  return {
    overview: {
      total_customers: totalCustomers,
      active_customers: activeCustomers,
      completed_customers: completedCustomers,
      pending_customers: pendingCustomers,
      recent_activity: recentActivity
    },
    queue: {
      queued_jobs: queuedJobs,
      processing_jobs: processingJobs,
      completed_jobs: completedJobs,
      total_in_queue: queuedJobs + processingJobs
    },
    package_breakdown: packageBreakdown,
    directory_stats: {
      total_submitted: totalDirectoriesSubmitted,
      total_failed: totalDirectoriesFailed,
      success_rate: totalDirectoriesSubmitted > 0 
        ? Math.round(((totalDirectoriesSubmitted - totalDirectoriesFailed) / totalDirectoriesSubmitted) * 10000) / 100
        : 100
    },
    timestamp: now.toISOString()
  }
}

// Export with staff authentication
export default withStaffAuth(handler)