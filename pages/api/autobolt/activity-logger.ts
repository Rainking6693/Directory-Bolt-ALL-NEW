// @ts-nocheck
/**
 * AutoBolt Activity Logger API
 * 
 * POST /api/autobolt/activity-logger - Log activity from Chrome extension
 * GET /api/autobolt/activity-logger - Retrieve activity logs
 * 
 * Provides comprehensive logging for transparency and debugging
 * Captures screenshots, form data, errors, and timing information
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { withRateLimit, rateLimiters } from '../../../lib/middleware/production-rate-limit'
import formidable from 'formidable'
import { promises as fs } from 'fs'
import path from 'path'

// Initialize Supabase client with service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface ActivityLog {
  session_id: string
  customer_id: string
  job_id: string
  extension_id: string
  activity_type: 'navigation' | 'form_fill' | 'submission' | 'captcha' | 'verification' | 'error' | 'screenshot' | 'timing'
  directory_name: string
  timestamp: string
  details: {
    action: string
    url?: string
    element_selector?: string
    form_data?: Record<string, any>
    error_message?: string
    processing_time_ms?: number
    screenshot_metadata?: {
      width: number
      height: number
      device_pixel_ratio: number
      viewport: { width: number; height: number }
    }
    performance_metrics?: {
      dom_load_time: number
      network_requests: number
      memory_usage: number
      cpu_usage: number
    }
  }
  success: boolean
  screenshot_url?: string
  related_files?: string[]
  severity: 'info' | 'warning' | 'error' | 'critical'
}

interface LogResponse {
  success: boolean
  data?: {
    log_id: string
    screenshot_urls?: string[]
  }
  error?: string
}

interface LogsResponse {
  success: boolean
  data?: {
    logs: ActivityLog[]
    total_count: number
    has_more: boolean
  }
  error?: string
}

// Configure formidable for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LogResponse | LogsResponse>
) {
  try {
    // Authenticate using API key
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '')
    
    if (!apiKey || apiKey !== process.env.AUTOBOLT_API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Valid AUTOBOLT_API_KEY required.'
      })
    }

    switch (req.method) {
      case 'POST':
        return await handleLogActivity(req, res)
      case 'GET':
        return await handleGetLogs(req, res)
      default:
        res.setHeader('Allow', ['POST', 'GET'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed. Use POST or GET.'
        })
    }
  } catch (error) {
    console.error('AutoBolt Activity Logger API Error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    })
  }
}

async function handleLogActivity(
  req: NextApiRequest,
  res: NextApiResponse<LogResponse>
) {
  try {
    const form = formidable({
      uploadDir: path.join(process.cwd(), 'public/screenshots'),
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB max
    })

    const [fields, files] = await form.parse(req)
    
    // Parse the activity log data
    const logData = JSON.parse(fields.logData?.[0] || '{}') as Partial<ActivityLog>
    
    if (!logData.session_id || !logData.customer_id || !logData.activity_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: session_id, customer_id, activity_type'
      })
    }

    // Process uploaded screenshots
    const screenshotUrls: string[] = []
    if (files.screenshots) {
      const screenshots = Array.isArray(files.screenshots) ? files.screenshots : [files.screenshots]
      
      for (const screenshot of screenshots) {
        if (screenshot.filepath) {
          // Generate unique filename
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const filename = `${logData.session_id}-${timestamp}-${screenshot.originalFilename}`
          const publicPath = path.join(process.cwd(), 'public/screenshots', filename)
          
          // Move file to public directory
          await fs.rename(screenshot.filepath, publicPath)
          
          const screenshotUrl = `/screenshots/${filename}`
          screenshotUrls.push(screenshotUrl)
        }
      }
    }

    // Create the log entry
    const activityLog: Partial<ActivityLog> = {
      ...logData,
      timestamp: new Date().toISOString(),
      screenshot_url: screenshotUrls[0], // Primary screenshot
      related_files: screenshotUrls.slice(1), // Additional files
      severity: logData.severity || (logData.success === false ? 'error' : 'info')
    }

    // Insert into database
    const { data: insertedLog, error: insertError } = await supabase
      .from('autobolt_activity_logs')
      .insert([activityLog])
      .select('id')
      .single()

    if (insertError) {
      console.error('❌ Failed to insert activity log:', insertError)
      return res.status(500).json({
        success: false,
        error: 'Failed to save activity log'
      })
    }

    // Also log to submission_logs for backward compatibility
    if (['form_fill', 'submission', 'captcha', 'verification', 'error'].includes(logData.activity_type)) {
      await supabase
        .from('autobolt_submission_logs')
        .insert([{
          customer_id: logData.customer_id,
          job_id: logData.job_id,
          directory_name: logData.directory_name,
          action: logData.activity_type,
          timestamp: activityLog.timestamp,
          details: JSON.stringify(logData.details),
          screenshot_url: screenshotUrls[0],
          success: logData.success,
          processing_time_ms: logData.details?.processing_time_ms,
          error_message: logData.details?.error_message,
          form_data: logData.details?.form_data,
          response_data: null
        }])
    }

    // Update session tracking
    await updateSessionStatus(logData.session_id!, logData.activity_type, logData.success!)

    console.log(`✅ Logged ${logData.activity_type} activity for ${logData.directory_name}`)

    return res.status(200).json({
      success: true,
      data: {
        log_id: insertedLog.id,
        screenshot_urls: screenshotUrls
      }
    })

  } catch (error) {
    console.error('Failed to log activity:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to process activity log'
    })
  }
}

async function handleGetLogs(
  req: NextApiRequest,
  res: NextApiResponse<LogsResponse>
) {
  try {
    const {
      session_id,
      customer_id,
      activity_type,
      severity,
      since,
      limit = '100',
      offset = '0'
    } = req.query

    const limitNum = Math.min(parseInt(limit as string) || 100, 500)
    const offsetNum = parseInt(offset as string) || 0

    // Build query
    let query = supabase
      .from('autobolt_activity_logs')
      .select(`
        *,
        created_at
      `)
      .order('timestamp', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1)

    // Apply filters
    if (session_id) {
      query = query.eq('session_id', session_id)
    }

    if (customer_id) {
      query = query.eq('customer_id', customer_id)
    }

    if (activity_type) {
      query = query.eq('activity_type', activity_type)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    if (since) {
      const sinceDate = new Date(since as string)
      if (!isNaN(sinceDate.getTime())) {
        query = query.gte('timestamp', sinceDate.toISOString())
      }
    } else {
      // Default: logs from last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      query = query.gte('timestamp', yesterday.toISOString())
    }

    const { data: logs, error: logsError, count } = await query

    if (logsError) {
      console.error('❌ Failed to fetch activity logs:', logsError)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch activity logs'
      })
    }

    console.log(`✅ Retrieved ${logs?.length || 0} activity logs`)

    return res.status(200).json({
      success: true,
      data: {
        logs: logs || [],
        total_count: count || 0,
        has_more: (count || 0) > offsetNum + limitNum
      }
    })

  } catch (error) {
    console.error('Failed to get activity logs:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve activity logs'
    })
  }
}

async function updateSessionStatus(sessionId: string, activityType: string, success: boolean) {
  try {
    // Update extension session status
    const updateData: any = {
      last_activity: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Track activity counts
    if (activityType === 'submission' && success) {
      updateData.directories_processed = supabase.raw('directories_processed + 1')
    } else if (activityType === 'error' || !success) {
      updateData.directories_failed = supabase.raw('directories_failed + 1')
    }

    await supabase
      .from('autobolt_extension_sessions')
      .update(updateData)
      .eq('session_id', sessionId)

  } catch (error) {
    console.error('Failed to update session status:', error)
  }
}

export default withRateLimit(handler, rateLimiters.general)