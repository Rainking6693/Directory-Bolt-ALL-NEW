import type { NextApiRequest, NextApiResponse } from 'next'
import { withStaffAuth } from '../../../../lib/middleware/staff-auth'
import { createClient } from '@supabase/supabase-js'

interface DeleteCustomerResponse {
  success: boolean
  data?: { deleted_customer_id?: string }
  error?: string
}

async function handler(req: NextApiRequest, res: NextApiResponse<DeleteCustomerResponse>) {
  console.log('[staff.customers.delete] start', { method: req.method })
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', ['POST', 'DELETE'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { id, customer_id } = (req.body || {}) as { id?: string; customer_id?: string }
  console.log('[staff.customers.delete] payload', { id, customer_id })
  if (!id && !customer_id) {
    return res.status(400).json({ success: false, error: 'id or customer_id is required' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[staff.customers.delete] missing supabase env', { hasUrl: !!supabaseUrl, hasKey: !!serviceKey })
    return res.status(503).json({ success: false, error: 'Supabase not configured' })
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey)

    // Resolve internal UUID id and string customer_id from either provided id or customer_id
    let internalId: string | null = id || null
    let stringCustomerId: string | null = customer_id || null

    if (!internalId && customer_id) {
      console.log('[staff.customers.delete] resolving by customer_id')
      const { data: c, error } = await supabase
        .from('customers')
        .select('id, customer_id')
        .eq('customer_id', customer_id)
        .maybeSingle()
      if (error) {
        console.error('[staff.customers.delete] lookup error', error)
      }
      if (!c) {
        return res.status(404).json({ success: false, error: 'Customer not found' })
      }
      internalId = c.id
      stringCustomerId = c.customer_id
    } else if (internalId && !stringCustomerId) {
      // If we have internal ID but not string customer_id, fetch it
      console.log('[staff.customers.delete] resolving string customer_id from internal id')
      const { data: c, error } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('id', internalId)
        .maybeSingle()
      if (error) {
        console.error('[staff.customers.delete] lookup error', error)
      }
      if (c) {
        stringCustomerId = c.customer_id
      }
    }

    if (!internalId) {
      return res.status(404).json({ success: false, error: 'Customer not found' })
    }

    // Delete jobs using the string customer_id (not the UUID)
    if (stringCustomerId) {
      console.log('[staff.customers.delete] deleting jobs', { customerId: stringCustomerId })
      const { error: jobsErr } = await supabase.from('jobs').delete().eq('customer_id', stringCustomerId)
      if (jobsErr) {
        console.error('[staff.customers.delete] jobs delete error', jobsErr)
        // If table doesn't exist, continue with customer deletion
        if (jobsErr.message?.includes('relation "jobs" does not exist')) {
          console.log('[staff.customers.delete] Jobs table does not exist, skipping job deletion')
        } else {
          return res.status(500).json({ success: false, error: jobsErr.message })
        }
      }
    } else {
      console.log('[staff.customers.delete] No string customer_id found, skipping job deletion')
    }

    console.log('[staff.customers.delete] deleting customer', { customerId: internalId })
    const { error: delErr, count } = await supabase.from('customers').delete({ count: 'exact' }).eq('id', internalId)
    if (delErr) {
      console.error('[staff.customers.delete] customer delete error', delErr)
      // If table doesn't exist, return success since there's nothing to delete
      if (delErr.message?.includes('relation "customers" does not exist')) {
        console.log('[staff.customers.delete] Customers table does not exist')
        return res.status(200).json({ success: true, data: { deleted_customer_id: internalId } })
      }
      return res.status(500).json({ success: false, error: delErr.message })
    }

    console.log('[staff.customers.delete] success', { customerId: internalId, count })
    return res.status(200).json({ success: true, data: { deleted_customer_id: internalId } })
  } catch (e:any) {
    console.error('[staff.customers.delete] error', { message: e?.message, stack: e?.stack })
    return res.status(500).json({ success: false, error: e?.message || 'Internal server error' })
  }
}

export default withStaffAuth(handler)
