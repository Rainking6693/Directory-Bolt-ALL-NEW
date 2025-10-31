// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

let watchModeState = {
  enabled: false,
  enabledAt: null,
  enabledBy: null,
  screenshotInterval: 3000 // 3 seconds
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { enabled, screenshotInterval } = req.body

      watchModeState = {
        enabled: Boolean(enabled),
        enabledAt: enabled ? new Date().toISOString() : null,
        enabledBy: 'admin',
        screenshotInterval: screenshotInterval || 3000
      }

      // Store watch mode state in database
      await supabase.from('autobolt_system_config').upsert([{
        key: 'watch_mode',
        value: JSON.stringify(watchModeState),
        updated_at: new Date().toISOString()
      }])

      // Send signal to extension to start/stop screenshot capture
      await supabase.from('autobolt_commands').insert([{
        command: enabled ? 'start_screenshot_capture' : 'stop_screenshot_capture',
        parameters: { interval: watchModeState.screenshotInterval },
        status: 'pending',
        created_at: new Date().toISOString()
      }])

      // Log the watch mode change
      await supabase.from('autobolt_activity_log').insert([{
        action: enabled ? 'Watch Mode Enabled' : 'Watch Mode Disabled',
        directory: null,
        customer_id: null,
        status: 'success',
        details: `Watch mode ${enabled ? 'activated' : 'deactivated'} by admin`,
        metadata: { watch_mode: watchModeState }
      }])

      res.status(200).json({
        success: true,
        watchMode: watchModeState
      })

    } catch (error) {
      console.error('Error toggling watch mode:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to toggle watch mode'
      })
    }
  } else if (req.method === 'GET') {
    try {
      // Fetch current watch mode state from database
      const { data } = await supabase
        .from('autobolt_system_config')
        .select('value')
        .eq('key', 'watch_mode')
        .single()

      if (data?.value) {
        watchModeState = JSON.parse(data.value)
      }

      res.status(200).json({
        success: true,
        watchMode: watchModeState
      })

    } catch (error) {
      console.error('Error fetching watch mode state:', error)
      res.status(200).json({
        success: true,
        watchMode: watchModeState // Return in-memory state as fallback
      })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}