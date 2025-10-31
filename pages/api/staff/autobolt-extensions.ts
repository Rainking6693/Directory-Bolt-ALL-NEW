// Staff Dashboard - AutoBolt Extensions API
// Provides AutoBolt extension status data for staff monitoring

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🤖 Staff requesting AutoBolt extension status')

    // Get extension status
    const { data: extensions, error: extensionError } = await supabase
      .from('autobolt_extension_status')
      .select(`
        extension_id,
        status,
        last_heartbeat,
        current_customer_id,
        current_queue_id,
        directories_processed,
        directories_failed,
        error_message,
        created_at,
        updated_at
      `)
      .order('last_heartbeat', { ascending: false })

    if (extensionError) {
      console.error('❌ Failed to get extension status:', extensionError)
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to retrieve extension status',
        details: extensionError.message
      })
    }

    // Filter out extensions that haven't been seen in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const activeExtensions = extensions?.filter(ext => 
      new Date(ext.last_heartbeat) > fiveMinutesAgo
    ) || []

    console.log(`✅ Retrieved ${activeExtensions.length} active AutoBolt extensions`)

    res.status(200).json({
      success: true,
      data: activeExtensions,
      retrieved_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ AutoBolt extensions error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve AutoBolt extension status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
