// AutoBolt Extension - Get Next Customer API
// Returns the next customer in the processing queue for the AutoBolt extension

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

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🤖 AutoBolt extension requesting next customer')

    const { extension_id } = req.query

    if (!extension_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Extension ID is required'
      })
    }

    // Update extension status to online
    await updateExtensionStatus(extension_id as string, 'online')

    // Get the next customer in the queue (highest priority, oldest first)
    const { data: nextCustomer, error: queueError } = await supabase
      .from('autobolt_processing_queue')
      .select(`
        id,
        customer_id,
        business_name,
        email,
        package_type,
        directory_limit,
        priority_level,
        status,
        created_at,
        metadata
      `)
      .eq('status', 'queued')
      .order('priority_level', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (queueError || !nextCustomer) {
      console.log('📭 No customers in queue')
      return res.status(200).json({
        success: true,
        has_customer: false,
        message: 'No customers in processing queue'
      })
    }

    // Get customer details from customers table
    const { data: customerDetails, error: customerError } = await supabase
      .from('customers')
      .select(`
        id,
        customer_id,
        business_name,
        email,
        phone,
        website,
        address,
        city,
        state,
        zip,
        country,
        package_type,
        created_at
      `)
      .eq('customer_id', nextCustomer.customer_id)
      .single()

    if (customerError || !customerDetails) {
      console.error('❌ Customer details not found:', customerError)
      return res.status(404).json({
        error: 'Not Found',
        message: 'Customer details not found'
      })
    }

    // Update queue status to processing
    const { error: updateError } = await supabase
      .from('autobolt_processing_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', nextCustomer.id)

    if (updateError) {
      console.error('❌ Failed to update queue status:', updateError)
    }

    // Update extension status to processing
    await updateExtensionStatus(extension_id as string, 'processing', nextCustomer.customer_id, nextCustomer.id)

    // Create processing history record
    await createProcessingHistory(nextCustomer.id, nextCustomer.customer_id, nextCustomer.directory_limit)

    console.log(`✅ AutoBolt extension assigned customer: ${nextCustomer.customer_id}`)

    // Return customer data for AutoBolt processing
    res.status(200).json({
      success: true,
      has_customer: true,
      queue_id: nextCustomer.id,
      customer: {
        customer_id: nextCustomer.customer_id,
        business_name: nextCustomer.business_name,
        email: nextCustomer.email,
        phone: customerDetails.phone || '',
        website: customerDetails.website || '',
        address: customerDetails.address || '',
        city: customerDetails.city || '',
        state: customerDetails.state || '',
        zip: customerDetails.zip || '',
        country: customerDetails.country || 'USA',
        package_type: nextCustomer.package_type,
        directory_limit: nextCustomer.directory_limit,
        priority_level: nextCustomer.priority_level
      },
      processing_info: {
        estimated_directories: nextCustomer.directory_limit,
        priority: nextCustomer.priority_level,
        started_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ AutoBolt get next customer error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get next customer',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function updateExtensionStatus(extensionId: string, status: string, customerId?: string, queueId?: string) {
  try {
    const { error } = await supabase
      .from('autobolt_extension_status')
      .upsert({
        extension_id: extensionId,
        status: status,
        last_heartbeat: new Date().toISOString(),
        current_customer_id: customerId || null,
        current_queue_id: queueId || null,
        processing_started_at: status === 'processing' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('❌ Failed to update extension status:', error)
    }
  } catch (error) {
    console.error('❌ Extension status update error:', error)
  }
}

async function createProcessingHistory(queueId: string, customerId: string, totalDirectories: number) {
  try {
    const { error } = await supabase
      .from('autobolt_processing_history')
      .insert({
        queue_id: queueId,
        customer_id: customerId,
        session_started_at: new Date().toISOString(),
        total_directories: totalDirectories,
        status: 'in_progress'
      })

    if (error) {
      console.error('❌ Failed to create processing history:', error)
    }
  } catch (error) {
    console.error('❌ Processing history creation error:', error)
  }
}
