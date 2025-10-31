import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      // This endpoint would typically receive screenshots from the Chrome extension
      const { screenshot, tabInfo, timestamp } = req.body

      if (!screenshot) {
        return res.status(400).json({
          success: false,
          error: 'Screenshot data is required'
        })
      }

      // Store screenshot metadata in database
      const { data: screenshotRecord } = await supabase
        .from('autobolt_screenshots')
        .insert([{
          tab_url: tabInfo?.url,
          tab_title: tabInfo?.title,
          captured_at: timestamp || new Date().toISOString(),
          screenshot_size: screenshot.length,
          metadata: tabInfo || {}
        }])
        .select()
        .single()

      // For demo purposes, we'll use a placeholder screenshot
      // In a real implementation, this would store the actual screenshot in a cloud storage service
      const placeholderScreenshot = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

      res.status(200).json({
        success: true,
        screenshot: screenshot || placeholderScreenshot,
        screenshotId: screenshotRecord?.id,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      console.error('Error capturing screenshot:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to capture screenshot'
      })
    }
  } else if (req.method === 'GET') {
    try {
      // Trigger screenshot capture from extension
      await supabase.from('autobolt_commands').insert([{
        command: 'capture_screenshot',
        parameters: { immediate: true },
        status: 'pending',
        created_at: new Date().toISOString()
      }])

      // Return a placeholder screenshot for immediate feedback
      // In a real implementation, this would wait for the extension to respond
      const placeholderScreenshot = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

      res.status(200).json({
        success: true,
        screenshot: placeholderScreenshot,
        message: 'Screenshot capture initiated',
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      console.error('Error initiating screenshot capture:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to initiate screenshot capture'
      })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}