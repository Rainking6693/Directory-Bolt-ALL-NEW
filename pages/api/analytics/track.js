import { NextApiRequest, NextApiResponse } from 'next'

// Simple analytics tracking endpoint
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { event, data, session_id } = req.body

    // Basic validation
    if (!event || typeof event !== 'string') {
      return res.status(400).json({ error: 'Invalid event name' })
    }

    // Prepare analytics payload
    const analyticsData = {
      event,
      data: data || {},
      session_id,
      timestamp: new Date().toISOString(),
      ip_address: getClientIP(req),
      user_agent: req.headers['user-agent'],
      referer: req.headers.referer
    }

    // In a production environment, you would:
    // 1. Store in your analytics database
    // 2. Send to external analytics services
    // 3. Queue for batch processing
    
    // For now, just log to console
    console.log('Analytics Event:', JSON.stringify(analyticsData, null, 2))

    // Optional: Send to external services
    await Promise.allSettled([
      sendToGoogleAnalytics(analyticsData),
      sendToCustomAnalytics(analyticsData)
    ])

    res.status(200).json({ success: true })
    
  } catch (error) {
    console.error('Analytics tracking error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

function getClientIP(req) {
  const xForwardedFor = req.headers['x-forwarded-for']
  const xRealIP = req.headers['x-real-ip']
  const connectionRemoteAddress = req.connection?.remoteAddress
  const socketRemoteAddress = req.socket?.remoteAddress
  const connectionSocketRemoteAddress = req.connection?.socket?.remoteAddress

  const ip = xForwardedFor?.split(',')[0] ||
             xRealIP ||
             connectionRemoteAddress ||
             socketRemoteAddress ||
             connectionSocketRemoteAddress ||
             '0.0.0.0'

  return ip.trim()
}

async function sendToGoogleAnalytics(data) {
  // Measurement Protocol for GA4
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const GA_API_SECRET = process.env.GA_API_SECRET

  if (!GA_MEASUREMENT_ID || !GA_API_SECRET) {
    return
  }

  try {
    const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: data.session_id,
        events: [{
          name: data.event,
          params: {
            ...data.data,
            engagement_time_msec: 1
          }
        }]
      })
    })

    if (!response.ok) {
      console.warn('GA4 tracking failed:', response.statusText)
    }
  } catch (error) {
    console.warn('GA4 tracking error:', error.message)
  }
}

async function sendToCustomAnalytics(data) {
  // Example: Send to your own analytics service
  // This could be a database insert, webhook, or external service
  
  if (process.env.CUSTOM_ANALYTICS_ENDPOINT) {
    try {
      await fetch(process.env.CUSTOM_ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CUSTOM_ANALYTICS_TOKEN}`
        },
        body: JSON.stringify(data)
      })
    } catch (error) {
      console.warn('Custom analytics error:', error.message)
    }
  }
}