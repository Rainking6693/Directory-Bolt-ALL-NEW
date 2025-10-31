// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// In-memory storage for real-time activity data
let liveActivityStore = {
  currentActivities: [],
  screenshots: [],
  apiResponses: [],
  extensionStatus: 'unknown',
  lastScreenshot: null,
  activeTabs: [],
  processingErrors: []
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // Fetch recent activity from database
      const { data: recentActivities } = await supabase
        .from('autobolt_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      // Fetch recent API responses
      const { data: apiResponses } = await supabase
        .from('autobolt_api_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      // Fetch processing errors from last 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { data: errors } = await supabase
        .from('autobolt_error_log')
        .select('*')
        .gte('created_at', tenMinutesAgo)
        .order('created_at', { ascending: false })

      // Check extension status by looking for recent heartbeat
      const { data: extensionHeartbeat } = await supabase
        .from('autobolt_extension_status')
        .select('*')
        .order('last_seen', { ascending: false })
        .limit(1)

      const isExtensionActive = extensionHeartbeat?.[0] && 
        new Date(extensionHeartbeat[0].last_seen) > new Date(Date.now() - 30000) // 30 seconds

      // Get active tabs from extension
      const { data: activeTabs } = await supabase
        .from('autobolt_active_tabs')
        .select('*')
        .eq('is_active', true)

      // Merge with in-memory store
      const responseData = {
        currentActivities: recentActivities || [],
        screenshots: liveActivityStore.screenshots,
        apiResponses: apiResponses?.map(response => ({
          endpoint: response.endpoint,
          method: response.method,
          statusCode: response.status_code,
          duration: response.duration_ms,
          timestamp: response.created_at,
          error: response.error_message
        })) || [],
        extensionStatus: isExtensionActive ? 'active' : 'inactive',
        lastScreenshot: liveActivityStore.lastScreenshot,
        activeTabs: activeTabs?.map(tab => ({
          title: tab.title,
          url: tab.url,
          status: tab.processing_status
        })) || [],
        processingErrors: errors?.map(error => ({
          message: error.error_message,
          timestamp: error.created_at,
          stack: error.stack_trace,
          context: error.context
        })) || []
      }

      res.status(200).json({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      console.error('Error fetching live activity:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch live activity data'
      })
    }
  } else if (req.method === 'POST') {
    // Allow extension to post real-time updates
    try {
      const { type, data } = req.body

      switch (type) {
        case 'activity':
          // Store activity in database and memory
          await supabase.from('autobolt_activity_log').insert([{
            action: data.action,
            directory: data.directory,
            customer_id: data.customer,
            status: data.status,
            details: data.details,
            metadata: data.metadata || {}
          }])
          
          liveActivityStore.currentActivities.unshift(data)
          if (liveActivityStore.currentActivities.length > 50) {
            liveActivityStore.currentActivities = liveActivityStore.currentActivities.slice(0, 50)
          }
          break

        case 'screenshot':
          liveActivityStore.lastScreenshot = data.screenshot
          liveActivityStore.screenshots.unshift(data.screenshot)
          if (liveActivityStore.screenshots.length > 10) {
            liveActivityStore.screenshots = liveActivityStore.screenshots.slice(0, 10)
          }
          break

        case 'api_response':
          await supabase.from('autobolt_api_log').insert([{
            endpoint: data.endpoint,
            method: data.method,
            status_code: data.statusCode,
            duration_ms: data.duration,
            error_message: data.error
          }])
          break

        case 'error':
          await supabase.from('autobolt_error_log').insert([{
            error_message: data.message,
            stack_trace: data.stack,
            context: data.context || {}
          }])
          break

        case 'heartbeat':
          await supabase.from('autobolt_extension_status').upsert([{
            extension_id: data.extensionId || 'main',
            status: 'active',
            last_seen: new Date().toISOString(),
            version: data.version
          }])
          break

        case 'tab_update':
          await supabase.from('autobolt_active_tabs').upsert([{
            tab_id: data.tabId,
            title: data.title,
            url: data.url,
            processing_status: data.status,
            is_active: true,
            last_updated: new Date().toISOString()
          }])
          break
      }

      res.status(200).json({ success: true })

    } catch (error) {
      console.error('Error processing live activity update:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to process activity update'
      })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}