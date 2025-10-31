// AutoBolt Extension - Heartbeat API
// Handles heartbeat signals from the AutoBolt Chrome extension

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { corsMiddleware } from '../../../lib/utils/cors'

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply CORS headers for Chrome extension support
  if (!corsMiddleware(req, res, { allowCredentials: true })) {
    return; // OPTIONS request handled
  }

  // Support both GET (for connection testing) and POST (for heartbeat updates)
  if (!['GET', 'POST'].includes(req.method!)) {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Authenticate using API key for extension requests
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '')
  
  if (req.method === 'GET') {
    // Simple connection test for extension
    if (!apiKey || apiKey !== process.env.AUTOBOLT_API_KEY) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - Invalid API key' 
      })
    }
    
    return res.status(200).json({
      success: true,
      message: 'AutoBolt API connection successful',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    })
  }

  try {
    console.log('💓 AutoBolt extension heartbeat received')

    // Validate API key for POST requests too
    if (!apiKey || apiKey !== process.env.AUTOBOLT_API_KEY) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Valid AUTOBOLT_API_KEY required' 
      })
    }

    const { 
      extension_id,
      status,
      current_customer_id,
      current_queue_id,
      directories_processed,
      directories_failed,
      error_message
    } = req.body

    if (!extension_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Extension ID is required'
      })
    }

    // Update extension status
    const updateData = {
      extension_id: extension_id,
      status: status || 'online',
      last_heartbeat: new Date().toISOString(),
      current_customer_id: current_customer_id || null,
      current_queue_id: current_queue_id || null,
      directories_processed: directories_processed || 0,
      directories_failed: directories_failed || 0,
      error_message: error_message || null,
      updated_at: new Date().toISOString()
    }

    // First, try to find existing extension status
    const { data: existingStatuses, error: findError } = await supabase
      .from('autobolt_extension_status')
      .select('id')
      .eq('extension_id', extension_id)
      .limit(1)

    const existingStatus = existingStatuses && existingStatuses.length > 0 ? existingStatuses[0] : null

    let updateError

    if (existingStatus) {
      // Update existing status
      const { error } = await supabase
        .from('autobolt_extension_status')
        .update(updateData)
        .eq('id', existingStatus.id)
      
      updateError = error
    } else {
      // Insert new status
      const { error } = await supabase
        .from('autobolt_extension_status')
        .insert(updateData)
      
      updateError = error
    }

    if (updateError) {
      console.error('❌ Failed to update extension heartbeat:', updateError)
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to update extension status'
      })
    }

    console.log(`✅ Heartbeat updated for extension: ${extension_id}`)

    res.status(200).json({
      success: true,
      message: 'Heartbeat received',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ AutoBolt heartbeat error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process heartbeat',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
