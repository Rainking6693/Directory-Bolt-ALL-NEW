// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

let debugModeState = {
  enabled: false,
  enabledAt: null,
  enabledBy: null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { enabled } = req.body

      debugModeState = {
        enabled: Boolean(enabled),
        enabledAt: enabled ? new Date().toISOString() : null,
        enabledBy: 'admin' // In a real app, this would be the authenticated user
      }

      // Store debug mode state in database
      await supabase.from('autobolt_system_config').upsert([{
        key: 'debug_mode',
        value: JSON.stringify(debugModeState),
        updated_at: new Date().toISOString()
      }])

      // Log the debug mode change
      await supabase.from('autobolt_activity_log').insert([{
        action: enabled ? 'Debug Mode Enabled' : 'Debug Mode Disabled',
        directory: null,
        customer_id: null,
        status: 'success',
        details: `Debug mode ${enabled ? 'activated' : 'deactivated'} by admin`,
        metadata: { debug_mode: debugModeState }
      }])

      res.status(200).json({
        success: true,
        debugMode: debugModeState
      })

    } catch (error) {
      console.error('Error toggling debug mode:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to toggle debug mode'
      })
    }
  } else if (req.method === 'GET') {
    try {
      // Fetch current debug mode state from database
      const { data } = await supabase
        .from('autobolt_system_config')
        .select('value')
        .eq('key', 'debug_mode')
        .single()

      if (data?.value) {
        debugModeState = JSON.parse(data.value)
      }

      res.status(200).json({
        success: true,
        debugMode: debugModeState
      })

    } catch (error) {
      console.error('Error fetching debug mode state:', error)
      res.status(200).json({
        success: true,
        debugMode: debugModeState // Return in-memory state as fallback
      })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}